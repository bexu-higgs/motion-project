import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  ClockSync,
  type Ack,
  type ChatMessage,
  type ClientToServerEvents,
  type Member,
  type PlaybackAction,
  type PlaybackState,
  type QueueItem,
  type RemovalReason,
  type Role,
  type RoomInfo,
  type RoomNotice,
  type RoomSnapshot,
  type ServerToClientEvents,
  type ShareState,
} from '@birge/shared';
import { apiBaseUrl, getApiToken, type ClientErrorCode } from '@/lib/api';

type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ChatEntry =
  | { kind: 'message'; id: string; message: ChatMessage }
  | { kind: 'notice'; id: string; notice: RoomNotice; at: number };

export type RoomStatus = 'connecting' | 'ready' | 'reconnecting' | 'removed' | 'error';

export interface RoomState {
  status: RoomStatus;
  error: ClientErrorCode | null;
  removedReason: RemovalReason | null;
  room: RoomInfo | null;
  role: Role;
  members: Member[];
  queue: QueueItem[];
  playback: PlaybackState | null;
  share: ShareState | null;
  chat: ChatEntry[];
  voice: boolean;
}

const INITIAL: RoomState = {
  status: 'connecting',
  error: null,
  removedReason: null,
  room: null,
  role: 'member',
  members: [],
  queue: [],
  playback: null,
  share: null,
  chat: [],
  voice: false,
};

const MAX_CHAT = 300;
let noticeCounter = 0;

/**
 * Бөлмеге Socket.IO арқылы қосылады: күйді алады, өзгерістерді тыңдайды,
 * сервер сағатымен синхрондалады және әрекеттерді жібереді.
 */
