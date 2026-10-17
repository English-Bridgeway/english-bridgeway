import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft, ArrowUpRight, Clock, Copy, Crown, Headphones, Lock, Mic, MicOff, Phone, PhoneMissed, PhoneOff, Plus, RefreshCw, UserPlus, Users, Wifi, WifiOff, X,
} from "lucide-react";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { TextField } from "../../components/FormField";
import { useAuth } from "../../context/AuthContext";
import { CALL_STATE_LABEL, useVoice } from "../../voice/VoiceContext";
import type { Peer } from "../../voice/useVoiceChat";
import { formatDuration, useElapsed, useSpeaking } from "../../voice/callUi";
import { fetchMyCalls } from "../../utils/account";
import { formatDateTime } from "../../utils/access";
import type { CallLogEntry } from "../../types";
import { cn } from "../../utils/cn";

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-amber-100 font-display font-semibold text-brand-navy", className ?? "h-10 w-10")} aria-hidden="true">
      {initials}
    </span>
  );
}

const PEER_LABEL: Record<Peer["state"], string> = { connecting: "Connecting…", connected: "Connected", reconnecting: "Reconnecting…", failed: "Can't connect" };

/** One person on the call: a ring glows while they talk. */
function Tile({ name, initials, muted, stream, label, warn, onRetry, big }: {
  name: string; initials: string; muted: boolean; stream?: MediaStream | null; label: string; warn?: boolean; onRetry?: () => void; big?: boolean;
}) {
  const speaking = useSpeaking(stream, !muted);
  return (
    <li className="flex flex-col items-center gap-2 text-center">
      <span className="relative">
        <span className={cn("absolute -inset-1.5 rounded-full transition-all duration-150", speaking ? "bg-emerald-400/70 opacity-100" : "opacity-0")} aria-hidden="true" />
        <Avatar initials={initials} className={cn("relative ring-4 ring-white/10", big ? "h-28 w-28 text-4xl" : "h-20 w-20 text-2xl")} />
        {muted && (
          <span className="absolute -bottom-0.5 -right-0.5 grid h-8 w-8 place-items-center rounded-full bg-red-600 text-white ring-4 ring-brand-navy" title="Muted">
            <MicOff className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="max-w-full truncate font-semibold text-white">{name}</span>
      <span className={cn("text-xs", warn ? "text-amber-300" : "text-white/70")}>{label}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
        </button>
      )}
    </li>
  );
}

function RoundButton({ label, onClick, active, danger, children, disabled }: {
  label: string; onClick: () => void; active?: boolean; danger?: boolean; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active}
        className={cn(
          "grid h-14 w-14 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 disabled:opacity-50 sm:h-16 sm:w-16",
          danger ? "bg-red-600 text-white hover:bg-red-700" : active ? "bg-white text-brand-navy" : "bg-white/10 text-white hover:bg-white/20",
        )}>
        {children}
      </button>
      <span className="text-xs text-white/80">{label}</span>
    </div>
  );
}

