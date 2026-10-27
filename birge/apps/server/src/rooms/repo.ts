import { randomUUID } from 'node:crypto';
import {
  CHAT_HISTORY_LIMIT,
  QUEUE_MAX_ITEMS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  clampCapacity,
  type ChatMessage,
  type MediaKind,
  type MediaType,
  type PlaybackState,
  type Role,
  type RoomInfo,
} from '@birge/shared';
import type { Db } from '../db';
import { randomCode } from '../lib/crypto';
import { AppError } from '../lib/errors';

export interface RoomRow {
  id: string;
  code: string;
  name: string;
  owner_id: string;
  capacity: number;
  playback: PlaybackState | null;
  created_at: Date;
  last_active_at: Date;
}

export interface MemberRow {
  user_id: string;
  display_name: string;
  role: Role;
}

export interface QueueRow {
  id: string;
  kind: MediaKind;
  media_type: MediaType;
  source: string;
  hls: boolean;
  title: string;
  upload_id: string | null;
  added_by: string | null;
}

export function toRoomInfo(row: RoomRow): RoomInfo {
  return { id: row.id, code: row.code, name: row.name, capacity: row.capacity, ownerId: row.owner_id };
}

export function sanitizeRoomName(input: string): string {
  return input
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ROOM_NAME_MAX_LENGTH);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Бөлмелерге қатысты барлық SQL осында. */
export class RoomRepo {
  constructor(private readonly db: Db) {}

  async create(ownerId: string, name: string, capacity: number): Promise<RoomRow> {
    const cleanName = sanitizeRoomName(name);
    if (!cleanName) throw new AppError('invalid_input');
    for (let attempt = 0; attempt < 8; attempt++) {
      const id = randomUUID();
      const code = randomCode(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);
      try {
        return await this.db.transaction(async (tx) => {
          const { rows } = await tx.query<RoomRow>(
            'INSERT INTO rooms (id, code, name, owner_id, capacity) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [id, code, cleanName, ownerId, clampCapacity(capacity)],
          );
          await tx.query(`INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'owner')`, [id, ownerId]);
          return rows[0]!;
        });
      } catch (err) {
        if ((err as { code?: string }).code === '23505') continue; // код қайталанды — қайта көреміз
        throw err;
      }
    }
    throw new AppError('server_error');
  }

  async get(id: string): Promise<RoomRow | null> {
    if (!isUuid(id)) return null;
    const { rows } = await this.db.query<RoomRow>('SELECT * FROM rooms WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async getByCode(code: string): Promise<RoomRow | null> {
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(clean)) return null;
    const { rows } = await this.db.query<RoomRow>('SELECT * FROM rooms WHERE code = $1', [clean]);
    return rows[0] ?? null;
  }

  async listForUser(userId: string) {
    const { rows } = await this.db.query<RoomRow & { role: Role; member_count: string; owner_name: string }>(
      `SELECT r.*, m.role,
              (SELECT count(*) FROM room_members x WHERE x.room_id = r.id AND NOT x.banned)::text AS member_count,
              o.display_name AS owner_name
       FROM room_members m
       JOIN rooms r ON r.id = m.room_id
       JOIN users o ON o.id = r.owner_id
       WHERE m.user_id = $1 AND NOT m.banned
       ORDER BY r.last_active_at DESC
       LIMIT 100`,
      [userId],
    );
    return rows;
  }

  async memberCount(roomId: string): Promise<number> {
    const { rows } = await this.db.query<{ n: string }>('SELECT count(*)::text AS n FROM room_members WHERE room_id = $1 AND NOT banned', [
      roomId,
    ]);
    return Number(rows[0]?.n ?? 0);
  }

  async membership(roomId: string, userId: string): Promise<{ role: Role; banned: boolean } | null> {
    if (!isUuid(roomId)) return null;
    const { rows } = await this.db.query<{ role: Role; banned: boolean }>(
      'SELECT role, banned FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, userId],
    );
    return rows[0] ?? null;
  }

