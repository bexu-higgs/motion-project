import React from 'react';
import {useCurrentFrame} from 'remotion';
import {IconArrow, IconSparkle, IconUpload} from '../components/Icons';
import {partEnds, PromptText} from '../components/PromptCard';
import {ScreenPanel} from '../components/ScreenPanel';
import {Sfx, SfxName} from '../components/Sfx';
import {ImageSlot} from '../components/Slots';
import {Card, Chip} from '../components/ui';
import {DEMO_PROMPT, IMAGES, RECORDINGS} from '../config';
import {appear, easeInOut, lerp, prog, sec as s} from '../lib/anim';
import type {Section} from '../timeline';
import {C, W} from '../theme';

const CPF = 1.5; // typed characters per frame (45 / s)

export const AdScene: React.FC<{sec: Section}> = ({sec}) => {
	const frame = useCurrentFrame();
	const [l07, l08] = sec.lines;
	const typeStart = l08.start - s(0.2);
	const morph = prog(frame, typeStart - 16, 22, easeInOut);
	const ends = partEnds(DEMO_PROMPT);
	const totalChars = ends[ends.length - 1];
	const typeEnd = typeStart + totalChars / CPF;

	const typing: React.ReactNode[] = [];
	for (let c = 3, n = 0; c < totalChars; c += 3, n++) {
		typing.push(<Sfx key={c} name={`type-${(n % 4) + 1}` as SfxName} at={typeStart + c / CPF} gain={0.8 + ((n * 7) % 5) * 0.06} />);
	}

	return (
		<>
			<ScreenPanel
				slot={RECORDINGS.upload}
				width={1000}
				height={600}
				planned={sec.duration}
				style={{left: 40, top: 290, transform: `scale(${lerp(1, 0.62, morph)})`, transformOrigin: '50% 0%'}}
			/>

			{/* Phase A: simple product photo -> professional ad */}
			<div
				style={{
					position: 'absolute',
					top: 930,
					width: W,
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					gap: 34,
					opacity: 1 - morph,
				}}
			>
				<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, ...appear(frame, l07.start + 4)}}>
					<ImageSlot file={IMAGES.reference} width={290} height={290} label="Өнім суреті" />
					<Chip style={{fontSize: 28}}>
						<IconUpload size={30} /> Бастапқы сурет
					</Chip>
				</div>
				<div style={{color: C.cyanSoft, ...appear(frame, l07.start + 30)}}>
					<IconArrow size={64} />
				</div>
				<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, ...appear(frame, l07.start + 40)}}>
					<div
						style={{
							width: 290,
							height: 290,
							borderRadius: 26,
							background: 'radial-gradient(circle at 50% 40%, rgba(139,92,246,0.35), rgba(34,211,238,0.10) 60%, rgba(255,255,255,0.02))',
							border: '2px solid rgba(180,156,255,0.45)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							color: C.text,
							boxShadow: '0 0 60px rgba(139,92,246,0.25)',
						}}
					>
						<IconSparkle size={110} stroke={1.4} />
					</div>
					<Chip gradient style={{fontSize: 28}}>
						Кәсіби жарнама
					</Chip>
				</div>
			</div>
			<Sfx name="whoosh-soft" at={l07.start + 4} />
			<Sfx name="pop" at={l07.start + 40} />

			{/* Phase B: the demo prompt, typed and decoded */}
			<Card style={{left: 50, top: 690, width: 980, height: 640, opacity: morph, transform: `translateY(${(1 - morph) * 40}px)`}}>
				<div style={{padding: '30px 40px'}}>
					<div style={{marginBottom: 20}}>
						<Chip gradient style={{fontSize: 28}}>
							Негізгі промпт
						</Chip>
					</div>
					<PromptText parts={DEMO_PROMPT} typeStart={typeStart} charsPerFrame={CPF} fontSize={37} />
				</div>
			</Card>
			{typing}
			<Sfx name="shimmer" at={typeEnd + 4} gain={0.55} />
		</>
	);
};
