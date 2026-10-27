import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { REPORT_DETAILS_MAX_LENGTH, REPORT_REASONS } from '@birge/shared';
import type { Services } from '../services';
import { noContent, requireModerator, requireUser } from '../http';

const Report = z.object({
  targetType: z.enum(['user', 'message', 'room']),
  targetId: z.string().max(64),
  roomId: z.string().max(64).optional(),
  reason: z.enum(REPORT_REASONS),
  details: z
    .string()
    .max(REPORT_DETAILS_MAX_LENGTH * 2)
    .optional(),
});
const Block = z.object({ userId: z.string().max(64) });
const IdParams = z.object({ id: z.string().max(64) });
const ReportsQuery = z.object({ status: z.enum(['open', 'resolved']).default('open') });

export function moderationRoutes(app: FastifyInstance, s: Services) {
  app.post('/api/reports', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (request, reply) => {
    const user = requireUser(request);
    await s.moderation.report(user.id, Report.parse(request.body));
    return noContent(reply);
  });

  app.get('/api/blocks', async (request) => s.moderation.blocks(requireUser(request).id));

  app.post('/api/blocks', async (request, reply) => {
    const user = requireUser(request);
    await s.moderation.block(user.id, Block.parse(request.body).userId);
    return noContent(reply);
  });

  app.delete('/api/blocks/:id', async (request, reply) => {
    const user = requireUser(request);
    await s.moderation.unblock(user.id, IdParams.parse(request.params).id);
    return noContent(reply);
  });

  // ---------- Модераторлар (MODERATOR_EMAILS) ----------

  app.get('/api/mod/reports', async (request) => {
    requireModerator(request);
    return s.moderation.listReports(ReportsQuery.parse(request.query).status);
  });

  app.post('/api/mod/reports/:id/resolve', async (request, reply) => {
    const mod = requireModerator(request);
    await s.moderation.resolveReport(IdParams.parse(request.params).id, mod.id);
    return noContent(reply);
  });

  app.post('/api/mod/users/:id/ban', async (request, reply) => {
    requireModerator(request);
    await s.accounts.banUser(IdParams.parse(request.params).id);
    return noContent(reply);
  });

  app.delete('/api/mod/rooms/:id', async (request, reply) => {
    requireModerator(request);
    const { id } = IdParams.parse(request.params);
    if (await s.rooms.get(id)) await s.accounts.closeRoom(id);
    return noContent(reply);
  });

  app.delete('/api/mod/messages/:id', async (request, reply) => {
    requireModerator(request);
    const message = await s.rooms.message(IdParams.parse(request.params).id);
    if (message) {
      await s.rooms.deleteMessage(message.id);
      s.hub.messageDeleted(message.room_id, message.id);
    }
    return noContent(reply);
  });
}
