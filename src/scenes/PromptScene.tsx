import React from 'react';
import {useCurrentFrame} from 'remotion';
import {ScreenPanel} from '../components/ScreenPanel';
import {Sfx} from '../components/Sfx';
import {Card, Chip, PartPill} from '../components/ui';
import {RECORDINGS} from '../config';
import {appear, pop} from '../lib/anim';
import {Section, wordFrame} from '../timeline';
import {C, FONT, PartId, W} from '../theme';

const WORD: Record<PartId, string> = {
	subject: 'нысанды',
	background: 'фонды',
	lighting: 'жарықты',
	composition: 'композицияны',
	style: 'стильді',
};

const Plus: React.FC<{o: number}> = ({o}) => (
	<div style={{fontFamily: FONT.en, fontSize: 52, fontWeight: 300, color: C.faint, opacity: o, margin: '0 6px'}}>+</div>
);

export const PromptScene: React.FC<{sec: Section}> = ({sec}) => {
	const frame = useCurrentFrame();
	const [l05, l06] = sec.lines;
	const at = (p: PartId) => wordFrame(l06, WORD[p]) - 6;
	const s = (p: PartId) => pop(frame, at(p));
	const rowStyle: React.CSSProperties = {position: 'absolute', width: W, display: 'flex', justifyContent: 'center', alignItems: 'center'};
	const pill = (p: PartId) => (
		<div style={{transform: `scale(${s(p)})`, opacity: Math.min(1, s(p) * 1.5)}}>
			<PartPill part={p} size={42} />
		</div>
	);
	const total = Math.min(l06.end - 4, at('style') + 20);
	return (
		<>
			<ScreenPanel slot={RECORDINGS.promptField} width={1000} height={400} planned={sec.duration} style={{left: 40, top: 290}} />

			<Card style={{left: 60, top: 730, width: 960, height: 210, ...appear(frame, l05.start + 2)}}>
				<div style={{padding: '30px 40px', display: 'flex', flexDirection: 'column', gap: 16}}>
					<div>
						<Chip gradient style={{fontSize: 32}}>
							Промпт
						</Chip>
					</div>
					<div style={{fontFamily: FONT.kk, fontSize: 42, fontWeight: 600, color: C.text, lineHeight: 1.22, letterSpacing: -0.4}}>
						модельге қандай нәтиже керек екенін түсіндіретін мәтін
					</div>
				</div>
			</Card>
			<Sfx name="pop" at={l05.start + 2} />

			<div style={{...rowStyle, top: 985}}>
				{pill('subject')}
				<Plus o={s('background')} />
				{pill('background')}
				<Plus o={s('lighting')} />
				{pill('lighting')}
			</div>
			<div style={{...rowStyle, top: 1090}}>
				<Plus o={s('composition')} />
				{pill('composition')}
				<Plus o={s('style')} />
				{pill('style')}
			</div>
			<div style={{...rowStyle, top: 1200, gap: 22, transform: `scale(${pop(frame, total)})`, opacity: Math.min(1, pop(frame, total) * 1.5)}}>
				<div style={{fontFamily: FONT.en, fontSize: 56, fontWeight: 300, color: C.faint}}>=</div>
				<Chip gradient style={{fontSize: 46, padding: '16px 40px'}}>
					Промпт
				</Chip>
			</div>
			{(['subject', 'background', 'lighting', 'composition', 'style'] as PartId[]).map((p) => (
				<Sfx key={p} name="pop" at={at(p)} />
			))}
			<Sfx name="shimmer" at={total} gain={0.6} />
		</>
	);
};
