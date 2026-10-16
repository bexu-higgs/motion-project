import React from 'react';
import {useCurrentFrame} from 'remotion';
import {IconArrow, IconSparkle, IconUpload} from '../components/Icons';
import {partEnds, PromptText} from '../components/PromptCard';
import {Sfx, SfxName} from '../components/Sfx';
import {ImageSlot} from '../components/Slots';
import {Card, Chip} from '../components/ui';
import {DEMO_PROMPT, FINAL_PICK, IMAGES, VARIANTS} from '../config';
import {appear, easeInOut, prog, sec as s} from '../lib/anim';
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
	const after = VARIANTS[Math.min(Math.max(FINAL_PICK, 1), VARIANTS.length) - 1].image;

	const typing: React.ReactNode[] = [];
	for (let c = 3, n = 0; c < totalChars; c += 3, n++) {
		typing.push(<Sfx key={c} name={`type-${(n % 4) + 1}` as SfxName} at={typeStart + c / CPF} gain={0.8 + ((n * 7) % 5) * 0.06} />);
	}

	return (
		<>
			{/* Phase A: simple product photo -> professional ad (both real images) */}
			<div
				style={{
					position: 'absolute',
					top: 480,
					width: W,
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					gap: 22,
					opacity: 1 - morph,
					transform: `translateY(${-morph * 30}px)`,
				}}
			>
				<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, ...appear(frame, l07.start + 4)}}>
					<ImageSlot file={IMAGES.reference} width={430} height={430} label="Бастапқы сурет" />
					<Chip style={{fontSize: 30}}>
						<IconUpload size={32} /> Бастапқы сурет
					</Chip>
				</div>
				<div style={{color: C.cyanSoft, marginBottom: 70, ...appear(frame, l07.start + 30)}}>
					<IconArrow size={60} />
				</div>
				<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, ...appear(frame, l07.start + 40)}}>
					<div style={{borderRadius: 30, boxShadow: '0 0 70px rgba(139,92,246,0.35)'}}>
						<ImageSlot file={IMAGES[after]} width={430} height={430} label="Кәсіби жарнама" />
					</div>
					<Chip gradient style={{fontSize: 30}}>
						<IconSparkle size={32} stroke={2} /> Кәсіби жарнама
					</Chip>
				</div>
			</div>
			<Sfx name="whoosh-soft" at={l07.start + 4} />
			<Sfx name="shimmer" at={l07.start + 40} gain={0.6} />

			{/* Phase B: an example prompt, typed and decoded */}
			<Card style={{left: 50, top: 300, width: 980, height: 860, opacity: morph, transform: `translateY(${(1 - morph) * 40}px)`}}>
				<div style={{padding: '36px 44px'}}>
					<div style={{display: 'flex', alignItems: 'center', gap: 22, marginBottom: 30}}>
						<ImageSlot file={IMAGES.reference} width={110} height={110} radius={20} />
						<IconArrow size={40} color={C.faint} />
						<Chip gradient style={{fontSize: 30}}>
							Мысал промпт
						</Chip>
					</div>
					<PromptText parts={DEMO_PROMPT} typeStart={typeStart} charsPerFrame={CPF} fontSize={46} />
				</div>
			</Card>
			{typing}
			<Sfx name="shimmer" at={typeEnd + 4} gain={0.55} />
		</>
	);
};
