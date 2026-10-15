import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { API_BASE, apiFetch, isLive } from "../utils/backend";

/**
 * Live voice chat between signed-in learners.
 *
 * Audio flows directly between browsers over WebRTC; every person in a room connects to every
 * other person (a "mesh", good for up to ~6 people). The server (server/src/services/voice.ts)
 * only relays the set-up messages over Socket.IO: who is online, rooms, invitations, and the
 * WebRTC offer/answer/ICE candidates. Whoever joins a room sends the offers (the "offerer"), so
 * two browsers never offer to each other at the same time; the offerer also restarts ICE when
 * a connection drops or fails. When the Socket.IO connection itself drops, the call carries on
 * (audio does not go through the server) and the page takes its place back on reconnect.
 */

export interface OnlineUser {
  id: string;
  name: string;
  initials: string;
  busy: boolean;
}

export interface RoomSummary {
  id: string;
  name: string;
  kind: "team" | "direct";
  isPrivate: boolean;
  owner: { id: string; name: string; initials: string };
  count: number;
  max: number;
  answeredAt?: string | null;
  members: { id: string; name: string; initials: string }[];
}

export type PeerState = "connecting" | "connected" | "reconnecting" | "failed";

export interface Peer {
  socketId: string;
  id: string;
  name: string;
  initials: string;
  muted: boolean;
  state: PeerState;
  /** Their connection to the server dropped; they are expected back. */
  away: boolean;
  stream: MediaStream | null;
}

export interface Invite {
  room: RoomSummary;
  from: { id: string; name: string; initials: string };
  /** The caller knows we are already on a call. */
  busy?: boolean;
}

/**
 * idle: no call. ringing: our one-to-one call hasn't been answered yet. waiting: alone in a team
 * room. connecting: someone is there and audio is being set up. connected: talking.
 * reconnecting: the connection dropped and is being restored.
 */
export type CallState = "idle" | "ringing" | "waiting" | "connecting" | "connected" | "reconnecting";

export interface EndedCall {
  title: string;
  seconds: number;
  reason: string;
}

type Status = "unavailable" | "connecting" | "online" | "offline";
type PeerDto = Omit<Peer, "state" | "stream" | "away"> & { reconnecting?: boolean };
type JoinResult =
  | { ok: true; room: RoomSummary; peers: PeerDto[]; selfSocketId: string; callee?: { name: string }; busy?: boolean }
  | { ok: false; message: string; code?: string; redirect?: string };
type Signal = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; restart?: boolean };
interface Conn {
  pc: RTCPeerConnection;
  queued: RTCIceCandidateInit[];
  /** We sent the first offer, so we also lead ICE restarts. */
  offerer: boolean;
  restarts: number;
  timers: ReturnType<typeof setTimeout>[];
}

/** Gives up on a connection that never came up after this long (after one ICE restart). */
const CONNECT_TIMEOUT_MS = 20_000;
/** A "disconnected" connection often recovers by itself; restart ICE if it hasn't after this. */
const DISCONNECTED_GRACE_MS = 4_000;
const MAX_RESTARTS = 3;
/** How long to wait for the voice server to come back before ending the call on this side. */
const RESUME_WAIT_MS = 30_000;

function socketTarget() {
  // API_BASE is "/api" (same site) or a full URL such as "https://api.example.com/api".
  if (/^https?:\/\//.test(API_BASE)) {
    const u = new URL(API_BASE);
    return { url: u.origin, path: `${u.pathname.replace(/\/$/, "")}/socket.io` };
  }
  return { url: window.location.origin, path: `${API_BASE}/socket.io` };
}

const toPeer = (p: PeerDto): Peer => ({ ...p, state: "connecting", away: Boolean(p.reconnecting), stream: null });

