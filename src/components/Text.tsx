import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {easeIn, pop, tw, vis} from '../lib/anim';
import {Icon, type IconName} from './Icon';
import {STEP} from '../copy';

export type Tone = 'cyan' | 'red' | 'amber' | 'neutral' | 'lime';

const TONES: Record<Tone, {fg: string; bg: string; bd: string}> = {
  cyan: {fg: C.cyan, bg: 'rgba(46,230,255,0.12)', bd: 'rgba(46,230,255,0.45)'},
  red: {fg: C.red, bg: 'rgba(255,77,94,0.13)', bd: 'rgba(255,77,94,0.5)'},
  amber: {fg: C.amber, bg: 'rgba(255,181,71,0.13)', bd: 'rgba(255,181,71,0.5)'},
  neutral: {fg: 'rgba(255,255,255,0.86)', bg: 'rgba(255,255,255,0.06)', bd: 'rgba(255,255,255,0.14)'},
  lime: {fg: C.lime, bg: 'rgba(209,254,23,0.10)', bd: 'rgba(209,254,23,0.4)'},
};

export const toneColor = (t: Tone) => TONES[t].fg;

/** Rounded label chip. */
export const Tag: React.FC<{text: string; tone?: Tone; icon?: IconName; size?: number; solid?: boolean; style?: React.CSSProperties}> = ({
  text,
  tone = 'cyan',
  icon,
  size = 22,
  solid,
  style,
}) => {
  const t = TONES[tone];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.45,
        padding: `${size * 0.42}px ${size * 0.8}px`,
        borderRadius: 999,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: solid ? '#041014' : t.fg,
        background: solid ? t.fg : t.bg,
        border: `1.5px solid ${solid ? t.fg : t.bd}`,
        whiteSpace: 'nowrap',
        boxShadow: solid ? `0 0 30px ${t.bd}` : 'none',
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size * 1.1} stroke={2.6} />}
      {text}
    </div>
  );
};

/** Absolutely positioned element with a springy entrance and a fade-out. */
export const Pop: React.FC<{
  at: number;
  out?: number;
  x: number;
  y: number;
  from?: 'up' | 'down' | 'left' | 'right' | 'scale';
  anchor?: 'tl' | 'center' | 'tc' | 'tr' | 'cl';
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({at, out = Infinity, x, y, from = 'up', anchor = 'tl', children, style}) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = pop(f, at);
  const o = Math.min(tw(f, at, at + 8), 1 - tw(f, out, out + 10, 0, 1, easeIn));
  if (o <= 0) return null;
  const d = (1 - p) * 40;
  const tr =
    from === 'up' ? `translateY(${d}px)` : from === 'down' ? `translateY(${-d}px)` : from === 'left' ? `translateX(${-d}px)` : from === 'right' ? `translateX(${d}px)` : `scale(${0.85 + 0.15 * p})`;
  const anc =
    anchor === 'center' ? 'translate(-50%, -50%)' : anchor === 'tc' ? 'translateX(-50%)' : anchor === 'tr' ? 'translateX(-100%)' : anchor === 'cl' ? 'translateY(-50%)' : '';
  return <div style={{position: 'absolute', left: x, top: y, opacity: o, transform: `${anc} ${tr}`, ...style}}>{children}</div>;
};