  /** Сыйымдылықты тексеріп, қолданушыны бөлмеге қосады (50 адамнан аспайды). */
  async join(room: RoomRow, userId: string): Promise<Role> {
    return this.db.transaction(async (tx) => {
      // Бір уақытта көп адам кірсе де сыйымдылық бұзылмасын.
      await tx.query('SELECT id FROM rooms WHERE id = $1 FOR UPDATE', [room.id]);
      const existing = await tx.query<{ role: Role; banned: boolean }>(
        'SELECT role, banned FROM room_members WHERE room_id = $1 AND user_id = $2',
        [room.id, userId],
      );
      const member = existing.rows[0];
      if (member?.banned) throw new AppError('room_banned');
      if (member) return member.role;
      const count = await tx.query<{ n: string }>('SELECT count(*)::text AS n FROM room_members WHERE room_id = $1 AND NOT banned', [
        room.id,
      ]);
      if (Number(count.rows[0]?.n ?? 0) >= room.capacity) throw new AppError('room_full');
      await tx.query(`INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'member')`, [room.id, userId]);
      return 'member' as Role;
    });
  }

  async members(roomId: string): Promise<MemberRow[]> {
    const { rows } = await this.db.query<MemberRow>(
      `SELECT m.user_id, u.display_name, m.role
       FROM room_members m JOIN users u ON u.id = m.user_id
       WHERE m.room_id = $1 AND NOT m.banned
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.joined_at`,
      [roomId],
    );
    return rows;
  }

  async update(roomId: string, patch: { name?: string; capacity?: number }): Promise<RoomRow> {
    const room = await this.get(roomId);
    if (!room) throw new AppError('not_found');
    const name = patch.name !== undefined ? sanitizeRoomName(patch.name) : room.name;
    if (!name) throw new AppError('invalid_input');
    const capacity = patch.capacity !== undefined ? clampCapacity(patch.capacity) : room.capacity;
    const { rows } = await this.db.query<RoomRow>('UPDATE rooms SET name = $2, capacity = $3 WHERE id = $1 RETURNING *', [
      roomId,
      name,
      capacity,
    ]);
    return rows[0]!;
  }

  async setRole(roomId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
    await this.db.query(`UPDATE room_members SET role = $3 WHERE room_id = $1 AND user_id = $2 AND role <> 'owner'`, [
      roomId,
      userId,
      role,
    ]);
  }

  async removeMember(roomId: string, userId: string, ban: boolean): Promise<void> {
    if (ban) {
      await this.db.query(
        `INSERT INTO room_members (room_id, user_id, role, banned) VALUES ($1, $2, 'member', true)
         ON CONFLICT (room_id, user_id) DO UPDATE SET banned = true, role = 'member'`,
        [roomId, userId],
      );
    } else {
      await this.db.query(`DELETE FROM room_members WHERE room_id = $1 AND user_id = $2 AND role <> 'owner'`, [roomId, userId]);
    }
  }

  async delete(roomId: string): Promise<string[]> {
    const { rows } = await this.db.query<{ id: string }>('SELECT id FROM uploads WHERE room_id = $1', [roomId]);
    await this.db.query('DELETE FROM rooms WHERE id = $1', [roomId]);
    return rows.map((r) => r.id);
  }

  async ownedRoomIds(userId: string): Promise<string[]> {
    const { rows } = await this.db.query<{ id: string }>('SELECT id FROM rooms WHERE owner_id = $1', [userId]);
    return rows.map((r) => r.id);
  }

  async memberRoomIds(userId: string): Promise<string[]> {
    const { rows } = await this.db.query<{ room_id: string }>('SELECT room_id FROM room_members WHERE user_id = $1', [userId]);
    return rows.map((r) => r.room_id);
  }

  async savePlayback(roomId: string, playback: PlaybackState): Promise<void> {
    await this.db.query('UPDATE rooms SET playback = $2, last_active_at = now() WHERE id = $1', [roomId, JSON.stringify(playback)]);
  }

  async touch(roomId: string, userId: string): Promise<void> {
    await this.db.query('UPDATE rooms SET last_active_at = now() WHERE id = $1', [roomId]);
    await this.db.query('UPDATE room_members SET last_seen_at = now() WHERE room_id = $1 AND user_id = $2', [roomId, userId]);
  }

  // ---------- Кезек ----------

