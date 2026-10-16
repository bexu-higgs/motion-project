import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {cues} from '../timeline';
import {easeIn, easeInOut, pop, track, tw, vis} from '../lib/anim';
import {PhoneStage, camTrack, focus, landToPortrait, overview, type Cam} from '../components/Phone';
import {Crop, Cutout, Shot} from '../components/Screen';
import {Highlight, Touch} from '../components/Marks';
import {QuickSettings, AUTO_ROTATE_INDEX, tileBox} from '../components/QuickSettings';
import {Card, Instr, LeftScrim, Pop, StepHeader, Tag} from '../components/Text';
import {Icon} from '../components/Icon';
import {MonthGrid} from '../components/Months';
import {Sfx} from '../components/Sfx';
import {boxCenter, type Box} from '../lib/regions';
import {T} from '../copy';

// Billing toggle in the landscape screenshot (landscape units = source px)
const TOGGLE_CENTER: [number, number] = [1335, 690];
const MONTHLY_LABEL: Box = [1060, 664, 150, 54];
const ANNUAL_LABEL: Box = [1310, 664, 128, 54];
const LAND_CAM: Cam = {fx: 540, fy: 1200, s: 1.65, ax: 1060, ay: 640};

/** Real toggle repainted in its "Monthly" state: knob slides left, label brightness swaps. */
const MonthlyState: React.FC<{p: number}> = ({p}) => {
  if (p <= 0) return null;
  return (
    <>
      <div style={{position: 'absolute', left: 1210, top: 660, width: 94, height: 60, background: 'rgb(16,17,19)'}} />
      <div style={{position: 'absolute', left: 1217, top: 667, width: 80, height: 46, borderRadius: 23, background: '#CFFD17'}} />
      <div style={{position: 'absolute', left: 1272 - 30 * p - 16.5, top: 690 - 16.5, width: 33, height: 33, borderRadius: 17, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)'}} />
      <Crop src="landscape" box={MONTHLY_LABEL} style={{opacity: p, filter: 'brightness(1.76) contrast(1.122)'}} />
      <Crop src="landscape" box={ANNUAL_LABEL} style={{opacity: p, filter: 'brightness(0.539) contrast(0.938)'}} />
    </>
  );
};

export const S06Monthly: React.FC = () => {
  const f = useCurrentFrame();
  const c = cues('s6');
  const end = c.duration;

  const enter = pop(f, 0, 18, 110);
  // portrait: look for "Monthly"
  const scanFrom = c.at('s6_1') + 10;
  const scanTo = c.mid('s6_2', 0.5);
  // quick-settings shade
  const T0 = c.end('s6_2') - 8;
  const dragDown: [number, number] = [T0 + 10, T0 + 30];
  const tapRotate = T0 + 56;
  const dragUp: [number, number] = [T0 + 80, T0 + 94];
  const shadeOpen = Math.max(0, track(f, [[dragDown[0], 0], [dragDown[1], 0.86], [dragDown[1] + 8, 1], [dragUp[0], 1], [dragUp[1] + 4, 0]]));
  const autoRotate = tw(f, tapRotate, tapRotate + 8);
  // rotate to landscape
  const R0 = c.at('s6_3');
  const rot = track(f, [[R0, 0], [R0 + 38, -90]], easeInOut);
  const portraitO = 1 - tw(f, R0 + 14, R0 + 30);
  const landO = tw(f, R0 + 16, R0 + 34);
  // tap Monthly
  const hlAt = c.mid('s6_4', 0.3);
  const tapM = c.mid('s6_5', 0.4);
  const monthly = tw(f, tapM + 1, tapM + 9, 0, 1, easeInOut);
  const exitAt = c.at('s6_6') - 12;
  const exit = tw(f, exitAt, exitAt + 16, 0, 1, easeIn);

  const toggleCam = focus(landToPortrait(TOGGLE_CENTER[0], TOGGLE_CENTER[1]), 3.0, [1060, 600]);
  const cam = camTrack(f, [
    [0, overview()],
    [c.at('s6_1'), overview()],
    [c.at('s6_1') + 22, focus([540, 640], 1.45, [1300, 560])],
    [scanTo, focus([540, 640], 1.45, [1300, 560])],
    [scanTo + 22, overview()],
    [R0, overview()],
    [R0 + 38, LAND_CAM],
    [c.at('s6_4'), LAND_CAM],
    [c.at('s6_4') + 24, toggleCam],
    [exitAt, toggleCam],
    [exitAt + 16, {...toggleCam, s: 2.4}],
  ]);

  const tile = tileBox(AUTO_ROTATE_INDEX);
  const tileC = boxCenter(tile);
  const instrOut = R0 + 4;

  return (
    <AbsoluteFill>
      <PhoneStage
        cam={cam}
        rot={rot}
        dy={(1 - enter) * 700}
        opacity={Math.min(1, enter * 1.4) * (1 - exit)}
        screen={
          <div style={{position: 'absolute', inset: 0, opacity: portraitO}}>
            <Shot src="max1800" />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 880,
                width: 1080,
                height: 1520,
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 18%, rgba(0,0,0,0.85) 100%)',
                opacity: vis(f, c.at('s6_1'), scanTo + 10, 12),
              }}
            />
            <QuickSettings open={shadeOpen} autoRotate={autoRotate} />
          </div>
        }
        overlay={
          f < R0 + 10 ? (
            <>
              <Touch
                keys={[
                  {f: scanFrom, x: 250, y: 300},
                  {f: scanFrom + 22, x: 860, y: 300},
                  {f: scanFrom + 44, x: 987, y: 722},
                  {f: scanFrom + 70, x: 72, y: 722},
                  {f: scanFrom + 96, x: 540, y: 560},
                ]}
                inAt={scanFrom - 6}
                outAt={scanFrom + 100}
              />
              <Touch
                keys={[
                  {f: T0, x: 540, y: 300},
                  {f: dragDown[0], x: 540, y: 50},
                  {f: dragDown[1], x: 540, y: 1000},
                  {f: T0 + 46, x: tileC[0] + 240, y: tileC[1] + 260},
                  {f: tapRotate - 4, x: tileC[0], y: tileC[1]},
                  {f: dragUp[0] - 4, x: 540, y: 1240},
                  {f: dragUp[1], x: 540, y: 260},
                ]}
                taps={[tapRotate]}
                drags={[dragDown, dragUp]}
                inAt={T0}
                outAt={dragUp[1] + 6}
              />
              <Highlight box={tile} at={T0 + 38} out={tapRotate + 14} radius={64} pad={10} />
            </>
          ) : null
        }
        landscape={
          <div style={{position: 'absolute', inset: 0, opacity: landO}}>
            <Shot src="landscape" />
            <MonthlyState p={monthly} />
          </div>
        }
        landscapeOverlay={
          <>
            <Highlight box={MONTHLY_LABEL} at={hlAt} out={tapM + 2} radius={18} pad={10} />
            <Highlight box={[1050, 650, 260, 82]} at={tapM + 8} out={exitAt} radius={26} pad={8} />
            <Touch keys={[{f: tapM - 24, x: 1300, y: 900}, {f: tapM - 4, x: 1132, y: 690}]} taps={[tapM]} inAt={tapM - 26} outAt={tapM + 14} />
          </>
        }
      />
      <LeftScrim amount={tw(cam.s, 1.05, 1.6) * (1 - tw(f, R0, R0 + 20)) + tw(f, c.at('s6_4'), c.at('s6_4') + 20) * (1 - exit)} />
      <StepHeader step={4} title={T.monthly.title} at={2} out={end - 10} />

      {/* portrait steps */}
      <Instr icon="search" text={T.monthly.find} at={c.at('s6_1')} out={instrOut} y={400} dim={tw(f, c.mid('s6_2', 0.4), c.mid('s6_2', 0.4) + 10)} />
      <Instr icon="x" tone="red" text={T.monthly.notVisible} at={c.mid('s6_2', 0.4)} out={instrOut} y={492} dim={tw(f, T0, T0 + 10)} />
      <Instr icon="hand" text={T.monthly.swipe} at={T0} out={instrOut} y={584} dim={tw(f, tapRotate - 10, tapRotate)} />
      <Instr icon="rotate" text={T.monthly.autoRotate} at={tapRotate - 10} out={instrOut} y={676} solid={f >= tapRotate + 4} />

      {/* landscape captions (top-right, clear of the phone) */}
      <Pop at={R0} out={c.at('s6_4') + 6} x={1800} y={140} anchor="tr" from="scale">
        <Tag text={T.monthly.sideways} tone="cyan" icon="rotate" solid size={24} />
      </Pop>
      <Pop at={c.at('s6_4') + 8} out={exitAt} x={120} y={720}>
        <Tag text={T.monthly.visibleNow} tone="cyan" icon="check" size={24} />
      </Pop>
      <Pop at={tapM + 8} out={exitAt} x={120} y={800}>
        <Tag text={T.monthly.selected} tone="cyan" icon="check" solid size={24} />
      </Pop>
      <Pop at={tapM + 34} out={exitAt} x={120} y={410}>
        <div style={{fontFamily: FONT, fontSize: 26, fontWeight: 600, color: C.dim, marginBottom: 14}}>{T.monthly.priceNow}</div>
        <Card radius={18} glow="rgba(46,230,255,0.4)">
          <Cutout name="maxPrice1800" width={640} />
        </Card>
      </Pop>

      {/* yearly ≠ monthly */}
      <ComparePanel at={c.at('s6_6')} out={end - 12} />

      <Sfx name="whoosh" at={0} />
      <Sfx name="swipe" at={dragDown[0]} />
      <Sfx name="toggle" at={tapRotate} />
      <Sfx name="swipe" at={dragUp[0]} />
      <Sfx name="rotate" at={R0} />
      <Sfx name="pop" at={hlAt} />
      <Sfx name="toggle" at={tapM} />
      <Sfx name="pop" at={tapM + 34} />
      <Sfx name="whoosh" at={c.at('s6_6')} />
    </AbsoluteFill>
  );
};