/** Step badge + headline in the top-left corner. */
export const StepHeader: React.FC<{step?: number; kicker?: string; title: string; at: number; out?: number; tone?: Tone; total?: number}> = ({
  step,
  kicker,
  title,
  at,
  out = Infinity,
  tone = 'cyan',
  total = 6,
}) => {
  const f = useCurrentFrame();
  const o = vis(f, at, out, 12);
  if (o <= 0) return null;
  const t = TONES[tone];
  const words = title.split(' ');
  return (
    <div style={{position: 'absolute', left: 120, top: 104, opacity: o, fontFamily: FONT}}>
      <div style={{transform: `translateX(${(1 - tw(f, at, at + 16)) * -30}px)`, display: 'flex', alignItems: 'center', gap: 18}}>
        <Tag text={kicker ?? STEP(step ?? 1, total)} tone={tone} size={21} />
        {step !== undefined && (
          <div style={{display: 'flex', gap: 7}}>
            {Array.from({length: total}).map((_, i) => {
              const fill = i < step - 1 ? 1 : i === step - 1 ? tw(f, at + 6, at + 26) : 0;
              return (
                <div key={i} style={{width: 34, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.12)', overflow: 'hidden'}}>
                  <div style={{width: `${fill * 100}%`, height: '100%', background: t.fg, boxShadow: `0 0 10px ${t.bd}`}} />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{marginTop: 26, maxWidth: 900, fontSize: 62, fontWeight: 760, lineHeight: 1.06, letterSpacing: '-0.028em', color: C.text}}>
        {words.map((w, i) => {
          const p = tw(f, at + 4 + i * 3, at + 22 + i * 3);
          return (
            <span key={i} style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: 6, marginRight: '0.24em'}}>
              <span style={{display: 'inline-block', transform: `translateY(${(1 - p) * 105}%)`, opacity: p}}>{w}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** "A → B → C" chain where each step lights up at its frame. */
export const Flow: React.FC<{items: string[]; activeAt: number[]; x: number; y: number; at: number; out?: number; size?: number; doneAt?: number}> = ({
  items,
  activeAt,
  x,
  y,
  at,
  out = Infinity,
  size = 19,
  doneAt = Infinity,
}) => {
  const f = useCurrentFrame();
  const o = vis(f, at, out, 12);
  if (o <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap: 14, opacity: o, fontFamily: FONT}}>
      {items.map((it, i) => {
        const on = tw(f, activeAt[i], activeAt[i] + 10);
        const done = f >= doneAt || (i < items.length - 1 && f >= activeAt[i + 1]);
        const appear = tw(f, at + i * 5, at + i * 5 + 14);
        return (
          <React.Fragment key={it}>
            {i > 0 && (
              <div style={{opacity: appear, color: on > 0.5 ? C.cyan : C.faint}}>
                <Icon name="arrow" size={size * 1.2} stroke={2.4} />
              </div>
            )}
            <div
              style={{
                opacity: appear,
                transform: `translateY(${(1 - appear) * 10}px) scale(${1 + 0.06 * on * (1 - (done ? 1 : 0))})`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: `${size * 0.55}px ${size * 0.9}px`,
                borderRadius: 14,
                fontSize: size,
                fontWeight: 700,
                letterSpacing: '0.1em',
                whiteSpace: 'nowrap',
                color: on > 0.5 ? (done ? C.cyan : '#041014') : C.dim,
                background: on > 0.5 ? (done ? 'rgba(46,230,255,0.10)' : C.cyan) : 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${on > 0.5 ? C.cyan : 'rgba(255,255,255,0.12)'}`,
                boxShadow: on > 0.5 && !done ? `0 0 28px ${C.cyanGlow}` : 'none',
              }}
            >
              {done && <Icon name="check" size={size} stroke={3} />}
              {it}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Dark card used for floating cut-outs and info panels. */
export const Card: React.FC<{children: React.ReactNode; pad?: number; radius?: number; glow?: string; style?: React.CSSProperties}> = ({
  children,
  pad = 0,
  radius = 22,
  glow,
  style,
}) => (
  <div
    style={{
      padding: pad,
      borderRadius: radius,
      background: C.panel,
      border: `1.5px solid ${glow ?? C.border}`,
      boxShadow: `0 30px 70px rgba(0,0,0,0.55)${glow ? `, 0 0 40px ${glow}` : ''}`,
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
  </div>
);

/** Darkens the left side of the frame so text stays readable when the phone is zoomed. */
export const LeftScrim: React.FC<{amount: number}> = ({amount}) =>
  amount <= 0 ? null : (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: amount,
        background:
          'linear-gradient(180deg, rgba(5,7,10,0.92) 0px, rgba(5,7,10,0.75) 230px, rgba(5,7,10,0) 330px), linear-gradient(90deg, rgba(5,7,10,0.97) 0%, rgba(5,7,10,0.9) 30%, rgba(5,7,10,0.55) 44%, rgba(5,7,10,0) 58%)',
      }}
    />
  );

export const Caption: React.FC<{children: React.ReactNode; size?: number; color?: string; weight?: number; style?: React.CSSProperties}> = ({
  children,
  size = 30,
  color = C.dim,
  weight = 500,
  style,
}) => <div style={{fontFamily: FONT, fontSize: size, color, fontWeight: weight, lineHeight: 1.3, letterSpacing: '-0.01em', ...style}}>{children}</div>;


/** One instruction row in the left column: icon bubble + short English label. */
export const Instr: React.FC<{icon: IconName; text: string; tone?: Tone; at: number; out?: number; x?: number; y: number; solid?: boolean; dim?: number}> = ({
  icon,
  text,
  tone = 'cyan',
  at,
  out = Infinity,
  x = 120,
  y,
  solid,
  dim = 0,
}) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = pop(f, at);
  const o = Math.min(tw(f, at, at + 8), 1 - tw(f, out, out + 10, 0, 1, easeIn)) * (1 - 0.55 * dim);
  if (o <= 0) return null;
  const t = TONES[tone];
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap: 22, opacity: o, transform: `translateX(${(1 - p) * -36}px)`, fontFamily: FONT}}>
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: 20,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: solid ? '#041014' : t.fg,
          background: solid ? t.fg : t.bg,
          border: `1.5px solid ${t.bd}`,
          boxShadow: solid ? `0 0 26px ${t.bd}` : 'none',
          transform: `scale(${0.7 + 0.3 * p})`,
        }}
      >
        <Icon name={icon} size={32} stroke={2.4} />
      </div>
      <div style={{fontSize: 36, fontWeight: 650, color: C.text, letterSpacing: '-0.015em', whiteSpace: 'nowrap'}}>{text}</div>
    </div>
  );
};
