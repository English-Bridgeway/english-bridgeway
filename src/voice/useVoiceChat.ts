import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { API_BASE, apiFetch, isLive } from "../utils/backend";

/**
 * Live voice chat between signed-in learners.
 *
 * Audio flows directly between browsers over WebRTC; every person in a room connects to every
 * other person (a "mesh", good for up to ~6 people). The server (server/src/services/voice.ts)
 * only relays the set-up messages over Socket.IO: who is online, rooms, invitations, and the
 * WebRTC offer/answer/ICE candidates. Whoever joins a room sends the offers, so two browsers
 * never offer to each other at the same time.
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
  members: { id: string; name: string; initials: string }[];
}

export interface Peer {
  socketId: string;
  id: string;
  name: string;
  initials: string;
  muted: boolean;
  state: "connecting" | "connected" | "failed";
  stream: MediaStream | null;
}

export interface Invite {
  room: RoomSummary;
  from: { id: string; name: string; initials: string };
}

type Status = "unavailable" | "connecting" | "online" | "offline";
type JoinResult =
  | { ok: true; room: RoomSummary; peers: Omit<Peer, "state" | "stream">[]; selfSocketId: string }
  | { ok: false; message: string };
type Signal = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

const RING_TIMEOUT_MS = 40_000;

function socketTarget() {
  // API_BASE is "/api" (same site) or a full URL such as "https://api.example.com/api".
  if (/^https?:\/\//.test(API_BASE)) {
    const u = new URL(API_BASE);
    return { url: u.origin, path: `${u.pathname.replace(/\/$/, "")}/socket.io` };
  }
  return { url: window.location.origin, path: `${API_BASE}/socket.io` };
}

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

  const socketRef = useRef<Socket | null>(null);
  const iceRef = useRef<RTCIceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const localStream = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, { pc: RTCPeerConnection; queued: RTCIceCandidateInit[] }>());
  const roomRef = useRef<RoomSummary | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  roomRef.current = room;

  const updatePeer = useCallback((socketId: string, patch: Partial<Peer>) => {
    setPeers((list) => list.map((p) => (p.socketId === socketId ? { ...p, ...patch } : p)));
  }, []);

  const closePeer = useCallback((socketId: string) => {
    const entry = pcs.current.get(socketId);
    entry?.pc.close();
    pcs.current.delete(socketId);
    setPeers((list) => list.filter((p) => p.socketId !== socketId));
  }, []);

  /** Ends the call on this side: closes every connection and releases the microphone. */
  const teardown = useCallback(() => {
    for (const { pc } of pcs.current.values()) pc.close();
    pcs.current.clear();
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    if (ringTimer.current) clearTimeout(ringTimer.current);
    ringTimer.current = null;
    setPeers([]);
    setRoom(null);
    setMuted(false);
  }, []);

  const createPeerConnection = useCallback(
    (socketId: string) => {
      const pc = new RTCPeerConnection({ iceServers: iceRef.current });
      const entry = { pc, queued: [] as RTCIceCandidateInit[] };
      pcs.current.set(socketId, entry);
      localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate) socketRef.current?.emit("signal", { to: socketId, data: { candidate: e.candidate.toJSON() } });
      };
      pc.ontrack = (e) => updatePeer(socketId, { stream: e.streams[0] ?? new MediaStream([e.track]) });
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "connected") updatePeer(socketId, { state: "connected" });
        else if (s === "failed") updatePeer(socketId, { state: "failed" });
        else if (s === "connecting" || s === "new") updatePeer(socketId, { state: "connecting" });
      };
      return entry;
    },
    [updatePeer],
  );

  const flushCandidates = async (entry: { pc: RTCPeerConnection; queued: RTCIceCandidateInit[] }) => {
    for (const c of entry.queued.splice(0)) await entry.pc.addIceCandidate(c).catch(() => undefined);
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
            : "Could not start your microphone.",
      );
    }
  };

  /** Runs after the server put us in a room: connect to everyone already there. */
  const enterRoom = useCallback(
    async (res: JoinResult) => {
      if (!res.ok) {
        // Nothing changed on the server, but this side already dropped its connections.
        if (roomRef.current) socketRef.current?.emit("room:leave", {});
        teardown();
        setNotice({ tone: "error", text: res.message });
        return false;
      }
      setRoom(res.room);
      setSelfSocketId(res.selfSocketId);
      setPeers(res.peers.map((p) => ({ ...p, state: "connecting", stream: null })));
      for (const p of res.peers) {
        const entry = createPeerConnection(p.socketId);
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        socketRef.current?.emit("signal", { to: p.socketId, data: { description: entry.pc.localDescription!.toJSON() } });
      }
      return true;
    },
    [createPeerConnection, teardown],
  );

  // Connect to the signaling server while the page is open.
  useEffect(() => {
    if (!isLive || !token) return;
    let cancelled = false;
    apiFetch<{ iceServers: RTCIceServer[] }>("/voice/config", { token })
      .then((cfg) => {
        if (!cancelled && cfg.iceServers?.length) iceRef.current = cfg.iceServers;
      })
      .catch(() => undefined);

    let socket: Socket | null = null;
    // The Socket.IO client is only downloaded for signed-in learners.
    import("socket.io-client").then(({ io }) => {
      if (cancelled) return;
      const { url, path } = socketTarget();
      socket = io(url, { path, auth: { token }, transports: ["websocket", "polling"] });
      socketRef.current = socket;
      listen(socket);
    });

    function listen(socket: Socket) {
      socket.on("connect", () => setStatus("online"));
      socket.on("disconnect", () => {
        setStatus("offline");
        // The server forgets our room when the connection drops, so end the call here too.
        if (roomRef.current) {
          teardown();
          setNotice({ tone: "error", text: "Connection lost. The call ended." });
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
      socket.on("invite:declined", ({ user }: { user: { name: string } }) => {
        setNotice({ tone: "info", text: `${user.name} can't talk right now.` });
        const r = roomRef.current;
        if (r?.kind === "direct") {
          socket.emit("room:leave", {});
          teardown();
        }
      });
      socket.on("room:ended", ({ reason }: { reason: string }) => {
        teardown();
        setNotice({ tone: "info", text: reason });
      });
      socket.on("peer:joined", (p: Omit<Peer, "state" | "stream">) => {
        if (ringTimer.current) clearTimeout(ringTimer.current);
        ringTimer.current = null;
        setPeers((list) => [...list.filter((x) => x.socketId !== p.socketId), { ...p, state: "connecting", stream: null }]);
        setRoom((r) => (r ? { ...r, count: r.count + 1 } : r));
      });
      socket.on("peer:left", ({ socketId }: { socketId: string }) => {
        closePeer(socketId);
        setRoom((r) => (r ? { ...r, count: Math.max(1, r.count - 1) } : r));
      });
      socket.on("peer:muted", ({ socketId, muted: m }: { socketId: string; muted: boolean }) => updatePeer(socketId, { muted: m }));
      socket.on("signal", async ({ from, data }: { from: string; data: Signal }) => {
        try {
          if (data.description) {
            const entry = pcs.current.get(from) ?? createPeerConnection(from);
            await entry.pc.setRemoteDescription(data.description);
            await flushCandidates(entry);
            if (data.description.type === "offer") {
              await entry.pc.setLocalDescription(await entry.pc.createAnswer());
              socket.emit("signal", { to: from, data: { description: entry.pc.localDescription!.toJSON() } });
            }
          } else if (data.candidate) {
            const entry = pcs.current.get(from);
            if (!entry) return;
            if (entry.pc.remoteDescription) await entry.pc.addIceCandidate(data.candidate).catch(() => undefined);
            else entry.queued.push(data.candidate);
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
  }, [token, createPeerConnection, closePeer, teardown, updatePeer]);

  /** Gets the microphone, then asks the server to put us in a room. */
  const withMic = useCallback(
    async (event: string, payload: unknown) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        setNotice({ tone: "error", text: "Not connected to the voice server. Check your internet and reload the page." });
        return false;
      }
      setJoining(true);
      setNotice(null);
      try {
        await getMic();
        // Leaving the current call first keeps us in one room at a time.
        for (const id of [...pcs.current.keys()]) closePeer(id);
        const res = (await socket.timeout(10_000).emitWithAck(event, payload)) as JoinResult;
        return await enterRoom(res);
      } catch (e) {
        teardown();
        setNotice({
          tone: "error",
          text: e instanceof Error && !/timed out/i.test(e.message) ? e.message : "The voice server didn't answer. Please try again.",
        });
        return false;
      } finally {
        setJoining(false);
      }
    },
    [closePeer, enterRoom, teardown],
  );

  const createRoom = useCallback((name: string, isPrivate: boolean) => withMic("room:create", { name, isPrivate }), [withMic]);
  const joinRoom = useCallback((roomId: string) => withMic("room:join", { roomId }), [withMic]);

  const callUser = useCallback(
    async (user: OnlineUser) => {
      const ok = await withMic("call:user", { userId: user.id });
      if (!ok) return;
      setNotice({ tone: "info", text: `Calling ${user.name}…` });
      ringTimer.current = setTimeout(() => {
        if (roomRef.current?.kind === "direct" && pcs.current.size === 0) {
          socketRef.current?.emit("room:leave", {});
          teardown();
          setNotice({ tone: "info", text: `${user.name} didn't answer.` });
        }
      }, RING_TIMEOUT_MS);
    },
    [teardown, withMic],
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

  const acceptInvite = useCallback(
    async (inv: Invite) => {
      setInvites((all) => all.filter((i) => i.room.id !== inv.room.id));
      await joinRoom(inv.room.id);
    },
    [joinRoom],
  );

  const declineInvite = useCallback((inv: Invite) => {
    setInvites((all) => all.filter((i) => i.room.id !== inv.room.id));
    socketRef.current?.emit("invite:decline", { roomId: inv.room.id });
  }, []);

  const leave = useCallback(() => {
    socketRef.current?.emit("room:leave", {});
    teardown();
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
    socketRef.current?.emit("mute", { muted: next });
  }, [muted]);

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
    clearNotice: () => setNotice(null),
    createRoom,
    joinRoom,
    callUser,
    inviteUser,
    acceptInvite,
    declineInvite,
    leave,
    toggleMute,
  };
}
