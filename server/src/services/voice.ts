import crypto from 'crypto';
import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { config } from '../config';
import { CallLog, Learner, type CallDirection, type CallOutcome } from '../db';
import { learnerFromToken } from './learners';
import { countCallSeconds, limitMessage, usageSummary } from './usage';

// Live voice chat between signed-in learners. Audio goes browser to browser over WebRTC
// (each person in a room connects to every other person, which is fine up to ~6 people).
// This server only does the "signaling": who is online, who is in which room, invitations,
// and passing WebRTC offers/answers/ICE candidates between the browsers. No audio passes
// through it. When a direct path between two browsers is blocked, the TURN server
// (coturn, see docker-compose.yml) relays the audio.
//
// It also keeps the books: talk time starts when a second person is in the room, counts
// against the learner's allowance (see usage.ts; the call is ended when it runs out), and each
// learner gets a row in call_logs when they leave a call.

/** STUN plus, when configured, TURN with time-limited credentials (coturn "use-auth-secret"). */
export function iceServersFor(learnerId: string) {
  const servers: { urls: string[]; username?: string; credential?: string }[] = [];
  if (config.voice.stunUrls.length) servers.push({ urls: config.voice.stunUrls });
  if (config.voice.turnUrls.length && config.voice.turnSecret) {
    const username = `${Math.floor(Date.now() / 1000) + 12 * 60 * 60}:${learnerId}`;
    const credential = crypto.createHmac('sha1', config.voice.turnSecret).update(username).digest('base64');
    servers.push({ urls: config.voice.turnUrls, username, credential });
  }
  return servers;
}

interface Person {
  id: string;
  name: string;
  initials: string;
}

interface Member extends Person {
  socketId: string;
  muted: boolean;
  direction: CallDirection;
  joinedAt: number;
  /** Set while this member is talking with at least one other person. */
  talkStartedAt: number | null;
  /** Talk seconds already counted (and saved). */
  talkSeconds: number;
  /** Everyone this member was in the call with. */
  metWith: Set<string>;
  limitTimer: ReturnType<typeof setTimeout> | null;
  /** Set while the member's connection is down; they are dropped if they don't come back. */
  offlineTimer: ReturnType<typeof setTimeout> | null;
}

interface Room {
  id: string;
  name: string;
  /** team: a group room anyone online can see and join. direct: a one-to-one call. */
  kind: 'team' | 'direct';
  /** Private team rooms are hidden from the list; only invited people (or the link) get in. */
  isPrivate: boolean;
  owner: Person;
  members: Map<string, Member>;
  invited: Map<string, Person>;
  createdAt: number;
  /** When a second person first joined. */
  answeredAt: number | null;
  ringTimer: ReturnType<typeof setTimeout> | null;
}

type Ack = (res: Record<string, unknown>) => void;

const MAX_NAME = 60;
/** How long a one-to-one call rings before it ends as "no answer". */
const RING_MS = 45_000;
/** How long someone whose connection dropped stays in the call, waiting for them to come back. */
const RESUME_GRACE_MS = 30_000;
const PAY_URL = '/learn/billing#plans';

