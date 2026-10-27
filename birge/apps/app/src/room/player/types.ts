import type { Ref } from 'react';
import type { QueueItem } from '@birge/shared';

/** Барлық ойнатқыштарға (YouTube, файл, HLS) ортақ басқару интерфейсі. */
export interface PlayerHandle {
  /** Ағымдағы орын (секунд). */
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  setRate(rate: number): void;
  setMuted(muted: boolean): void;
  enterFullscreen?(): void;
  /** Жылдамдықты біркелкі өзгерте ала ма (YouTube — тек бекітілген мәндер). */
  readonly canAdjustRate: boolean;
}

export interface PlayerEvents {
  onReady(): void;
  onEnded(): void;
  onError(): void;
  /** Браузер дыбыспен автоматты ойнатуға рұқсат бермеді. */
  onAutoplayBlocked(): void;
}

export interface PlayerProps extends PlayerEvents {
  item: QueueItem;
  ref?: Ref<PlayerHandle | null>;
  /** YouTube ендірілген ойнатқышы үшін бет мекенжайы (Referer). */
  origin: string;
  locale: string;
}
