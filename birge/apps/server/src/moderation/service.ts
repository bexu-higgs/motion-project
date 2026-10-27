import { randomUUID } from 'node:crypto';
import { REPORT_DETAILS_MAX_LENGTH, type ModerationReport, type PublicUser, type ReportInput } from '@birge/shared';
import type { Db } from '../db';
import { AppError } from '../lib/errors';
import { isUuid } from '../rooms/repo';

/** Шағымдар және бұғаттаулар (App Store 1.2 / Google Play UGC талаптары). */
export class ModerationService {
  constructor(private readonly db: Db) {}

  async report(reporterId: string, input: ReportInput): Promise<void> {
    if (!isUuid(input.targetId)) throw new AppError('invalid_input');
    let targetUserId: string | null = null;
    let roomId: string | null = input.roomId && isUuid(input.roomId) ? input.roomId : null;
    let messageId: string | null = null;
    let messageBody: string | null = null;

    if (input.targetType === 'user') {
      const { rows } = await this.db.query<{ id: string }>('SELECT id FROM users WHERE id = $1', [input.targetId]);
      if (!rows[0]) throw new AppError('not_found');
      targetUserId = input.targetId;
    } else if (input.targetType === 'message') {
      const { rows } = await this.db.query<{ user_id: string | null; room_id: string; body: string }>(
        'SELECT user_id, room_id, body FROM messages WHERE id = $1',
        [input.targetId],
      );
      const message = rows[0];
      if (!message) throw new AppError('not_found');
      targetUserId = message.user_id;
      roomId = message.room_id;
      messageId = input.targetId;
      messageBody = message.body;
    } else {
      const { rows } = await this.db.query<{ owner_id: string }>('SELECT owner_id FROM rooms WHERE id = $1', [input.targetId]);
      if (!rows[0]) throw new AppError('not_found');
      roomId = input.targetId;
      targetUserId = rows[0].owner_id;
    }

    await this.db.query(
      `INSERT INTO reports (id, reporter_id, target_type, target_user_id, room_id, message_id, message_body, reason, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        reporterId,
        input.targetType,
        targetUserId,
        roomId,
        messageId,
        messageBody,
        input.reason,
        (input.details ?? '').trim().slice(0, REPORT_DETAILS_MAX_LENGTH),
      ],
    );
  }

  async listReports(status: 'open' | 'resolved'): Promise<ModerationReport[]> {
    const { rows } = await this.db.query<{
      id: string;
      target_type: ModerationReport['targetType'];
      reason: ModerationReport['reason'];
      details: string;
      status: ModerationReport['status'];
      created_at: Date;
      reporter_id: string | null;
      reporter_name: string | null;
      target_user_id: string | null;
      target_name: string | null;
      room_id: string | null;
      room_name: string | null;
      message_body: string | null;
    }>(
      `SELECT r.id, r.target_type, r.reason, r.details, r.status, r.created_at,
              r.reporter_id, ru.display_name AS reporter_name,
              r.target_user_id, tu.display_name AS target_name,
              r.room_id, rm.name AS room_name, r.message_body
       FROM reports r
       LEFT JOIN users ru ON ru.id = r.reporter_id
       LEFT JOIN users tu ON tu.id = r.target_user_id
       LEFT JOIN rooms rm ON rm.id = r.room_id
       WHERE r.status = $1
       ORDER BY r.created_at DESC
       LIMIT 200`,
      [status],
    );
    return rows.map((r) => ({
      id: r.id,
      targetType: r.target_type,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at.getTime(),
      reporter: r.reporter_id ? { id: r.reporter_id, displayName: r.reporter_name ?? '' } : null,
      targetUser: r.target_user_id ? { id: r.target_user_id, displayName: r.target_name ?? '' } : null,
      room: r.room_id ? { id: r.room_id, name: r.room_name ?? '' } : null,
      messageBody: r.message_body,
    }));
  }

  async resolveReport(reportId: string, moderatorId: string): Promise<void> {
    if (!isUuid(reportId)) throw new AppError('not_found');
    await this.db.query(`UPDATE reports SET status = 'resolved', resolved_at = now(), resolved_by = $2 WHERE id = $1`, [
      reportId,
      moderatorId,
    ]);
  }

  async banUser(userId: string): Promise<void> {
    if (!isUuid(userId)) throw new AppError('not_found');
    await this.db.query('UPDATE users SET banned_at = now() WHERE id = $1', [userId]);
    await this.db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  async blocks(userId: string): Promise<PublicUser[]> {
    const { rows } = await this.db.query<{ id: string; display_name: string }>(
      `SELECT u.id, u.display_name FROM blocks b JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = $1 ORDER BY b.created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({ id: r.id, displayName: r.display_name }));
  }

  async block(userId: string, blockedId: string): Promise<void> {
    if (!isUuid(blockedId) || blockedId === userId) throw new AppError('invalid_input');
    const { rows } = await this.db.query<{ id: string }>('SELECT id FROM users WHERE id = $1', [blockedId]);
    if (!rows[0]) throw new AppError('not_found');
    await this.db.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, blockedId]);
  }

  async unblock(userId: string, blockedId: string): Promise<void> {
    if (!isUuid(blockedId)) return;
    await this.db.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [userId, blockedId]);
  }
}
