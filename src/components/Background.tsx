import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C} from '../theme';

/** Persistent dark backdrop: soft drifting cyan glows over a faint dot grid. */
export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const a = f / 300;
  const g1x = 22 + Math.sin(a) * 6;
  const g1y = 18 + Math.cos(a * 0.8) * 5;
  const g2x = 82 + Math.cos(a * 0.7) * 5;
  const g2y = 86 + Math.sin(a * 0.9) * 4;
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at ${g1x}% ${g1y}%, rgba(46,230,255,0.10), transparent 70%),
             radial-gradient(1000px 800px at ${g2x}% ${g2y}%, rgba(15,181,209,0.08), transparent 70%),
             linear-gradient(180deg, #070A0E 0%, #05070A 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1.2px, transparent 1.3px)',
          backgroundSize: '36px 36px',
          backgroundPosition: `${(f * 0.15) % 36}px 0px`,
          maskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, black 30%, transparent 100%)',
        }}
      />
      <AbsoluteFill style={{boxShadow: 'inset 0 0 260px rgba(0,0,0,0.75)'}} />
    </AbsoluteFill>
  );
};
