import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {cues} from '../timeline';
import {easeIn, pop, tw} from '../lib/anim';
import {PhoneStage, camTrack, focus, overview} from '../components/Phone';
import {ClosedPage, Crop, Cutout} from '../components/Screen';
import {Highlight, Touch} from '../components/Marks';
import {Instr, LeftScrim, StepHeader} from '../components/Text';
import {Icon} from '../components/Icon';
import {Sfx} from '../components/Sfx';
import type {Box} from '../lib/regions';

const LINK_BOX: Box = [130, 1190, 820, 110];
export const URL_BOX: Box = [132, 116, 540, 108];

/** Neutral "your referral link" card — stands in for wherever the viewer finds the link. */
const LinkCard: React.FC = () => (
  <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#0E131A 0%, #090C10 100%)', fontFamily: FONT}}>
    <Crop src="menuOut" box={[0, 0, 1080, 104]} />
    <div style={{position: 'absolute', left: 90, top: 880, width: 900, height: 600, borderRadius: 52, background: '#161C24', border: '2px solid rgba(255,255,255,0.08)'}} />
    <div style={{position: 'absolute', left: 150, top: 950}}>
      <Cutout name="welcomeLogo" width={136} radius={34} />
    </div>
    <div style={{position: 'absolute', left: 320, top: 962, fontSize: 56, fontWeight: 750, color: '#fff', letterSpacing: '-0.02em'}}>Higgsfield MAX</div>
    <div style={{position: 'absolute', left: 320, top: 1034, fontSize: 40, fontWeight: 500, color: 'rgba(255,255,255,0.55)'}}>Discount link</div>
    <div style={{position: 'absolute', left: 140, top: 1150, width: 800, height: 2, background: 'rgba(255,255,255,0.08)'}} />
    <div style={{position: 'absolute', left: 150, top: 1212, display: 'flex', alignItems: 'center', gap: 22, color: C.cyan, fontSize: 48, fontWeight: 600}}>
      <Icon name="link" size={52} stroke={2.4} />
      <span style={{textDecoration: 'underline', textUnderlineOffset: 10}}>higgsfield.ai/…</span>
    </div>
    <div style={{position: 'absolute', left: 150, top: 1360, fontSize: 36, color: 'rgba(255,255,255,0.45)'}}>Tap to open</div>
  </div>
);

export const S02Link: React.FC = () => {
  const f = useCurrentFrame();
  const c = cues('s2');
  const end = c.duration;

  const enter = pop(f, 0, 18, 110);
  const tapAt = c.mid('s2_2', 0.8);
  const openAt = tapAt + 5;
  const loaded = openAt + 28;
  const zoomIn = Math.max(c.at('s2_3'), loaded + 2);

  const urlCam = focus([400, 172], 2.35, [1190, 430]);
  const cam = camTrack(f, [
    [0, overview()],
    [zoomIn, overview()],
    [zoomIn + 22, urlCam],
    [end - 26, urlCam],
    [end - 2, overview()],
  ]);

  const page = tw(f, openAt, openAt + 10);
  const bodyHidden = 1 - tw(f, loaded - 6, loaded + 10);
  const bar = tw(f, openAt, loaded, 0, 1);

  return (
    <AbsoluteFill>
      <PhoneStage
        cam={cam}
        dy={(1 - enter) * 700}
        opacity={Math.min(1, enter * 1.4)}
        screen={
          <>
            <ClosedPage />
            <div style={{position: 'absolute', left: 0, top: 251, width: 1080, height: 2103, background: '#080808', opacity: bodyHidden}} />
            <div style={{position: 'absolute', left: 0, top: 246, height: 8, width: 1080 * bar, background: C.cyan, opacity: 1 - tw(f, loaded, loaded + 8), boxShadow: `0 0 16px ${C.cyan}`}} />
            <div style={{position: 'absolute', inset: 0, opacity: 1 - page}}>
              <LinkCard />
            </div>
          </>
        }
        overlay={
          <>
            <Highlight box={LINK_BOX} at={c.at('s2_2') + 12} out={tapAt + 2} radius={30} />
            <Touch keys={[{f: tapAt - 26, x: 760, y: 1950}, {f: tapAt - 4, x: 420, y: 1246}]} taps={[tapAt]} inAt={tapAt - 26} outAt={openAt + 8} />
            <Highlight box={URL_BOX} at={zoomIn + 16} out={end - 22} radius={54} pad={10} />
          </>
        }
      />
      <LeftScrim amount={tw(cam.s, 1.05, 1.7, 0, 1)} />
      <StepHeader step={1} title="Open the referral link" at={2} out={end - 10} />
      <Instr icon="hand" text="Tap my referral link" at={c.at('s2_2')} out={end - 10} y={400} dim={tw(f, openAt, openAt + 10)} />
      <Instr icon="check" text="Higgsfield opens" at={c.at('s2_3')} out={end - 10} y={492} solid />
      {f >= zoomIn + 18 && (
        <div style={{position: 'absolute', left: 120, top: 600, opacity: tw(f, zoomIn + 18, zoomIn + 30) * (1 - tw(f, end - 22, end - 10, 0, 1, easeIn))}}>
          <div style={{fontFamily: FONT, fontSize: 26, color: C.dim, fontWeight: 500}}>Check the address bar:</div>
          <div style={{marginTop: 10, fontFamily: FONT, fontSize: 44, fontWeight: 700, color: C.cyan, letterSpacing: '-0.01em'}}>higgsfield.ai</div>
        </div>
      )}
      <Sfx name="whoosh" at={0} />
      <Sfx name="tap" at={tapAt} />
      <Sfx name="swipe" at={openAt} />
      <Sfx name="pop" at={zoomIn + 18} />
    </AbsoluteFill>
  );
};
