import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C} from '../theme';
import {easeIn, easeInOut, tw, vis} from '../lib/anim';
import type {Box} from '../lib/regions';
import {useZoom} from './Phone';

type Common = {box: Box; at: number; out?: number; pad?: number; radius?: number};

/** Cyan outline that draws itself around an element (lives in phone units, overlay layer). */
export const Highlight: React.FC<Common & {color?: string; glow?: boolean}> = ({box, at, out = Infinity, pad = 14, radius = 28, color = C.cyan, glow = true}) => {
  const f = useCurrentFrame();
  const zoom = useZoom();
  const o = vis(f, at, out, 8);
  if (o <= 0) return null;
  const draw = tw(f, at, at + 16, 0, 1, easeInOut);
  const sw = 3.4 / zoom;
  const w = box[2] + pad * 2;
  const h = box[3] + pad * 2;
  const r = Math.min(radius + pad, h / 2);
  const per = 2 * (w + h) - (8 - 2 * Math.PI) * r;
  const breathe = 0.65 + 0.35 * Math.sin((f - at) / 9);
  return (
    <svg
      style={{position: 'absolute', left: box[0] - pad, top: box[1] - pad, width: w, height: h, overflow: 'visible', opacity: o}}
      viewBox={`0 0 ${w} ${h}`}
    >
      <rect x={0} y={0} width={w} height={h} rx={r} fill={color} fillOpacity={0.07 * draw} />
      {glow && (
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          rx={r}
          fill="none"
          stroke={color}
          strokeOpacity={0.45 * breathe * draw}
          strokeWidth={sw * 4}
          style={{filter: `blur(${6 / zoom}px)`}}
        />
      )}
      <rect x={0} y={0} width={w} height={h} rx={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={per} strokeDashoffset={per * (1 - draw)} strokeLinecap="round" />
    </svg>
  );
};

/** Dims the rest of the screen around a box (lives in the clipped screen layer). */
export const Spotlight: React.FC<Common & {strength?: number}> = ({box, at, out = Infinity, pad = 14, radius = 28, strength = 0.55}) => {
  const f = useCurrentFrame();
  const o = vis(f, at, out, 12);
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: box[0] - pad,
        top: box[1] - pad,
        width: box[2] + pad * 2,
        height: box[3] + pad * 2,
        borderRadius: radius + pad,
        boxShadow: `0 0 0 4000px rgba(0,0,0,${strength * o})`,
      }}
    />
  );
};

/** Red "don't tap this" cross over an element. */
export const Cross: React.FC<Common> = ({box, at, out = Infinity, pad = 10, radius = 26}) => {
  const f = useCurrentFrame();
  const zoom = useZoom();
  const o = vis(f, at, out, 8);
  if (o <= 0) return null;
  const a = tw(f, at + 4, at + 14, 0, 1, easeInOut);
  const b = tw(f, at + 10, at + 20, 0, 1, easeInOut);
  const w = box[2] + pad * 2;
  const h = box[3] + pad * 2;
  const sw = 6 / zoom;
  const inset = Math.min(w, h) * 0.12;
  const len = Math.hypot(w - inset * 2, h - inset * 2);
  const shake = f < at + 26 ? Math.sin((f - at) * 2.2) * (1 - tw(f, at + 12, at + 26)) * (6 / zoom) : 0;
  return (
    <svg style={{position: 'absolute', left: box[0] - pad + shake, top: box[1] - pad, width: w, height: h, overflow: 'visible', opacity: o}} viewBox={`0 0 ${w} ${h}`}>
      <rect x={0} y={0} width={w} height={h} rx={radius + pad} fill={C.red} fillOpacity={0.22} stroke={C.red} strokeWidth={sw * 0.6} />
      <line x1={inset} y1={inset} x2={w - inset} y2={h - inset} stroke={C.red} strokeWidth={sw} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - a)} />
      <line x1={w - inset} y1={inset} x2={inset} y2={h - inset} stroke={C.red} strokeWidth={sw} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - b)} />
    </svg>
  );
};

type TouchKey = {f: number; x: number; y: number};

/**
 * Finger/touch indicator. keys = path keyframes (screen units), taps = frames of taps,
 * drags = [start, end] frame ranges where the finger is held down (swipes).
 */
export const Touch: React.FC<{keys: TouchKey[]; taps?: number[]; drags?: Array<[number, number]>; inAt: number; outAt?: number}> = ({
  keys,
  taps = [],
  drags = [],
  inAt,
  outAt = Infinity,
}) => {
  const f = useCurrentFrame();
  const zoom = useZoom();
  const o = vis(f, inAt, outAt, 8);
  if (o <= 0) return null;
  const pos = (axis: 'x' | 'y') => {
    if (f <= keys[0].f) return keys[0][axis];
    for (let i = 1; i < keys.length; i++) {
      if (f <= keys[i].f) return keys[i - 1][axis] + (keys[i][axis] - keys[i - 1][axis]) * easeInOut((f - keys[i - 1].f) / Math.max(1, keys[i].f - keys[i - 1].f));
    }
    return keys[keys.length - 1][axis];
  };
  const x = pos('x');
  const y = pos('y');
  let press = 0;
  for (const t of taps) press = Math.max(press, tw(f, t - 4, t, 0, 1) * (1 - tw(f, t + 2, t + 8, 0, 1, easeIn)));
  for (const [a, b] of drags) press = Math.max(press, tw(f, a - 4, a) * (1 - tw(f, b, b + 6, 0, 1, easeIn)));
  const size = 62 / zoom;
  const s = 1 - 0.18 * press;
  return (
    <>
      {taps.map((t) => {
        const p = tw(f, t, t + 18, 0, 1);
        if (f < t || p >= 1) return null;
        const kx = keys.length ? x : 0;
        return (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: kx - (size * (0.6 + 1.6 * p)) / 2,
              top: y - (size * (0.6 + 1.6 * p)) / 2,
              width: size * (0.6 + 1.6 * p),
              height: size * (0.6 + 1.6 * p),
              borderRadius: '50%',
              border: `${3 / zoom}px solid ${C.cyan}`,
              opacity: (1 - p) * o,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: '50%',
          opacity: o,
          transform: `scale(${s})`,
          background: `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.95), rgba(255,255,255,${0.62 + 0.2 * press}) 60%, rgba(46,230,255,${0.35 * press}) 100%)`,
          border: `${2.5 / zoom}px solid rgba(255,255,255,0.95)`,
          boxShadow: `0 ${6 / zoom}px ${18 / zoom}px rgba(0,0,0,0.5), 0 0 ${24 / zoom}px rgba(46,230,255,${0.6 * press})`,
        }}
      />
    </>
  );
};
