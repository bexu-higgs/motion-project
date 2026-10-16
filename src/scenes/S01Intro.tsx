import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {cues} from '../timeline';
import {easeIn, easeInOut, pop, tw, vis} from '../lib/anim';
import {PhoneStage, overview} from '../components/Phone';
import {Shot, Cutout} from '../components/Screen';
import {Tag} from '../components/Text';
import {Icon, type IconName} from '../components/Icon';
import {Sfx} from '../components/Sfx';
import {T} from '../copy';

const HOME_INTRO: [number, number] = [1490, 560];

const Node: React.FC<{label: string; icon?: IconName; logo?: boolean; on: number; appear: number}> = ({label, icon, logo, on, appear}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '16px 24px 16px 16px',
      borderRadius: 22,
      opacity: appear,
      transform: `translateY(${(1 - appear) * 24}px) scale(${1 + 0.05 * Math.sin(Math.PI * Math.min(1, on))})`,
      background: on > 0.5 ? 'rgba(46,230,255,0.10)' : 'rgba(255,255,255,0.04)',
      border: `1.5px solid ${on > 0.5 ? C.cyan : 'rgba(255,255,255,0.12)'}`,
      boxShadow: on > 0.5 ? `0 0 36px rgba(46,230,255,${0.35 * on})` : 'none',
      fontFamily: FONT,
      fontWeight: 750,
      fontSize: 23,
      letterSpacing: '0.1em',
      color: on > 0.5 ? C.text : C.dim,
      whiteSpace: 'nowrap',
    }}
  >
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: logo ? 'transparent' : on > 0.5 ? C.cyan : 'rgba(255,255,255,0.08)',
        color: on > 0.5 ? '#041014' : C.dim,
      }}
    >
      {logo ? <Cutout name="welcomeLogo" width={46} radius={12} /> : <Icon name={icon ?? 'link'} size={26} stroke={2.4} />}
    </div>
    {label}
  </div>
);

