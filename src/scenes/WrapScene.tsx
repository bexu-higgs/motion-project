import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {IconCheck, IconDownload} from '../components/Icons';
import {Sfx} from '../components/Sfx';
import {ImageSlot, LogoSlot} from '../components/Slots';
import {Chip} from '../components/ui';
import {FINAL_PICK, IMAGES, VARIANTS} from '../config';
import {appear, easeInOut, pop, prog, sec as s} from '../lib/anim';
import {Section, wordFrame} from '../timeline';
import {C, FONT, W} from '../theme';
import {VariantCard} from './PracticeScene';

export const WrapScene: React.FC<{sec: Section}> = ({sec}) => {
	const frame = useCurrentFrame();
	const [l13] = sec.lines;
	const pickIdx = Math.min(Math.max(FINAL_PICK, 1), VARIANTS.length) - 1;
	const compareAt = wordFrame(l13, 'салыстырып') - 6;
	const pickAt = wordFrame(l13, 'ұнаған') - 6;
	const saveAt = wordFrame(l13, 'сақтаңыз') - 4;
	const recapAt = l13.end + s(0.15);
	const logoAt = Math.max(recapAt + s(1.5), sec.duration - s(2.4));

	const pick = prog(frame, pickAt, 22, easeInOut);
	const toRecap = prog(frame, recapAt, 16, easeInOut);
	const toLogo = prog(frame, logoAt, 16, easeInOut);
	/** cards light up one after another while the narrator says "compare" */
	const compareGlow = (i: number) =>
		interpolate(frame - (compareAt + i * 9), [0, 6, 16, 24], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	return (
		<>
			{/* compare -> pick -> save */}
			<div style={{position: 'absolute', inset: 0, opacity: 1 - toRecap}}>
				<div style={{position: 'absolute', top: 290, left: 40, width: 1000, display: 'flex', justifyContent: 'space-between'}}>
					{VARIANTS.map((_, i) => {
						const chosen = i === pickIdx;
						const o = chosen ? 1 : 1 - pick * 0.75;
						const sc = chosen ? 1 + pick * 0.08 : 1 - pick * 0.06;
						const g = compareGlow(i);
						return (
							<div key={i} style={{opacity: o, transform: `scale(${sc})`, transformOrigin: '50% 0%', position: 'relative'}}>
								<VariantCard i={i} />
								<div
									style={{
										position: 'absolute',
										left: -6,
										right: -6,
										top: 53,
										height: 328,
										borderRadius: 30,
										border: `3px solid rgba(127,231,246,${0.9 * g})`,
										boxShadow: `0 0 40px rgba(34,211,238,${0.4 * g})`,
									}}
								/>
								{chosen ? (
									<div
										style={{
											position: 'absolute',
											right: -12,
											top: 40,
											width: 64,
											height: 64,
											borderRadius: 99,
											background: C.gradient,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											color: '#0E0F12',
											transform: `scale(${pop(frame, pickAt + 10)})`,
										}}
									>
										<IconCheck size={40} stroke={3} />
									</div>
								) : null}
							</div>
						);
					})}
				</div>
				<div style={{position: 'absolute', top: 860, width: W, display: 'flex', justifyContent: 'center', gap: 20}}>
					<div style={appear(frame, compareAt)}>
						<Chip style={{fontSize: 34, padding: '14px 28px'}}>Салыстырыңыз</Chip>
					</div>
					<div style={{...appear(frame, saveAt), transform: `${appear(frame, saveAt).transform} scale(${0.9 + 0.1 * pop(frame, saveAt)})`}}>
						<Chip gradient style={{fontSize: 34, padding: '14px 28px'}}>
							<IconDownload size={36} stroke={2.4} /> Сақтаңыз
						</Chip>
					</div>
				</div>
			</div>
			<Sfx name="whoosh-soft" at={compareAt} gain={0.7} />
			<Sfx name="pop" at={pickAt + 10} />
			<Sfx name="success" at={saveAt} />

			{/* recap: the selected image + one-line takeaway */}
			<div style={{position: 'absolute', inset: 0, opacity: toRecap * (1 - toLogo)}}>
				<div
					style={{
						position: 'absolute',
						top: 300,
						width: W,
						display: 'flex',
						justifyContent: 'center',
						transform: `translateY(${(1 - toRecap) * 40}px) scale(${0.94 + 0.06 * toRecap})`,
					}}
				>
					<ImageSlot file={IMAGES[VARIANTS[pickIdx].image]} width={540} height={540} label={`${pickIdx + 1}-нұсқа`} radius={32} />
				</div>
				<div
					style={{
						position: 'absolute',
						top: 960,
						width: W,
						textAlign: 'center',
						fontFamily: FONT.kk,
						fontSize: 78,
						fontWeight: 780,
						letterSpacing: -1.6,
						lineHeight: 1.1,
						color: C.text,
						transform: `translateY(${(1 - toRecap) * 30}px)`,
					}}
				>
					Бір идея ·{' '}
					<span style={{background: C.gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}}>
						бірнеше нұсқа
					</span>
				</div>
			</div>
			<Sfx name="whoosh" at={recapAt} gain={0.6} />

			{/* end card: official logo */}
			<div
				style={{
					position: 'absolute',
					top: 780,
					width: W,
					display: 'flex',
					justifyContent: 'center',
					opacity: toLogo,
					transform: `translateY(${Math.round((1 - toLogo) * 20)}px)`,
				}}
			>
				<LogoSlot maxWidth={640} maxHeight={200} />
			</div>
			<Sfx name="chime" at={logoAt} gain={0.8} />
		</>
	);
};
