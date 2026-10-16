import React from 'react';
import {useCurrentFrame} from 'remotion';
import {IconSparkle} from '../components/Icons';
import {Sfx} from '../components/Sfx';
import {ImageSlot} from '../components/Slots';
import {Chip} from '../components/ui';
import {IMAGES, VARIANTS} from '../config';
import {appear, pop} from '../lib/anim';
import {Section, wordFrame} from '../timeline';
import {C, FONT, W} from '../theme';

export const VariantCard: React.FC<{i: number; width?: number}> = ({i, width = 316}) => {
	const v = VARIANTS[i];
	return (
		<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width}}>
			<div style={{fontFamily: FONT.kk, fontSize: width > 250 ? 36 : 28, fontWeight: 750, color: C.text}}>{i + 1}-нұсқа</div>
			<ImageSlot file={IMAGES[v.image]} width={width} height={width} label={`${i + 1}-нұсқа`} />
			<div style={{fontFamily: FONT.kk, fontSize: width > 250 ? 25 : 21, fontWeight: 550, color: C.muted, textAlign: 'center', lineHeight: 1.3}}>
				{v.note}
			</div>
		</div>
	);
};

export const PracticeScene: React.FC<{sec: Section}> = ({sec}) => {
	const frame = useCurrentFrame();
	const [l12] = sec.lines;
	const at = [wordFrame(l12, 'фон') - 6, wordFrame(l12, 'жарықты') - 6, wordFrame(l12, 'бірнеше') - 4];
	const promptAt = wordFrame(l12, 'негізгі') - 6;
	return (
		<>
			<div
				style={{
					position: 'absolute',
					top: 290,
					width: W,
					textAlign: 'center',
					fontFamily: FONT.kk,
					fontSize: 60,
					fontWeight: 760,
					letterSpacing: -1,
					color: C.text,
					...appear(frame, 4),
				}}
			>
				Бір өнім ·{' '}
				<span style={{background: C.gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}}>
					бір промпт
				</span>
			</div>

			<div style={{position: 'absolute', top: 400, width: W, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22}}>
				<div style={appear(frame, l12.start)}>
					<ImageSlot file={IMAGES.reference} width={120} height={120} radius={20} />
				</div>
				<div style={{fontFamily: FONT.en, fontSize: 48, color: C.faint, ...appear(frame, promptAt)}}>+</div>
				<div style={appear(frame, promptAt)}>
					<Chip gradient style={{fontSize: 32, padding: '14px 28px'}}>
						<IconSparkle size={34} stroke={2} /> Негізгі промпт
					</Chip>
				</div>
			</div>
			<Sfx name="pop" at={l12.start} />
			<Sfx name="pop" at={promptAt} />

			<div style={{position: 'absolute', top: 600, left: 40, width: 1000, display: 'flex', justifyContent: 'space-between'}}>
				{VARIANTS.map((_, i) => {
					const p = pop(frame, at[i]);
					return (
						<div key={i} style={{transform: `translateY(${(1 - p) * 60}px) scale(${0.9 + 0.1 * p})`, opacity: Math.min(1, p * 1.6)}}>
							<VariantCard i={i} />
						</div>
					);
				})}
			</div>
			{at.map((a, i) => (
				<Sfx key={i} name="shimmer" at={a} gain={0.45} />
			))}

			<div
				style={{
					position: 'absolute',
					top: 1150,
					width: W,
					textAlign: 'center',
					fontFamily: FONT.kk,
					fontSize: 34,
					fontWeight: 600,
					color: C.muted,
					...appear(frame, at[2] + 24),
				}}
			>
				Бір уақытта тек <span style={{color: C.cyanSoft}}>бір элементті</span> өзгертіңіз
			</div>
		</>
	);
};
