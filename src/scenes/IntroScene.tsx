import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Sfx} from '../components/Sfx';
import {LogoSlot} from '../components/Slots';
import {Chip} from '../components/ui';
import {appear, prog} from '../lib/anim';
import type {Section} from '../timeline';
import {C, FONT, W} from '../theme';

/** Floating frames (square / vertical / horizontal) foreshadow the aspect-ratio lesson. */
const Frames: React.FC = () => {
	const frame = useCurrentFrame();
	const items = [
		{x: 110, y: 330, w: 190, h: 190, d: 0},
		{x: 820, y: 280, w: 150, h: 266, d: 1.7},
		{x: 700, y: 1240, w: 290, h: 163, d: 3.1},
		{x: 120, y: 1180, w: 120, h: 213, d: 4.4},
	];
	return (
		<>
			{items.map((it, i) => {
				const o = prog(frame, 8 + i * 6, 30) * 0.5;
				const fy = Math.sin(frame / 40 + it.d) * 14;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: it.x,
							top: it.y + fy,
							width: it.w,
							height: it.h,
							borderRadius: 22,
							border: '2px solid rgba(180,156,255,0.35)',
							background: 'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(34,211,238,0.06))',
							opacity: o,
							transform: `rotate(${(i % 2 ? -1 : 1) * 6}deg)`,
						}}
					/>
				);
			})}
		</>
	);
};

export const IntroScene: React.FC<{sec: Section}> = () => {
	const frame = useCurrentFrame();
	const logo = prog(frame, 4, 26);
	const words: {t: string; grad?: boolean; br?: boolean}[] = [
		{t: 'AI', grad: true},
		{t: 'сурет'},
		{t: 'жасаудың', br: true},
		{t: 'негіздері'},
	];
	return (
		<>
			<Sfx name="chime" at={3} />
			<Sfx name="whoosh-soft" at={24} />
			<Frames />
			<div
				style={{
					position: 'absolute',
					top: 520,
					width: W,
					display: 'flex',
					justifyContent: 'center',
					opacity: logo,
					transform: `translateY(${Math.round((1 - logo) * 24)}px)`,
				}}
			>
				<LogoSlot maxWidth={620} maxHeight={190} />
			</div>
			<div style={{position: 'absolute', top: 810, width: W, display: 'flex', justifyContent: 'center', ...appear(frame, 22)}}>
				<Chip>Бастаушыларға арналған сабақ</Chip>
			</div>
			<div
				style={{
					position: 'absolute',
					top: 900,
					width: W,
					textAlign: 'center',
					fontFamily: FONT.kk,
					fontSize: 104,
					fontWeight: 760,
					lineHeight: 1.06,
					letterSpacing: -2.5,
					color: C.text,
				}}
			>
				{words.map((w, i) => (
					<React.Fragment key={i}>
						<span
							style={{
								display: 'inline-block',
								marginRight: w.br ? 0 : 26,
								...appear(frame, 28 + i * 5, {y: 40, dur: 20}),
								...(w.grad
									? {background: C.gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}
									: null),
							}}
						>
							{w.t}
						</span>
						{w.br ? <br /> : null}
					</React.Fragment>
				))}
			</div>
			<div
				style={{
					position: 'absolute',
					top: 1150,
					width: W,
					textAlign: 'center',
					fontFamily: FONT.en,
					fontSize: 36,
					fontWeight: 500,
					letterSpacing: 1,
					color: C.muted,
					...appear(frame, 52),
				}}
			>
				AI Image Generation Basics
			</div>
		</>
	);
};