export function attachVoice(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: '/api/socket.io',
    cors: config.corsOrigins.length ? { origin: config.corsOrigins } : undefined,
    serveClient: false,
    maxHttpBufferSize: 64 * 1024,
  });

  const rooms = new Map<string, Room>();
  const roomOf = new Map<string, string>(); // socket id -> room id
  const socketsOf = new Map<string, Set<Socket>>(); // learner id -> sockets (several tabs)

  io.use(async (socket, next) => {
    const learner = await learnerFromToken(socket.handshake.auth?.token).catch(() => null);
    if (!learner) return next(new Error('unauthorized'));
    socket.data.person = { id: learner.id, name: learner.name, initials: initialsOf(learner.name) } satisfies Person;
    next();
  });

  const roomSummary = (r: Room) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    isPrivate: r.isPrivate,
    owner: r.owner,
    count: r.members.size,
    max: r.kind === 'direct' ? 2 : config.voice.maxRoomSize,
    answeredAt: r.answeredAt ? new Date(r.answeredAt).toISOString() : null,
    members: [...r.members.values()].map(({ id, name, initials }) => ({ id, name, initials })),
  });

  const memberDto = (m: Member) => ({ socketId: m.socketId, id: m.id, name: m.name, initials: m.initials, muted: m.muted, reconnecting: Boolean(m.offlineTimer) });

  const inCall = (userId: string) => [...(socketsOf.get(userId) ?? [])].some((s) => roomOf.has(s.id));

  const broadcastPresence = () => {
    const users = [...socketsOf.entries()].map(([id, set]) => {
      const person = [...set][0]!.data.person as Person;
      return { ...person, busy: inCall(id) };
    });
    io.emit('presence', users.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const publicRooms = () => [...rooms.values()].filter((r) => r.kind === 'team' && !r.isPrivate).sort((a, b) => b.createdAt - a.createdAt).map(roomSummary);
  const broadcastRooms = () => io.emit('rooms', publicRooms());

  const changed = () => {
    broadcastPresence();
    broadcastRooms();
  };

  const emitToUser = (userId: string, event: string, payload: unknown) => {
    for (const s of socketsOf.get(userId) ?? []) s.emit(event, payload);
  };

  // ---- Talk time and allowances ----

  /** Remaining call seconds for a learner (null = no limit), or why they can't call. */
  async function callAllowance(userId: string) {
    const learner = await Learner.findByPk(userId);
    if (!learner || !learner.active) return { ok: false as const, message: 'Your account cannot make calls. Please contact us.' };
    const { call } = await usageSummary(learner);
    if (call.remaining !== null && call.remaining <= 0) return { ok: false as const, message: limitMessage('call', call), code: 'limit', redirect: PAY_URL };
    return { ok: true as const, remaining: call.remaining };
  }

  function stopTalking(m: Member) {
    if (m.limitTimer) clearTimeout(m.limitTimer);
    m.limitTimer = null;
    if (m.talkStartedAt === null) return;
    const seconds = (Date.now() - m.talkStartedAt) / 1000;
    m.talkStartedAt = null;
    m.talkSeconds += seconds;
    countCallSeconds(m.id, seconds).catch((err) => console.error('Could not save call time', err));
  }

  function startTalking(m: Member) {
    if (m.talkStartedAt !== null) return;
    const started = Date.now();
    m.talkStartedAt = started;
    callAllowance(m.id)
      .then((a) => {
        if (m.talkStartedAt !== started) return; // stopped meanwhile
        const remainingMs = a.ok ? (a.remaining === null ? null : a.remaining * 1000) : 0;
        if (remainingMs === null) return;
        m.limitTimer = setTimeout(() => endForLimit(m), Math.max(0, remainingMs - (Date.now() - started)));
      })
      .catch((err) => console.error('Could not check call allowance', err));
  }

  /** Talk time runs for everyone while two or more people are in the room. */
  function syncTalking(room: Room) {
    const talking = room.members.size >= 2;
    if (talking && room.answeredAt === null) {
      room.answeredAt = Date.now();
      if (room.ringTimer) clearTimeout(room.ringTimer);
      room.ringTimer = null;
    }
    const names = [...room.members.values()].map((m) => m.name);
    for (const m of room.members.values()) {
      for (const n of names) if (n !== m.name) m.metWith.add(n);
      if (talking) startTalking(m);
      else stopTalking(m);
    }
  }

  function endForLimit(m: Member) {
    const socketId = m.socketId;
    if (!roomOf.has(socketId)) return;
    leaveRoom(socketId, 'limit', `${m.name}'s call minutes ran out. The call ended.`);
    changed();
    Learner.findByPk(m.id)
      .then(async (learner) => (learner ? limitMessage('call', (await usageSummary(learner)).call) : null))
      .catch(() => null)
      .then((message) => io.to(socketId).emit('limit:reached', { message: message ?? 'Your call minutes are used up.', redirect: PAY_URL }));
  }

  // ---- Call history ----

  function logCall(room: Room, m: Pick<Member, 'id' | 'direction' | 'joinedAt' | 'talkSeconds' | 'metWith'>, outcome: CallOutcome) {
    const others = [...m.metWith];
    if (!others.length && room.kind === 'direct') {
      others.push(...[room.owner, ...room.invited.values()].filter((p) => p.id !== m.id).map((p) => p.name));
    }
    CallLog.create({
      learnerId: m.id,
      roomId: room.id,
      roomName: room.name.slice(0, 160),
      kind: room.kind,
      direction: m.direction,
      withNames: others.join(', ').slice(0, 500),
      startedAt: new Date(m.joinedAt),
      endedAt: new Date(),
      talkSeconds: Math.round(m.talkSeconds),
      outcome,
    }).catch((err) => console.error('Could not save call history', err));
  }

  function finishMember(room: Room, m: Member, outcome?: CallOutcome) {
    stopTalking(m);
    if (m.offlineTimer) clearTimeout(m.offlineTimer);
    m.offlineTimer = null;
    const final: CallOutcome = outcome === 'limit' || outcome === 'dropped' ? outcome : m.talkSeconds >= 1 ? 'completed' : (outcome ?? 'cancelled');
    logCall(room, m, final);
  }

  /** Takes a socket out of its room. A one-to-one call ends for both when either side leaves. */
  function leaveRoom(socketId: string, outcome?: CallOutcome, reasonForOthers?: string) {
    const roomId = roomOf.get(socketId);
    if (!roomId) return;
    roomOf.delete(socketId);
    io.sockets.sockets.get(socketId)?.leave(roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    const me = room.members.get(socketId);
    room.members.delete(socketId);
    if (me) finishMember(room, me, outcome);
    io.to(roomId).emit('peer:left', { socketId });
    if (room.kind === 'direct') {
      const name = me?.name ?? 'The other person';
      for (const m of [...room.members.values()]) {
        room.members.delete(m.socketId);
        roomOf.delete(m.socketId);
        io.sockets.sockets.get(m.socketId)?.leave(roomId);
        // The other side's outcome mirrors the leaver's (declined, no answer…), or simply "completed".
        const theirs: CallOutcome | undefined = outcome === 'no-answer' || outcome === 'declined' || outcome === 'cancelled' ? outcome : outcome === 'dropped' ? 'dropped' : undefined;
        finishMember(room, m, theirs);
        io.to(m.socketId).emit('room:ended', { roomId, outcome: theirs ?? 'completed', reason: reasonForOthers ?? `${name} ended the call.` });
      }
    } else {
      syncTalking(room);
    }
    if (room.members.size === 0) closeRoom(room);
  }

  function closeRoom(room: Room) {
    rooms.delete(room.id);
    if (room.ringTimer) clearTimeout(room.ringTimer);
    room.ringTimer = null;
    for (const [userId, p] of room.invited) {
      emitToUser(userId, 'invite:cancelled', { roomId: room.id });
      // Someone rang this learner and they never picked up.
      if (room.kind === 'direct' && room.answeredAt === null) {
        logCall(room, { id: p.id, direction: 'incoming', joinedAt: room.createdAt, talkSeconds: 0, metWith: new Set([room.owner.name]) }, 'missed');
      }
    }
    room.invited.clear();
  }

  function join(socket: Socket, room: Room, direction: CallDirection) {
    leaveRoom(socket.id);
    const person = socket.data.person as Person;
    const peers = [...room.members.values()].map(memberDto);
    const me: Member = {
      ...person, socketId: socket.id, muted: false, direction, joinedAt: Date.now(),
      talkStartedAt: null, talkSeconds: 0, metWith: new Set(), limitTimer: null, offlineTimer: null,
    };
    room.members.set(socket.id, me);
    room.invited.delete(person.id);
    roomOf.set(socket.id, room.id);
    socket.join(room.id);
    socket.to(room.id).emit('peer:joined', memberDto(me));
    syncTalking(room);
    return { ok: true, room: roomSummary(room), peers, selfSocketId: socket.id };
  }

  const newRoomId = () => crypto.randomBytes(9).toString('base64url');
  const cleanName = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME) : fallback);
  const safeAck = (ack: unknown): Ack => (typeof ack === 'function' ? (ack as Ack) : () => {});
  const newRoom = (owner: Person, kind: Room['kind'], name: string, isPrivate: boolean): Room => ({
    id: newRoomId(), name, kind, isPrivate, owner, members: new Map(), invited: new Map(), createdAt: Date.now(), answeredAt: null, ringTimer: null,
  });

  io.on('connection', (socket) => {
    const person = socket.data.person as Person;
    if (!socketsOf.has(person.id)) socketsOf.set(person.id, new Set());
    socketsOf.get(person.id)!.add(socket);
    socket.emit('rooms', publicRooms());
    broadcastPresence();

    socket.on('room:create', async (input: { name?: unknown; isPrivate?: unknown } = {}, ack?: unknown) => {
      const reply = safeAck(ack);
      const allowed = await callAllowance(person.id).catch(() => null);
      if (!allowed?.ok) return reply(allowed ?? { ok: false, message: 'Please try again.' });
      const room = newRoom(person, 'team', cleanName(input?.name, `${person.name}'s room`), input?.isPrivate === true);
      rooms.set(room.id, room);
      reply(join(socket, room, 'room'));
      changed();
    });

    socket.on('room:join', async (input: { roomId?: unknown } = {}, ack?: unknown) => {
      const reply = safeAck(ack);
      const room = typeof input?.roomId === 'string' ? rooms.get(input.roomId) : undefined;
      if (!room) return reply({ ok: false, message: 'This call has ended.' });
      if (roomOf.get(socket.id) === room.id) return reply({ ok: false, message: 'You are already in this call.' });
      if (room.kind === 'direct' && !room.invited.has(person.id)) return reply({ ok: false, message: 'This call is private.' });
      const max = room.kind === 'direct' ? 2 : config.voice.maxRoomSize;
      if (room.members.size >= max) return reply({ ok: false, message: `This room is full (${max} people).` });
      const allowed = await callAllowance(person.id).catch(() => null);
      if (!allowed?.ok) {
        // Answering was not possible, so the caller should stop ringing.
        if (room.kind === 'direct') declineDirect(room, `${person.name} can't take calls right now.`, 'declined');
        return reply(allowed ?? { ok: false, message: 'Please try again.' });
      }
      if (!rooms.has(room.id)) return reply({ ok: false, message: 'This call has ended.' });
      reply(join(socket, room, room.kind === 'direct' ? 'incoming' : 'room'));
      changed();
    });

    socket.on('room:leave', (input: { reason?: unknown } = {}, ack?: unknown) => {
      const outcome = input?.reason === 'no-answer' ? 'no-answer' : undefined;
      leaveRoom(socket.id, outcome);
      safeAck(ack)({ ok: true });
      changed();
    });

    // After a dropped connection: take back this learner's place in the call they were in.
    socket.on('room:resume', (input: { roomId?: unknown; previousSocketId?: unknown } = {}, ack?: unknown) => {
      const reply = safeAck(ack);
      const room = typeof input?.roomId === 'string' ? rooms.get(input.roomId) : undefined;
      const prev = typeof input?.previousSocketId === 'string' ? input.previousSocketId : '';
      const m = room?.members.get(prev);
      if (!room || !m || m.id !== person.id) return reply({ ok: false, message: 'The call ended while you were offline.' });
      if (m.offlineTimer) clearTimeout(m.offlineTimer);
      m.offlineTimer = null;
      room.members.delete(prev);
      roomOf.delete(prev);
      m.socketId = socket.id;
      room.members.set(socket.id, m);
      roomOf.set(socket.id, room.id);
      socket.join(room.id);
      socket.to(room.id).emit('peer:resumed', { from: prev, to: socket.id });
      reply({ ok: true, room: roomSummary(room), peers: [...room.members.values()].filter((x) => x !== m).map(memberDto), selfSocketId: socket.id });
      changed();
    });

    socket.on('room:invite', (input: { userId?: unknown } = {}, ack?: unknown) => {
      const reply = safeAck(ack);
      const room = rooms.get(roomOf.get(socket.id) ?? '');
      const userId = typeof input?.userId === 'string' ? input.userId : '';
      if (!room) return reply({ ok: false, message: 'Join a room first.' });
      if (room.kind === 'direct') return reply({ ok: false, message: 'Start a team room to talk with more people.' });
      const target = socketsOf.get(userId);
      if (!target?.size) return reply({ ok: false, message: 'This person is not online any more.' });
      room.invited.set(userId, [...target][0]!.data.person as Person);
      emitToUser(userId, 'invite', { room: roomSummary(room), from: person, busy: inCall(userId) });
      reply({ ok: true });
    });

    // One-to-one call: a two-person room, with the other learner invited (their phone rings).
    socket.on('call:user', async (input: { userId?: unknown } = {}, ack?: unknown) => {
      const reply = safeAck(ack);
      const userId = typeof input?.userId === 'string' ? input.userId : '';
      if (userId === person.id) return reply({ ok: false, message: "You can't call yourself." });
      const allowed = await callAllowance(person.id).catch(() => null);
      if (!allowed?.ok) return reply(allowed ?? { ok: false, message: 'Please try again.' });
      const target = socketsOf.get(userId);
      if (!target?.size) return reply({ ok: false, message: 'This person is not online any more.' });
      const callee = [...target][0]!.data.person as Person;
      const busy = inCall(userId);
      const room = newRoom(person, 'direct', `${person.name} & ${callee.name}`, true);
      room.invited.set(userId, callee);
      rooms.set(room.id, room);
      const res = join(socket, room, 'outgoing');
      room.ringTimer = setTimeout(() => {
        if (rooms.get(room.id) === room && room.answeredAt === null) declineDirect(room, `${callee.name} didn't answer.`, 'no-answer');
      }, RING_MS);
      reply({ ...res, callee, busy });
      emitToUser(userId, 'invite', { room: roomSummary(room), from: person, busy });
      changed();
    });

    socket.on('invite:decline', (input: { roomId?: unknown } = {}) => {
      const room = typeof input?.roomId === 'string' ? rooms.get(input.roomId) : undefined;
      const me = room?.invited.get(person.id);
      if (!room || !me) return;
      room.invited.delete(person.id);
      // Other tabs of the same learner stop ringing too.
      emitToUser(person.id, 'invite:cancelled', { roomId: room.id });
      if (room.kind === 'direct') {
        logCall(room, { id: person.id, direction: 'incoming', joinedAt: room.createdAt, talkSeconds: 0, metWith: new Set([room.owner.name]) }, 'declined');
        declineDirect(room, `${person.name} can't talk right now.`, 'declined');
      } else {
        io.to(room.id).emit('invite:declined', { roomId: room.id, user: person });
      }
    });

    // On a call and someone else rings: bring them into this call (it becomes a group call).
    socket.on('call:merge', (input: { roomId?: unknown } = {}, ack?: unknown) => {
      const reply = safeAck(ack);
      const incoming = typeof input?.roomId === 'string' ? rooms.get(input.roomId) : undefined;
      const current = rooms.get(roomOf.get(socket.id) ?? '');
      if (!incoming || !incoming.invited.has(person.id)) return reply({ ok: false, message: 'That call has ended.' });
      if (!current) return reply({ ok: false, message: 'You are not in a call any more. Answer it instead.' });
      if (current.members.size + incoming.members.size > config.voice.maxRoomSize) {
        return reply({ ok: false, message: `A group call can have up to ${config.voice.maxRoomSize} people.` });
      }
      if (current.kind === 'direct') {
        current.kind = 'team';
        current.isPrivate = true;
        current.name = 'Group call';
      }
      incoming.invited.delete(person.id);
      emitToUser(person.id, 'invite:cancelled', { roomId: incoming.id });
      for (const m of [...incoming.members.values()]) {
        const s = io.sockets.sockets.get(m.socketId);
        incoming.members.delete(m.socketId);
        roomOf.delete(m.socketId);
        s?.leave(incoming.id);
        if (!s) continue;
        current.invited.set(m.id, m);
        s.emit('room:moved', join(s, current, m.direction));
      }
      closeRoom(incoming);
      io.to(current.id).emit('room:updated', roomSummary(current));
      reply({ ok: true });
      changed();
    });

    // WebRTC offers, answers and ICE candidates, passed only between people in the same room.
    socket.on('signal', (input: { to?: unknown; data?: unknown } = {}) => {
      const to = typeof input?.to === 'string' ? input.to : '';
      const roomId = roomOf.get(socket.id);
      if (!roomId || roomOf.get(to) !== roomId || input.data === undefined) return;
      io.to(to).emit('signal', { from: socket.id, data: input.data });
    });

    socket.on('mute', (input: { muted?: unknown } = {}) => {
      const room = rooms.get(roomOf.get(socket.id) ?? '');
      const me = room?.members.get(socket.id);
      if (!room || !me) return;
      me.muted = input?.muted === true;
      socket.to(room.id).emit('peer:muted', { socketId: socket.id, muted: me.muted });
    });

    socket.on('disconnect', () => {
      const set = socketsOf.get(person.id);
      set?.delete(socket);
      if (set && set.size === 0) socketsOf.delete(person.id);
      // A dropped connection (phone switching networks, a Wi-Fi blip) keeps the call going for a
      // while: the audio usually still flows browser to browser, and the learner's page
      // reconnects and takes its place back with room:resume.
      const room = rooms.get(roomOf.get(socket.id) ?? '');
      const m = room?.members.get(socket.id);
      if (room && m && room.members.size > 1) {
        socket.to(room.id).emit('peer:reconnecting', { socketId: socket.id });
        m.offlineTimer = setTimeout(() => {
          m.offlineTimer = null;
          leaveRoom(m.socketId, 'dropped', `${m.name} lost their connection. The call ended.`);
          changed();
        }, RESUME_GRACE_MS);
      } else {
        leaveRoom(socket.id);
      }
      changed();
    });
  });

  /** Ends a one-to-one call that was never answered, telling the caller why. */
  function declineDirect(room: Room, reason: string, outcome: CallOutcome) {
    for (const m of [...room.members.values()]) {
      room.members.delete(m.socketId);
      roomOf.delete(m.socketId);
      io.sockets.sockets.get(m.socketId)?.leave(room.id);
      finishMember(room, m, outcome);
      io.to(m.socketId).emit('room:ended', { roomId: room.id, outcome, reason });
    }
    if (outcome === 'declined') room.invited.clear(); // the callee's own row is already written
    closeRoom(room);
    changed();
  }

  return io;
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || 'ST'
  );
}
