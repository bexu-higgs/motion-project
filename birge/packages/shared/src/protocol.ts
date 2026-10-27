import type { Locale } from './limits';

/** Сервер қайтаратын қате кодтары. Мәтіні қосымшада екі тілде аударылады. */
export const ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'not_found',
  'invalid_input',
  'rate_limited',
  'server_error',
  // тіркелу / кіру
  'invalid_email',
  'invalid_phone',
  'code_invalid',
  'code_expired',
  'too_many_attempts',
  'resend_too_soon',
  'provider_not_configured',
  'oauth_failed',
  'account_banned',
  'terms_required',
  // бөлмелер
  'room_full',
  'room_banned',
  'room_not_joined',
  'cannot_moderate_owner',
  'invalid_url',
  'unsupported_media',
  'queue_full',
  'upload_too_large',
  'voice_unavailable',
  'message_blocked',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type Ack<T> = { ok: true; data: T } | { ok: false; error: ErrorCode };

export type AuthProvider = 'email' | 'phone' | 'google' | 'apple';
export type OtpChannel = 'email' | 'phone';

export interface PublicUser {
  id: string;
  displayName: string;
}

export interface Me extends PublicUser {
  locale: Locale;
  termsAccepted: boolean;
  isModerator: boolean;
  providers: AuthProvider[];
  email: string | null;
  phone: string | null;
  createdAt: number;
}

export interface AuthResult {
  token: string;
  user: Me;
  isNew: boolean;
}

/** GET /api/config — қосымша қандай кіру тәсілдерін көрсету керегін осыдан біледі. */
export interface PublicConfig {
  providers: Record<AuthProvider, boolean>;
  voice: boolean;
  maxUploadMb: number;
  supportEmail: string;
  webUrl: string;
  /** Әзірлеу режимі: OTP коды жауапта қайтады (продакшнда әрқашан false). */
  devOtp: boolean;
}

export type Role = 'owner' | 'admin' | 'member';

export function canControl(role: Role | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export interface RoomInfo {
  id: string;
  code: string;
  name: string;
  capacity: number;
  ownerId: string;
}

export interface RoomSummary extends RoomInfo {
  role: Role;
  memberCount: number;
  onlineCount: number;
  ownerName: string;
  lastActiveAt: number;
}

export interface Member extends PublicUser {
  role: Role;
  online: boolean;
}

export type MediaKind = 'youtube' | 'url' | 'upload';
export type MediaType = 'video' | 'audio';

export interface QueueItem {
  id: string;
  kind: MediaKind;
  title: string;
  mediaType: MediaType;
  /** youtube — бейне ID; url/upload — ойнатуға болатын толық сілтеме. */
  src: string;
  /** HLS (.m3u8) ағыны ма. */
  hls: boolean;
  addedBy: string | null;
}

export type PlaybackStatus = 'playing' | 'paused';

/**
 * Бөлмедегі ойнату күйі. Сервер — бірден-бір шындық көзі.
 * `position` — `updatedAt` сәтіндегі (сервер уақыты, мс) секунд.
 */
export interface PlaybackState {
  itemId: string | null;
  status: PlaybackStatus;
  position: number;
  rate: number;
  updatedAt: number;
  seq: number;
}

/** Әкімші браузер қойындысын (немесе экранын) бөлісіп тұрғанда. */
export interface ShareState {
  userId: string;
  startedAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string | null;
  displayName: string;
  body: string;
  createdAt: number;
}

export type RoomNotice =
  | { type: 'joined'; userName: string }
  | { type: 'left'; userName: string }
  | { type: 'now_playing'; userName: string; title: string }
  | { type: 'share_started'; userName: string }
  | { type: 'share_stopped'; userName: string }
  | { type: 'role_changed'; userName: string; role: Role }
  | { type: 'removed'; userName: string };

export interface RoomSnapshot {
  room: RoomInfo;
  role: Role;
  members: Member[];
  queue: QueueItem[];
  playback: PlaybackState;
  share: ShareState | null;
  messages: ChatMessage[];
  voice: boolean;
}

export interface VoiceCredentials {
  url: string;
  token: string;
}

export type RemovalReason = 'kicked' | 'banned' | 'closed' | 'left';

export interface ServerToClientEvents {
  'room:members': (members: Member[]) => void;
  'room:queue': (queue: QueueItem[]) => void;
  'room:playback': (state: PlaybackState) => void;
  'room:share': (share: ShareState | null) => void;
  'room:updated': (room: RoomInfo) => void;
  'room:role': (role: Role) => void;
  'room:notice': (notice: RoomNotice) => void;
  'room:removed': (info: { roomId: string; reason: RemovalReason }) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:deleted': (info: { id: string }) => void;
  /** Сессия жойылды (шығу, аккаунтты жою, бұғаттау). */
  'session:ended': () => void;
}

export type PlaybackAction = 'play' | 'pause' | 'seek';

export interface ClientToServerEvents {
  'time:sync': (clientTime: number, ack: (serverTime: number) => void) => void;
  'room:join': (p: { roomId: string }, ack: (r: Ack<RoomSnapshot>) => void) => void;
  'room:leave': (p: { roomId: string }) => void;
  'playback:control': (p: { roomId: string; action: PlaybackAction; position: number }, ack: (r: Ack<PlaybackState>) => void) => void;
  'playback:select': (p: { roomId: string; itemId: string }, ack: (r: Ack<PlaybackState>) => void) => void;
  'playback:ended': (p: { roomId: string; itemId: string; seq: number }) => void;
  'queue:add': (p: { roomId: string; url: string; title?: string }, ack: (r: Ack<QueueItem>) => void) => void;
  'queue:remove': (p: { roomId: string; itemId: string }, ack: (r: Ack<null>) => void) => void;
  'share:set': (p: { roomId: string; active: boolean }, ack: (r: Ack<ShareState | null>) => void) => void;
  'chat:send': (p: { roomId: string; body: string }, ack: (r: Ack<ChatMessage>) => void) => void;
  'chat:delete': (p: { roomId: string; messageId: string }, ack: (r: Ack<null>) => void) => void;
  'member:role': (p: { roomId: string; userId: string; role: 'admin' | 'member' }, ack: (r: Ack<null>) => void) => void;
  'member:remove': (p: { roomId: string; userId: string; ban: boolean }, ack: (r: Ack<null>) => void) => void;
  'member:mute': (p: { roomId: string; userId: string }, ack: (r: Ack<null>) => void) => void;
}

export type ReportTarget = 'user' | 'message' | 'room';
export const REPORT_REASONS = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'copyright', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportInput {
  targetType: ReportTarget;
  /** user → қолданушы ID, message → хабарлама ID, room → бөлме ID. */
  targetId: string;
  roomId?: string;
  reason: ReportReason;
  details?: string;
}

export interface ModerationReport {
  id: string;
  targetType: ReportTarget;
  reason: ReportReason;
  details: string;
  status: 'open' | 'resolved';
  createdAt: number;
  reporter: PublicUser | null;
  targetUser: PublicUser | null;
  room: { id: string; name: string } | null;
  messageBody: string | null;
}
