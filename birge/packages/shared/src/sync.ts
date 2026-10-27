import type { PlaybackState } from './protocol';

/** Сервер уақытының `serverNow` сәтінде ойнату қай секундта болуы керек. */
export function positionAt(state: PlaybackState, serverNow: number): number {
  if (state.status !== 'playing') return state.position;
  const elapsed = Math.max(0, serverNow - state.updatedAt) / 1000;
  return state.position + elapsed * state.rate;
}

export type SyncDecision =
  | { kind: 'none'; rate: number }
  | { kind: 'seek'; position: number; rate: number }
  | { kind: 'rate'; rate: number };

export interface SyncOptions {
  /** Ойнатқыш жылдамдықты біркелкі өзгерте ала ма (YouTube — жоқ). */
  canAdjustRate: boolean;
  baseRate?: number;
  /** Осыдан үлкен айырмашылықта бірден секіреміз (секунд). */
  seekThreshold?: number;
  /** Осыдан үлкен айырмашылықта жылдамдықты сәл өзгертіп қуып жетеміз. */
  rateThreshold?: number;
  /** Жылдамдықты қаншаға дейін өзгертуге болады (0.05 = ±5%). */
  maxRateDelta?: number;
}

/**
 * Нақты ойнату орнын күтілгенімен салыстырып, не істеу керегін шешеді.
 * Кішкене алшақтықты жылдамдықпен түзетеміз (көзге білінбейді),
 * үлкенін — бірден секіріп.
 */
export function decideSync(actual: number, expected: number, options: SyncOptions): SyncDecision {
  const baseRate = options.baseRate ?? 1;
  const seekThreshold = options.seekThreshold ?? (options.canAdjustRate ? 2 : 1.5);
  const rateThreshold = options.rateThreshold ?? 0.25;
  const maxRateDelta = options.maxRateDelta ?? 0.05;
  const drift = actual - expected;

  if (Math.abs(drift) >= seekThreshold) {
    return { kind: 'seek', position: Math.max(0, expected), rate: baseRate };
  }
  if (options.canAdjustRate && Math.abs(drift) >= rateThreshold) {
    // Алда болсақ — баяулаймыз, артта болсақ — жылдамдатамыз.
    const delta = Math.min(maxRateDelta, Math.abs(drift) * 0.1);
    const rate = drift > 0 ? baseRate - delta : baseRate + delta;
    return { kind: 'rate', rate: Math.round(rate * 1000) / 1000 };
  }
  return { kind: 'none', rate: baseRate };
}

interface ClockSample {
  offset: number;
  rtt: number;
}

/**
 * Клиент пен сервер сағаттарының айырмасын NTP тәрізді әдіспен бағалайды.
 * Ең аз кідірісті (RTT) үлгілерге көбірек сенеміз.
 */
export class ClockSync {
  private samples: ClockSample[] = [];

  constructor(private readonly maxSamples = 8) {}

  /** t0 — сұрау жіберілген, t1 — жауап келген клиент уақыты; serverTime — сервер уақыты. */
  addSample(t0: number, serverTime: number, t1: number): void {
    const rtt = Math.max(0, t1 - t0);
    const offset = serverTime - (t0 + rtt / 2);
    this.samples.push({ offset, rtt });
    if (this.samples.length > this.maxSamples) this.samples.shift();
  }

  get ready(): boolean {
    return this.samples.length > 0;
  }

  /** Клиент сағатына қосу керек түзету (мс). */
  get offset(): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a.rtt - b.rtt);
    const best = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
    return best.reduce((sum, s) => sum + s.offset, 0) / best.length;
  }

  get rtt(): number {
    if (this.samples.length === 0) return 0;
    return Math.min(...this.samples.map((s) => s.rtt));
  }

  serverNow(clientNow: number = Date.now()): number {
    return clientNow + this.offset;
  }
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** Кезекте келесі элементті табады; соңғысы болса null. */
export function nextItemId(queueIds: string[], currentId: string | null): string | null {
  if (queueIds.length === 0) return null;
  if (!currentId) return queueIds[0]!;
  const idx = queueIds.indexOf(currentId);
  return idx >= 0 && idx + 1 < queueIds.length ? queueIds[idx + 1]! : null;
}
