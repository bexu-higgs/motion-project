import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ROOM_MAX_CAPACITY, ROOM_MIN_CAPACITY, ROOM_NAME_MAX_LENGTH, canControl, titleFromFileName, type RoomSummary } from '@birge/shared';
import type { Services } from '../services';
import { noContent, requireActiveUser } from '../http';
import { AppError } from '../lib/errors';
import { cleanTitle } from '../rooms/hub';
import { toRoomInfo } from '../rooms/repo';

const Create = z.object({
  name: z.string().max(ROOM_NAME_MAX_LENGTH * 2),
  capacity: z.number().int().min(ROOM_MIN_CAPACITY).max(ROOM_MAX_CAPACITY),
});
const Update = Create.partial();
const Join = z.object({ code: z.string().max(20) });
const IdParams = z.object({ id: z.string() });
const UploadQuery = z.object({ title: z.string().max(500).optional() });

export function roomRoutes(app: FastifyInstance, s: Services) {
  const ownedRoom = async (roomId: string, userId: string) => {
    const room = await s.rooms.get(roomId);
    if (!room) throw new AppError('not_found');
    if (room.owner_id !== userId) throw new AppError('forbidden');
    return room;
  };

  app.get('/api/rooms', async (request): Promise<RoomSummary[]> => {
    const user = requireActiveUser(request);
    const rows = await s.rooms.listForUser(user.id);
    return rows.map((r) => ({
      ...toRoomInfo(r),
      role: r.role,
      memberCount: Number(r.member_count),
      onlineCount: s.hub.onlineCount(r.id),
      ownerName: r.owner_name,
      lastActiveAt: r.last_active_at.getTime(),
    }));
  });

  app.post('/api/rooms', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (request) => {
    const user = requireActiveUser(request);
    const body = Create.parse(request.body);
    return toRoomInfo(await s.rooms.create(user.id, body.name, body.capacity));
  });

  app.get('/api/rooms/code/:id', async (request) => {
    const user = requireActiveUser(request);
    const { id: code } = IdParams.parse(request.params);
    const room = await s.rooms.getByCode(code);
    if (!room) throw new AppError('not_found');
    const [memberCount, membership, members] = await Promise.all([
      s.rooms.memberCount(room.id),
      s.rooms.membership(room.id, user.id),
      s.rooms.members(room.id),
    ]);
    return {
      ...toRoomInfo(room),
      memberCount,
      ownerName: members.find((m) => m.role === 'owner')?.display_name ?? '',
      isMember: Boolean(membership && !membership.banned),
    };
  });

  app.post('/api/rooms/join', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
    const user = requireActiveUser(request);
    const { code } = Join.parse(request.body);
    const room = await s.rooms.getByCode(code);
    if (!room) throw new AppError('not_found');
    await s.rooms.join(room, user.id);
    return toRoomInfo(room);
  });

  app.patch('/api/rooms/:id', async (request) => {
    const user = requireActiveUser(request);
    const { id } = IdParams.parse(request.params);
    await ownedRoom(id, user.id);
    const room = toRoomInfo(await s.rooms.update(id, Update.parse(request.body)));
    s.hub.roomUpdated(room);
    return room;
  });

  app.delete('/api/rooms/:id', async (request, reply) => {
    const user = requireActiveUser(request);
    const { id } = IdParams.parse(request.params);
    await ownedRoom(id, user.id);
    await s.accounts.closeRoom(id);
    return noContent(reply);
  });

  app.post('/api/rooms/:id/leave', async (request, reply) => {
    const user = requireActiveUser(request);
    const { id } = IdParams.parse(request.params);
    const membership = await s.rooms.membership(id, user.id);
    if (!membership || membership.banned) throw new AppError('not_found');
    if (membership.role === 'owner') throw new AppError('forbidden');
    await s.rooms.removeMember(id, user.id, false);
    await s.hub.userRemoved(id, user.id, 'left');
    return noContent(reply);
  });

  app.post('/api/rooms/:id/voice', async (request) => {
    const user = requireActiveUser(request);
    const { id } = IdParams.parse(request.params);
    const membership = await s.rooms.membership(id, user.id);
    if (!membership || membership.banned) throw new AppError('room_not_joined');
    return s.voice.token(id, { id: user.id, displayName: user.display_name }, membership.role);
  });

  // Әкімші өз құрылғысынан бейне/аудио файл жүктейді.
  app.post('/api/rooms/:id/uploads', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }, async (request) => {
    const user = requireActiveUser(request);
    const { id } = IdParams.parse(request.params);
    const { title } = UploadQuery.parse(request.query);
    const membership = await s.rooms.membership(id, user.id);
    if (!membership || membership.banned) throw new AppError('room_not_joined');
    if (!canControl(membership.role)) throw new AppError('forbidden');
    const file = await request.file();
    if (!file) throw new AppError('invalid_input');
    const saved = await s.media.save({ roomId: id, userId: user.id, fileName: file.filename, stream: file.file });
    try {
      const row = await s.rooms.addToQueue(id, {
        kind: 'upload',
        mediaType: saved.mediaType,
        source: saved.id,
        hls: false,
        title: cleanTitle(title ?? '') || cleanTitle(titleFromFileName(file.filename)) || 'Media',
        uploadId: saved.id,
        addedBy: user.id,
      });
      await s.hub.queueChanged(id);
      return { id: row.id };
    } catch (err) {
      await s.db.query('DELETE FROM uploads WHERE id = $1', [saved.id]);
      await s.media.deleteFiles([saved.id]);
      throw err;
    }
  });

  app.get('/api/media/:id', async (request, reply) => {
    const { id } = IdParams.parse(request.params);
    const { exp, sig } = request.query as { exp?: string; sig?: string };
    if (!s.media.verify(id, exp, sig)) throw new AppError('forbidden');
    return s.media.serve(request, reply, id);
  });
}