export function useRoom(roomId: string) {
  const [state, setState] = useState<RoomState>(INITIAL);
  const socketRef = useRef<RoomSocket | null>(null);
  const clockRef = useRef(new ClockSync());

  useEffect(() => {
    const socket: RoomSocket = io(apiBaseUrl(), {
      auth: { token: getApiToken() },
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;
    let removed = false;

    const syncClock = async (samples: number) => {
      for (let i = 0; i < samples; i++) {
        const t0 = Date.now();
        try {
          const serverTime = await socket.timeout(3000).emitWithAck('time:sync', t0);
          clockRef.current.addSample(t0, serverTime, Date.now());
        } catch {
          return;
        }
      }
    };

    const join = async () => {
      await syncClock(5);
      try {
        const res = await socket.timeout(10_000).emitWithAck('room:join', { roomId });
        if (!res.ok) {
          setState((s) => ({ ...s, status: 'error', error: res.error }));
          return;
        }
        const snap: RoomSnapshot = res.data;
        setState((s) => ({
          ...s,
          status: 'ready',
          error: null,
          room: snap.room,
          role: snap.role,
          members: snap.members,
          queue: snap.queue,
          playback: snap.playback,
          share: snap.share,
          voice: snap.voice,
          chat: snap.messages.map((m) => ({ kind: 'message', id: m.id, message: m })),
        }));
      } catch {
        setState((s) => ({ ...s, status: 'reconnecting' }));
      }
    };

    socket.on('connect', () => void join());
    socket.on('disconnect', () => {
      if (!removed) setState((s) => ({ ...s, status: 'reconnecting' }));
    });
    socket.on('connect_error', (err) => {
      if (err.message === 'unauthorized' || err.message === 'terms_required') {
        setState((s) => ({ ...s, status: 'error', error: err.message as ClientErrorCode }));
        socket.disconnect();
      } else {
        setState((s) => (s.status === 'connecting' ? s : { ...s, status: 'reconnecting' }));
      }
    });

    socket.on('room:members', (members) => setState((s) => ({ ...s, members })));
    socket.on('room:queue', (queue) => setState((s) => ({ ...s, queue })));
    socket.on('room:playback', (playback) =>
      setState((s) => (s.playback && s.playback.seq > playback.seq && s.playback.itemId === playback.itemId ? s : { ...s, playback })),
    );
    socket.on('room:share', (share) => setState((s) => ({ ...s, share })));
    socket.on('room:updated', (room) => setState((s) => ({ ...s, room })));
    socket.on('room:role', (role) => setState((s) => ({ ...s, role })));
    socket.on('room:notice', (notice) =>
      setState((s) => ({
        ...s,
        chat: [...s.chat, { kind: 'notice' as const, id: `n${++noticeCounter}`, notice, at: Date.now() }].slice(-MAX_CHAT),
      })),
    );
    socket.on('chat:message', (message) =>
      setState((s) =>
        s.chat.some((c) => c.id === message.id)
          ? s
          : { ...s, chat: [...s.chat, { kind: 'message' as const, id: message.id, message }].slice(-MAX_CHAT) },
      ),
    );
    socket.on('chat:deleted', ({ id }) => setState((s) => ({ ...s, chat: s.chat.filter((c) => c.id !== id) })));
    socket.on('room:removed', ({ reason }) => {
      removed = true;
      setState((s) => ({ ...s, status: 'removed', removedReason: reason }));
      socket.disconnect();
    });
    socket.on('session:ended', () => {
      removed = true;
      setState((s) => ({ ...s, status: 'error', error: 'unauthorized' }));
    });

    // Сағат айырмасы уақыт өте өзгеруі мүмкін — анда-санда қайта өлшейміз.
    const clockTimer = setInterval(() => void syncClock(2), 30_000);

    return () => {
      clearInterval(clockTimer);
      if (socket.connected) socket.emit('room:leave', { roomId });
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  const call = useCallback(async <E extends AckEvent>(event: E, payload: AckPayload<E>): Promise<AckResult<E>> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, error: 'network' } as AckResult<E>;
    try {
      return await (socket.timeout(10_000).emitWithAck as (ev: string, p: unknown) => Promise<AckResult<E>>)(event, payload);
    } catch {
      return { ok: false, error: 'network' } as AckResult<E>;
    }
  }, []);

  const actions = useMemo(
    () => ({
      control: (action: PlaybackAction, position: number) => call('playback:control', { roomId, action, position }),
      select: (itemId: string) => call('playback:select', { roomId, itemId }),
      ended: (itemId: string, seq: number) => socketRef.current?.emit('playback:ended', { roomId, itemId, seq }),
      addUrl: (url: string, title?: string) => call('queue:add', { roomId, url, title: title || undefined }),
      remove: (itemId: string) => call('queue:remove', { roomId, itemId }),
      setShare: (active: boolean) => call('share:set', { roomId, active }),
      sendChat: (body: string) => call('chat:send', { roomId, body }),
      deleteMessage: (messageId: string) => call('chat:delete', { roomId, messageId }),
      setRole: (userId: string, role: 'admin' | 'member') => call('member:role', { roomId, userId, role }),
      removeMember: (userId: string, ban: boolean) => call('member:remove', { roomId, userId, ban }),
      mute: (userId: string) => call('member:mute', { roomId, userId }),
    }),
    [call, roomId],
  );

  return { state, actions, clock: clockRef.current };
}

type AckEvent = {
  [E in keyof ClientToServerEvents]: Parameters<ClientToServerEvents[E]> extends [unknown, (r: infer R) => void]
    ? R extends { ok: boolean }
      ? E
      : never
    : never;
}[keyof ClientToServerEvents];
type AckPayload<E extends keyof ClientToServerEvents> = Parameters<ClientToServerEvents[E]>[0];
type AckResult<E extends keyof ClientToServerEvents> =
  Parameters<ClientToServerEvents[E]> extends [unknown, (r: infer R) => void] ? R | { ok: false; error: 'network' } : never;

export type RoomActions = ReturnType<typeof useRoom>['actions'];
