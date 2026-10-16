import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {cues} from '../timeline';
import {easeInOut, pop, track, tw, vis} from '../lib/anim';
import {Crop} from '../components/Screen';
import {Card, Pop, StepHeader, Tag} from '../components/Text';
import {Icon} from '../components/Icon';
import {MonthGrid} from '../components/Months';
import {Sfx} from '../components/Sfx';
import {REGIONS, type Box} from '../lib/regions';
import {T} from '../copy';

// The real pricing page (landscape screenshot, browser chrome trimmed)
const PAGE: Box = [96, 251, 2304, 784];
const PANEL_W = 1360;
const PK = PANEL_W / PAGE[2];
const PANEL_X = 280;
const PANEL_Y = 380;

const toPanel = (sx: number, sy: number): [number, number] => [PANEL_X + (sx - PAGE[0]) * PK, PANEL_Y + (sy - PAGE[1]) * PK];

export const S05Annual: React.FC = () => {
  const f = useCurrentFrame();
  const c = cues('s5');
  const end = c.duration;

  // --- page panel with zoom on the billing toggle
  const pageIn = c.at('s5_2') - 4;
  const zoomAt = c.at('s5_3');
  const pageOut = c.at('s5_4') - 4;
  const tg = REGIONS.billingToggle.box;
  const toggleCenter = toPanel(tg[0] + tg[2] / 2, tg[1] + tg[3] / 2);
  const s = track(f, [
    [zoomAt, 1],
    [zoomAt + 24, 2.3],
    [pageOut, 2.3],
    [pageOut + 14, 2.6],
  ]);
  const zp = tw(f, zoomAt, zoomAt + 24, 0, 1, easeInOut);
  const anchor: [number, number] = [toggleCenter[0] + (960 - toggleCenter[0]) * zp, toggleCenter[1] + (520 - toggleCenter[1]) * zp];
  const pageO = vis(f, pageIn, pageOut, 12);
  const rise = pop(f, pageIn, 16, 120);
  const hlAt = c.mid('s5_3', 0.25);
  const hlBox = toPanel(tg[0], tg[1]);

  // --- concept: "/mo" price = 12-month total ÷ 12
  const cardAt = c.at('s5_4') + 6;
  const careful = c.at('s5_5');
  const calAt = c.at('s5_6');
  const litAt = c.mid('s5_6', 0.35);
  const upfrontAt = c.at('s5_7');
  const notThis = c.at('s5_8');
  const monthlyAt = c.at('s5_9');
  const group = vis(f, cardAt - 6, end - 14, 12);
  const dimGroup = tw(f, notThis + 4, notThis + 16);
  const shake = f > careful && f < careful + 24 ? Math.sin((f - careful) * 1.9) * 10 * (1 - (f - careful) / 24) : 0;
  const strike = tw(f, careful + 4, careful + 16, 0, 1, easeInOut);

  return (
    <AbsoluteFill>
      <StepHeader step={4} title={T.annual.title} at={2} out={end - 10} />

      {/* real pricing page */}
      {pageO > 0 && (
        <div style={{position: 'absolute', inset: 0, opacity: pageO}}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transformOrigin: '0 0',
              transform: `translate(${anchor[0]}px, ${anchor[1] + (1 - rise) * 120}px) scale(${s}) translate(${-toggleCenter[0]}px, ${-toggleCenter[1]}px)`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: PANEL_X,
                top: PANEL_Y,
                width: PANEL_W,
                height: PAGE[3] * PK,
                borderRadius: 26,
                overflow: 'hidden',
                boxShadow: '0 40px 90px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(255,255,255,0.08)',
              }}
            >
              <Crop src="landscape" box={PAGE} x={0} y={0} scale={PK} />
            </div>
            {f >= hlAt && (
              <svg style={{position: 'absolute', left: hlBox[0] - 8, top: hlBox[1] - 8, overflow: 'visible'}} width={tg[2] * PK + 16} height={tg[3] * PK + 16}>
                <rect
                  x={0}
                  y={0}
                  width={tg[2] * PK + 16}
                  height={tg[3] * PK + 16}
                  rx={22}
                  fill="none"
                  stroke={C.cyan}
                  strokeWidth={2.4}
                  strokeDasharray={1200}
                  strokeDashoffset={1200 * (1 - tw(f, hlAt, hlAt + 16, 0, 1, easeInOut))}
                  style={{filter: `drop-shadow(0 0 6px ${C.cyan})`}}
                />
              </svg>
            )}
          </div>
          <Pop at={hlAt + 8} out={pageOut - 8} x={960} y={640} anchor="tc">
            <div style={{display: 'flex', alignItems: 'center', gap: 18, padding: '10px 26px 10px 10px', borderRadius: 999, background: 'rgba(5,7,10,0.88)', boxShadow: '0 12px 30px rgba(0,0,0,0.5)'}}>
              <Tag text={T.annual.annual} tone="cyan" icon="calendar" solid size={24} />
              <span style={{fontFamily: FONT, fontSize: 30, color: C.text, fontWeight: 600}}>{T.annual.selectedFirst}</span>
            </div>
          </Pop>
        </div>
      )}

      {/* concept graphic */}
      {group > 0 && (
        <div style={{position: 'absolute', inset: 0, opacity: group}}>
          <div style={{position: 'absolute', inset: 0, opacity: 1 - 0.62 * dimGroup, filter: `grayscale(${dimGroup * 0.8})`}}>
            {/* shown price card */}
            <Pop at={cardAt} x={120} y={390}>
              <Card pad={36} radius={28} glow={f > careful ? 'rgba(255,181,71,0.45)' : undefined} style={{width: 500, transform: `translateX(${shake}px)`}}>
                <div style={{fontFamily: FONT, fontSize: 21, letterSpacing: '0.14em', fontWeight: 700, color: C.faint, textTransform: 'uppercase'}}>{T.annual.priceYouSee}</div>
                <div style={{display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 18, fontFamily: FONT}}>
                  <span style={{fontSize: 92, fontWeight: 800, color: C.text, letterSpacing: '-0.04em'}}>$</span>
                  <span style={{display: 'inline-block', width: 150, height: 64, borderRadius: 14, background: 'linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))'}} />
                  <span style={{fontSize: 52, fontWeight: 600, color: C.dim}}>{T.annual.perMonth}</span>
                </div>
                <div style={{position: 'relative', marginTop: 22, display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: FONT, fontSize: 32, fontWeight: 650, color: C.text}}>
                  <Icon name="search" size={32} color={C.dim} /> {T.annual.looksLike}
                  <div style={{position: 'absolute', left: 44, right: -6, top: '52%', height: 4, borderRadius: 2, background: C.amber, transformOrigin: 'left', transform: `scaleX(${strike})`}} />
                </div>
              </Card>
            </Pop>
            <Pop at={careful} x={120} y={330} from="scale">
              <Tag text={T.annual.careful} tone="amber" icon="warn" solid size={24} />
            </Pop>

            {/* 12 months */}
            <Pop at={calAt} x={720} y={330}>
              <div style={{display: 'flex', alignItems: 'center', gap: 16, fontFamily: FONT}}>
                <Tag text={T.annual.annual} tone="cyan" icon="calendar" size={22} />
                <span style={{fontSize: 30, fontWeight: 650, color: C.text}}>{T.annual.equation}</span>
              </div>
            </Pop>
            <div style={{position: 'absolute', left: 720, top: 410}}>
              <MonthGrid
                lit={(i) => tw(f, litAt + i * 1.5, litAt + 8 + i * 1.5) * (1 - 0.0 * i)}
                appear={(i) => tw(f, calAt + 4 + i * 2, calAt + 16 + i * 2)}
                color={upfrontAt <= f ? C.amber : C.cyan}
                tileW={160}
                tileH={104}
                gap={16}
              />
            </div>
            {/* bracket: all 12 months paid now */}
            {f >= upfrontAt && (
              <div style={{position: 'absolute', left: 720, top: 660, width: 6 * 160 + 5 * 16, opacity: tw(f, upfrontAt, upfrontAt + 10)}}>
                <svg width={6 * 160 + 5 * 16} height={40} style={{display: 'block'}}>
                  <path
                    d={`M 4 4 Q 4 22 30 22 L ${(6 * 160 + 5 * 16) / 2 - 20} 22 Q ${(6 * 160 + 5 * 16) / 2} 22 ${(6 * 160 + 5 * 16) / 2} 38 Q ${(6 * 160 + 5 * 16) / 2} 22 ${(6 * 160 + 5 * 16) / 2 + 20} 22 L ${6 * 160 + 5 * 16 - 30} 22 Q ${6 * 160 + 5 * 16 - 4} 22 ${6 * 160 + 5 * 16 - 4} 4`}
                    fill="none"
                    stroke={C.amber}
                    strokeWidth={3}
                    strokeDasharray={1200}
                    strokeDashoffset={1200 * (1 - tw(f, upfrontAt, upfrontAt + 20, 0, 1, easeInOut))}
                  />
                </svg>
                <div style={{display: 'flex', justifyContent: 'center', marginTop: 12}}>
                  <Pop at={upfrontAt + 12} x={0} y={0} style={{position: 'relative'}}>
                    <Tag text={T.annual.upfront} tone="amber" icon="card" solid size={24} />
                  </Pop>
                </div>
              </div>
            )}
          </div>
          {/* not this one */}
          <Pop at={notThis} out={end - 14} x={1800} y={800} anchor="tr" from="scale">
            <Tag text={T.annual.notThis} tone="red" icon="x" solid size={24} />
          </Pop>
          {f >= notThis && (
            <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
              <line x1={700} y1={400} x2={1720} y2={760} stroke={C.red} strokeWidth={6} strokeLinecap="round" strokeDasharray={1100} strokeDashoffset={1100 * (1 - tw(f, notThis + 4, notThis + 16, 0, 1, easeInOut))} opacity={1 - 0.6 * tw(f, monthlyAt, monthlyAt + 12)} />
            </svg>
          )}
          {/* what we need */}
          <Pop at={monthlyAt} out={end - 14} x={120} y={840}>
            <Card pad={26} radius={24} glow={C.cyanGlow} style={{display: 'flex', alignItems: 'center', gap: 26}}>
              <div style={{width: 92, height: 92, borderRadius: 20, background: C.cyan, color: '#041014', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <Icon name="repeat" size={50} stroke={2.4} />
              </div>
              <div style={{fontFamily: FONT}}>
                <div style={{fontSize: 22, letterSpacing: '0.14em', fontWeight: 700, color: C.cyan, textTransform: 'uppercase'}}>{T.annual.needLabel}</div>
                <div style={{fontSize: 42, fontWeight: 760, color: C.text, letterSpacing: '-0.02em', marginTop: 4}}>{T.annual.needText}</div>
              </div>
              <div style={{marginLeft: 12, color: C.cyan}}>
                <Icon name="check" size={56} stroke={3} />
              </div>
            </Card>
          </Pop>
        </div>
      )}

      <Sfx name="whoosh" at={pageIn} />
      <Sfx name="pop" at={hlAt} />
      <Sfx name="pop" at={cardAt} />
      <Sfx name="error" at={careful} volume={0.3} />
      <Sfx name="pop" at={litAt} />
      <Sfx name="pop" at={upfrontAt + 12} />
      <Sfx name="error" at={notThis + 4} />
      <Sfx name="success" at={monthlyAt + 2} />
    </AbsoluteFill>
  );
};