/** The live call: who is on it, its state and duration, and the controls. */
function CallStage({ copyLink, copied }: { copyLink: () => void; copied: boolean }) {
  const { user } = useAuth();
  const vc = useVoice();
  const seconds = useElapsed(vc.connectedAt);
  const room = vc.room!;
  const direct = room.kind === "direct";
  const state = vc.callState;
  const calleeName = direct ? room.name.split(" & ").find((n) => n && n !== user?.name) ?? room.name : room.name;
  const calleeInitials = calleeName.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  return (
    <section aria-label="Your call" className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-navy via-brand-navy to-brand-primary p-6 text-white shadow-2xl sm:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-sky/20 blur-3xl" aria-hidden="true" />
      <div className="relative text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">{direct ? "One-to-one call" : room.isPrivate ? "Private group call" : "Team room"}</p>
        <h2 className="mt-2 truncate text-2xl font-bold text-white sm:text-3xl">{direct ? calleeName : room.name}</h2>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm" aria-live="polite">
          <span className={cn("h-2 w-2 rounded-full", state === "connected" ? "bg-emerald-400" : state === "reconnecting" ? "animate-pulse bg-red-400" : "animate-pulse bg-amber-300")} aria-hidden="true" />
          {state === "connected" ? (
            <span className="font-mono text-base tabular-nums">{formatDuration(seconds)}</span>
          ) : (
            <span className="text-white/80">
              {state === "ringing" && vc.calleeBusy ? `${calleeName.split(" ")[0]} is on another call. Still ringing…` : state === "waiting" ? "Waiting for others. Invite learners or share the link." : CALL_STATE_LABEL[state]}
            </span>
          )}
        </p>
      </div>

      <ul className={cn("relative mx-auto mt-8 grid max-w-3xl justify-items-center gap-6", vc.peers.length <= 1 ? "grid-cols-2 sm:max-w-md" : "grid-cols-2 sm:grid-cols-3")}>
        <Tile big={vc.peers.length <= 1} name="You" initials={user?.avatarInitials ?? "ME"} muted={vc.muted} stream={vc.localStream} label={vc.muted ? "Muted" : "Mic on"} />
        {vc.peers.length === 0 && direct ? (
          <li className="flex flex-col items-center gap-2 text-center">
            <span className="relative">
              <span className="absolute -inset-2 animate-ping rounded-full bg-white/20" aria-hidden="true" />
              <Avatar initials={calleeInitials || "?"} className="relative h-28 w-28 text-4xl ring-4 ring-white/10" />
            </span>
            <span className="font-semibold text-white">{calleeName}</span>
            <span className="text-xs text-white/70">Ringing…</span>
          </li>
        ) : (
          vc.peers.map((p) => (
            <Tile key={p.socketId} big={vc.peers.length <= 1} name={p.name} initials={p.initials} muted={p.muted} stream={p.stream}
              label={p.away ? "Reconnecting…" : PEER_LABEL[p.state] + (p.muted ? " · muted" : "")} warn={p.state === "failed" || p.away}
              onRetry={p.state === "failed" ? () => vc.retryPeer(p.socketId) : undefined} />
          ))
        )}
      </ul>

      {vc.peers.some((p) => p.state === "failed") && (
        <p className="relative mx-auto mt-6 max-w-lg rounded-2xl bg-white/10 p-3 text-center text-sm text-white/90">
          The audio couldn't get through. Tap <b>Try again</b>, or switch to mobile data or another Wi-Fi. Some office and college networks block calls.
        </p>
      )}

      <div className="relative mt-10 flex flex-wrap items-start justify-center gap-6 sm:gap-8">
        <RoundButton label={vc.muted ? "Unmute" : "Mute"} active={vc.muted} onClick={vc.toggleMute}>
          {vc.muted ? <MicOff className="h-6 w-6" aria-hidden="true" /> : <Mic className="h-6 w-6" aria-hidden="true" />}
        </RoundButton>
        {!direct && (
          <RoundButton label={copied ? "Link copied" : "Invite link"} onClick={copyLink}>
            <Copy className="h-6 w-6" aria-hidden="true" />
          </RoundButton>
        )}
        <RoundButton label={state === "ringing" ? "Cancel" : direct ? "End call" : "Leave"} danger onClick={vc.leave}>
          <PhoneOff className="h-6 w-6" aria-hidden="true" />
        </RoundButton>
      </div>
    </section>
  );
}

const OUTCOME: Record<CallLogEntry["outcome"], string> = {
  completed: "Completed", "no-answer": "No answer", declined: "Declined", missed: "Missed", cancelled: "Cancelled", limit: "Minutes ran out", dropped: "Connection lost",
};

