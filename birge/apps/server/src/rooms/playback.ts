import { positionAt, type PlaybackAction, type PlaybackState } from '@birge/shared';

export function initialPlayback(now: number): PlaybackState {
  return { itemId: null, status: 'paused', position: 0, rate: 1, updatedAt: now, seq: 0 };
}

function cleanPosition(position: number): number {
  return Number.isFinite(position) && position > 0 ? Math.min(position, 60 * 60 * 24) : 0;
}

/** Әкімшінің ойнату командасын қолданады. */
export function applyControl(state: PlaybackState, action: PlaybackAction, position: number, now: number): PlaybackState {
  const pos = cleanPosition(position);
  const status = action === 'play' ? 'playing' : action === 'pause' ? 'paused' : state.status;
  return { ...state, status, position: pos, updatedAt: now, seq: state.seq + 1 };
}

export function selectItem(state: PlaybackState, itemId: string | null, now: number, autoplay = true): PlaybackState {
  return {
    ...state,
    itemId,
    status: itemId && autoplay ? 'playing' : 'paused',
    position: 0,
    updatedAt: now,
    seq: state.seq + 1,
  };
}

/** Ағымдағы орынды «қатырып», тоқтатады (мыс. экранды бөлісу басталғанда). */
export function pauseAt(state: PlaybackState, now: number): PlaybackState {
  if (state.status === 'paused') return state;
  return { ...state, status: 'paused', position: positionAt(state, now), updatedAt: now, seq: state.seq + 1 };
}

export { nextItemId } from '@birge/shared';
