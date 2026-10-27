import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  CHAT_MAX_LENGTH,
  MEDIA_TITLE_MAX_LENGTH,
  canControl,
  parseMediaUrl,
  titleFromFileName,
  type Ack,
  type ClientToServerEvents,
  type Member,
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
import { AppError, isAppError } from '../lib/errors';
import { RateLimiter } from '../lib/rate-limit';
import type { MediaStore } from '../media/store';
import { filterText } from '../moderation/filter';
import type { Logger } from '../notify';
import type { VoiceService } from '../voice/livekit';
import { applyControl, initialPlayback, nextItemId, pauseAt, selectItem } from './playback';
import { isUuid, toRoomInfo, type QueueRow, type RoomRepo } from './repo';

export interface SocketData {
  user: { id: string; displayName: string };
  token: string;
  roomId?: string;
}

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

interface LiveRoom {
  id: string;
  playback: PlaybackState;
  share: ShareState | null;
  /** userId → сол қолданушының осы бөлмедегі сокеттері. */
  presence: Map<string, Set<string>>;
}

const roomKey = (id: string) => `room:${id}`;
export const userKey = (id: string) => `user:${id}`;

const RoomIdSchema = z.object({ roomId: z.string().refine(isUuid) });
const ControlSchema = RoomIdSchema.extend({ action: z.enum(['play', 'pause', 'seek']), position: z.number().finite() });
const ItemSchema = RoomIdSchema.extend({ itemId: z.string().refine(isUuid) });
const EndedSchema = ItemSchema.extend({ seq: z.number().int() });
const QueueAddSchema = RoomIdSchema.extend({ url: z.string().max(4096), title: z.string().max(500).optional() });
const ShareSchema = RoomIdSchema.extend({ active: z.boolean() });
const ChatSchema = RoomIdSchema.extend({ body: z.string().max(CHAT_MAX_LENGTH * 2) });
const ChatDeleteSchema = RoomIdSchema.extend({ messageId: z.string().refine(isUuid) });
const RoleSchema = RoomIdSchema.extend({ userId: z.string().refine(isUuid), role: z.enum(['admin', 'member']) });
const RemoveSchema = RoomIdSchema.extend({ userId: z.string().refine(isUuid), ban: z.boolean() });
const MuteSchema = RoomIdSchema.extend({ userId: z.string().refine(isUuid) });

export function cleanTitle(input: string): string {
  return input
    .replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MEDIA_TITLE_MAX_LENGTH);
}

/**
 * Бөлмелердің «тірі» күйі: кім онлайн, не ойнап тұр, кім экранын бөлісіп жатыр.
 * Барлық өзгеріс серверде шешіліп, бөлмедегілердің бәріне таратылады.
 */
export class RoomHub {
  private readonly live = new Map<string, LiveRoom>();
  private readonly chatLimiter = new RateLimiter(5, 5000);
  private readonly actionLimiter = new RateLimiter(40, 10_000);

  constructor(
    private readonly io: IO,
    private readonly repo: RoomRepo,
    private readonly media: MediaStore,
    private readonly voice: VoiceService,
    private readonly log: Logger,
    private readonly fetchTitle: (videoId: string) => Promise<string | null>,
  ) {}

  // ---------- Сыртқы (REST) әрекеттер ----------

  onlineCount(roomId: string): number {
    return this.live.get(roomId)?.presence.size ?? 0;
  }

  roomUpdated(room: RoomInfo): void {
    this.io.to(roomKey(room.id)).emit('room:updated', room);
  }

  messageDeleted(roomId: string, messageId: string): void {
    this.io.to(roomKey(roomId)).emit('chat:deleted', { id: messageId });
  }

  /** Кезек өзгергенде: бәріне таратамыз; ештеңе таңдалмаса — біріншісін (кідіртілген күйде) таңдаймыз. */
  async queueChanged(roomId: string): Promise<void> {
    const live = await this.liveRoom(roomId);
    const queue = await this.repo.queue(roomId);
    const current = live.playback.itemId;
    const missing = current !== null && !queue.some((q) => q.id === current);
    this.io.to(roomKey(roomId)).emit(
      'room:queue',
      queue.map((r) => this.toItem(r)),
    );
    if ((!current && queue[0]) || missing) {
      live.playback = selectItem(live.playback, queue[0]?.id ?? null, Date.now(), false);
      this.broadcastPlayback(live);
      await this.savePlayback(live);
    }
  }

