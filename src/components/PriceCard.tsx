import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {easeInOut, pop, tw} from '../lib/anim';
import {Tag} from './Text';
import {T} from '../copy';

/** Clean MAX price card: regular price first, then the discounted price with a soft glow. */
export const PriceCard: React.FC<{option: number; credits: string; regular: string; discounted: string; regAt: number; discAt: number}> = ({
  option,
  credits,
  regular,
  discounted,
  regAt,
  discAt,
}) => {
  const f = useCurrentFrame();
  const reg = pop(f, regAt);
  const strike = tw(f, discAt - 2, discAt + 10, 0, 1, easeInOut);
  const disc = pop(f, discAt, 12, 150);
  const glow = tw(f, discAt, discAt + 14) * (0.75 + 0.25 * Math.sin((f - discAt) / 10));
  return (
    <div
      style={{
        width: 640,
        padding: '40px 46px 44px',
        borderRadius: 34,
        background: 'linear-gradient(160deg, rgba(20,28,38,0.95), rgba(10,14,20,0.95))',
        border: `1.5px solid ${f >= discAt ? 'rgba(46,230,255,0.55)' : C.border}`,
        boxShadow: `0 40px 80px rgba(0,0,0,0.55), 0 0 ${60 * glow}px rgba(46,230,255,${0.25 * glow})`,
        fontFamily: FONT,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{fontSize: 64, fontWeight: 850, letterSpacing: '-0.03em', color: C.text}}>MAX</div>
        <Tag text={T.max.option(option)} tone="neutral" size={19} />
      </div>
      <div style={{marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 14}}>
        <span style={{fontSize: 46, fontWeight: 750, color: C.cyan, letterSpacing: '-0.02em'}}>{credits}</span>
        <span style={{fontSize: 30, fontWeight: 600, color: C.dim}}>{T.max.creditsMonth}</span>
      </div>
      <div style={{height: 1.5, background: C.border, margin: '30px 0 26px'}} />
      <div style={{opacity: Math.min(1, reg), transform: `translateY(${(1 - reg) * 20}px)`}}>
        <div style={{fontSize: 20, fontWeight: 700, letterSpacing: '0.16em', color: C.faint, textTransform: 'uppercase'}}>{T.max.regular}</div>
        <div style={{position: 'relative', display: 'inline-block', marginTop: 6, fontSize: 76, fontWeight: 700, color: f >= discAt ? C.dim : C.text, letterSpacing: '-0.03em'}}>
          {regular}
          <div style={{position: 'absolute', left: -6, right: -6, top: '54%', height: 6, borderRadius: 3, background: C.red, transformOrigin: 'left', transform: `scaleX(${strike}) rotate(-6deg)`}} />
        </div>
      </div>
      <div style={{marginTop: 22, opacity: Math.min(1, disc * 1.2), transform: `translateY(${(1 - disc) * 30}px) scale(${0.9 + 0.1 * disc})`, transformOrigin: 'left center'}}>
        <div style={{fontSize: 20, fontWeight: 700, letterSpacing: '0.16em', color: C.cyan, textTransform: 'uppercase'}}>{T.max.discounted}</div>
        <div style={{marginTop: 2, fontSize: 150, lineHeight: 1, fontWeight: 850, color: C.text, letterSpacing: '-0.045em', textShadow: `0 0 ${40 * glow}px rgba(46,230,255,${0.7 * glow})`}}>
          {discounted}
        </div>
      </div>
    </div>
  );
};
