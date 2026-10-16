import React, {createContext, useContext} from 'react';
import {track} from '../lib/anim';
import type {Box} from '../lib/regions';

/** Portrait screen size on canvas at zoom 1. Screen content is laid out in "units" (1080×2400). */
export const SCREEN_W = 400;
export const SCREEN_H = (SCREEN_W * 2400) / 1080;
export const BEZEL = 13;
export const K = SCREEN_W / 1080;
export const PHONE_W = SCREEN_W + BEZEL * 2;
export const PHONE_H = SCREEN_H + BEZEL * 2;
export const HOME: [number, number] = [1310, 540];

/** fx/fy: focus point in portrait screen units; s: zoom; ax/ay: where that point sits on the canvas. */
export type Cam = {fx: number; fy: number; s: number; ax: number; ay: number};

export const overview = (home: [number, number] = HOME): Cam => ({fx: 540, fy: 1200, s: 1, ax: home[0], ay: home[1]});
export const focus = (p: [number, number], s: number, anchor: [number, number]): Cam => ({fx: p[0], fy: p[1], s, ax: anchor[0], ay: anchor[1]});

export const camTrack = (f: number, keys: Array<[number, Cam]>): Cam => {
  const fields: Array<keyof Cam> = ['fx', 'fy', 's', 'ax', 'ay'];
  const out = {} as Cam;
  for (const k of fields) out[k] = track(f, keys.map(([kf, c]) => [kf, c[k]] as [number, number]));
  return out;
};

const rotateVec = (x: number, y: number, deg: number): [number, number] => {
  const r = (deg * Math.PI) / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
};

/** Landscape content (2400×1080) is mounted rotated inside the portrait screen. */
export const landToPortrait = (lx: number, ly: number): [number, number] => [1080 - ly, lx];
export const landBox = (b: Box): Box => {
  const [x, y] = landToPortrait(b[0], b[1] + b[3]);
  return [x, y, b[3], b[2]];
};

/** Where a portrait-unit point lands on the canvas for a given camera. */
export const unitsToCanvas = (cam: Cam, p: [number, number], rot = 0, home: [number, number] = HOME): [number, number] => {
  const p0 = focusCanvas(cam, rot, home);
  const [vx, vy] = rotateVec(K * (p[0] - 540), K * (p[1] - 1200), rot);
  const raw: [number, number] = [home[0] + vx, home[1] + vy];
  return [cam.ax + cam.s * (raw[0] - p0[0]), cam.ay + cam.s * (raw[1] - p0[1])];
};

const focusCanvas = (cam: Cam, rot: number, home: [number, number]): [number, number] => {
  const [vx, vy] = rotateVec(K * (cam.fx - 540), K * (cam.fy - 1200), rot);
  return [home[0] + vx, home[1] + vy];
};

const ZoomCtx = createContext(K);
/** Canvas pixels per screen unit (for counter-scaling strokes, pointers…). */
export const useZoom = () => useContext(ZoomCtx);

type Props = {
  cam: Cam;
  rot?: number;
  home?: [number, number];
  /** extra canvas offset/opacity used for entrances & exits */
  dx?: number;
  dy?: number;
  opacity?: number;
  tilt?: number;
  screen: React.ReactNode;
  overlay?: React.ReactNode;
  /** content laid out in landscape units (2400×1080), mounted rotated so it is upright when rot = -90 */
  landscape?: React.ReactNode;
  landscapeOverlay?: React.ReactNode;
};

const LAND_TRANSFORM = 'translateX(1080px) rotate(90deg)';
const Land: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 2400, height: 1080, transformOrigin: '0 0', transform: LAND_TRANSFORM}}>{children}</div>
);

export const PhoneStage: React.FC<Props> = ({cam, rot = 0, home = HOME, dx = 0, dy = 0, opacity = 1, tilt = 0, screen, overlay, landscape, landscapeOverlay}) => {
  const p0 = focusCanvas(cam, rot, home);
  const zoom = K * cam.s;
  return (
    <div style={{position: 'absolute', inset: 0, opacity, transform: `translate(${dx}px, ${dy}px)`}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transformOrigin: '0 0',
          transform: `translate(${cam.ax}px, ${cam.ay}px) scale(${cam.s}) translate(${-p0[0]}px, ${-p0[1]}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: home[0] - PHONE_W / 2,
            top: home[1] - PHONE_H / 2,
            width: PHONE_W,
            height: PHONE_H,
            transform: `perspective(2400px) rotate(${rot}deg) rotateY(${tilt}deg)`,
          }}
        >
          <ZoomCtx.Provider value={zoom}>
            <PhoneBody>
              {screen}
              {landscape && <Land>{landscape}</Land>}
            </PhoneBody>
            <div style={{position: 'absolute', left: BEZEL, top: BEZEL, width: SCREEN_W, height: SCREEN_H, pointerEvents: 'none'}}>
              <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 2400, transformOrigin: '0 0', transform: `scale(${K})`}}>
                {overlay}
                {landscapeOverlay && <Land>{landscapeOverlay}</Land>}
              </div>
            </div>
          </ZoomCtx.Provider>
        </div>
      </div>
    </div>
  );
};

const PhoneBody: React.FC<{children: React.ReactNode}> = ({children}) => (
  <>
    {/* side keys */}
    <div style={{position: 'absolute', right: -4, top: 210, width: 5, height: 64, borderRadius: 3, background: 'linear-gradient(90deg,#2a3038,#151a20)'}} />
    <div style={{position: 'absolute', right: -4, top: 300, width: 5, height: 110, borderRadius: 3, background: 'linear-gradient(90deg,#2a3038,#151a20)'}} />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 62,
        background: 'linear-gradient(150deg, #3a414b 0%, #161b21 18%, #0b0e12 55%, #1f252c 100%)',
        boxShadow: '0 50px 90px rgba(0,0,0,0.6), 0 18px 36px rgba(0,0,0,0.45), inset 0 0 0 1.5px rgba(255,255,255,0.10), 0 0 0 1px rgba(0,0,0,0.9)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: BEZEL,
        top: BEZEL,
        width: SCREEN_W,
        height: SCREEN_H,
        borderRadius: 49,
        overflow: 'hidden',
        background: '#000',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
        // keeps rounded clipping crisp while children are transformed
        isolation: 'isolate',
      }}
    >
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 2400, transformOrigin: '0 0', transform: `scale(${K})`}}>
        {children}
        {/* punch-hole camera */}
        <div style={{position: 'absolute', left: 540 - 19, top: 26, width: 38, height: 38, borderRadius: 19, background: '#050505', boxShadow: '0 0 0 3px rgba(40,40,40,0.9)'}} />
      </div>
    </div>
  </>
);
