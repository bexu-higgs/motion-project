import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {cues} from '../timeline';
import {easeIn, easeInOut, pop, tw, vis} from '../lib/anim';
import {PhoneStage, focus, camTrack, overview} from '../components/Phone';
import {Cutout, Shot} from '../components/Screen';
import {Highlight} from '../components/Marks';
import {Card, Pop, StepHeader, Tag} from '../components/Text';
import {Icon} from '../components/Icon';
import {PriceCard} from '../components/PriceCard';
import {Sfx} from '../components/Sfx';
import {regionBox, type Box, type SourceKey} from '../lib/regions';

const OPTIONS: Array<{credits: string; regular: string; discounted: string; per100: string; per100n: number; src: SourceKey; label: [number, number]}> = [
  {credits: '1,800', regular: '$79', discounted: '$59', per100: '$3.28', per100n: 59 / 18, src: 'max1800', label: [243, 852]},
  {credits: '3,600', regular: '$158', discounted: '$115', per100: '$3.19', per100n: 115 / 36, src: 'max3600', label: [538, 852]},
  {credits: '5,400', regular: '$237', discounted: '$159', per100: '$2.94', per100n: 159 / 54, src: 'max5400', label: [836, 852]},
];

// slider labels inside the maxSlider1800 cut-out (cut-out pixels at width 640)
const SLIDER_W = 640;
const SLIDER_LABELS = [99, 318, 538];

