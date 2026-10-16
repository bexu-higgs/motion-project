import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, FONT} from '../theme';
import {cues} from '../timeline';
import {easeIn, pop, tw} from '../lib/anim';
import {HOME, PhoneStage, camTrack, focus, overview} from '../components/Phone';
import {ClosedPage, Cutout, Shot, SlideMenu} from '../components/Screen';
import {Highlight, Spotlight, Touch} from '../components/Marks';
import {Flow, Instr, LeftScrim, Pop, StepHeader} from '../components/Text';
import {Icon} from '../components/Icon';
import {Sfx} from '../components/Sfx';
import {boxCenter, regionBox, type Box, type RegionName} from '../lib/regions';

export const MENU_ICON_BOX: Box = [30, 292, 70, 70];

export const S03Register: React.FC = () => {
  const f = useCurrentFrame();
  const c = cues('s3');
  const end = c.duration;

  // 1. tap the square menu icon → the real sidebar slides in
  const tapMenu = c.end('s3_2') - 4;
  const slide = tw(f, tapMenu + 3, tapMenu + 21);
  // 2. the Log in button at the bottom of the menu
  const loginHl = c.mid('s3_4', 0.4);
  const tapLogin = c.mid('s3_5', 0.72);
  const modal = tw(f, tapLogin + 4, tapLogin + 16);
  // 3. sign-up methods, highlighted in the order they are spoken
  const methods: Array<{name: RegionName; at: number}> = [
    {name: 'googleBtn', at: c.mid('s3_7', 0.14)},
    {name: 'microsoftBtn', at: c.mid('s3_7', 0.26)},
    {name: 'appleBtn', at: c.mid('s3_7', 0.38)},
    {name: 'emailBlock', at: c.mid('s3_7', 0.55)},
  ];
  const tapGoogle = c.mid('s3_8', 0.5);
  const signedIn = tapGoogle + 10;
  const toHome = end - 22;

  const login = regionBox('loginBtn');
  const cam = camTrack(f, [
    [0, overview()],
    [c.at('s3_2'), overview()],
    [c.at('s3_2') + 22, focus([65, 327], 2.5, [1080, 380])],
    [tapMenu + 6, focus([65, 327], 2.5, [1080, 380])],
    [tapMenu + 30, overview()],
    [c.at('s3_4'), overview()],
    [c.at('s3_4') + 22, focus(boxCenter(login), 1.85, [1190, 760])],
    [tapLogin + 4, focus(boxCenter(login), 1.85, [1190, 760])],
    [tapLogin + 24, focus([540, 1250], 1.18, HOME)],
    [c.at('s3_7'), focus([540, 1250], 1.18, HOME)],
    [c.at('s3_7') + 20, focus([540, 1420], 1.5, [1230, 560])],
    [signedIn, focus([540, 1420], 1.5, [1230, 560])],
    [signedIn + 20, overview()],
  ]);

  const success = pop(f, signedIn, 13, 160);
  const successOut = tw(f, toHome - 4, toHome + 10, 0, 1, easeIn);

  return (
    <AbsoluteFill>
      <PhoneStage
        cam={cam}
        screen={
          <>
            <ClosedPage />
            <SlideMenu progress={slide} src="menuOut" />
            <Spotlight box={login} at={loginHl} out={tapLogin} radius={68} strength={0.5} />
            {modal > 0 && <Shot src="login" opacity={modal} />}
            {f >= c.at('s3_7') && <Spotlight box={[30, 1005, 1020, 830]} at={c.at('s3_7') + 6} out={signedIn} radius={30} strength={0.5} />}
            {f >= signedIn && (
              <>
                <div style={{position: 'absolute', inset: 0, background: `rgba(5,7,10,${0.82 * Math.min(1, success) * (1 - successOut)})`}} />
                <div style={{position: 'absolute', inset: 0, opacity: tw(f, toHome, toHome + 12)}}>
                  <ClosedPage loggedIn />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    left: 340,
                    top: 1000,
                    width: 400,
                    height: 400,
                    borderRadius: 200,
                    background: C.cyan,
                    color: '#041014',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: `scale(${success})`,
                    opacity: 1 - successOut,
                    boxShadow: `0 0 120px ${C.cyanGlow}`,
                  }}
                >
                  <Icon name="check" size={230} stroke={3} />
                </div>
              </>
            )}
          </>
        }
        overlay={
          <>
            <Highlight box={MENU_ICON_BOX} at={c.mid('s3_2', 0.45)} out={tapMenu + 4} radius={14} pad={12} />
            <Touch keys={[{f: tapMenu - 26, x: 420, y: 760}, {f: tapMenu - 4, x: 65, y: 327}]} taps={[tapMenu]} inAt={tapMenu - 26} outAt={tapMenu + 14} />
            <Highlight box={login} at={loginHl} out={tapLogin + 2} radius={68} pad={10} />
            <Touch keys={[{f: tapLogin - 24, x: 760, y: 1900}, {f: tapLogin - 4, x: 473, y: 2246}]} taps={[tapLogin]} inAt={tapLogin - 26} outAt={tapLogin + 14} />
            <Highlight box={regionBox('signUpSubtitle')} at={tapLogin + 22} out={c.at('s3_7')} radius={22} pad={12} />
            {methods.map((m, i) => (
              <Highlight key={m.name} box={regionBox(m.name)} at={m.at} out={i < 3 ? methods[i + 1].at - 2 : tapGoogle - 10} radius={i === 3 ? 30 : 40} pad={6} />
            ))}
            <Highlight box={regionBox('googleBtn')} at={tapGoogle - 8} out={signedIn} radius={40} pad={6} />
            <Touch keys={[{f: tapGoogle - 24, x: 860, y: 1900}, {f: tapGoogle - 4, x: 600, y: 1085}]} taps={[tapGoogle]} inAt={tapGoogle - 26} outAt={tapGoogle + 12} />
          </>
        }
      />
      <LeftScrim amount={tw(cam.s, 1.05, 1.6)} />
      <StepHeader step={2} title="Open the menu & sign up" at={2} out={end - 10} />

      {/* left column: what each tap does */}
      <Instr icon="menu" text="Tap the square menu icon" at={c.mid('s3_2', 0.3)} out={c.at('s3_5') - 6} y={400} dim={tw(f, tapMenu + 10, tapMenu + 20)} />
      <Instr icon="arrow" text="Menu opens on the left" at={c.at('s3_3')} out={c.at('s3_5') - 6} y={492} dim={tw(f, c.at('s3_4'), c.at('s3_4') + 10)} />
      <Instr icon="user" text="Log in / Sign up — bottom" at={loginHl} out={c.at('s3_5') - 6} y={584} />

      <Instr icon="user" text="No account yet → Sign up" at={c.at('s3_5') + 4} out={c.at('s3_7') - 4} y={400} />
      <Instr icon="lock" text="Have an account → Log in" at={c.at('s3_6')} out={c.at('s3_7') - 4} y={492} />
      <Pop at={c.mid('s3_6', 0.55)} out={c.at('s3_7') - 4} x={204} y={580}>
        <div style={{fontFamily: FONT, fontSize: 26, color: C.dim, fontWeight: 500}}>Both open this sign-in window</div>
      </Pop>

      {methods.map((m, i) => {
        const y = [372, 466, 560, 654][i];
        const chosen = m.name === 'googleBtn' ? tw(f, tapGoogle - 6, tapGoogle) : 0;
        const dimmed = m.name !== 'googleBtn' ? tw(f, tapGoogle - 6, tapGoogle) : 0;
        return (
          <Pop key={m.name} at={m.at} out={end - 12} x={120} y={y} from="left">
            <div
              style={{
                borderRadius: 18,
                overflow: 'hidden',
                opacity: 1 - 0.6 * dimmed,
                border: `2px solid ${chosen > 0.5 ? C.cyan : 'rgba(255,255,255,0.1)'}`,
                boxShadow: chosen > 0.5 ? `0 0 34px ${C.cyanGlow}` : '0 18px 40px rgba(0,0,0,0.5)',
              }}
            >
              <Cutout name={m.name} width={560} />
            </div>
          </Pop>
        );
      })}
      <Pop at={signedIn + 4} out={end - 12} x={120} y={812} from="left">
        <div style={{display: 'flex', alignItems: 'center', gap: 14, fontFamily: FONT, fontSize: 30, fontWeight: 650, color: C.cyan}}>
          <Icon name="check" size={34} stroke={3} /> Account ready
        </div>
      </Pop>

      <Flow items={['Tap menu', 'Sign up', 'Choose a method']} activeAt={[tapMenu, tapLogin, c.at('s3_7')]} doneAt={signedIn} x={120} y={930} at={c.at('s3_2')} out={end - 10} />

      <Sfx name="pop" at={c.mid('s3_2', 0.45)} />
      <Sfx name="tap" at={tapMenu} />
      <Sfx name="swipe" at={tapMenu + 3} />
      <Sfx name="pop" at={loginHl} />
      <Sfx name="tap" at={tapLogin} />
      {methods.map((m) => (
        <Sfx key={m.name} name="pop" at={m.at} volume={0.32} />
      ))}
      <Sfx name="tap" at={tapGoogle} />
      <Sfx name="success" at={signedIn} />
    </AbsoluteFill>
  );
};

