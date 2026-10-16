import {Easing, interpolate, spring} from 'remotion';
import {FPS} from '../timeline';

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
export const easeSoft = Easing.bezier(0.45, 0, 0.2, 1);

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 0→1 (or from→to) between frames a and b. */
export const tw = (f: number, a: number, b: number, from = 0, to = 1, ease: (t: number) => number = easeOut) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return f < a ? from : to;
  return interpolate(f, [a, Math.max(b, a + 0.0001)], [from, to], {...clamp, easing: ease});
};

/** Fade in at `inAt`, fade out at `outAt` (both over d frames). */
export const vis = (f: number, inAt: number, outAt = Infinity, d = 10) =>
  Math.min(tw(f, inAt, inAt + d), 1 - tw(f, outAt, outAt + d, 0, 1, easeIn));

/** Piecewise keyframe track: keys = [[frame, value], ...], eased between keys. */
export const track = (f: number, keys: Array<[number, number]>, ease: (t: number) => number = easeInOut) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (f <= f1) return interpolate(f, [f0, Math.max(f1, f0 + 0.0001)], [v0, v1], {...clamp, easing: ease});
  }
  return keys[keys.length - 1][1];
};

/** Spring that starts at frame `at` (0 → 1, slight overshoot). */
export const pop = (f: number, at: number, damping = 14, stiffness = 170) =>
  spring({frame: f - at, fps: FPS, config: {damping, stiffness, mass: 0.9}});

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const sec = (s: number) => Math.round(s * FPS);
