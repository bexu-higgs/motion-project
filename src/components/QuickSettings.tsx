import React from 'react';
import {C, FONT} from '../theme';
import {Icon, type IconName} from './Icon';
import {T} from '../copy';

/** Generic Android quick-settings shade, drawn in portrait screen units (1080 wide). */
export const SHADE_H = 1330;
const TILE = 200;
const GAP_X = 52;
const COLS = 4;
const START_X = (1080 - (COLS * TILE + (COLS - 1) * GAP_X)) / 2;
const ROW_Y = [560, 880];

const ICONS: IconName[] = ['wifi', 'signal', 'bluetooth', 'flashlight', 'rotate', 'plane', 'pin', 'moon'];
const TILES: Array<{icon: IconName; label: string; on?: boolean}> = ICONS.map((icon, i) => ({icon, label: T.monthly.tiles[i], on: i < 2}));

export const AUTO_ROTATE_INDEX = 4;

export const tileBox = (i: number): [number, number, number, number] => [START_X + (i % COLS) * (TILE + GAP_X), ROW_Y[Math.floor(i / COLS)], TILE, TILE];

/** open: 0 (hidden) → 1 (fully pulled down). autoRotate: 0 → 1 switches the tile on. */
export const QuickSettings: React.FC<{open: number; autoRotate: number}> = ({open, autoRotate}) => {
  if (open <= 0) return null;
  const y = -(SHADE_H + 60) * (1 - open);
  return (
    <>
      <div style={{position: 'absolute', inset: 0, background: `rgba(0,0,0,${0.5 * open})`}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: y,
          width: 1080,
          height: SHADE_H,
          borderRadius: '0 0 72px 72px',
          background: 'linear-gradient(180deg, #1A1D22 0%, #14171B 100%)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          fontFamily: FONT,
          color: '#fff',
        }}
      >
        <div style={{position: 'absolute', left: 64, top: 150, fontSize: 132, fontWeight: 300, letterSpacing: '-0.03em'}}>22:28</div>
        <div style={{position: 'absolute', right: 64, top: 196, display: 'flex', gap: 44, color: 'rgba(255,255,255,0.8)'}}>
          <Icon name="gear" size={58} stroke={1.8} />
        </div>
        {/* brightness */}
        <div style={{position: 'absolute', left: START_X, top: 372, width: 1080 - START_X * 2, height: 110, borderRadius: 55, background: 'rgba(255,255,255,0.09)', overflow: 'hidden'}}>
          <div style={{width: '62%', height: '100%', borderRadius: 55, background: 'rgba(255,255,255,0.82)', display: 'flex', alignItems: 'center', paddingLeft: 40}}>
            <Icon name="sun" size={50} color="#1A1D22" stroke={2.2} />
          </div>
        </div>
        {TILES.map((t, i) => {
          const [x, ty] = tileBox(i);
          const on = i === AUTO_ROTATE_INDEX ? autoRotate : t.on ? 1 : 0;
          return (
            <div key={t.label} style={{position: 'absolute', left: x, top: ty, width: TILE}}>
              <div
                style={{
                  width: TILE,
                  height: TILE,
                  borderRadius: 64,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: on > 0.5 ? C.cyan : 'rgba(255,255,255,0.1)',
                  boxShadow: i === AUTO_ROTATE_INDEX && on > 0.5 ? `0 0 ${50 * on}px ${C.cyanGlow}` : 'none',
                  transform: `scale(${i === AUTO_ROTATE_INDEX ? 1 + 0.08 * Math.sin(Math.PI * Math.min(1, autoRotate)) : 1})`,
                  color: on > 0.5 ? '#04252C' : 'rgba(255,255,255,0.85)',
                }}
              >
                <Icon name={t.icon} size={84} stroke={2} />
              </div>
              <div style={{marginTop: 20, textAlign: 'center', fontSize: 31, lineHeight: 1.12, fontWeight: 500, color: 'rgba(255,255,255,0.78)', marginLeft: -26, marginRight: -26}}>
                {t.label}
              </div>
            </div>
          );
        })}
        <div style={{position: 'absolute', left: 480, top: SHADE_H - 44, width: 120, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.35)'}} />
      </div>
    </>
  );
};