  async roomDeleted(roomId: string): Promise<void> {
    this.io.to(roomKey(roomId)).emit('room:removed', { roomId, reason: 'closed' });
    const sockets = await this.io.in(roomKey(roomId)).fetchSockets();
    for (const s of sockets) s.data.roomId = undefined;
    this.io.socketsLeave(roomKey(roomId));
    this.live.delete(roomId);
    await this.voice.deleteRoom(roomId);
  }

  /** Қолданушы бөлмеден шықты/шығарылды — оның сокеттерін бөлмеден ажыратамыз. */
  async userRemoved(roomId: string, userId: string, reason: RemovalReason): Promise<void> {
    const sockets = await this.io.in(userKey(userId)).fetchSockets();
    for (const s of sockets) {
      if (s.data.roomId !== roomId) continue;
      s.emit('room:removed', { roomId, reason });
      s.leave(roomKey(roomId));
      s.data.roomId = undefined;
    }
    const live = this.live.get(roomId);
    if (live) {
      live.presence.delete(userId);
      if (live.share?.userId === userId) this.setShare(live, null);
    }
    await this.voice.removeParticipant(roomId, userId);
    await this.broadcastMembers(roomId);
  }

  /** Шығу, аккаунтты жою немесе бұғаттау кезінде барлық сокеттерді жабамыз. */
  endUserSessions(userId: string): void {
    this.io.to(userKey(userId)).emit('session:ended');
    this.io.in(userKey(userId)).disconnectSockets(true);
  }

  // ---------- Socket.IO ----------

  attach(): void {
    this.io.on('connection', (socket) => this.onConnection(socket));
  }

  private onConnection(socket: ClientSocket): void {
    socket.join(userKey(socket.data.user.id));

    socket.on('time:sync', (_clientTime, ack) => {
      if (typeof ack === 'function') ack(Date.now());
    });

    this.on(socket, 'room:join', RoomIdSchema, (p) => this.join(socket, p.roomId));
    socket.on('room:leave', (p) => {
      if (p && socket.data.roomId === p.roomId) void this.leave(socket);
    });
    this.on(socket, 'playback:control', ControlSchema, (p) => this.control(socket, p.roomId, p.action, p.position));
    this.on(socket, 'playback:select', ItemSchema, (p) => this.select(socket, p.roomId, p.itemId));
    this.on(socket, 'playback:ended', EndedSchema, (p) => this.ended(socket, p.roomId, p.itemId, p.seq));
    this.on(socket, 'queue:add', QueueAddSchema, (p) => this.addToQueue(socket, p.roomId, p.url, p.title));
    this.on(socket, 'queue:remove', ItemSchema, (p) => this.removeFromQueue(socket, p.roomId, p.itemId));
    this.on(socket, 'share:set', ShareSchema, (p) => this.share(socket, p.roomId, p.active));
    this.on(socket, 'chat:send', ChatSchema, (p) => this.chat(socket, p.roomId, p.body));
    this.on(socket, 'chat:delete', ChatDeleteSchema, (p) => this.deleteMessage(socket, p.roomId, p.messageId));
    this.on(socket, 'member:role', RoleSchema, (p) => this.setRole(socket, p.roomId, p.userId, p.role));
    this.on(socket, 'member:remove', RemoveSchema, (p) => this.removeMember(socket, p.roomId, p.userId, p.ban));
    this.on(socket, 'member:mute', MuteSchema, (p) => this.mute(socket, p.roomId, p.userId));

    socket.on('disconnect', () => {
      if (socket.data.roomId) void this.leave(socket);
    });
  }

  /** Оқиғаны тексеріп, қатені клиентке код ретінде қайтаратын орама. */
  private on<S extends z.ZodType>(
    socket: ClientSocket,
    event: keyof ClientToServerEvents,
    schema: S,
    handler: (payload: z.infer<S>) => Promise<unknown>,
  ): void {
    (socket.on as (ev: string, fn: (...args: unknown[]) => void) => void)(event, async (payload: unknown, ack?: unknown) => {
      const reply = (r: Ack<unknown>) => {
        if (typeof ack === 'function') ack(r);
      };
      if (!this.actionLimiter.take(socket.data.user.id)) return reply({ ok: false, error: 'rate_limited' });
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return reply({ ok: false, error: 'invalid_input' });
      try {
        const data = await handler(parsed.data);
        reply({ ok: true, data: data ?? null });
      } catch (err) {
        if (!isAppError(err)) this.log.error({ err, event }, 'socket handler failed');
        reply({ ok: false, error: isAppError(err) ? err.code : 'server_error' });
      }
    });
  }