export const S07MaxDiscount: React.FC = () => {
  const f = useCurrentFrame();
  const c = cues('s7');
  const end = c.duration;

  // phase A: Max vs Pro
  const plansIn = c.at('s7_2');
  const maxOn = c.mid('s7_3', 0.3);
  const proOff = c.mid('s7_4', 0.1);
  const plansOut = c.at('s7_5') - 2;
  // phase B: three options on the real slider
  const optsIn = c.at('s7_5');
  const optsOut = c.at('s7_6') - 4;
  // phase C: price cards + matching real screenshots
  const cardAt = [c.at('s7_6'), c.at('s7_8'), c.at('s7_10')];
  const priceLine = ['s7_7', 's7_9', 's7_11'];
  const regAt = priceLine.map((l) => c.mid(l, 0.22));
  const discAt = priceLine.map((l) => c.mid(l, 0.56));
  const cardsOut = c.at('s7_12') - 6;
  // phase D: compare
  const sumIn = c.at('s7_12');
  const pickAt = c.at('s7_13');

  const phoneIn = pop(f, cardAt[0] - 4, 16, 110);
  const phoneOut = tw(f, cardsOut - 8, cardsOut + 8, 0, 1, easeIn);
  const cardCam = focus([540, 760], 1.32, [1330, 540]);
  const cam = camTrack(f, [
    [0, overview()],
    [cardAt[0], cardCam],
  ]);

  const priceRow = regionBox('maxPrice1800');
  const priceRowWide: Box = [priceRow[0], priceRow[1], 860, priceRow[3]];

  return (
    <AbsoluteFill>
      <StepHeader step={5} title="Pick a Max plan" at={2} out={end - 10} />

      {/* A: the discount is for Max only */}
      {f < plansOut + 14 && (
        <div style={{position: 'absolute', inset: 0, opacity: 1 - tw(f, plansOut, plansOut + 12, 0, 1, easeIn)}}>
          <Pop at={plansIn} x={200} y={470} from="left">
            <div style={{opacity: 1 - 0.6 * tw(f, proOff, proOff + 12), filter: `grayscale(${tw(f, proOff, proOff + 12)})`}}>
              <Card radius={26}>
                <Cutout name="proCardTop" width={640} />
              </Card>
            </div>
          </Pop>
          <Pop at={plansIn + 6} x={1000} y={470} from="right">
            <Card radius={26} glow={f >= maxOn ? C.cyan : undefined} style={{transform: `scale(${1 + 0.04 * tw(f, maxOn, maxOn + 12)})`}}>
              <Cutout name="maxHeader" width={680} />
            </Card>
          </Pop>
          <Pop at={maxOn} x={1000} y={392} from="scale">
            <Tag text="My discount applies" tone="cyan" icon="check" solid size={24} />
          </Pop>
          <Pop at={proOff} x={200} y={392} from="scale">
            <Tag text="No discount on Pro" tone="red" icon="x" solid size={24} />
          </Pop>
          {f >= proOff && (
            <div
              style={{
                position: 'absolute',
                left: 862,
                top: 518,
                width: 84,
                height: 84,
                borderRadius: 42,
                background: C.red,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${pop(f, proOff + 4)})`,
                boxShadow: `0 0 34px rgba(255,77,94,0.6)`,
              }}
            >
              <Icon name="x" size={48} stroke={3.4} />
            </div>
          )}
        </div>
      )}

      {/* B: three options (real slider) */}
      {f >= optsIn - 2 && f < optsOut + 14 && (
        <div style={{position: 'absolute', inset: 0, opacity: vis(f, optsIn, optsOut, 10)}}>
          <Pop at={optsIn} x={960} y={330} anchor="tc">
            <Card radius={24}>
              <Cutout name="maxHeader" width={SLIDER_W} />
            </Card>
          </Pop>
          <Pop at={optsIn + 6} x={960} y={480} anchor="tc">
            <div style={{position: 'relative'}}>
              <Card radius={24}>
                <Cutout name="maxSlider1800" width={SLIDER_W} />
              </Card>
              {SLIDER_LABELS.map((x, i) => {
                const at = optsIn + 18 + i * 9;
                const p = tw(f, at, at + 10, 0, 1, easeInOut);
                return (
                  <div
                    key={x}
                    style={{
                      position: 'absolute',
                      left: x - 74,
                      top: 236 - 26,
                      width: 148,
                      height: 52,
                      borderRadius: 26,
                      border: `2.5px solid ${C.cyan}`,
                      boxShadow: `0 0 18px ${C.cyanGlow}`,
                      opacity: p,
                      transform: `scale(${1.25 - 0.25 * p})`,
                    }}
                  />
                );
              })}
            </div>
          </Pop>
          <Pop at={optsIn + 40} x={960} y={800} anchor="tc" from="scale">
            <Tag text="3 options" tone="cyan" icon="check" solid size={26} />
          </Pop>
        </div>
      )}

      {/* C: price cards beside the real screenshots */}
      {f >= cardAt[0] - 4 && f < cardsOut + 16 && (
        <>
          <PhoneStage
            cam={cam}
            dx={(1 - phoneIn) * 500 + phoneOut * 300}
            opacity={Math.min(1, phoneIn * 1.4) * (1 - phoneOut)}
            screen={
              <>
                {OPTIONS.map((o, i) => (
                  <Shot key={o.src} src={o.src} opacity={i === 0 ? 1 : tw(f, cardAt[i] - 4, cardAt[i] + 8)} />
                ))}
              </>
            }
            overlay={
              <>
                {OPTIONS.map((o, i) => (
                  <React.Fragment key={o.src}>
                    <Highlight box={[o.label[0] - 72, o.label[1] - 30, 144, 60]} at={cardAt[i] + 6} out={(i < 2 ? cardAt[i + 1] : cardsOut) - 6} radius={22} pad={6} />
                    <Highlight box={priceRowWide} at={discAt[i] - 4} out={(i < 2 ? cardAt[i + 1] : cardsOut) - 6} radius={18} pad={8} />
                  </React.Fragment>
                ))}
              </>
            }
          />
          {OPTIONS.map((o, i) => {
            const inAt = cardAt[i];
            const outAt = i < 2 ? cardAt[i + 1] - 6 : cardsOut;
            if (f < inAt - 2 || f > outAt + 14) return null;
            const pin = pop(f, inAt, 15, 120);
            const pout = tw(f, outAt, outAt + 12, 0, 1, easeIn);
            return (
              <div
                key={o.credits}
                style={{
                  position: 'absolute',
                  left: 160,
                  top: 300,
                  opacity: Math.min(1, pin * 1.3) * (1 - pout),
                  transform: `translateX(${(1 - pin) * -80 - pout * 60}px)`,
                }}
              >
                <PriceCard option={i + 1} credits={o.credits} regular={o.regular} discounted={o.discounted} regAt={regAt[i]} discAt={discAt[i]} />
              </div>
            );
          })}
        </>
      )}

      {/* D: more credits → better price per credit */}
      {f >= sumIn - 2 && (
        <div style={{position: 'absolute', inset: 0, opacity: vis(f, sumIn, end - 14, 10)}}>
          <div style={{position: 'absolute', left: 120, top: 300, display: 'flex', gap: 40}}>
            {OPTIONS.map((o, i) => {
              const at = sumIn + 4 + i * 6;
              const p = pop(f, at);
              const pick = tw(f, pickAt + 6 + i * 8, pickAt + 14 + i * 8) * (1 - tw(f, pickAt + 14 + i * 8, pickAt + 30 + i * 8));
              const best = i === 2 ? tw(f, sumIn + 40, sumIn + 52) : 0;
              const barH = 40 + ((o.per100n - 2.6) / (3.4 - 2.6)) * 120;
              return (
                <div
                  key={o.credits}
                  style={{
                    width: 520,
                    padding: '34px 38px',
                    borderRadius: 30,
                    background: 'linear-gradient(160deg, rgba(20,28,38,0.95), rgba(10,14,20,0.95))',
                    border: `1.5px solid ${best > 0.5 || pick > 0.5 ? C.cyan : C.border}`,
                    boxShadow: `0 30px 70px rgba(0,0,0,0.55), 0 0 ${40 * Math.max(best, pick)}px ${C.cyanGlow}`,
                    opacity: Math.min(1, p * 1.3),
                    transform: `translateY(${(1 - p) * 40}px) scale(${1 + 0.03 * pick})`,
                    fontFamily: FONT,
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
                    <span style={{fontSize: 46, fontWeight: 800, color: C.text, letterSpacing: '-0.02em'}}>{o.credits}</span>
                    <span style={{fontSize: 26, fontWeight: 600, color: C.dim}}>credits</span>
                  </div>
                  <div style={{marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 16}}>
                    <span style={{fontSize: 36, fontWeight: 600, color: C.faint, textDecoration: 'line-through', textDecorationColor: C.red, textDecorationThickness: 4}}>{o.regular}</span>
                    <span style={{fontSize: 82, fontWeight: 850, color: C.text, letterSpacing: '-0.04em'}}>{o.discounted}</span>
                  </div>
                  <div style={{height: 1.5, background: C.border, margin: '22px 0 22px'}} />
                  <div style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 170}}>
                    <div>
                      <div style={{fontSize: 18, fontWeight: 700, letterSpacing: '0.14em', color: C.faint, textTransform: 'uppercase'}}>Per 100 credits</div>
                      <div style={{marginTop: 6, fontSize: 48, fontWeight: 760, color: i === 2 ? C.cyan : C.text}}>≈ {o.per100}</div>
                    </div>
                    <div style={{width: 64, height: 160, display: 'flex', alignItems: 'flex-end'}}>
                      <div style={{width: '100%', height: barH * tw(f, at + 8, at + 26, 0, 1, easeInOut), borderRadius: 12, background: i === 2 ? C.cyan : 'rgba(255,255,255,0.28)', boxShadow: i === 2 ? `0 0 24px ${C.cyanGlow}` : 'none'}} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Pop at={sumIn + 30} x={120} y={830}>
            <div style={{display: 'flex', alignItems: 'center', gap: 18, fontFamily: FONT, fontSize: 34, fontWeight: 700, color: C.text}}>
              More credits <Icon name="arrow" size={36} color={C.cyan} stroke={2.6} /> <span style={{color: C.cyan}}>lower price per credit</span>
            </div>
          </Pop>
          <Pop at={pickAt + 4} x={1800} y={838} anchor="tr" from="scale">
            <Tag text="Pick the one you need" tone="cyan" icon="hand" solid size={24} />
          </Pop>
        </div>
      )}

      <Sfx name="whoosh" at={plansIn} />
      <Sfx name="success" at={maxOn} volume={0.3} />
      <Sfx name="error" at={proOff + 4} />
      <Sfx name="whoosh" at={optsIn} />
      {[0, 1, 2].map((i) => (
        <Sfx key={`o${i}`} name="tick" at={optsIn + 18 + i * 9} />
      ))}
      {[0, 1, 2].map((i) => (
        <React.Fragment key={`p${i}`}>
          <Sfx name="whoosh" at={cardAt[i]} volume={0.25} />
          <Sfx name="pop" at={regAt[i]} />
          <Sfx name="success" at={discAt[i]} volume={0.3} />
        </React.Fragment>
      ))}
      <Sfx name="whoosh" at={sumIn} />
      <Sfx name="pop" at={pickAt + 4} />
    </AbsoluteFill>
  );
};