  async queue(roomId: string): Promise<QueueRow[]> {
    const { rows } = await this.db.query<QueueRow>(
      'SELECT id, kind, media_type, source, hls, title, upload_id, added_by FROM queue_items WHERE room_id = $1 ORDER BY position, created_at',
      [roomId],
    );
    return rows;
  }

  async addToQueue(
    roomId: string,
    item: { kind: MediaKind; mediaType: MediaType; source: string; hls: boolean; title: string; uploadId?: string; addedBy: string },
  ): Promise<QueueRow> {
    return this.db.transaction(async (tx) => {
      const count = await tx.query<{ n: string; max: number | null }>(
        'SELECT count(*)::text AS n, max(position) AS max FROM queue_items WHERE room_id = $1',
        [roomId],
      );
      if (Number(count.rows[0]?.n ?? 0) >= QUEUE_MAX_ITEMS) throw new AppError('queue_full');
      const { rows } = await tx.query<QueueRow>(
        `INSERT INTO queue_items (id, room_id, position, kind, media_type, source, hls, title, upload_id, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, kind, media_type, source, hls, title, upload_id, added_by`,
        [
          randomUUID(),
          roomId,
          (count.rows[0]?.max ?? -1) + 1,
          item.kind,
          item.mediaType,
          item.source,
          item.hls,
          item.title,
          item.uploadId ?? null,
          item.addedBy,
        ],
      );
      return rows[0]!;
    });
  }

  /** Кезектен өшіреді; жүктелген файл болса, оның ID-ін қайтарады (дискіден өшіру үшін). */
  async removeFromQueue(roomId: string, itemId: string): Promise<{ uploadId: string | null } | null> {
    if (!isUuid(itemId)) return null;
    const { rows } = await this.db.query<{ upload_id: string | null }>(
      'DELETE FROM queue_items WHERE room_id = $1 AND id = $2 RETURNING upload_id',
      [roomId, itemId],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.upload_id) await this.db.query('DELETE FROM uploads WHERE id = $1', [row.upload_id]);
    return { uploadId: row.upload_id };
  }

  // ---------- Чат ----------

  async addMessage(roomId: string, userId: string, body: string): Promise<ChatMessage> {
    const { rows } = await this.db.query<{ id: string; created_at: Date; display_name: string }>(
      `WITH m AS (
         INSERT INTO messages (id, room_id, user_id, body) VALUES ($1, $2, $3, $4) RETURNING id, created_at, user_id
       )
       SELECT m.id, m.created_at, u.display_name FROM m JOIN users u ON u.id = m.user_id`,
      [randomUUID(), roomId, userId, body],
    );
    const row = rows[0]!;
    return { id: row.id, userId, displayName: row.display_name, body, createdAt: row.created_at.getTime() };
  }

  /** Соңғы хабарламалар; көрушінің бұғаттаған адамдарының хабарламалары көрсетілмейді. */
  async messages(roomId: string, viewerId: string): Promise<ChatMessage[]> {
    const { rows } = await this.db.query<{
      id: string;
      user_id: string | null;
      display_name: string | null;
      body: string;
      created_at: Date;
    }>(
      `SELECT m.id, m.user_id, u.display_name, m.body, m.created_at
       FROM messages m LEFT JOIN users u ON u.id = m.user_id
       WHERE m.room_id = $1 AND m.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = $2 AND b.blocked_id = m.user_id)
       ORDER BY m.created_at DESC
       LIMIT $3`,
      [roomId, viewerId, CHAT_HISTORY_LIMIT],
    );
    return rows.reverse().map((r) => ({
      id: r.id,
      userId: r.user_id,
      displayName: r.display_name ?? '',
      body: r.body,
      createdAt: r.created_at.getTime(),
    }));
  }

  async message(messageId: string): Promise<{ id: string; room_id: string; user_id: string | null; body: string } | null> {
    if (!isUuid(messageId)) return null;
    const { rows } = await this.db.query<{ id: string; room_id: string; user_id: string | null; body: string }>(
      'SELECT id, room_id, user_id, body FROM messages WHERE id = $1',
      [messageId],
    );
    return rows[0] ?? null;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.db.query('UPDATE messages SET deleted_at = now() WHERE id = $1', [messageId]);
  }
}