const ComparePanel: React.FC<{at: number; out: number}> = ({at, out}) => {
  const f = useCurrentFrame();
  const o = vis(f, at, out, 12);
  if (o <= 0) return null;
  const neq = pop(f, at + 14);
  const higher = at + 70;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: o, fontFamily: FONT}}>
      <Pop at={at} x={170} y={370} from="left">
        <Card pad={40} radius={30} style={{width: 700}}>
          <Tag text={T.monthly.yearly} tone="neutral" icon="calendar" size={22} />
          <div style={{marginTop: 28}}>
            <MonthGrid lit={() => 1} color="rgba(255,255,255,0.7)" tileW={96} tileH={62} gap={10} fontSize={17} appear={(i) => tw(f, at + 4 + i, at + 14 + i)} />
          </div>
          <div style={{marginTop: 30, fontSize: 38, fontWeight: 760, color: C.text, letterSpacing: '-0.02em'}}>{T.monthly.yearlyLine}</div>
          <div style={{marginTop: 10, fontSize: 28, fontWeight: 500, color: C.dim}}>{T.monthly.yearlySub}</div>
        </Card>
      </Pop>
      <div style={{position: 'absolute', left: 960, top: 560, transform: `translate(-50%, -50%) scale(${neq})`, fontSize: 130, fontWeight: 300, color: C.cyan, textShadow: `0 0 30px ${C.cyanGlow}`}}>≠</div>
      <Pop at={at + 8} x={1050} y={370} from="right">
        <Card pad={40} radius={30} glow={C.cyanGlow} style={{width: 700}}>
          <Tag text={T.monthly.monthly} tone="cyan" icon="repeat" solid size={22} />
          <div style={{marginTop: 28}}>
            <MonthGrid lit={(i) => (i === 0 ? 1 : 0)} tileW={96} tileH={62} gap={10} fontSize={17} appear={(i) => tw(f, at + 12 + i, at + 22 + i)} />
          </div>
          <div style={{marginTop: 30, fontSize: 38, fontWeight: 760, color: C.text, letterSpacing: '-0.02em'}}>{T.monthly.monthlyLine}</div>
          <div style={{marginTop: 10, fontSize: 28, fontWeight: 650, color: C.amber, display: 'flex', alignItems: 'center', gap: 10, opacity: tw(f, higher, higher + 12)}}>
            <Icon name="warn" size={30} /> {T.monthly.monthlySub}
          </div>
        </Card>
      </Pop>
    </div>
  );
};
