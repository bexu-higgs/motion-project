import React from 'react';
import {Img, staticFile} from 'remotion';
import {C, FONT} from '../theme';
import {REGIONS, SOURCES, unitsPerSourcePx, type Box, type RegionName, type SourceKey} from '../lib/regions';

export const screenSrc = (src: SourceKey) => staticFile(`screens/${SOURCES[src].file}`);

/** A full screenshot filling the portrait (1080×2400) or landscape (2400×1080) screen. */
export const Shot: React.FC<{src: SourceKey; opacity?: number; style?: React.CSSProperties}> = ({src, opacity = 1, style}) => {
  const land = SOURCES[src].w > SOURCES[src].h;
  return (
    <Img
      src={screenSrc(src)}
      style={{position: 'absolute', left: 0, top: 0, width: land ? 2400 : 1080, height: land ? 1080 : 2400, opacity, ...style}}
    />
  );
};

/** Part of a screenshot (source-pixel box) placed at x/y in screen units. */
export const Crop: React.FC<{src: SourceKey; box: Box; x?: number; y?: number; scale?: number; style?: React.CSSProperties}> = ({
  src,
  box,
  x,
  y,
  scale,
  style,
}) => {
  const k = scale ?? unitsPerSourcePx(src);
  const s = SOURCES[src];
  return (
    <div
      style={{
        position: 'absolute',
        left: x ?? box[0] * k,
        top: y ?? box[1] * k,
        width: box[2] * k,
        height: box[3] * k,
        overflow: 'hidden',
        ...style,
      }}
    >
      <Img src={screenSrc(src)} style={{position: 'absolute', left: -box[0] * k, top: -box[1] * k, width: s.w * k, height: s.h * k, maxWidth: 'none'}} />
    </div>
  );
};

/** A named cut-out rendered at a given canvas width (used outside the phone). */
export const Cutout: React.FC<{name: RegionName; width: number; radius?: number; style?: React.CSSProperties}> = ({name, width, radius = 0, style}) => {
  const r = REGIONS[name];
  const k = width / r.box[2];
  return <Crop src={r.src} box={r.box} x={0} y={0} scale={k} style={{position: 'relative', borderRadius: radius, ...style}} />;
};

const CHROME_H = 251;
const NAV_Y = 2354;

/**
 * The Explore page with the menu closed. There is no screenshot of this state, so it is assembled
 * from real pieces: the browser bar, the real menu icon, Higgsfield's Upgrade pill (visible at the
 * top-right edge of every menu screenshot) and an out-of-focus feed built from real page pixels.
 */
export const ClosedPage: React.FC<{loggedIn?: boolean}> = ({loggedIn}) => {
  const src: SourceKey = loggedIn ? 'menuIn' : 'menuOut';
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 2400, background: '#080808'}}>
      <Img src={staticFile('img/explore-feed.jpg')} style={{position: 'absolute', left: 0, top: 400, width: 1080, height: 1954}} />
      <Crop src={src} box={[0, 0, 1080, CHROME_H]} />
      <Crop src={src} box={REGIONS.menuIcon.box} x={30} y={292} />
      <UpgradePill x={846} y={290} />
      <Crop src={src} box={[0, NAV_Y, 1080, 2400 - NAV_Y]} />
    </div>
  );
};

export const UpgradePill: React.FC<{x: number; y: number; scale?: number}> = ({x, y, scale = 1}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 200 * scale,
      height: 74 * scale,
      borderRadius: 37 * scale,
      background: C.lime,
      color: '#0A0A0A',
      fontFamily: FONT,
      fontWeight: 600,
      fontSize: 34 * scale,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      letterSpacing: '-0.01em',
    }}
  >
    Upgrade
  </div>
);

/** The real sidebar sliding in over the closed page; at progress 1 it is exactly the screenshot. */
export const SlideMenu: React.FC<{progress: number; src: SourceKey}> = ({progress, src}) => {
  if (progress <= 0) return null;
  if (progress >= 1) return <Shot src={src} />;
  const sidebar: Box = [0, CHROME_H, 948, NAV_Y - CHROME_H];
  return (
    <>
      <div style={{position: 'absolute', left: 0, top: CHROME_H, width: 1080, height: NAV_Y - CHROME_H, background: `rgba(0,0,0,${0.62 * progress})`}} />
      <Crop src={src} box={[948, CHROME_H, 132, NAV_Y - CHROME_H]} style={{opacity: progress}} />
      <Crop
        src={src}
        box={sidebar}
        x={-948 * (1 - progress)}
        y={CHROME_H}
        style={{boxShadow: '20px 0 60px rgba(0,0,0,0.6)'}}
      />
    </>
  );
};
