import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {cues} from '../timeline';
import {easeIn, easeInOut, pop, tw, vis} from '../lib/anim';
import {PhoneStage, camTrack, focus, overview} from '../components/Phone';
import {Shot} from '../components/Screen';
import {Highlight, Spotlight, Touch} from '../components/Marks';
import {Flow, LeftScrim, Pop, StepHeader, Tag} from '../components/Text';
import {Icon} from '../components/Icon';
import {Sfx} from '../components/Sfx';
import {boxCenter, regionBox, type Box} from '../lib/regions';

const SLIDER_1800: Box = [171, 822, 144, 60];

/** Generic, unbranded bank card — no real numbers, names or codes. */
const BankCard: React.FC<{tilt: number}> = ({tilt}) => (
  <div
    style={{
      width: 540,
      height: 340,
      borderRadius: 28,
      position: 'relative',
      overflow: 'hidden',
      transform: `perspective(1600px) rotateY(${tilt}deg) rotateX(6deg)`,
      background: 'linear-gradient(135deg, #0F3C47 0%, #0A2229 45%, #071419 100%)',
      border: '1.5px solid rgba(46,230,255,0.35)',
      boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 50px rgba(46,230,255,0.15)',
      fontFamily: FONT,
      color: 'rgba(255,255,255,0.9)',
    }}
  >
    <div style={{position: 'absolute', right: -120, top: -140, width: 360, height: 360, borderRadius: 180, background: 'radial-gradient(circle, rgba(46,230,255,0.28), transparent 70%)'}} />
    <div style={{position: 'absolute', left: 40, top: 46, width: 74, height: 56, borderRadius: 12, background: 'linear-gradient(135deg,#d9c58b,#a8915a)', opacity: 0.9}} />
    <div style={{position: 'absolute', right: 40, top: 48, color: C.cyan}}>
      <Icon name="card" size={44} stroke={2} />
    </div>
    <div style={{position: 'absolute', left: 40, top: 160, fontSize: 38, letterSpacing: '0.18em', fontWeight: 600}}>•••• •••• •••• ••••</div>
    <div style={{position: 'absolute', left: 40, bottom: 40, fontSize: 18, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.55)', fontWeight: 600}}>BANK CARD</div>
    <div style={{position: 'absolute', right: 40, bottom: 40, fontSize: 22, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)', fontWeight: 600}}>•• / ••</div>
  </div>
);

const Field: React.FC<{label: string; dots: number; p: number; w: number}> = ({label, dots, p, w}) => {
  const n = Math.round(dots * p);
  return (
    <div style={{width: w}}>
      <div style={{fontSize: 20, fontWeight: 600, color: C.dim, marginBottom: 10}}>{label}</div>
      <div
        style={{
          height: 70,
          borderRadius: 16,
          border: `1.5px solid ${p > 0 && p < 1 ? C.cyan : 'rgba(255,255,255,0.14)'}`,
          background: 'rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 22px',
          fontSize: 30,
          letterSpacing: '0.2em',
          color: C.text,
        }}
      >
        {'•'.repeat(n)}
        {p > 0 && p < 1 && <span style={{width: 2, height: 34, background: C.cyan, marginLeft: 4}} />}
      </div>
    </div>
  );
};

export const S08Payment: React.FC = () => {
  const f = useCurrentFrame();
  const c = cues('s8');
  const end = c.duration;

  // A: pick credits, tap Get Max (real screenshot)
  const tapOption = c.mid('s8_2', 0.25);
  const getMax = regionBox('getMaxBtn');
  const getMaxHl = c.mid('s8_2', 0.62);
  const tapGetMax = c.end('s8_2') + 6;
  const phoneOut = tw(f, tapGetMax + 10, tapGetMax + 24, 0, 1, easeIn);
  const enter = pop(f, 0, 18, 110);
  const cardCam = focus([540, 860], 1.4, [1300, 520]);
  const cam = camTrack(f, [
    [0, overview()],
    [c.at('s8_2'), overview()],
    [c.at('s8_2') + 22, cardCam],
  ]);

  // B: generic payment illustration
  const payIn = c.at('s8_3') - 4;
  const fieldsAt = c.mid('s8_4', 0.15);
  const f1 = tw(f, fieldsAt, fieldsAt + 30, 0, 1, (t) => t);
  const f2 = tw(f, fieldsAt + 34, fieldsAt + 48, 0, 1, (t) => t);
  const f3 = tw(f, fieldsAt + 52, fieldsAt + 62, 0, 1, (t) => t);
  const checks = [c.mid('s8_5', 0.28), c.mid('s8_5', 0.12), c.mid('s8_5', 0.62)];
  const tapPay = c.end('s8_5') + 14;
  const done = tw(f, tapPay + 2, tapPay + 22);
  const tilt = -14 + 6 * Math.sin(f / 40);

  return (
    <AbsoluteFill>
      {f < tapGetMax + 26 && (
        <>
          <PhoneStage
            cam={cam}
            dy={(1 - enter) * 700}
            opacity={Math.min(1, enter * 1.4) * (1 - phoneOut)}
            screen={
              <>
                <Shot src="max1800" />
                <Spotlight box={getMax} at={getMaxHl} out={tapGetMax + 8} radius={40} strength={0.5} pad={6} />
              </>
            }
            overlay={
              <>
                <Highlight box={SLIDER_1800} at={tapOption - 2} out={getMaxHl} radius={22} pad={6} />
                <Touch keys={[{f: tapOption - 22, x: 700, y: 1500}, {f: tapOption - 4, x: 243, y: 852}]} taps={[tapOption]} inAt={tapOption - 24} outAt={tapOption + 12} />
                <Highlight box={getMax} at={getMaxHl} out={tapGetMax + 8} radius={40} pad={6} />
                <Touch keys={[{f: tapGetMax - 24, x: 900, y: 1700}, {f: tapGetMax - 4, x: boxCenter(getMax)[0], y: boxCenter(getMax)[1]}]} taps={[tapGetMax]} inAt={tapGetMax - 26} outAt={tapGetMax + 14} />
              </>
            }
          />
          <LeftScrim amount={tw(cam.s, 1.05, 1.6) * (1 - phoneOut)} />
        </>
      )}
      <StepHeader step={6} title="Get Max & pay" at={2} out={end - 10} />
      <Flow items={['Choose credits', 'Get Max']} activeAt={[tapOption, getMaxHl]} doneAt={tapGetMax} x={120} y={410} at={c.at('s8_2')} out={payIn} size={22} />

      {/* payment page — generic illustration */}
      {f >= payIn && (
        <div style={{position: 'absolute', inset: 0, opacity: vis(f, payIn, end - 12, 12), fontFamily: FONT}}>
          <Pop at={payIn} x={1800} y={120} anchor="tr" from="scale">
            <Tag text="Payment page" tone="neutral" icon="lock" size={22} />
          </Pop>
          <Pop at={payIn + 4} x={140} y={330} from="left">
            <BankCard tilt={tilt} />
          </Pop>
          <Pop at={payIn + 10} x={820} y={300} from="right">
            <div
              style={{
                width: 900,
                padding: '40px 46px',
                borderRadius: 32,
                background: 'linear-gradient(160deg, rgba(20,28,38,0.96), rgba(10,14,20,0.96))',
                border: `1.5px solid ${C.border}`,
                boxShadow: '0 40px 80px rgba(0,0,0,0.55)',
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 750, color: C.text}}>
                <Icon name="card" size={34} color={C.cyan} /> Card details
              </div>
              <div style={{marginTop: 26}}>
                <Field label="Card number" dots={16} p={f1} w={808} />
              </div>
              <div style={{marginTop: 20, display: 'flex', gap: 24}}>
                <Field label="Expiry date" dots={4} p={f2} w={392} />
                <Field label="Security code" dots={3} p={f3} w={392} />
              </div>
              <div
                style={{
                  marginTop: 30,
                  height: 82,
                  borderRadius: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                  fontSize: 30,
                  fontWeight: 750,
                  color: '#041014',
                  background: f >= tapPay ? C.cyan : `rgba(46,230,255,${0.35 + 0.65 * tw(f, checks[2] + 10, checks[2] + 20)})`,
                  boxShadow: f >= checks[2] + 10 ? `0 0 40px ${C.cyanGlow}` : 'none',
                  transform: `scale(${f >= tapPay - 2 && f < tapPay + 6 ? 0.97 : 1})`,
                }}
              >
                {f >= tapPay + 4 ? (
                  <>
                    <Icon name="check" size={36} stroke={3} /> Payment confirmed
                  </>
                ) : (
                  <>
                    <Icon name="lock" size={30} stroke={2.6} /> Confirm payment
                  </>
                )}
              </div>
            </div>
          </Pop>
          {/* before confirming: quick checklist */}
          <Pop at={c.at('s8_5')} x={140} y={720} from="left">
            <div
              style={{
                width: 560,
                padding: '26px 30px',
                borderRadius: 26,
                background: 'rgba(255,181,71,0.07)',
                border: '1.5px solid rgba(255,181,71,0.45)',
              }}
            >
              <div style={{fontSize: 20, fontWeight: 750, letterSpacing: '0.14em', color: C.amber, textTransform: 'uppercase', marginBottom: 14}}>Check before you pay</div>
              {['Monthly billing', 'Max plan', 'Discounted price'].map((t, i) => {
                const on = tw(f, checks[i], checks[i] + 8);
                return (
                  <div key={t} style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: i ? 12 : 0}}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: on > 0.5 ? C.cyan : 'transparent',
                        border: `2px solid ${on > 0.5 ? C.cyan : 'rgba(255,255,255,0.3)'}`,
                        color: '#041014',
                        transform: `scale(${1 + 0.2 * Math.sin(Math.PI * on)})`,
                      }}
                    >
                      {on > 0.5 && <Icon name="check" size={26} stroke={3.2} />}
                    </div>
                    <span style={{fontSize: 32, fontWeight: 700, letterSpacing: '0.04em', color: on > 0.5 ? C.text : C.dim, textTransform: 'uppercase'}}>{t}</span>
                  </div>
                );
              })}
            </div>
          </Pop>
          {/* confirm tap */}
          {f >= tapPay - 24 && f < tapPay + 16 && (
            <div
              style={{
                position: 'absolute',
                left: tw(f, tapPay - 24, tapPay - 4, 1500, 1270, easeInOut) - 30,
                top: tw(f, tapPay - 24, tapPay - 4, 1000, 701, easeInOut) - 30,
                width: 60,
                height: 60,
                borderRadius: 30,
                background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.95), rgba(255,255,255,0.7))',
                border: '2.5px solid #fff',
                boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
                opacity: vis(f, tapPay - 24, tapPay + 6, 6),
                transform: `scale(${f >= tapPay - 2 && f < tapPay + 4 ? 0.82 : 1})`,
              }}
            />
          )}
          {f >= tapPay + 2 && (
            <div
              style={{
                position: 'absolute',
                left: 866 - 40 * done,
                top: 660 - 40 * done,
                width: 808 + 80 * done,
                height: 82 + 80 * done,
                borderRadius: 18 + 40 * done,
                border: `3px solid ${C.cyan}`,
                opacity: Math.max(0, 1 - done),
              }}
            />
          )}
        </div>
      )}

      <Sfx name="whoosh" at={0} />
      <Sfx name="tap" at={tapOption} />
      <Sfx name="pop" at={getMaxHl} />
      <Sfx name="tap" at={tapGetMax} />
      <Sfx name="whoosh" at={payIn} />
      {[0, 1, 2].map((i) => (
        <Sfx key={i} name="tick" at={checks[i]} volume={0.5} />
      ))}
      <Sfx name="tap" at={tapPay} />
      <Sfx name="success" at={tapPay + 6} />
    </AbsoluteFill>
  );
};

