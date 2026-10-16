import React from 'react';
import {useCurrentFrame} from 'remotion';
import {IconArrow, IconRefresh} from '../components/Icons';
import {ScreenPanel} from '../components/ScreenPanel';
import {Sfx} from '../components/Sfx';
import {ImageSlot} from '../components/Slots';
import {Card, Chip, PartPill} from '../components/ui';
import {IMAGES, ITERATION, RECORDINGS} from '../config';
import {appear, prog, sec as s} from '../lib/anim';
import {Section, wordFrame} from '../timeline';
import {C, FONT} from '../theme';

const ResultCard: React.FC<{file: string; label: string; left: number; style: React.CSSProperties}> = ({file, label, left, style}) => (
	<div style={{position: 'absolute', left, top: 650, ...style}}>
		<ImageSlot file={file} width={450} height={450} label={label} />
		<Chip style={{position: 'absolute', left: 16, top: 16, fontSize: 26, padding: '7px 18px', background: 'rgba(14,15,18,0.82)'}}>
			{label}
		</Chip>
	</div>
);

export const IterateScene: React.FC<{sec: Section}> = ({sec}) => {
	const frame = useCurrentFrame();
	const [l09] = sec.lines;
	const r1 = s(0.9);
	const diffAt = wordFrame(l09, 'бір бөлігін') - 6;
	const againAt = wordFrame(l09, 'қайта') - 4;
	const r2 = Math.max(againAt + s(1.2), l09.end - s(0.4));

	return (
		<>
			<ScreenPanel slot={RECORDINGS.generate} width={1000} height={322} planned={sec.duration} style={{left: 40, top: 290}} />

			{/* result 1 -> one change -> result 2 (both real results) */}
			<ResultCard file={IMAGES[ITERATION.from]} label="1-нәтиже" left={50} style={appear(frame, r1)} />
			<Sfx name="shimmer" at={r1} gain={0.5} />

			<div
				style={{
					position: 'absolute',
					left: 500,
					top: 820,
					width: 80,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 8,
					color: C.cyanSoft,
					...appear(frame, againAt),
				}}
			>
				<div style={{transform: `rotate(${prog(frame, againAt, 30) * 360}deg)`}}>
					<IconRefresh size={48} />
				</div>
				<IconArrow size={44} />
			</div>

			<ResultCard file={IMAGES[ITERATION.to]} label="2-нәтиже" left={580} style={appear(frame, r2)} />
			<Sfx name="shimmer" at={r2} gain={0.6} />

			{/* only one part changes */}
			<Card style={{left: 50, top: 1140, width: 980, height: 120, ...appear(frame, diffAt)}}>
				<div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, height: '100%'}}>
					<div style={{fontFamily: FONT.kk, fontSize: 32, fontWeight: 600, color: C.muted}}>Бір бөлігі ғана:</div>
					<PartPill part={ITERATION.part} size={30} />
					<div style={{fontFamily: FONT.kk, fontSize: 32, fontWeight: 650, color: C.text}}>{ITERATION.note}</div>
				</div>
			</Card>
			<Sfx name="pop" at={diffAt} />
		</>
	);
};
