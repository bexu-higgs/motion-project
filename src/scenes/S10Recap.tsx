import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {cues} from '../timeline';
import {easeIn, pop, tw, vis} from '../lib/anim';
import {Cutout} from '../components/Screen';
import {StepHeader, Tag} from '../components/Text';
import {Icon} from '../components/Icon';
import {Sfx} from '../components/Sfx';

const ITEMS = [
  'Open the referral link',
  'Create an account',
  'Open Go Premium from your profile',
  'Select Monthly',
  'Choose Max and verify the discounted price',
  'Complete payment within 3 hours',
];

export const S10Recap: React.FC = () => {
  const f = useCurrentFrame();
  const c = cues('s10');
  const end = c.duration;

  const listFrom = c.at('s10_1') + 8;
  const listTo = c.end('s10_2') + 24;
  const step = (listTo - listFrom) / ITEMS.length;
  const titleAt = c.at('s10_3') - 14;
  const listOut = titleAt - 6;
  const t = pop(f, titleAt, 16, 90);
  const fadeToBlack = tw(f, end - 26, end - 2, 0, 1, easeIn);

  return (
    <AbsoluteFill style={{fontFamily: FONT}}>
      {/* the real Higgsfield pricing page, softly blurred in the background */}
      <AbsoluteFill style={{opacity: 0.6 * tw(f, 0, 24), transform: `scale(${1.06 - 0.06 * tw(f, 0, end, 0, 1, (x) => x)})`}}>
        <Img src={staticFile('img/site-backdrop.jpg')} style={{width: 1920, height: 1080}} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 30% 50%, rgba(5,7,10,0.55), rgba(5,7,10,0.9))'}} />

      <StepHeader kicker="Recap" title="That’s it!" at={2} out={listOut} />

      <div style={{position: 'absolute', left: 120, top: 320, opacity: 1 - tw(f, listOut, listOut + 12, 0, 1, easeIn)}}>
        {ITEMS.map((item, i) => {
          const at = listFrom + i * step;
          const p = pop(f, at);
          const done = tw(f, at + 10, at + 18);
          if (f < at) return null;
          return (
            <div key={item} style={{display: 'flex', alignItems: 'center', gap: 24, height: 96, opacity: Math.min(1, p * 1.3), transform: `translateX(${(1 - p) * -40}px)`}}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 800,
                  color: done > 0.5 ? '#041014' : C.text,
                  background: done > 0.5 ? C.cyan : 'rgba(255,255,255,0.06)',
                  border: `1.5px solid ${done > 0.5 ? C.cyan : C.borderStrong}`,
                  boxShadow: done > 0.5 ? `0 0 26px ${C.cyanGlow}` : 'none',
                  transform: `scale(${1 + 0.18 * Math.sin(Math.PI * done)})`,
                }}
              >
                {done > 0.5 ? <Icon name="check" size={36} stroke={3.2} /> : i + 1}
              </div>
              <div style={{fontSize: 36, fontWeight: 750, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.text}}>{item}</div>
            </div>
          );
        })}
      </div>

      {/* title card */}
      {f >= titleAt && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: Math.min(1, t * 1.4)}}>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${(1 - t) * 40}px)`}}>
            <div style={{transform: `scale(${0.6 + 0.4 * t})`, filter: 'drop-shadow(0 0 40px rgba(209,254,23,0.35))'}}>
              <Cutout name="welcomeLogo" width={132} radius={32} />
            </div>
            <div style={{marginTop: 34, fontSize: 130, fontWeight: 850, letterSpacing: '-0.04em', color: C.text, lineHeight: 1}}>HIGGSFIELD MAX</div>
            <div style={{marginTop: 22, fontSize: 46, fontWeight: 400, letterSpacing: '0.42em', color: C.cyan, paddingLeft: '0.42em'}}>DISCOUNT GUIDE</div>
            <div style={{marginTop: 36, width: 520 * tw(f, titleAt + 10, titleAt + 34), height: 2, background: `linear-gradient(90deg, transparent, ${C.cyan}, transparent)`}} />
          </div>
          <div style={{position: 'absolute', top: 820, display: 'flex', gap: 22}}>
            <div style={{opacity: vis(f, c.at('s10_3'), Infinity, 12)}}>
              <Tag text="Save this video" tone="neutral" icon="bookmark" size={22} />
            </div>
            <div style={{opacity: vis(f, c.at('s10_4'), Infinity, 12)}}>
              <Tag text="Questions? Write to me" tone="cyan" icon="message" size={22} />
            </div>
          </div>
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{background: '#000', opacity: fadeToBlack}} />

      {ITEMS.map((_, i) => (
        <Sfx key={i} name="tick" at={listFrom + i * step + 10} volume={0.4} />
      ))}
      <Sfx name="whoosh" at={titleAt} />
      <Sfx name="success" at={titleAt + 8} volume={0.3} />
    </AbsoluteFill>
  );
};