  private async liveRoom(roomId: string): Promise<LiveRoom> {
    let live = this.live.get(roomId);
    if (live) return live;
    const room = await this.repo.get(roomId);
    if (!room) throw new AppError('not_found');
    live = this.live.get(roomId); // await кезінде басқа сокет жасап үлгеруі мүмкін
    if (live) return live;
    live = { id: roomId, playback: room.playback ?? initialPlayback(Date.now()), share: null, presence: new Map() };
    this.live.set(roomId, live);
    return live;
  }

  /** Сокет осы бөлмеде отырғанын және рөлін тексереді. */
  private async context(socket: ClientSocket, roomId: string, needControl = false) {
    if (socket.data.roomId !== roomId) throw new AppError('room_not_joined');
    const membership = await this.repo.membership(roomId, socket.data.user.id);
    if (!membership || membership.banned) throw new AppError('room_not_joined');
    if (needControl && !canControl(membership.role)) throw new AppError('forbidden');
    return { live: await this.liveRoom(roomId), role: membership.role };
  }

  private toItem(row: QueueRow): QueueItem {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      mediaType: row.media_type,
      src: row.kind === 'upload' && row.upload_id ? this.media.signedUrl(row.upload_id) : row.source,
      hls: row.hls,
      addedBy: row.added_by,
    };
  }

  private async members(roomId: string): Promise<Member[]> {
    const live = this.live.get(roomId);
    const rows = await this.repo.members(roomId);
    return rows.map((r) => ({ id: r.user_id, displayName: r.display_name, role: r.role, online: Boolean(live?.presence.has(r.user_id)) }));
  }

  private async broadcastMembers(roomId: string): Promise<void> {
    this.io.to(roomKey(roomId)).emit('room:members', await this.members(roomId));
  }

  private notice(roomId: string, notice: RoomNotice): void {
    this.io.to(roomKey(roomId)).emit('room:notice', notice);
  }

  private async savePlayback(live: LiveRoom): Promise<void> {
    await this.repo.savePlayback(live.id, live.playback);
  }

  private broadcastPlayback(live: LiveRoom): void {
    this.io.to(roomKey(live.id)).emit('room:playback', live.playback);
  }

  private setShare(live: LiveRoom, share: ShareState | null): void {
    live.share = share;
    this.io.to(roomKey(live.id)).emit('room:share', share);
  }

  // ---------- Бөлмеге кіру / шығу ----------

  private async join(socket: ClientSocket, roomId: string): Promise<RoomSnapshot> {
    const room = await this.repo.get(roomId);
    if (!room) throw new AppError('not_found');
    const userId = socket.data.user.id;
    const membership = await this.repo.membership(roomId, userId);
    if (membership?.banned) throw new AppError('room_banned');
    if (!membership) throw new AppError('room_not_joined');

    if (socket.data.roomId && socket.data.roomId !== roomId) await this.leave(socket);
    const live = await this.liveRoom(roomId);
    socket.join(roomKey(roomId));
    socket.data.roomId = roomId;
    const sockets = live.presence.get(userId) ?? new Set<string>();
    const firstSocket = sockets.size === 0;
    sockets.add(socket.id);
    live.presence.set(userId, sockets);
    await this.repo.touch(roomId, userId);

    const [members, queue, messages] = await Promise.all([
      this.members(roomId),
      this.repo.queue(roomId),
      this.repo.messages(roomId, userId),
    ]);
    if (firstSocket) {
      socket.to(roomKey(roomId)).emit('room:members', members);
      socket.to(roomKey(roomId)).emit('room:notice', { type: 'joined', userName: socket.data.user.displayName });
    }
    return {
      room: toRoomInfo(room),
      role: membership.role,
      members,
      queue: queue.map((r) => this.toItem(r)),
      playback: live.playback,
      share: live.share,
      messages,
      voice: this.voice.enabled,
    };
  }

  private async leave(socket: ClientSocket): Promise<void> {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.leave(roomKey(roomId));
    socket.data.roomId = undefined;
    const live = this.live.get(roomId);
    if (!live) return;
    const userId = socket.data.user.id;
    const sockets = live.presence.get(userId);
    sockets?.delete(socket.id);
    if (sockets && sockets.size > 0) return;
    live.presence.delete(userId);

    if (live.share?.userId === userId) {
      this.setShare(live, null);
      this.notice(roomId, { type: 'share_stopped', userName: socket.data.user.displayName });
    }
    if (live.presence.size === 0) {
      // Бөлмеде ешкім қалмады: ойнатуды тоқтатып, күйін сақтаймыз.
      live.playback = pauseAt(live.playback, Date.now());
      this.live.delete(roomId);
      await this.savePlayback(live).catch((err) => this.log.error({ err }, 'save playback failed'));
      return;
    }
    this.notice(roomId, { type: 'left', userName: socket.data.user.displayName });
    await this.broadcastMembers(roomId).catch(() => undefined);
  }

  // ---------- Ойнату ----------

  private async control(socket: ClientSocket, roomId: string, action: 'play' | 'pause' | 'seek', position: number) {
    const { live } = await this.context(socket, roomId, true);
    if (!live.playback.itemId) throw new AppError('invalid_input');
    live.playback = applyControl(live.playback, action, position, Date.now());
    this.broadcastPlayback(live);
    await this.savePlayback(live);
    return live.playback;
  }

  private async select(socket: ClientSocket, roomId: string, itemId: string) {
    const { live } = await this.context(socket, roomId, true);
    const queue = await this.repo.queue(roomId);
    const item = queue.find((q) => q.id === itemId);
    if (!item) throw new AppError('not_found');
    if (live.share) {
      this.setShare(live, null);
      this.notice(roomId, { type: 'share_stopped', userName: socket.data.user.displayName });
    }
    live.playback = selectItem(live.playback, itemId, Date.now());
    this.broadcastPlayback(live);
    this.notice(roomId, { type: 'now_playing', userName: socket.data.user.displayName, title: item.title });
    await this.savePlayback(live);
    return live.playback;
  }

  private async ended(socket: ClientSocket, roomId: string, itemId: string, seq: number) {
    const { live } = await this.context(socket, roomId, true);
    const pb = live.playback;
    if (pb.itemId !== itemId || pb.seq !== seq || pb.status !== 'playing') return null;
    const queue = await this.repo.queue(roomId);
    const next = nextItemId(
      queue.map((q) => q.id),
      itemId,
    );
    const now = Date.now();
    live.playback = next ? selectItem(pb, next, now) : pauseAt(pb, now);
    this.broadcastPlayback(live);
    if (next) {
      const title = queue.find((q) => q.id === next)?.title ?? '';
      this.notice(roomId, { type: 'now_playing', userName: socket.data.user.displayName, title });
    }
    await this.savePlayback(live);
    return null;
  }

  private async addToQueue(socket: ClientSocket, roomId: string, url: string, title?: string): Promise<QueueItem> {
    await this.context(socket, roomId, true);
    const parsed = parseMediaUrl(url);
    if (!parsed.ok) throw new AppError(parsed.error);
    const media = parsed.media;
    const given = title ? cleanTitle(title) : '';
    const row =
      media.kind === 'youtube'
        ? await this.repo.addToQueue(roomId, {
            kind: 'youtube',
            mediaType: 'video',
            source: media.videoId,
            hls: false,
            title: given || cleanTitle((await this.fetchTitle(media.videoId)) ?? '') || 'YouTube',
            addedBy: socket.data.user.id,
          })
        : await this.repo.addToQueue(roomId, {
            kind: 'url',
            mediaType: media.mediaType,
            source: media.url,
            hls: media.hls,
            title: given || cleanTitle(titleFromFileName(media.fileName)) || new URL(media.url).hostname,
            addedBy: socket.data.user.id,
          });
    await this.queueChanged(roomId);
    return this.toItem(row);
  }

  private async removeFromQueue(socket: ClientSocket, roomId: string, itemId: string) {
    const { live } = await this.context(socket, roomId, true);
    const before = await this.repo.queue(roomId);
    const removed = await this.repo.removeFromQueue(roomId, itemId);
    if (!removed) throw new AppError('not_found');
    if (removed.uploadId) await this.media.deleteFiles([removed.uploadId]);
    if (live.playback.itemId === itemId) {
      const next =
        nextItemId(
          before.map((q) => q.id),
          itemId,
        ) ??
        before.find((q) => q.id !== itemId)?.id ??
        null;
      live.playback = selectItem(live.playback, next, Date.now(), live.playback.status === 'playing');
      this.broadcastPlayback(live);
      await this.savePlayback(live);
    }
    const queue = await this.repo.queue(roomId);
    this.io.to(roomKey(roomId)).emit(
      'room:queue',
      queue.map((r) => this.toItem(r)),
    );
    return null;
  }

  private async share(socket: ClientSocket, roomId: string, active: boolean) {
    const { live, role } = await this.context(socket, roomId, active);
    const userId = socket.data.user.id;
    const userName = socket.data.user.displayName;
    if (active) {
      live.playback = pauseAt(live.playback, Date.now());
      this.broadcastPlayback(live);
      this.setShare(live, { userId, startedAt: Date.now() });
      this.notice(roomId, { type: 'share_started', userName });
      await this.savePlayback(live);
    } else if (live.share && (live.share.userId === userId || canControl(role))) {
      this.setShare(live, null);
      this.notice(roomId, { type: 'share_stopped', userName });
    }
    return live.share;
  }

  // ---------- Чат ----------

  private async chat(socket: ClientSocket, roomId: string, body: string) {
    await this.context(socket, roomId);
    const text = body
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, CHAT_MAX_LENGTH);
    if (!text) throw new AppError('invalid_input');
    if (!this.chatLimiter.take(socket.data.user.id)) throw new AppError('rate_limited');
    const filtered = filterText(text);
    const message = await this.repo.addMessage(roomId, socket.data.user.id, filtered.text);
    this.io.to(roomKey(roomId)).emit('chat:message', message);
    return message;
  }

  private async deleteMessage(socket: ClientSocket, roomId: string, messageId: string) {
    const { role } = await this.context(socket, roomId);
    const message = await this.repo.message(messageId);
    if (!message || message.room_id !== roomId) throw new AppError('not_found');
    if (message.user_id !== socket.data.user.id && !canControl(role)) throw new AppError('forbidden');
    await this.repo.deleteMessage(messageId);
    this.io.to(roomKey(roomId)).emit('chat:deleted', { id: messageId });
    return null;
  }

  // ---------- Модерация ----------

  private async target(roomId: string, actorRole: Role, actorId: string, userId: string) {
    if (userId === actorId) throw new AppError('invalid_input');
    const target = await this.repo.membership(roomId, userId);
    if (!target || target.banned) throw new AppError('not_found');
    if (target.role === 'owner') throw new AppError('cannot_moderate_owner');
    // Әкімші тек қатардағы мүшелерді басқарады; әкімшілерді — тек иесі.
    if (target.role === 'admin' && actorRole !== 'owner') throw new AppError('forbidden');
    return target;
  }

  private async setRole(socket: ClientSocket, roomId: string, userId: string, role: 'admin' | 'member') {
    const { role: actorRole } = await this.context(socket, roomId, true);
    if (actorRole !== 'owner') throw new AppError('forbidden');
    await this.target(roomId, actorRole, socket.data.user.id, userId);
    await this.repo.setRole(roomId, userId, role);
    const sockets = await this.io.in(userKey(userId)).fetchSockets();
    for (const s of sockets) if (s.data.roomId === roomId) s.emit('room:role', role);
    await this.voice.updateRole(roomId, userId, role);
    await this.broadcastMembers(roomId);
    const name = (await this.members(roomId)).find((m) => m.id === userId)?.displayName ?? '';
    this.notice(roomId, { type: 'role_changed', userName: name, role });
    return null;
  }

  private async removeMember(socket: ClientSocket, roomId: string, userId: string, ban: boolean) {
    const { role } = await this.context(socket, roomId, true);
    await this.target(roomId, role, socket.data.user.id, userId);
    const name = (await this.members(roomId)).find((m) => m.id === userId)?.displayName ?? '';
    await this.repo.removeMember(roomId, userId, ban);
    await this.userRemoved(roomId, userId, ban ? 'banned' : 'kicked');
    this.notice(roomId, { type: 'removed', userName: name });
    return null;
  }

  private async mute(socket: ClientSocket, roomId: string, userId: string) {
    const { role } = await this.context(socket, roomId, true);
    await this.target(roomId, role, socket.data.user.id, userId);
    await this.voice.muteMicrophone(roomId, userId);
    return null;
  }
}
