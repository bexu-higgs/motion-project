import {Easing, interpolate, spring} from 'remotion';
import {FPS} from '../theme';

export const ease = Easing.bezier(0.22, 1, 0.36, 1); // smooth "out-expo"-like
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 0 -> 1 over `dur` frames starting at `start`. */
export const prog = (frame: number, start: number, dur = 18, easing = ease) =>
	interpolate(frame, [start, start + dur], [0, 1], {...clamp, easing});

/** Fade/rise in at `start`, optional fade out at `end`. Returns style props. */
export function appear(frame: number, start: number, opts: {end?: number; dur?: number; y?: number; scale?: number} = {}) {
	const {end, dur = 16, y = 28, scale = 0.96} = opts;
	const pIn = prog(frame, start, dur);
	const pOut = end === undefined ? 0 : prog(frame, end - 10, 10, easeInOut);
	const p = pIn * (1 - pOut);
	return {
		opacity: p,
		transform: `translateY(${(1 - pIn) * y - pOut * 12}px) scale(${scale + (1 - scale) * pIn})`,
	};
}

export const pop = (frame: number, start: number) =>
	spring({frame: frame - start, fps: FPS, config: {damping: 14, stiffness: 160, mass: 0.7}});

export const sec = (s: number) => Math.round(s * FPS);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