function CallHistory({ calls }: { calls: CallLogEntry[] | null }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Clock className="h-5 w-5 text-brand-primary" aria-hidden="true" /> Recent calls</h2>
      {!calls ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : calls.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Your calls will show here, with how long you talked.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {calls.map((c) => {
            const missed = c.outcome === "missed" || (c.outcome === "declined" && c.direction === "incoming");
            const Icon = missed ? PhoneMissed : c.direction === "incoming" ? ArrowDownLeft : c.direction === "outgoing" ? ArrowUpRight : Users;
            return (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", missed ? "bg-red-50 text-red-600" : "bg-ink-50 text-brand-primary")}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.withNames || c.roomName}</p>
                  <p className="text-xs text-muted">{formatDateTime(c.startedAt)} · {OUTCOME[c.outcome]}</p>
                </div>
                <span className="font-mono text-sm tabular-nums">{c.talkSeconds ? formatDuration(c.talkSeconds) : "—"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Call minutes left: the trial's few minutes, or today's paid allowance. */
function MinutesMeter() {
  const { usage } = useAuth();
  const call = usage?.call;
  if (!call || call.limit === null) return call ? <p className="text-sm text-white/80">Unlimited call minutes</p> : null;
  const left = call.remaining ?? 0;
  const pct = call.limit ? Math.min(100, (left / call.limit) * 100) : 0;
  return (
    <div className="w-full max-w-xs">
      <p className="flex justify-between text-sm text-white/90">
        <span>{call.period === "day" ? "Minutes left today" : call.period === "trial" ? "Free trial minutes" : "Call minutes"}</span>
        <span className="font-mono tabular-nums">{formatDuration(left)} / {formatDuration(call.limit)}</span>
      </p>
      <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
        <span className={cn("block h-full rounded-full", pct > 25 ? "bg-emerald-400" : "bg-amber-300")} style={{ width: `${pct}%` }} />
      </span>
      {call.period !== "day" && (
        <Link to="/learn/billing#plans" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200">
          <Crown className="h-3.5 w-3.5" aria-hidden="true" /> Get daily call minutes with a plan
        </Link>
      )}
    </div>
  );
}

export default function SpeakLive() {
  const { user, token, usage, refresh } = useAuth();
  const vc = useVoice();
  const [params, setParams] = useSearchParams();
  const linkRoom = params.get("room");
  const [roomName, setRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [calls, setCalls] = useState<CallLogEntry[] | null>(null);

  const loadCalls = useCallback(() => {
    if (token) fetchMyCalls(token).then(setCalls).catch(() => setCalls([]));
  }, [token]);
  useEffect(loadCalls, [loadCalls]);

  // After a call: the history and the minutes left change (the server saves them as the call ends).
  const inCall = Boolean(vc.room);
  const wasInCall = useRef(inCall);
  useEffect(() => {
    if (wasInCall.current && !inCall) {
      const t = setTimeout(() => {
        loadCalls();
        refresh();
      }, 600);
      wasInCall.current = inCall;
      return () => clearTimeout(t);
    }
    wasInCall.current = inCall;
  }, [inCall, loadCalls, refresh]);

  const inviteLink = vc.room ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(vc.room.id)}` : "";
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", inviteLink);
    }
  };

  const others = vc.users.filter((u) => u.id !== user?.id);
  const inTeamRoom = vc.room?.kind === "team";
  const noMinutes = usage?.call.remaining === 0;
  const canStart = vc.status === "online" && !vc.joining && !noMinutes;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {!vc.room && (
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-navy to-brand-primary p-6 text-white sm:p-8">
          <div className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Speak Live</h1>
              <p className="mt-2 text-white/85">Practise speaking with other learners in real time. Call someone one-to-one, or start a team room for up to six people.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {vc.status === "online" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-100"><Wifi className="h-3.5 w-3.5" aria-hidden="true" /> Online</span>
                ) : vc.status === "connecting" ? (
                  <span className="rounded-full bg-white/10 px-3 py-1">Connecting…</span>
                ) : vc.status === "offline" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/20 px-3 py-1 text-amber-100"><WifiOff className="h-3.5 w-3.5" aria-hidden="true" /> Reconnecting…</span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 text-white/75"><Headphones className="h-4 w-4" aria-hidden="true" /> Headphones stop echo</span>
              </div>
            </div>
            <MinutesMeter />
          </div>
        </section>
      )}

      {vc.status === "unavailable" && (
        <Alert tone="info" title="Live voice chat needs the server">
          This preview runs without the English-Bridgeway server, so live calls are switched off. They work on the real site.
        </Alert>
      )}
      {noMinutes && !vc.room && (
        <Alert tone="warning" title={usage?.call.period === "day" ? "You've used today's call minutes" : "Your free call minutes are used up"}>
          {usage?.call.period === "day" ? "They refresh at midnight." : "Subscribe or buy a course to keep practising live with other learners."}{" "}
          {usage?.call.period !== "day" && <Link to="/learn/billing#plans" className="font-semibold underline">See plans</Link>}
        </Alert>
      )}
      {vc.notice && !vc.lastCall && (
        <Alert tone={vc.notice.tone === "error" ? "error" : "info"}>
          {vc.notice.text}{" "}
          <button type="button" onClick={vc.clearNotice} className="font-semibold underline">Dismiss</button>
        </Alert>
      )}
      {vc.lastCall && !vc.room && (
        <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-white p-4 shadow-card sm:p-5" role="status">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-ink-50 text-brand-primary"><PhoneOff className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Call ended{vc.lastCall.title ? ` · ${vc.lastCall.title}` : ""}</p>
            <p className="text-sm text-muted">{vc.lastCall.seconds ? `You talked for ${formatDuration(vc.lastCall.seconds)}. ` : ""}{vc.lastCall.reason}</p>
          </div>
          <button type="button" onClick={() => { vc.clearLastCall(); vc.clearNotice(); }} aria-label="Dismiss" className="text-muted hover:text-ink-900"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
      )}
      {linkRoom && !vc.room && vc.status === "online" && (
        <Alert tone="info" title="You have an invitation to a room">
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={!canStart} onClick={async () => { if (await vc.joinRoom(linkRoom)) setParams({}, { replace: true }); }}>
              <Phone className="h-4 w-4" aria-hidden="true" /> Join the room
            </Button>
            <Button size="sm" variant="outline" onClick={() => setParams({}, { replace: true })}>Not now</Button>
          </div>
        </Alert>
      )}

      {vc.room && <CallStage copyLink={copyLink} copied={copied} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" /> Learners online <span className="text-base font-normal text-muted">({others.length})</span>
          </h2>
          {others.length ? (
            <ul className="mt-3 divide-y divide-line">
              {others.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-3">
                  <span className="relative">
                    <Avatar initials={u.initials} />
                    <span className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white", u.busy ? "bg-amber-400" : "bg-emerald-500")} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{u.name}</p>
                    <p className="text-sm text-muted">{u.busy ? "On a call" : "Available"}</p>
                  </div>
                  {inTeamRoom ? (
                    <Button size="sm" variant="outline" disabled={vc.room?.members.some((m) => m.id === u.id) || vc.peers.some((p) => p.id === u.id)} onClick={() => vc.inviteUser(u)}>
                      <UserPlus className="h-4 w-4" aria-hidden="true" /> Invite
                    </Button>
                  ) : (
                    <Button size="sm" disabled={Boolean(vc.room) || !canStart} onClick={() => vc.callUser(u)} aria-label={`Call ${u.name}`}>
                      <Phone className="h-4 w-4" aria-hidden="true" /> Call
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Nobody else is online right now. Start a team room and share the link with a friend.</p>
          )}
        </section>

        <section className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5 text-brand-primary" aria-hidden="true" /> Team rooms</h2>
          <form
            className="mt-3 space-y-3 rounded-2xl bg-ink-50 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await vc.createRoom(roomName, isPrivate)) setRoomName("");
            }}
          >
            <TextField id="room-name" label="Start a room" placeholder="e.g. Job interview practice" maxLength={60} value={roomName} onChange={(e) => setRoomName(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="h-4 w-4 accent-brand-primary" />
              Private: only people I invite or send the link to can join
            </label>
            <Button type="submit" disabled={!canStart || Boolean(vc.room)}><Plus className="h-4 w-4" aria-hidden="true" /> Start room</Button>
          </form>
          {vc.rooms.length ? (
            <ul className="mt-3 divide-y divide-line">
              {vc.rooms.map((r) => {
                const full = r.count >= r.max;
                const here = vc.room?.id === r.id;
                return (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="truncate text-sm text-muted">{r.members.map((m) => m.name).join(", ")} · {r.count}/{r.max}</p>
                    </div>
                    {here ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">You're here</span> : (
                      <Button size="sm" variant="outline" disabled={full || !canStart} onClick={() => vc.joinRoom(r.id)}>
                        {full ? "Full" : "Join"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No open rooms right now. Start one and invite other learners.</p>
          )}
        </section>
      </div>

      <CallHistory calls={calls} />

      <p className="flex items-center gap-2 text-sm text-muted"><Lock className="h-4 w-4" aria-hidden="true" /> Calls are encrypted and go straight between browsers. Nothing is recorded; only the time and length of each call are saved.</p>
    </div>
  );
}
