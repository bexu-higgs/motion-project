import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {prog} from '../lib/anim';
import {OVERLAP, SectionId, TIMELINE} from '../timeline';
import {C, FONT, SAFE} from '../theme';

const STEPS: {id: SectionId; title: string}[] = [
	{id: 'model', title: 'Image және модель'},
	{id: 'prompt', title: 'Промпт деген не?'},
	{id: 'ad', title: 'Өнім суретінен жарнама'},
	{id: 'iterate', title: 'Жасау және жетілдіру'},
	{id: 'format', title: 'Кадр пішімі мен ажыратымдылық'},
	{id: 'practice', title: 'Практика'},
];

/** Lesson progress bar + current step label ("1-қадам · ..."). */
export const StepHeader: React.FC = () => {
	const frame = useCurrentFrame();
	const secs = STEPS.map((s) => TIMELINE.sections.find((x) => x.id === s.id)!);
	const first = secs[0];
	const last = secs[secs.length - 1];
	const visible = Math.min(
		prog(frame, first.from, 16),
		1 - prog(frame, last.from + last.duration - OVERLAP, OVERLAP),
	);
	if (visible <= 0) return null;
	const active = secs.findIndex((s, i) => {
		const next = secs[i + 1];
		return frame < (next ? next.from + OVERLAP / 2 : Infinity);
	});
	return (
		<div style={{position: 'absolute', left: SAFE.side, right: SAFE.side, top: SAFE.top, opacity: visible}}>
			<div style={{display: 'flex', gap: 10}}>
				{secs.map((s, i) => {
					const fill = interpolate(frame, [s.from, s.from + s.duration - OVERLAP], [0, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					});
					return (
						<div key={s.id} style={{flex: 1, height: 6, borderRadius: 9, background: 'rgba(255,255,255,0.10)', overflow: 'hidden'}}>
							<div
								style={{
									width: `${fill * 100}%`,
									height: '100%',
									background: i === active ? C.gradient : 'rgba(180,156,255,0.55)',
								}}
							/>
						</div>
					);
				})}
			</div>
			<div style={{position: 'relative', height: 70, marginTop: 22}}>
				{STEPS.map((s, i) => {
					const sec = secs[i];
					const pin = prog(frame, sec.from + 4, 14);
					const next = secs[i + 1];
					const pout = next ? prog(frame, next.from, 8) : 0;
					const o = pin * (1 - pout);
					if (o <= 0) return null;
					return (
						<div
							key={s.id}
							style={{
								position: 'absolute',
								left: 0,
								top: 0,
								display: 'flex',
								alignItems: 'center',
								gap: 18,
								opacity: o,
								transform: `translateY(${(1 - pin) * 14 - pout * 10}px)`,
							}}
						>
							<div
								style={{
									padding: '8px 18px',
									borderRadius: 999,
									background: C.gradient,
									color: '#0E0F12',
									fontFamily: FONT.kk,
									fontSize: 28,
									fontWeight: 750,
								}}
							>
								{i + 1}-қадам
							</div>
							<div style={{fontFamily: FONT.kk, fontSize: 38, fontWeight: 650, color: C.text, letterSpacing: -0.4}}>{s.title}</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};
