import React from 'react';
import {useCurrentFrame} from 'remotion';
import {IconArrow, IconImageEdit, IconSparkle, IconStyle, IconText} from '../components/Icons';
import {ScreenPanel} from '../components/ScreenPanel';
import {Sfx} from '../components/Sfx';
import {Card, Chip, IconTile} from '../components/ui';
import {MODEL_NAME, RECORDINGS} from '../config';
import {appear, easeInOut, lerp, prog} from '../lib/anim';
import {Section, wordFrame} from '../timeline';
import {C, FONT, W} from '../theme';

const GOALS = [
	{Icon: IconImageEdit, kk: 'Дайын суретті өзгерту'},
	{Icon: IconStyle, kk: 'Белгілі бір стиль'},
	{Icon: IconText, kk: 'Суреттегі анық мәтін'},
];

export const ModelScene: React.FC<{sec: Section}> = ({sec}) => {
	const frame = useCurrentFrame();
	const [l02, l03, l04] = sec.lines;

	// panel shrinks to the top when the "how to choose" principle starts
	const shrink = prog(frame, l04.start - 14, 22, easeInOut);
	const scale = lerp(1, 0.6, shrink);

	const imageAt = wordFrame(l02, 'Image');
	const modelAt = wordFrame(l02, 'модельді');
	const nanoAt = wordFrame(l03, 'Nano') - 8;
	const goalsEnd = l04.start - 10;

	return (
		<>
			<ScreenPanel
				slot={RECORDINGS.model}
				width={1000}
				height={700}
				planned={l04.start}
				style={{left: 40, top: 290, transform: `scale(${scale})`, transformOrigin: '50% 0%'}}
			/>

			{/* L02: Image -> model breadcrumb */}
			<div
				style={{
					position: 'absolute',
					top: 1040,
					width: W,
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					gap: 22,
					...appear(frame, imageAt - 6, {end: nanoAt}),
				}}
			>
				<Chip style={{fontFamily: FONT.en, fontSize: 40, padding: '16px 34px'}}>Image</Chip>
				<div style={{opacity: prog(frame, modelAt - 6, 12), color: C.cyanSoft}}>
					<IconArrow size={52} />
				</div>
				<Chip gradient style={{fontSize: 40, padding: '16px 34px', opacity: prog(frame, modelAt - 4, 12)}}>
					Модель
				</Chip>
			</div>
			<Sfx name="pop" at={imageAt - 6} />
			<Sfx name="pop" at={modelAt - 4} />

			{/* L03: the demo model */}
			<Card style={{left: 60, top: 1030, width: 960, height: 200, ...appear(frame, nanoAt, {end: goalsEnd})}}>
				<div style={{display: 'flex', alignItems: 'center', gap: 30, padding: '0 40px', height: '100%'}}>
					<IconTile size={112}>
						<IconSparkle size={58} />
					</IconTile>
					<div>
						<div style={{fontFamily: FONT.kk, fontSize: 28, color: C.muted, fontWeight: 550}}>Осы сабақтағы модель</div>
						<div style={{fontFamily: FONT.en, fontSize: 56, fontWeight: 750, color: C.text, letterSpacing: -1}}>{MODEL_NAME}</div>
						<div style={{fontFamily: FONT.kk, fontSize: 30, color: C.cyanSoft, fontWeight: 550}}>
							Суретті нұсқаулықпен өңдеуге ыңғайлы
						</div>
					</div>
				</div>
			</Card>
			<Sfx name="pop" at={nanoAt} />

			{/* L04: choose by goal */}
			<div
				style={{
					position: 'absolute',
					top: 745,
					width: W,
					textAlign: 'center',
					fontFamily: FONT.kk,
					fontSize: 50,
					fontWeight: 720,
					letterSpacing: -0.8,
					color: C.text,
					...appear(frame, l04.start + 2),
				}}
			>
				Модельді{' '}
				<span style={{background: C.gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}}>
					мақсатқа қарай
				</span>{' '}
				таңдаңыз
			</div>
			{GOALS.map((g, i) => {
				const p = l04.phrases[i + 1] ?? l04.phrases[l04.phrases.length - 1];
				const at = p.start - 4;
				const speaking = frame >= p.start - 4 && frame < p.end;
				const allDone = frame >= l04.end;
				const active = speaking || allDone ? 1 : 0.35;
				return (
					<React.Fragment key={g.kk}>
						<Card
							glow={speaking ? 1 : 0}
							style={{
								left: 60,
								top: 840 + i * 168,
								width: 960,
								height: 148,
								...appear(frame, at, {y: 30}),
								opacity: appear(frame, at).opacity * (0.45 + 0.55 * active),
							}}
						>
							<div style={{display: 'flex', alignItems: 'center', gap: 30, padding: '0 34px', height: '100%'}}>
								<IconTile size={96} active={active}>
									<g.Icon size={52} />
								</IconTile>
								<div style={{fontFamily: FONT.kk, fontSize: 44, fontWeight: 650, color: C.text, letterSpacing: -0.5}}>{g.kk}</div>
							</div>
						</Card>
						<Sfx name="pop" at={at} />
					</React.Fragment>
				);
			})}
		</>
	);
};
