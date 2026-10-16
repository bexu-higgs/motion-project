import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {cues} from '../timeline';
import {easeInOut, pop, tw, vis} from '../lib/anim';
import {Pop, StepHeader, Tag} from '../components/Text';
import {Icon, type IconName} from '../components/Icon';
import {Sfx} from '../components/Sfx';

const THREE_HOURS = 3 * 3600;
const pad = (n: number) => String(n).padStart(2, '0');
const hms = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;

const RING_X = 1390;
const RING_Y = 520;
const R = 230;

export const S09Deadline: React.FC = () => {
  const f = useCurrentFrame();
  const c = cues('s9');
  const end = c.duration;

  const warnAt = c.at('s9_1') - 4;
  const warnOut = c.at('s9_2') + 4;
  const ringIn = c.at('s9_2') + 2;
  const cdStart = c.mid('s9_2', 0.55);
  const cdEnd = c.mid('s9_3', 0.6);
  const left = THREE_HOURS * (1 - tw(f, cdStart, cdEnd, 0, 1, (t) => t));
  const frac = left / THREE_HOURS;
  const expired = f >= cdEnd;
  const planAt = c.at('s9_4');
  const dimRing = tw(f, planAt, planAt + 14);
  const ringColor = expired ? C.red : frac < 0.15 ? C.red : C.amber;
  const circ = 2 * Math.PI * R;
  const ringP = pop(f, ringIn, 14, 120);
  const ticks: number[] = [];
  for (let t = cdStart; t < cdEnd; t += 10) ticks.push(t);

  const steps: Array<{icon: IconName; label: string}> = [
    {icon: 'user', label: 'Sign up'},
    {icon: 'check', label: 'Choose plan'},
    {icon: 'card', label: 'Pay'},
  ];

  return (
    <AbsoluteFill style={{fontFamily: FONT}}>
      <StepHeader kicker="Important" tone="amber" title="The discount lasts 3 hours" at={2} out={end - 10} />

      {/* warning */}
      {f < warnOut + 12 && (
        <div style={{position: 'absolute', left: RING_X - 140, top: RING_Y - 150, opacity: vis(f, warnAt, warnOut, 10), transform: `scale(${pop(f, warnAt, 10, 150) * (1 + 0.04 * Math.sin(f / 5))})`, color: C.amber, filter: `drop-shadow(0 0 40px rgba(255,181,71,0.6))`}}>
          <Icon name="warn" size={280} stroke={1.6} />
        </div>
      )}

      {/* statement */}
      <div style={{position: 'absolute', left: 120, top: 360, opacity: vis(f, c.at('s9_2'), planAt - 4, 12)}}>
        {['Discount available', 'for 3 hours'].map((t, i) => {
          const p = tw(f, c.at('s9_2') + i * 6, c.at('s9_2') + 20 + i * 6);
          return (
            <div key={t} style={{overflow: 'hidden'}}>
              <div style={{transform: `translateY(${(1 - p) * 105}%)`, fontSize: 78, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.035em', color: i ? C.amber : C.text}}>{t}</div>
            </div>
          );
        })}
        <div style={{marginTop: 22, fontSize: 32, fontWeight: 500, color: C.dim, opacity: tw(f, c.mid('s9_2', 0.3), c.mid('s9_2', 0.3) + 12)}}>
          from the moment you first create your account
        </div>
        <Pop at={cdEnd} x={0} y={210} from="scale" style={{position: 'relative'}}>
          <Tag text="After 3 hours the discount is gone" tone="red" icon="x" solid size={24} />
        </Pop>
      </div>

      {/* countdown (conceptual, sped up) */}
      {f >= ringIn && (
        <div style={{position: 'absolute', inset: 0, opacity: (1 - 0.6 * dimRing) * Math.min(1, ringP * 1.3)}}>
          <svg style={{position: 'absolute', left: RING_X - R - 30, top: RING_Y - R - 30, transform: `scale(${0.85 + 0.15 * ringP})`}} width={2 * R + 60} height={2 * R + 60}>
            <circle cx={R + 30} cy={R + 30} r={R} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth={18} />
            <circle
              cx={R + 30}
              cy={R + 30}
              r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth={18}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - frac)}
              transform={`rotate(-90 ${R + 30} ${R + 30})`}
              style={{filter: `drop-shadow(0 0 14px ${ringColor})`}}
            />
          </svg>
          <div style={{position: 'absolute', left: RING_X, top: RING_Y, transform: 'translate(-50%, -50%)', textAlign: 'center'}}>
            <Icon name="clock" size={44} color={ringColor} style={{margin: '0 auto 14px'}} />
            <div style={{fontSize: 92, fontWeight: 750, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: expired ? C.red : C.text}}>{hms(Math.ceil(left))}</div>
            <div style={{marginTop: 8, display: 'flex', justifyContent: 'center', gap: 34, fontSize: 20, fontWeight: 600, letterSpacing: '0.12em', color: C.faint, textTransform: 'uppercase'}}>
              <span>hours</span>
              <span>min</span>
              <span>sec</span>
            </div>
          </div>
          <div style={{position: 'absolute', left: RING_X, top: RING_Y + R + 60, transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap'}}>
            <Tag text="Discount available for 3 hours" tone="amber" icon="clock" size={22} />
            <div style={{marginTop: 12, fontSize: 20, color: C.faint, fontWeight: 500}}>sped-up illustration</div>
          </div>
        </div>
      )}

      {/* do it all inside the window */}
      {f >= planAt && (
        <div style={{position: 'absolute', left: 120, top: 380, opacity: vis(f, planAt, end - 12, 12)}}>
          <div style={{fontSize: 30, fontWeight: 600, color: C.dim, marginBottom: 26, opacity: tw(f, planAt, planAt + 12)}}>After signing up with my link:</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
            {steps.map((s, i) => {
              const at = planAt + 8 + i * 14;
              const p = pop(f, at);
              return (
                <React.Fragment key={s.label}>
                  {i > 0 && (
                    <div style={{width: 60, height: 4, borderRadius: 2, background: C.cyan, transformOrigin: 'left', transform: `scaleX(${tw(f, at - 8, at, 0, 1, easeInOut)})`}} />
                  )}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '18px 26px 18px 18px',
                      borderRadius: 22,
                      background: 'rgba(46,230,255,0.08)',
                      border: `1.5px solid ${C.cyan}`,
                      opacity: Math.min(1, p * 1.3),
                      transform: `scale(${0.85 + 0.15 * p})`,
                    }}
                  >
                    <div style={{width: 52, height: 52, borderRadius: 16, background: C.cyan, color: '#041014', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <Icon name={s.icon} size={30} stroke={2.6} />
                    </div>
                    <span style={{fontSize: 32, fontWeight: 750, color: C.text}}>{s.label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          {/* bracket */}
          <svg width={860} height={50} style={{display: 'block', marginTop: 18}}>
            <path
              d="M 6 6 Q 6 26 30 26 L 400 26 Q 430 26 430 46 Q 430 26 460 26 L 830 26 Q 854 26 854 6"
              fill="none"
              stroke={C.amber}
              strokeWidth={3.5}
              strokeDasharray={1100}
              strokeDashoffset={1100 * (1 - tw(f, planAt + 44, planAt + 66, 0, 1, easeInOut))}
            />
          </svg>
          <div style={{marginTop: 14, marginLeft: 430, transform: 'translateX(-50%)', display: 'inline-block'}}>
            <Pop at={planAt + 60} x={0} y={0} from="scale" style={{position: 'relative'}}>
              <Tag text="All within 3 hours" tone="amber" icon="clock" solid size={26} />
            </Pop>
          </div>
        </div>
      )}

      <Sfx name="error" at={warnAt + 2} volume={0.35} />
      <Sfx name="pop" at={ringIn} />
      {ticks.map((t) => (
        <Sfx key={t} name="tick" at={t} volume={0.2} />
      ))}
      <Sfx name="error" at={cdEnd} />
      {[0, 1, 2].map((i) => (
        <Sfx key={`s${i}`} name="pop" at={planAt + 8 + i * 14} />
      ))}
      <Sfx name="success" at={planAt + 60} volume={0.3} />
    </AbsoluteFill>
  );
};

