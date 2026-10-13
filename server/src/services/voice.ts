import crypto from 'crypto';
import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { config } from '../config';
import { learnerFromToken } from './learners';

// Live voice chat between signed-in learners. Audio goes browser to browser over WebRTC
// (each person in a room connects to every other person, which is fine up to ~6 people).
// This server only does the "signaling": who is online, who is in which room, invitations,
// and passing WebRTC offers/answers/ICE candidates between the browsers. No audio passes
// through it. When a direct path between two browsers is blocked, the TURN server
// (coturn, see docker-compose.yml) relays the audio.

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
  invited: Set<string>;
  createdAt: number;
}

type Ack = (res: Record<string, unknown>) => void;

const MAX_NAME = 60;

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
    members: [...r.members.values()].map(({ id, name, initials }) => ({ id, name, initials })),
  });

  const memberDto = (m: Member) => ({ socketId: m.socketId, id: m.id, name: m.name, initials: m.initials, muted: m.muted });

  const broadcastPresence = () => {
    const users = [...socketsOf.entries()].map(([id, set]) => {
      const sock = [...set][0]!;
      const person = sock.data.person as Person;
      const inRoom = [...set].map((s) => roomOf.get(s.id)).find(Boolean);
      return { ...person, busy: Boolean(inRoom) };
    });
    io.emit('presence', users.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const broadcastRooms = () => {
    const list = [...rooms.values()].filter((r) => r.kind === 'team' && !r.isPrivate).sort((a, b) => b.createdAt - a.createdAt);
    io.emit('rooms', list.map(roomSummary));
  };

  const emitToUser = (userId: string, event: string, payload: unknown) => {
    for (const s of socketsOf.get(userId) ?? []) s.emit(event, payload);
  };

  function leave(socket: Socket) {
    const roomId = roomOf.get(socket.id);
    if (!roomId) return;
    roomOf.delete(socket.id);
    socket.leave(roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    room.members.delete(socket.id);
    socket.to(roomId).emit('peer:left', { socketId: socket.id });
    // A one-to-one call ends for both when either side hangs up.
    if (room.kind === 'direct') {
      for (const m of room.members.values()) {
        const other = io.sockets.sockets.get(m.socketId);
        if (other) {
          other.emit('room:ended', { roomId, reason: `${(socket.data.person as Person).name} ended the call.` });
          roomOf.delete(other.id);
          other.leave(roomId);
        }
      }
      room.members.clear();
    }
    if (room.members.size === 0) {
      rooms.delete(roomId);
      for (const userId of room.invited) emitToUser(userId, 'invite:cancelled', { roomId });
    }
  }

  function join(socket: Socket, room: Room) {
    leave(socket);
    const person = socket.data.person as Person;
    const peers = [...room.members.values()].map(memberDto);
    const me: Member = { ...person, socketId: socket.id, muted: false };
    room.members.set(socket.id, me);
    room.invited.delete(person.id);
    roomOf.set(socket.id, room.id);
    socket.join(room.id);
    socket.to(room.id).emit('peer:joined', memberDto(me));
    return { ok: true, room: roomSummary(room), peers, selfSocketId: socket.id };
  }

  const changed = () => {
    broadcastPresence();
    broadcastRooms();
  };

  const newRoomId = () => crypto.randomBytes(9).toString('base64url');
  const cleanName = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME) : fallback);
  const safeAck = (ack: unknown): Ack => (typeof ack === 'function' ? (ack as Ack) : () => {});

  io.on('connection', (socket) => {
    const person = socket.data.person as Person;
    if (!socketsOf.has(person.id)) socketsOf.set(person.id, new Set());
    socketsOf.get(person.id)!.add(socket);
    socket.emit('rooms', [...rooms.values()].filter((r) => r.kind === 'team' && !r.isPrivate).map(roomSummary));
    broadcastPresence();

    socket.on('room:create', (input: { name?: unknown; isPrivate?: unknown } = {}, ack?: unknown) => {
      const room: Room = {
        id: newRoomId(),
        name: cleanName(input?.name, `${person.name}'s room`),
        kind: 'team',
        isPrivate: input?.isPrivate === true,
        owner: person,
        members: new Map(),
        invited: new Set(),
        createdAt: Date.now(),
      };
      rooms.set(room.id, room);
      safeAck(ack)(join(socket, room));
      changed();
    });

    socket.on('room:join', (input: { roomId?: unknown } = {}, ack?: unknown) => {
      const reply = safeAck(ack);
      const room = typeof input?.roomId === 'string' ? rooms.get(input.roomId) : undefined;
      if (!room) return reply({ ok: false, message: 'This room has ended.' });
      if (roomOf.get(socket.id) === room.id) return reply({ ok: false, message: 'You are already in this room.' });
      if (room.kind === 'direct' && !room.invited.has(person.id)) return reply({ ok: false, message: 'This call is private.' });
      const max = room.kind === 'direct' ? 2 : config.voice.maxRoomSize;
      if (room.members.size >= max) return reply({ ok: false, message: `This room is full (${max} people).` });
      reply(join(socket, room));
      changed();
    });

    socket.on('room:leave', (_input: unknown, ack?: unknown) => {
      leave(socket);
      safeAck(ack)({ ok: true });
      changed();
    });

    socket.on('room:invite', (input: { userId?: unknown } = {}, ack?: unknown) => {
      const reply = safeAck(ack);
      const room = rooms.get(roomOf.get(socket.id) ?? '');
      const userId = typeof input?.userId === 'string' ? input.userId : '';
      if (!room) return reply({ ok: false, message: 'Join a room first.' });
      if (room.kind === 'direct') return reply({ ok: false, message: 'Start a team room to talk with more people.' });
      if (!socketsOf.has(userId)) return reply({ ok: false, message: 'This person is not online any more.' });
      room.invited.add(userId);
      emitToUser(userId, 'invite', { room: roomSummary(room), from: person });
      reply({ ok: true });
    });

    // One-to-one call: a two-person room, with the other learner invited (their phone rings).
    socket.on('call:user', (input: { userId?: unknown } = {}, ack?: unknown) => {
      const reply = safeAck(ack);
      const userId = typeof input?.userId === 'string' ? input.userId : '';
      if (userId === person.id) return reply({ ok: false, message: "You can't call yourself." });
      const target = socketsOf.get(userId);
      if (!target?.size) return reply({ ok: false, message: 'This person is not online any more.' });
      const callee = [...target][0]!.data.person as Person;
      const room: Room = {
        id: newRoomId(),
        name: `${person.name} & ${callee.name}`,
        kind: 'direct',
        isPrivate: true,
        owner: person,
        members: new Map(),
        invited: new Set([userId]),
        createdAt: Date.now(),
      };
      rooms.set(room.id, room);
      reply(join(socket, room));
      emitToUser(userId, 'invite', { room: roomSummary(room), from: person });
      changed();
    });

    socket.on('invite:decline', (input: { roomId?: unknown } = {}) => {
      const room = typeof input?.roomId === 'string' ? rooms.get(input.roomId) : undefined;
      if (!room || !room.invited.delete(person.id)) return;
      io.to(room.id).emit('invite:declined', { roomId: room.id, user: person });
      // Other tabs of the same learner stop ringing too.
      emitToUser(person.id, 'invite:cancelled', { roomId: room.id });
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
      leave(socket);
      const set = socketsOf.get(person.id);
      set?.delete(socket);
      if (set && set.size === 0) socketsOf.delete(person.id);
      changed();
    });
  });

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