export function useVoiceChat(token: string | null) {
  const [status, setStatus] = useState<Status>(isLive ? "connecting" : "unavailable");
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [muted, setMuted] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [selfSocketId, setSelfSocketId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [lastCall, setLastCall] = useState<EndedCall | null>(null);
  const [limit, setLimit] = useState<{ message: string; redirect: string } | null>(null);
  const [calleeBusy, setCalleeBusy] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const iceRef = useRef<RTCIceServer[]>([{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }]);
  const iceReady = useRef<Promise<void>>(Promise.resolve());
  const localStream = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, Conn>());
  const roomRef = useRef<RoomSummary | null>(null);
  const peersRef = useRef<Peer[]>([]);
  const selfRef = useRef<string | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  roomRef.current = room;
  peersRef.current = peers;
  selfRef.current = selfSocketId;
  connectedAtRef.current = connectedAt;

  const updatePeer = useCallback((socketId: string, patch: Partial<Peer>) => {
    setPeers((list) => list.map((p) => (p.socketId === socketId ? { ...p, ...patch } : p)));
  }, []);

  const closeConn = (c: Conn | undefined) => {
    if (!c) return;
    c.timers.forEach(clearTimeout);
    c.pc.onconnectionstatechange = null;
    c.pc.oniceconnectionstatechange = null;
    c.pc.close();
  };

  const closePeer = useCallback((socketId: string) => {
    closeConn(pcs.current.get(socketId));
    pcs.current.delete(socketId);
    setPeers((list) => list.filter((p) => p.socketId !== socketId));
  }, []);

  /** Ends the call on this side: closes every connection and releases the microphone. */
  const teardown = useCallback((reason?: string) => {
    const r = roomRef.current;
    if (r && reason !== undefined) {
      const names = peersRef.current.map((p) => p.name);
      const started = connectedAtRef.current;
      setLastCall({
        title: r.kind === "direct" ? names[0] ?? r.name.split(" & ").find((n) => n) ?? r.name : r.name,
        seconds: started ? Math.round((Date.now() - started) / 1000) : 0,
        reason,
      });
    }
    for (const c of pcs.current.values()) closeConn(c);
    pcs.current.clear();
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
    setPeers([]);
    setRoom(null);
    setMuted(false);
    setConnectedAt(null);
    setCalleeBusy(false);
  }, []);

  const sendSignal = (to: string, data: Signal) => socketRef.current?.emit("signal", { to, data });

  /** Starts (or restarts) ICE from the offerer's side; the other side asks the offerer to. */
  const restartIce = useCallback(async (socketId: string) => {
    const c = pcs.current.get(socketId);
    if (!c) return;
    if (!c.offerer) {
      sendSignal(socketId, { restart: true });
      return;
    }
    if (c.restarts >= MAX_RESTARTS) return;
    c.restarts++;
    try {
      const offer = await c.pc.createOffer({ iceRestart: true });
      await c.pc.setLocalDescription(offer);
      sendSignal(socketId, { description: c.pc.localDescription!.toJSON() });
    } catch {
      /* the next state change tries again */
    }
  }, []);

  const createPeerConnection = useCallback(
    (socketId: string, offerer: boolean) => {
      closeConn(pcs.current.get(socketId));
      const pc = new RTCPeerConnection({ iceServers: iceRef.current });
      const c: Conn = { pc, queued: [], offerer, restarts: 0, timers: [] };
      pcs.current.set(socketId, c);
      localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(socketId, { candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => updatePeer(socketId, { stream: e.streams[0] ?? new MediaStream([e.track]) });

      let downTimer: ReturnType<typeof setTimeout> | null = null;
      const onState = () => {
        if (pcs.current.get(socketId) !== c) return;
        // Safari before 16 has no connectionState; the ICE state says the same thing.
        const s = pc.connectionState ?? pc.iceConnectionState;
        const ice = pc.iceConnectionState;
        if (s === "connected" || ice === "connected" || ice === "completed") {
          if (downTimer) clearTimeout(downTimer);
          downTimer = null;
          c.restarts = 0;
          updatePeer(socketId, { state: "connected" });
          setConnectedAt((t) => t ?? Date.now());
        } else if (s === "disconnected" || ice === "disconnected") {
          updatePeer(socketId, { state: "reconnecting" });
          if (!downTimer) {
            downTimer = setTimeout(() => {
              downTimer = null;
              if (pc.iceConnectionState === "disconnected" || pc.connectionState === "disconnected") restartIce(socketId);
            }, DISCONNECTED_GRACE_MS);
          }
        } else if (s === "failed" || ice === "failed") {
          if (c.restarts < MAX_RESTARTS) {
            updatePeer(socketId, { state: "reconnecting" });
            restartIce(socketId);
          } else {
            updatePeer(socketId, { state: "failed" });
          }
        }
      };
      pc.onconnectionstatechange = onState;
      pc.oniceconnectionstatechange = onState;
      // Never sit on "Connecting…" for ever: restart once, then show "Can't connect" with a retry.
      c.timers.push(
        setTimeout(() => {
          if (pc.iceConnectionState !== "connected" && pc.iceConnectionState !== "completed") restartIce(socketId);
        }, CONNECT_TIMEOUT_MS),
        setTimeout(() => {
          if (pcs.current.get(socketId) === c && pc.iceConnectionState !== "connected" && pc.iceConnectionState !== "completed") {
            updatePeer(socketId, { state: "failed" });
          }
        }, CONNECT_TIMEOUT_MS * 2),
      );
      return c;
    },
    [restartIce, updatePeer],
  );

  const flushCandidates = async (c: Conn) => {
    for (const cand of c.queued.splice(0)) await c.pc.addIceCandidate(cand).catch(() => undefined);
  };

  const getMic = async () => {
    if (localStream.current) return localStream.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser can't use the microphone here. Open the site over https:// in Chrome, Edge, Firefox or Safari.");
    }
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      return localStream.current;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      throw new Error(
        name === "NotAllowedError"
          ? "Microphone access was blocked. Allow the microphone for this site in your browser, then try again."
          : name === "NotFoundError"
            ? "No microphone was found. Plug in a headset or microphone and try again."
            : name === "NotReadableError"
              ? "Your microphone is being used by another app. Close it and try again."
              : "Could not start your microphone.",
      );
    }
  };

  const offerTo = useCallback(
    async (socketId: string) => {
      const c = createPeerConnection(socketId, true);
      const offer = await c.pc.createOffer();
      await c.pc.setLocalDescription(offer);
      sendSignal(socketId, { description: c.pc.localDescription!.toJSON() });
    },
    [createPeerConnection],
  );

  /** Runs after the server put us in a room: connect to everyone already there. */
  const enterRoom = useCallback(
    async (res: JoinResult) => {
      if (!res.ok) {
        teardown();
        if (res.code === "limit") setLimit({ message: res.message, redirect: res.redirect ?? "/learn/billing#plans" });
        setNotice({ tone: "error", text: res.message });
        return false;
      }
      await iceReady.current;
      setLastCall(null);
      setRoom(res.room);
      setSelfSocketId(res.selfSocketId);
      setPeers(res.peers.map(toPeer));
      for (const p of res.peers) await offerTo(p.socketId);
      return true;
    },
    [offerTo, teardown],
  );

  // Connect to the signaling server while the page is open.
  useEffect(() => {
    if (!isLive || !token) return;
    let cancelled = false;
    iceReady.current = apiFetch<{ iceServers: RTCIceServer[] }>("/voice/config", { token })
      .then((cfg) => {
        if (!cancelled && cfg.iceServers?.length) iceRef.current = cfg.iceServers;
      })
      .catch(() => undefined);

    let socket: Socket | null = null;
    // The Socket.IO client is only downloaded for signed-in learners.
    import("socket.io-client").then(({ io }) => {
      if (cancelled) return;
      const { url, path } = socketTarget();
      socket = io(url, { path, auth: { token }, transports: ["websocket", "polling"], reconnectionDelayMax: 4000 });
      socketRef.current = socket;
      listen(socket);
    });

    /** Back online during a call: take our place in it again and repair the audio. */
    async function resume(socket: Socket) {
      const r = roomRef.current;
      const previousSocketId = selfRef.current;
      if (!r || !previousSocketId || previousSocketId === socket.id) return;
      const res = (await socket.timeout(10_000).emitWithAck("room:resume", { roomId: r.id, previousSocketId }).catch(() => null)) as JoinResult | null;
      if (!res?.ok) {
        teardown(res && !res.ok ? res.message : "Connection lost. The call ended.");
        setNotice({ tone: "error", text: res && !res.ok ? res.message : "Connection lost. The call ended." });
        return;
      }
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
      setSelfSocketId(res.selfSocketId);
      setRoom(res.room);
      // People may have changed connection (new ids), left or joined while we were away.
      const known = new Map(peersRef.current.map((p) => [p.id, p]));
      const next: Peer[] = [];
      for (const p of res.peers) {
        const old = known.get(p.id);
        known.delete(p.id);
        if (old && old.socketId !== p.socketId) {
          const c = pcs.current.get(old.socketId);
          pcs.current.delete(old.socketId);
          if (c) pcs.current.set(p.socketId, c);
        }
        next.push(old ? { ...old, socketId: p.socketId, muted: p.muted, away: Boolean(p.reconnecting) } : toPeer(p));
        if (!pcs.current.has(p.socketId)) await offerTo(p.socketId);
      }
      for (const gone of known.values()) {
        closeConn(pcs.current.get(gone.socketId));
        pcs.current.delete(gone.socketId);
      }
      setPeers(next);
      for (const [id, c] of pcs.current) {
        if (c.pc.iceConnectionState !== "connected" && c.pc.iceConnectionState !== "completed") restartIce(id);
      }
    }

    function listen(socket: Socket) {
      socket.on("connect", () => {
        setStatus("online");
        resume(socket);
      });
      socket.on("disconnect", () => {
        setStatus("offline");
        // Audio goes browser to browser, so the call can carry on while we reconnect.
        if (roomRef.current && !resumeTimer.current) {
          resumeTimer.current = setTimeout(() => {
            resumeTimer.current = null;
            if (!roomRef.current) return;
            teardown("Connection lost. The call ended.");
            setNotice({ tone: "error", text: "Connection lost. The call ended." });
          }, RESUME_WAIT_MS);
        }
      });
      socket.on("connect_error", (err) => {
        setStatus("offline");
        if (err.message === "unauthorized") setNotice({ tone: "error", text: "Your session ended. Please log in again." });
      });
      socket.on("presence", (list: OnlineUser[]) => setUsers(list));
      socket.on("rooms", (list: RoomSummary[]) => setRooms(list));
      socket.on("invite", (inv: Invite) => setInvites((all) => [...all.filter((i) => i.room.id !== inv.room.id), inv]));
      socket.on("invite:cancelled", ({ roomId }: { roomId: string }) => setInvites((all) => all.filter((i) => i.room.id !== roomId)));
      socket.on("invite:declined", ({ user }: { user: { name: string } }) => setNotice({ tone: "info", text: `${user.name} can't join right now.` }));
      socket.on("room:ended", ({ reason }: { reason: string }) => {
        teardown(reason);
        setNotice({ tone: "info", text: reason });
      });
      socket.on("room:updated", (r: RoomSummary) => setRoom((cur) => (cur && cur.id === r.id ? r : cur)));
      // Merged into someone else's call: drop our connections and join theirs.
      socket.on("room:moved", async (res: JoinResult) => {
        for (const c of pcs.current.values()) closeConn(c);
        pcs.current.clear();
        setConnectedAt(null);
        setCalleeBusy(false);
        await enterRoom(res);
      });
      socket.on("limit:reached", ({ message, redirect }: { message: string; redirect: string }) => {
        teardown(message);
        setLimit({ message, redirect });
        setNotice({ tone: "error", text: message });
      });
      socket.on("peer:joined", (p: PeerDto) => {
        setCalleeBusy(false);
        setPeers((list) => [...list.filter((x) => x.socketId !== p.socketId), toPeer(p)]);
        setRoom((r) => (r ? { ...r, count: r.count + 1 } : r));
      });
      socket.on("peer:left", ({ socketId }: { socketId: string }) => {
        closePeer(socketId);
        setRoom((r) => (r ? { ...r, count: Math.max(1, r.count - 1) } : r));
      });
      socket.on("peer:reconnecting", ({ socketId }: { socketId: string }) => updatePeer(socketId, { away: true }));
      socket.on("peer:resumed", ({ from, to }: { from: string; to: string }) => {
        const c = pcs.current.get(from);
        pcs.current.delete(from);
        if (c) pcs.current.set(to, c);
        setPeers((list) => list.map((p) => (p.socketId === from ? { ...p, socketId: to, away: false } : p)));
        if (c && c.pc.iceConnectionState !== "connected" && c.pc.iceConnectionState !== "completed") restartIce(to);
      });
      socket.on("peer:muted", ({ socketId, muted: m }: { socketId: string; muted: boolean }) => updatePeer(socketId, { muted: m }));
      socket.on("signal", async ({ from, data }: { from: string; data: Signal }) => {
        try {
          if (data.restart) {
            if (pcs.current.get(from)?.offerer) await restartIce(from);
          } else if (data.description) {
            await iceReady.current;
            const c = data.description.type === "offer" && !pcs.current.has(from) ? createPeerConnection(from, false) : pcs.current.get(from);
            if (!c) return;
            await c.pc.setRemoteDescription(data.description);
            await flushCandidates(c);
            if (data.description.type === "offer") {
              await c.pc.setLocalDescription(await c.pc.createAnswer());
              sendSignal(from, { description: c.pc.localDescription!.toJSON() });
            }
          } else if (data.candidate) {
            const c = pcs.current.get(from);
            if (!c) return;
            if (c.pc.remoteDescription) await c.pc.addIceCandidate(data.candidate).catch(() => undefined);
            else c.queued.push(data.candidate);
          }
        } catch {
          updatePeer(from, { state: "failed" });
        }
      });
    }

    return () => {
      cancelled = true;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
      teardown();
    };
  }, [token, createPeerConnection, closePeer, enterRoom, offerTo, restartIce, teardown, updatePeer]);

  /** Gets the microphone, then asks the server to put us in a room. */
  const withMic = useCallback(
    async (event: string, payload: unknown) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        setNotice({ tone: "error", text: "Not connected to the voice server. Check your internet and reload the page." });
        return null;
      }
      setJoining(true);
      setNotice(null);
      setLimit(null);
      let joined = false;
      try {
        await getMic();
        // Leaving the current call first keeps us in one room at a time.
        for (const id of [...pcs.current.keys()]) closePeer(id);
        setConnectedAt(null);
        const res = (await socket.timeout(10_000).emitWithAck(event, payload)) as JoinResult;
        joined = res.ok;
        return (await enterRoom(res)) ? res : null;
      } catch (e) {
        // The server may have put us in the room before something failed here: leave it, so
        // nobody sees us as "on a call" that this page doesn't show.
        if (joined) socket.emit("room:leave", {});
        teardown();
        setNotice({
          tone: "error",
          text: e instanceof Error && !/timed out|operation has timed out/i.test(e.message) ? e.message : "The voice server didn't answer. Please try again.",
        });
        return null;
      } finally {
        setJoining(false);
      }
    },
    [closePeer, enterRoom, teardown],
  );

  const createRoom = useCallback(async (name: string, isPrivate: boolean) => Boolean(await withMic("room:create", { name, isPrivate })), [withMic]);
  const joinRoom = useCallback(async (roomId: string) => Boolean(await withMic("room:join", { roomId })), [withMic]);

  const callUser = useCallback(
    async (user: OnlineUser) => {
      const res = await withMic("call:user", { userId: user.id });
      if (res?.ok) setCalleeBusy(Boolean(res.busy));
    },
    [withMic],
  );

  const inviteUser = useCallback(async (user: OnlineUser) => {
    const res = (await socketRef.current
      ?.timeout(10_000)
      .emitWithAck("room:invite", { userId: user.id })
      .catch(() => null)) as { ok: boolean; message?: string } | null;
    setNotice(
      res?.ok
        ? { tone: "info", text: `Invitation sent to ${user.name}.` }
        : { tone: "error", text: res?.message || "Could not send the invitation." },
    );
  }, []);

  /** Answers (or joins). When already on a call, that call ends first. */
  const acceptInvite = useCallback(
    async (inv: Invite) => {
      setInvites((all) => all.filter((i) => i.room.id !== inv.room.id));
      if (roomRef.current) teardown(`You switched to ${inv.from.name}.`);
      await joinRoom(inv.room.id);
    },
    [joinRoom, teardown],
  );

  /** On a call and someone else rings: bring them into this call as a group call. */
  const mergeInvite = useCallback(async (inv: Invite) => {
    setInvites((all) => all.filter((i) => i.room.id !== inv.room.id));
    const res = (await socketRef.current
      ?.timeout(10_000)
      .emitWithAck("call:merge", { roomId: inv.room.id })
      .catch(() => null)) as { ok: boolean; message?: string } | null;
    if (!res?.ok) setNotice({ tone: "error", text: res?.message || "Could not merge the calls." });
  }, []);

  const declineInvite = useCallback((inv: Invite) => {
    setInvites((all) => all.filter((i) => i.room.id !== inv.room.id));
    socketRef.current?.emit("invite:decline", { roomId: inv.room.id });
  }, []);

  const leave = useCallback(() => {
    socketRef.current?.emit("room:leave", {});
    teardown(roomRef.current?.kind === "direct" && !connectedAtRef.current && peersRef.current.length === 0 ? "Call cancelled." : "You left the call.");
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
    socketRef.current?.emit("mute", { muted: next });
  }, [muted]);

  /** "Can't connect" → try again: a fresh ICE round with that person. */
  const retryPeer = useCallback(
    (socketId: string) => {
      const c = pcs.current.get(socketId);
      if (!c) return;
      c.restarts = 0;
      updatePeer(socketId, { state: "connecting" });
      restartIce(socketId);
    },
    [restartIce, updatePeer],
  );

  const callState: CallState = useMemo(() => {
    if (!room) return "idle";
    if (status === "offline") return "reconnecting";
    if (peers.length === 0) return room.kind === "direct" ? "ringing" : "waiting";
    if (peers.some((p) => p.state === "connected")) return "connected";
    if (peers.some((p) => p.state === "reconnecting" || p.away)) return "reconnecting";
    return "connecting";
  }, [room, status, peers]);

  return {
    status,
    users,
    rooms,
    room,
    peers,
    muted,
    invites,
    notice,
    joining,
    selfSocketId,
    callState,
    connectedAt,
    calleeBusy,
    lastCall,
    limit,
    clearLastCall: () => setLastCall(null),
    clearLimit: () => setLimit(null),
    clearNotice: () => setNotice(null),
    localStream: localStream.current,
    createRoom,
    joinRoom,
    callUser,
    inviteUser,
    acceptInvite,
    mergeInvite,
    declineInvite,
    leave,
    toggleMute,
    retryPeer,
  };
}
