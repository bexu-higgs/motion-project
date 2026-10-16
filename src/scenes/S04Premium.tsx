import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {cues} from '../timeline';
import {easeIn, tw} from '../lib/anim';
import {PhoneStage, camTrack, focus, overview} from '../components/Phone';
import {ClosedPage, Crop, Shot, SlideMenu} from '../components/Screen';
import {Cross, Highlight, Spotlight, Touch} from '../components/Marks';
import {Flow, Instr, LeftScrim, Pop, StepHeader, Tag} from '../components/Text';
import {Sfx} from '../components/Sfx';
import {REGIONS, boxCenter, regionBox, type Box} from '../lib/regions';
import {MENU_ICON_BOX} from './S03Register';

const UPGRADE_BOX: Box = [846, 290, 200, 74];

export const S04Premium: React.FC = () => {
  const f = useCurrentFrame();
  const c = cues('s4');
  const end = c.duration;

  const crossAt = c.mid('s4_2', 0.6);
  const tapMenu = c.mid('s4_3', 0.32);
  const slide = tw(f, tapMenu + 3, tapMenu + 21);
  const user = regionBox('userCard');
  const tapUser = c.end('s4_3') + 10;
  const popup = tw(f, tapUser + 3, tapUser + 15);
  const go = regionBox('goPremium');
  const goHl = c.mid('s4_4', 0.3);
  const upgradeBtn = regionBox('goPremiumUpgrade');
  const tapUpgrade = c.end('s4_4') + 2;
  const exit = tw(f, end - 16, end, 0, 1, easeIn);

  const cam = camTrack(f, [
    [0, overview()],
    [c.at('s4_2'), overview()],
    [c.at('s4_2') + 22, focus(boxCenter(UPGRADE_BOX), 2.15, [1470, 440])],
    [c.at('s4_3'), focus(boxCenter(UPGRADE_BOX), 2.15, [1470, 440])],
    [c.at('s4_3') + 20, overview()],
    [tapMenu + 22, overview()],
    [tapMenu + 44, focus(boxCenter(user), 1.8, [1220, 760])],
    [tapUser + 8, focus(boxCenter(user), 1.8, [1220, 760])],
    [Math.max(tapUser + 26, c.at('s4_4')), focus([452, 1640], 1.3, [1300, 560])],
    [Math.max(tapUser + 27, c.at('s4_4') + 4), focus([452, 1640], 1.3, [1300, 560])],
    [Math.max(tapUser + 46, c.at('s4_4') + 24), focus(boxCenter(go), 2.0, [1240, 560])],
    [tapUpgrade + 8, focus(boxCenter(go), 2.0, [1240, 560])],
    [end, focus(boxCenter(go), 1.6, [1240, 560])],
  ]);

  const popupBox = REGIONS.profilePopup.box;
  return (
    <AbsoluteFill>
      <PhoneStage
        cam={cam}
        opacity={1 - exit}
        dx={exit * 120}
        screen={
          <>
            <ClosedPage loggedIn />
            <Spotlight box={UPGRADE_BOX} at={crossAt - 6} out={c.at('s4_3')} radius={37} strength={0.45} />
            <SlideMenu progress={slide} src="menuIn" />
            {popup > 0 && popup < 1 && (
              <Crop
                src="profile"
                box={popupBox}
                style={{opacity: popup, transform: `translateY(${(1 - popup) * 60}px) scale(${0.94 + 0.06 * popup})`, transformOrigin: '50% 100%', borderRadius: 40}}
              />
            )}
            {popup >= 1 && <Shot src="profile" />}
            <Spotlight box={go} at={goHl} out={tapUpgrade + 6} radius={30} strength={0.5} pad={8} />
          </>
        }
        overlay={
          <>
            <Cross box={UPGRADE_BOX} at={crossAt} out={c.at('s4_3') + 4} radius={37} />
            <Highlight box={MENU_ICON_BOX} at={tapMenu - 18} out={tapMenu + 4} radius={14} pad={12} />
            <Touch keys={[{f: tapMenu - 26, x: 460, y: 900}, {f: tapMenu - 4, x: 65, y: 327}]} taps={[tapMenu]} inAt={tapMenu - 26} outAt={tapMenu + 14} />
            <Highlight box={user} at={tapUser - 22} out={tapUser + 4} radius={70} pad={8} />
            <Touch keys={[{f: tapUser - 24, x: 860, y: 1700}, {f: tapUser - 4, x: 300, y: 2229}]} taps={[tapUser]} inAt={tapUser - 26} outAt={tapUser + 14} />
            <Highlight box={go} at={goHl} out={tapUpgrade + 6} radius={34} pad={8} />
            <Touch keys={[{f: tapUpgrade - 26, x: 860, y: 1900}, {f: tapUpgrade - 4, x: boxCenter(upgradeBtn)[0], y: boxCenter(upgradeBtn)[1]}]} taps={[tapUpgrade]} inAt={tapUpgrade - 26} outAt={tapUpgrade + 14} />
          </>
        }
      />
      <LeftScrim amount={tw(cam.s, 1.05, 1.6)} />
      <StepHeader step={3} title="Go Premium from your profile" at={2} out={end - 10} />

      <Instr icon="x" tone="red" text="Don't tap the top-right Upgrade" at={crossAt} out={end - 10} y={400} dim={tw(f, c.at('s4_3'), c.at('s4_3') + 12)} />
      <Flow items={['Menu', 'Profile', 'Go Premium']} activeAt={[tapMenu, tapUser, goHl]} doneAt={tapUpgrade} x={120} y={512} at={c.at('s4_3')} out={end - 10} size={22} />
      <Pop at={goHl + 6} out={end - 10} x={120} y={612}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <Tag text="Go Premium" tone="cyan" icon="check" solid size={22} />
          <span style={{fontFamily: FONT, fontSize: 28, color: C.dim, fontWeight: 500}}>then tap its Upgrade button</span>
        </div>
      </Pop>

      <Sfx name="error" at={crossAt + 4} />
      <Sfx name="tap" at={tapMenu} />
      <Sfx name="swipe" at={tapMenu + 3} />
      <Sfx name="tap" at={tapUser} />
      <Sfx name="pop" at={tapUser + 4} />
      <Sfx name="pop" at={goHl} />
      <Sfx name="tap" at={tapUpgrade} />
      <Sfx name="whoosh" at={end - 16} />
    </AbsoluteFill>
  );
};

