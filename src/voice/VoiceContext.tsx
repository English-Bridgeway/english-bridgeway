import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mic, MicOff, Phone, PhoneIncoming, PhoneOff } from "lucide-react";
import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { useVoiceChat } from "./useVoiceChat";

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

function VoiceOverlay({ vc }: { vc: VoiceChat }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onSpeakPage = pathname === "/speak";

  return (
    <>
      <div hidden>{vc.peers.map((p) => <PeerAudio key={p.socketId} stream={p.stream} />)}</div>

      {(vc.invites.length > 0 || (vc.room && !onSpeakPage)) && (
        <div className="fixed inset-x-4 bottom-4 z-50 space-y-3 sm:left-auto sm:w-96" aria-live="assertive">
          {vc.room && !onSpeakPage && (
            <div className="flex items-center gap-3 rounded-2xl bg-brand-primary p-3 text-white shadow-xl">
              <Link to="/speak" className="min-w-0 flex-1 pl-1">
                <p className="truncate font-semibold">{vc.room.name}</p>
                <p className="text-xs text-ink-100">{vc.peers.length ? `${vc.peers.length + 1} people talking` : "Waiting…"} · Open call</p>
              </Link>
              <button type="button" onClick={vc.toggleMute} aria-pressed={vc.muted} aria-label={vc.muted ? "Unmute" : "Mute"}
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20">
                {vc.muted ? <MicOff className="h-5 w-5" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
              </button>
              <button type="button" onClick={vc.leave} aria-label="Leave call" className="grid h-10 w-10 place-items-center rounded-xl bg-red-600 hover:bg-red-700">
                <PhoneOff className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
          {vc.invites.map((inv) => (
            <div key={inv.room.id} role="alertdialog" aria-label={`Call from ${inv.from.name}`} className="rounded-2xl border border-line bg-white p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 animate-pulse place-items-center rounded-full bg-emerald-100 text-emerald-700"><PhoneIncoming className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="font-semibold">{inv.from.name}</p>
                  <p className="truncate text-sm text-muted">{inv.room.kind === "direct" ? "is calling you" : `invites you to “${inv.room.name}”`}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => vc.declineInvite(inv)}><PhoneOff className="h-4 w-4" aria-hidden="true" /> Decline</Button>
                <Button size="sm" disabled={vc.joining} onClick={async () => { navigate("/speak"); await vc.acceptInvite(inv); }}>
                  <Phone className="h-4 w-4" aria-hidden="true" /> {inv.room.kind === "direct" ? "Answer" : "Join"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
