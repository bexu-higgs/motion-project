import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {ALL_LINES} from '../timeline';
import {C, FONT, SAFE, W} from '../theme';

const HOLD = 8; // frames a phrase stays after the voice stops
const FADE = 6;

/** Kazakh narration captions: one phrase at a time, words brighten as they are spoken. */
export const Captions: React.FC = () => {
	const frame = useCurrentFrame();
	const phrases = ALL_LINES.flatMap((l) => l.phrases);
	const idx = phrases.findIndex((p, i) => {
		const next = phrases[i + 1];
		const end = next && next.start - p.end < HOLD ? next.start : p.end + HOLD;
		return frame >= p.start - 2 && frame < end;
	});
	if (idx < 0) return null;
	const p = phrases[idx];
	const next = phrases[idx + 1];
	const continuous = next && next.start - p.end < HOLD;
	const prev = phrases[idx - 1];
	const fromPrev = prev && p.start - prev.end < HOLD;
	const end = continuous ? next.start : p.end + HOLD;
	const opacity = Math.min(
		fromPrev ? 1 : interpolate(frame, [p.start - 2, p.start + FADE], [0, 1], {extrapolateRight: 'clamp'}),
		continuous ? 1 : interpolate(frame, [end - FADE, end], [1, 0], {extrapolateLeft: 'clamp'}),
	);
	const enter = interpolate(frame, [p.start - 2, p.start + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	const words = p.text.split(' ');
	const total = p.text.length;
	let acc = 0;
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				width: W,
				bottom: SAFE.captionBottom,
				display: 'flex',
				justifyContent: 'center',
				opacity,
			}}
		>
			<div
				style={{
					maxWidth: 880,
					padding: '18px 30px 20px',
					borderRadius: 28,
					background: 'rgba(12,13,16,0.72)',
					border: `1px solid ${C.border}`,
					boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
					fontFamily: FONT.kk,
					fontSize: 48,
					fontWeight: 600,
					lineHeight: 1.28,
					letterSpacing: -0.3,
					color: C.text,
					textAlign: 'center',
					transform: `translateY(${(1 - enter) * 10}px)`,
				}}
			>
				{words.map((w, i) => {
					const at = p.start + ((p.end - p.start) * acc) / total;
					acc += w.length + 1;
					const lit = interpolate(frame, [at - 3, at + 3], [0.5, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					});
					return (
						<span key={i} style={{opacity: lit}}>
							{w}
							{i < words.length - 1 ? ' ' : ''}
						</span>
					);
				})}
			</div>
		</div>
	);
};