const Connector: React.FC<{p: number; appear: number}> = ({p, appear}) => (
  <div style={{position: 'relative', width: 58, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', opacity: appear}}>
    <div style={{width: `${p * 100}%`, height: '100%', borderRadius: 2, background: C.cyan, boxShadow: `0 0 12px ${C.cyanGlow}`}} />
    <div style={{position: 'absolute', right: -6, top: -9, color: p > 0.95 ? C.cyan : 'rgba(255,255,255,0.25)'}}>
      <Icon name="arrow" size={22} stroke={2.6} style={{transform: 'translateX(4px)'}} />
    </div>
  </div>
);

const Cursor: React.FC<{x: number; y: number; press: number; o: number}> = ({x, y, press, o}) => (
  <div style={{position: 'absolute', left: x, top: y, opacity: o, transform: `scale(${1 - 0.15 * press})`, transformOrigin: '6px 4px', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.6))'}}>
    <svg width="40" height="48" viewBox="0 0 24 28">
      <path d="M2 2 L2 22 L7.5 17 L11 25.5 L14.6 24 L11.2 15.6 L18.5 15.6 Z" fill="#fff" stroke="#0A0D12" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </div>
);

export const S01Intro: React.FC = () => {
  const f = useCurrentFrame();
  const c = cues('s1');
  const end = c.duration;

  // phone with the real Higgsfield welcome screen rises in
  const rise = pop(f, 4, 18, 90);
  const exit = tw(f, end - 16, end, 0, 1, easeIn);
  const tilt = -16 + 8 * tw(f, 0, end, 0, 1, easeInOut);

  // flow: cursor clicks the referral link, then the chain lights up
  const flowIn = c.at('s1_2');
  const click = c.mid('s1_2', 0.32);
  const n2 = click + 22;
  const n3 = n2 + 22;
  const cx = tw(f, flowIn + 4, click - 4, 860, 245, easeInOut);
  const cy = tw(f, flowIn + 4, click - 4, 900, 606, easeInOut);
  const press = tw(f, click - 3, click, 0, 1) * (1 - tw(f, click + 2, click + 7));
  const cursorO = vis(f, flowIn + 2, n3 + 20, 8);

  const stepsAt = c.at('s1_3');
  const fadeAll = 1 - tw(f, end - 14, end, 0, 1, easeIn);

  return (
    <AbsoluteFill>
      <PhoneStage
        cam={overview(HOME_INTRO)}
        home={HOME_INTRO}
        dy={(1 - rise) * 760 + exit * 80}
        opacity={Math.min(1, rise * 1.5) * (1 - exit)}
        tilt={tilt}
        screen={<Shot src="login" />}
      />
      <AbsoluteFill style={{opacity: fadeAll}}>
        {/* title */}
        <div style={{position: 'absolute', left: 120, top: 150, fontFamily: FONT}}>
          <div style={{opacity: vis(f, 10), transform: `translateX(${(1 - tw(f, 10, 28)) * -30}px)`}}>
            <Tag text={T.intro.kicker} tone="cyan" icon="phone" size={21} />
          </div>
          {T.intro.title.map((line, i) => {
            const p = tw(f, 16 + i * 6, 40 + i * 6);
            return (
              <div key={line} style={{overflow: 'hidden', marginTop: i === 0 ? 26 : 0, paddingBottom: 6}}>
                <div
                  style={{
                    transform: `translateY(${(1 - p) * 110}%)`,
                    fontSize: 96,
                    lineHeight: 1.02,
                    fontWeight: i === 0 ? 800 : 300,
                    letterSpacing: '-0.035em',
                    color: i === 0 ? C.text : C.cyan,
                  }}
                >
                  {line}
                </div>
              </div>
            );
          })}
        </div>
        {/* referral link → higgsfield → max discount */}
        <div style={{position: 'absolute', left: 120, top: 560, display: 'flex', alignItems: 'center', gap: 20}}>
          <Node label={T.intro.nodes[0]} icon="link" on={tw(f, click, click + 8)} appear={tw(f, flowIn - 6, flowIn + 12)} />
          <Connector p={tw(f, click + 4, n2, 0, 1, easeInOut)} appear={tw(f, flowIn - 2, flowIn + 14)} />
          <Node label={T.intro.nodes[1]} logo on={tw(f, n2, n2 + 8)} appear={tw(f, flowIn, flowIn + 18)} />
          <Connector p={tw(f, n2 + 4, n3, 0, 1, easeInOut)} appear={tw(f, flowIn + 4, flowIn + 20)} />
          <Node label={T.intro.nodes[2]} icon="percent" on={tw(f, n3, n3 + 8)} appear={tw(f, flowIn + 6, flowIn + 24)} />
        </div>
        {/* six steps preview */}
        <div style={{position: 'absolute', left: 120, top: 740, display: 'flex', alignItems: 'center', gap: 16, fontFamily: FONT}}>
          {Array.from({length: 6}).map((_, i) => {
            const p = pop(f, stepsAt + i * 4);
            return (
              <div
                key={i}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                  color: C.text,
                  border: `1.5px solid ${C.borderStrong}`,
                  background: 'rgba(255,255,255,0.04)',
                  opacity: Math.min(1, p),
                  transform: `scale(${0.6 + 0.4 * p})`,
                }}
              >
                {i + 1}
              </div>
            );
          })}
          <div style={{marginLeft: 10, fontSize: 28, fontWeight: 600, color: C.dim, opacity: tw(f, stepsAt + 24, stepsAt + 36)}}>{T.intro.steps}</div>
        </div>
        <Cursor x={cx} y={cy} press={press} o={cursorO} />
      </AbsoluteFill>
      <Sfx name="whoosh" at={4} />
      <Sfx name="tap" at={click} />
      <Sfx name="pop" at={n2} />
      <Sfx name="pop" at={n3} />
    </AbsoluteFill>
  );
};
