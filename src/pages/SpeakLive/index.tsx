import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, Headphones, Lock, Mic, MicOff, Phone, PhoneOff, Plus, UserPlus, Users, Wifi, WifiOff } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { Badge } from "../../components/Badge";
import { TextField } from "../../components/FormField";
import { useAuth } from "../../context/AuthContext";
import { useVoice } from "../../voice/VoiceContext";
import type { Peer } from "../../voice/useVoiceChat";
import { cn } from "../../utils/cn";

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-amber-100 font-display font-semibold text-amber-800", className ?? "h-10 w-10")} aria-hidden="true">
      {initials}
    </span>
  );
}

function Tile({ name, initials, muted, state, you }: { name: string; initials: string; muted: boolean; state?: Peer["state"]; you?: boolean }) {
  const label = you ? "You" : state === "connected" ? "Connected" : state === "failed" ? "Can't connect" : "Connecting…";
  return (
    <li className="flex flex-col items-center gap-2 rounded-2xl bg-white/10 p-4 text-center">
      <span className="relative">
        <Avatar initials={initials} className="h-16 w-16 text-xl" />
        {muted && (
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-red-600 text-white" title="Muted">
            <MicOff className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="max-w-full truncate font-semibold text-white">{name}</span>
      <span className={cn("text-xs", state === "failed" ? "text-amber-300" : "text-ink-200")}>
        {label}
        {muted ? " · muted" : ""}
      </span>
    </li>
  );
}

export default function SpeakLive() {
  const { user } = useAuth();
  const vc = useVoice();
  const [params, setParams] = useSearchParams();
  const linkRoom = params.get("room");
  const [roomName, setRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [copied, setCopied] = useState(false);

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

  return (
    <>
      <PageHeader crumbs={[{ label: "Speak Live" }]} title="Speak Live"
        description="Practise speaking with other learners in real time. Call someone one-to-one, or start a team room for up to six people.">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {vc.status === "online" ? (
            <Badge tone="green"><Wifi className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Connected</Badge>
          ) : vc.status === "connecting" ? (
            <Badge tone="amber">Connecting…</Badge>
          ) : vc.status === "offline" ? (
            <Badge tone="amber"><WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Reconnecting…</Badge>
          ) : null}
          <span className="flex items-center gap-1.5 text-muted"><Headphones className="h-4 w-4" aria-hidden="true" /> Use headphones to avoid echo.</span>
        </div>
      </PageHeader>

      <div className="container-page space-y-6 py-10">
        {vc.status === "unavailable" && (
          <Alert tone="info" title="Live voice chat needs the server">
            This preview runs without the English-Bridgeway server, so live calls are switched off. They work on the real site.
          </Alert>
        )}
        {vc.notice && (
          <Alert tone={vc.notice.tone === "error" ? "error" : "info"}>
            {vc.notice.text}{" "}
            <button type="button" onClick={vc.clearNotice} className="font-semibold underline">Dismiss</button>
          </Alert>
        )}
        {linkRoom && !vc.room && vc.status === "online" && (
          <Alert tone="info" title="You have an invitation to a room">
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" disabled={vc.joining} onClick={async () => { if (await vc.joinRoom(linkRoom)) setParams({}, { replace: true }); }}>
                <Phone className="h-4 w-4" aria-hidden="true" /> Join the room
              </Button>
              <Button size="sm" variant="outline" onClick={() => setParams({}, { replace: true })}>Not now</Button>
            </div>
          </Alert>
        )}

        {vc.room && (
          <section aria-label="Your call" className="rounded-3xl bg-brand-primary p-6 text-white sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-300">{vc.room.kind === "direct" ? "One-to-one call" : vc.room.isPrivate ? "Private team room" : "Team room"}</p>
                <h2 className="mt-1 truncate text-2xl font-bold text-white">{vc.room.name}</h2>
                <p className="mt-1 text-sm text-ink-100">
                  {vc.peers.length === 0
                    ? vc.room.kind === "direct" ? "Ringing…" : "Waiting for others to join. Invite learners from the list below or share the link."
                    : `${vc.peers.length + 1} people talking`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={vc.toggleMute} variant={vc.muted ? "accent" : "outline"} className={vc.muted ? "" : "border-white/20 bg-white/10 text-white hover:bg-white/20"} aria-pressed={vc.muted}>
                  {vc.muted ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                  {vc.muted ? "Unmute" : "Mute"}
                </Button>
                {inTeamRoom && (
                  <Button onClick={copyLink} variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                    <Copy className="h-4 w-4" aria-hidden="true" /> {copied ? "Link copied" : "Copy invite link"}
                  </Button>
                )}
                <Button onClick={vc.leave} variant="danger"><PhoneOff className="h-4 w-4" aria-hidden="true" /> Leave</Button>
              </div>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Tile you name={user?.name ?? "You"} initials={user?.avatarInitials ?? "ME"} muted={vc.muted} />
              {vc.peers.map((p) => <Tile key={p.socketId} name={p.name} initials={p.initials} muted={p.muted} state={p.state} />)}
            </ul>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><Users className="h-5 w-5 text-ink-500" aria-hidden="true" /> Team rooms</h2>
            <form
              className="mt-4 space-y-3 rounded-2xl bg-ink-50 p-4"
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
              <Button type="submit" disabled={vc.status !== "online" || vc.joining}><Plus className="h-4 w-4" aria-hidden="true" /> Start room</Button>
            </form>
            {vc.rooms.length ? (
              <ul className="mt-4 divide-y divide-line">
                {vc.rooms.map((r) => {
                  const full = r.count >= r.max;
                  const here = vc.room?.id === r.id;
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{r.name}</p>
                        <p className="truncate text-sm text-muted">{r.members.map((m) => m.name).join(", ")} · {r.count}/{r.max}</p>
                      </div>
                      {here ? <Badge tone="green">You're here</Badge> : (
                        <Button size="sm" variant="outline" disabled={full || vc.joining || vc.status !== "online"} onClick={() => vc.joinRoom(r.id)}>
                          {full ? "Full" : "Join"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">No open rooms right now. Start one and invite other learners.</p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" /> Learners online <span className="text-base font-normal text-muted">({others.length})</span></h2>
            {others.length ? (
              <ul className="mt-4 divide-y divide-line">
                {others.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-3">
                    <Avatar initials={u.initials} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{u.name}</p>
                      <p className="text-sm text-muted">{u.busy ? "In a call" : "Available"}</p>
                    </div>
                    {inTeamRoom ? (
                      <Button size="sm" variant="outline" disabled={vc.room?.members.some((m) => m.id === u.id) || vc.peers.some((p) => p.id === u.id)} onClick={() => vc.inviteUser(u)}>
                        <UserPlus className="h-4 w-4" aria-hidden="true" /> Invite
                      </Button>
                    ) : (
                      <Button size="sm" disabled={Boolean(vc.room) || vc.joining || vc.status !== "online"} onClick={() => vc.callUser(u)}>
                        <Phone className="h-4 w-4" aria-hidden="true" /> Call
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">Nobody else is online right now. Start a team room and share the link with a friend.</p>
            )}
          </Card>
        </div>

        <p className="flex items-center gap-2 text-sm text-muted"><Lock className="h-4 w-4" aria-hidden="true" /> Calls are encrypted and go straight between browsers. Nothing is recorded.</p>
      </div>

    </>
  );
}
