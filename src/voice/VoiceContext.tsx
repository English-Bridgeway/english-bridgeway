import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Crown, GitMerge, Mic, MicOff, Phone, PhoneIncoming, PhoneOff, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useVoiceChat, type CallState, type Invite } from "./useVoiceChat";
import { formatDuration, useElapsed } from "./callUi";
import { cn } from "../utils/cn";

type VoiceChat = ReturnType<typeof useVoiceChat>;
const VoiceContext = createContext<VoiceChat | null>(null);

/**
 * Keeps signed-in learners connected to the voice chat on every page, so they show as online,
 * hear incoming calls anywhere on the site, and stay in a call while they browse lessons.
 */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const vc = useVoiceChat(token);
  return (
    <VoiceContext.Provider value={vc}>
      {children}
      {token && <VoiceOverlay vc={vc} />}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used inside VoiceProvider");
  return ctx;
}

export const CALL_STATE_LABEL: Record<CallState, string> = {
  idle: "",
  ringing: "Ringing…",
  waiting: "Waiting for others",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
};

/** Plays one person's voice. WebRTC audio has to be attached to a media element to be heard. */
function PeerAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
      if (stream) ref.current.play().catch(() => undefined);
    }
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline />;
}

function IncomingCall({ inv, vc, onAnswer }: { inv: Invite; vc: VoiceChat; onAnswer: () => void }) {
  const onCall = Boolean(vc.room);
  const direct = inv.room.kind === "direct";
  return (
    <div role="alertdialog" aria-label={`Call from ${inv.from.name}`} className="overflow-hidden rounded-3xl bg-brand-navy text-white shadow-2xl ring-1 ring-white/10">
      <div className="flex items-center gap-3 p-4">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-300 font-display text-lg font-bold text-brand-navy">
          <span className="absolute inset-0 animate-ping rounded-full bg-amber-300/40" aria-hidden="true" />
          <span className="relative">{inv.from.initials}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{inv.from.name}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-white/70">
            <PhoneIncoming className="h-3.5 w-3.5" aria-hidden="true" />
            {direct ? "Incoming call" : `Invites you to “${inv.room.name}”`}
          </p>
        </div>
      </div>
      {onCall && <p className="px-4 pb-2 text-xs text-white/70">You're on a call. Keep it, switch to {inv.from.name.split(" ")[0]}, or bring them in.</p>}
      <div className={cn("grid gap-2 p-3 pt-1", onCall && direct ? "grid-cols-3" : "grid-cols-2")}>
        <button type="button" onClick={() => vc.declineInvite(inv)} className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-sm font-semibold hover:bg-white/20">
          <PhoneOff className="h-4 w-4" aria-hidden="true" /> {onCall ? "Keep call" : "Decline"}
        </button>
        {onCall && direct && (
          <button type="button" disabled={vc.joining} onClick={() => vc.mergeInvite(inv)} className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-sm font-semibold hover:bg-white/20 disabled:opacity-50">
            <GitMerge className="h-4 w-4" aria-hidden="true" /> Merge
          </button>
        )}
        <button type="button" disabled={vc.joining} onClick={onAnswer} className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
          <Phone className="h-4 w-4" aria-hidden="true" /> {onCall ? (direct ? "End & answer" : "Switch") : direct ? "Answer" : "Join"}
        </button>
      </div>
    </div>
  );
}

function MiniCallBar({ vc }: { vc: VoiceChat }) {
  const seconds = useElapsed(vc.connectedAt);
  const state = vc.callState;
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-brand-navy p-2.5 pl-4 text-white shadow-2xl ring-1 ring-white/10">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", state === "connected" ? "bg-emerald-400" : "animate-pulse bg-amber-300")} aria-hidden="true" />
      <Link to="/learn/live" className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{vc.room?.kind === "direct" && vc.peers[0] ? vc.peers[0].name : vc.room?.name}</p>
        <p className="text-xs tabular-nums text-white/70">{state === "connected" ? formatDuration(seconds) : CALL_STATE_LABEL[state]} · Open call</p>
      </Link>
      <button type="button" onClick={vc.toggleMute} aria-pressed={vc.muted} aria-label={vc.muted ? "Unmute" : "Mute"}
        className={cn("grid h-10 w-10 place-items-center rounded-full", vc.muted ? "bg-white text-brand-navy" : "bg-white/10 hover:bg-white/20")}>
        {vc.muted ? <MicOff className="h-5 w-5" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
      </button>
      <button type="button" onClick={vc.leave} aria-label="End call" className="grid h-10 w-10 place-items-center rounded-full bg-red-600 hover:bg-red-700">
        <PhoneOff className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

function VoiceOverlay({ vc }: { vc: VoiceChat }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const onSpeakPage = pathname === "/learn/live";

  // Free minutes (or today's minutes) used up: take the learner to the plans.
  const limit = vc.limit;
  useEffect(() => {
    if (!limit) return;
    refresh();
    navigate(limit.redirect);
  }, [limit, navigate, refresh]);

  return (
    <>
      <div hidden>{vc.peers.map((p) => <PeerAudio key={p.socketId} stream={p.stream} />)}</div>

      {(vc.invites.length > 0 || (vc.room && !onSpeakPage) || limit) && (
        <div className="fixed inset-x-4 bottom-4 z-50 space-y-3 sm:left-auto sm:w-[25rem]" aria-live="assertive">
          {limit && (
            <div role="alert" className="rounded-3xl border border-amber-300 bg-amber-50 p-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-300 text-brand-navy"><Crown className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-brand-navy">Call minutes used up</p>
                  <p className="mt-0.5 text-sm text-brand-navy/80">{limit.message}</p>
                </div>
                <button type="button" onClick={vc.clearLimit} aria-label="Close" className="text-brand-navy/60 hover:text-brand-navy"><X className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            </div>
          )}
          {vc.room && !onSpeakPage && <MiniCallBar vc={vc} />}
          {vc.invites.map((inv) => (
            <IncomingCall key={inv.room.id} inv={inv} vc={vc} onAnswer={async () => { navigate("/learn/live"); await vc.acceptInvite(inv); }} />
          ))}
        </div>
      )}
    </>
  );
}
