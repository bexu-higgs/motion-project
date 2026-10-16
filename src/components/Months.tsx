import React from 'react';
import {C, FONT} from '../theme';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 12 month tiles; lit(i) returns 0..1 for each tile. */
export const MonthGrid: React.FC<{
  cols?: number;
  tileW?: number;
  tileH?: number;
  gap?: number;
  lit: (i: number) => number;
  appear?: (i: number) => number;
  color?: string;
  fontSize?: number;
}> = ({cols = 6, tileW = 150, tileH = 96, gap = 14, lit, appear = () => 1, color = C.cyan, fontSize = 24}) => (
  <div style={{display: 'grid', gridTemplateColumns: `repeat(${cols}, ${tileW}px)`, gap, fontFamily: FONT}}>
    {MONTHS.map((m, i) => {
      const l = lit(i);
      const a = appear(i);
      return (
        <div
          key={m}
          style={{
            width: tileW,
            height: tileH,
            borderRadius: 16,
            position: 'relative',
            overflow: 'hidden',
            opacity: a,
            transform: `translateY(${(1 - a) * 18}px) scale(${0.9 + 0.1 * a})`,
            border: `1.5px solid ${l > 0.5 ? color : 'rgba(255,255,255,0.12)'}`,
            background: 'rgba(255,255,255,0.035)',
            boxShadow: l > 0.5 ? `0 0 22px ${color}55` : 'none',
          }}
        >
          <div style={{position: 'absolute', inset: 0, background: color, opacity: 0.2 * l}} />
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 8, background: l > 0.5 ? color : 'rgba(255,255,255,0.12)'}} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 6,
              fontSize,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: l > 0.5 ? C.text : C.faint,
            }}
          >
            {m}
          </div>
        </div>
      );
    })}
  </div>
);
