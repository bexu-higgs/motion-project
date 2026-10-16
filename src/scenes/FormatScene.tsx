import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {IconBanner, IconGrid, IconPhone} from '../components/Icons';
import {ScreenPanel} from '../components/ScreenPanel';
import {Sfx} from '../components/Sfx';
import {Card} from '../components/ui';
import {RATIO_LABELS, RECORDINGS, RESOLUTION_LABELS} from '../config';
import {appear, easeInOut, prog} from '../lib/anim';
import {Section, wordFrame} from '../timeline';
import {C, FONT} from '../theme';

/** Rectangle that breathes between square, vertical and horizontal: "shape". */
const ShapeMorph: React.FC = () => {
	const frame = useCurrentFrame();
	const shapes = [
		[180, 180],
		[124, 220],
		[240, 135],
	];
	const cycle = 54;
	const i = Math.floor(frame / cycle) % 3;
	const t = easeInOut(Math.min(1, (frame % cycle) / 18));
	const [aw, ah] = shapes[i];
	const [bw, bh] = shapes[(i + 1) % 3];
	const w = aw + (bw - aw) * t;
	const h = ah + (bh - ah) * t;
	return (
		<div style={{width: 260, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
			<div
				style={{
					width: w,
					height: h,
					borderRadius: 16,
					border: `4px solid ${C.purpleSoft}`,
					background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(34,211,238,0.12))',
					boxShadow: '0 0 40px rgba(139,92,246,0.3)',
				}}
			/>
		</div>
	);
};

/** A shape rendered at low then high detail: "detail". */
const DetailDemo: React.FC<{start: number}> = ({start}) => {
	const frame = useCurrentFrame();
	const sharp = prog(frame, start + 20, 30, easeInOut);
	const grid = 12;
	const cells = [];
	for (let y = 0; y < grid; y++) {
		for (let x = 0; x < grid; x++) {
			const cx = (x + 0.5) / grid - 0.5;
			const cy = (y + 0.5) / grid - 0.5;
			const inside = cx * cx + cy * cy < 0.16;
			if (inside)
				cells.push(
					<div
						key={`${x}-${y}`}
						style={{position: 'absolute', left: x * 18, top: y * 18, width: 18, height: 18, background: y < grid / 2 ? '#B49CFF' : '#7FE7F6'}}
					/>,
				);
		}
	}
	return (
		<div style={{position: 'relative', width: 216, height: 216, margin: 12}}>
			<div style={{position: 'absolute', inset: 0, opacity: 1 - sharp}}>{cells}</div>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					borderRadius: 999,
					transform: 'scale(0.8)',
					background: 'linear-gradient(180deg, #B49CFF 0%, #B49CFF 50%, #7FE7F6 50%, #7FE7F6 100%)',
					opacity: sharp,
					boxShadow: '0 0 40px rgba(127,231,246,0.35)',
				}}
			/>
			{RESOLUTION_LABELS ? (
				<div
					style={{
						position: 'absolute',
						right: -6,
						bottom: -6,
						fontFamily: FONT.en,
						fontSize: 26,
						fontWeight: 700,
						color: '#0E0F12',
						background: C.cyanSoft,
						borderRadius: 10,
						padding: '4px 10px',
					}}
				>
					{sharp < 0.5 ? RESOLUTION_LABELS[0] : RESOLUTION_LABELS[1]}
				</div>
			) : null}
		</div>
	);
};

const FORMATS = [
	{key: 'square', kk: 'Шаршы', use: 'Пост', Icon: IconGrid, w: 190, h: 190, word: 'Шаршы'},
	{key: 'vertical', kk: 'Тік', use: 'Сторис', Icon: IconPhone, w: 132, h: 234, word: 'тік'},
	{key: 'horizontal', kk: 'Көлденең', use: 'Баннер', Icon: IconBanner, w: 260, h: 146, word: 'көлденең'},
] as const;

export const FormatScene: React.FC<{sec: Section}> = ({sec}) => {
	const frame = useCurrentFrame();
	const [l10, l11] = sec.lines;
	const shapeAt = wordFrame(l10, 'Кадр') - 4;
	const detailAt = wordFrame(l10, 'ажыратымдылық') - 4;
	const swap = l11.start - 10;
	const tile = (left: number, at: number, title: string, result: string, child: React.ReactNode) => (
		<Card style={{left, top: 850, width: 470, height: 470, ...appear(frame, at, {end: swap})}}>
			<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px', gap: 6}}>
				<div style={{fontFamily: FONT.kk, fontSize: 38, fontWeight: 700, color: C.text}}>{title}</div>
				{child}
				<div style={{fontFamily: FONT.kk, fontSize: 40, fontWeight: 700, color: C.cyanSoft}}>{result}</div>
			</div>
		</Card>
	);
	return (
		<>
			<ScreenPanel slot={RECORDINGS.format} width={1000} height={520} planned={sec.duration} style={{left: 40, top: 290}} />

			{tile(60, shapeAt, 'Кадр пішімі', '→ форма', <ShapeMorph />)}
			{tile(550, detailAt, 'Ажыратымдылық', '→ деталь', <DetailDemo start={detailAt} />)}
			<Sfx name="pop" at={shapeAt} />
			<Sfx name="pop" at={detailAt} />

			{FORMATS.map((f, i) => {
				const at = Math.max(swap + 6 + i * 4, wordFrame(l11, f.word) - 8);
				const lit = interpolate(frame, [at, at + 10], [0.4, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
				const ratio = RATIO_LABELS[f.key];
				return (
					<React.Fragment key={f.key}>
						<Card glow={frame >= at && frame < at + 40 ? 1 : 0} style={{left: 60 + i * 325, top: 850, width: 310, height: 470, ...appear(frame, swap + 6 + i * 4)}}>
							<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', padding: '26px 0', opacity: lit}}>
								<div style={{height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
									<div
										style={{
											width: f.w,
											height: f.h,
											borderRadius: 14,
											border: `4px solid ${C.purpleSoft}`,
											background: 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(34,211,238,0.10))',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											color: C.text,
										}}
									>
										<f.Icon size={54} stroke={1.8} />
									</div>
								</div>
								<div style={{fontFamily: FONT.kk, fontSize: 40, fontWeight: 720, color: C.text, marginTop: 14}}>{f.kk}</div>
								<div style={{fontFamily: FONT.kk, fontSize: 32, fontWeight: 600, color: C.cyanSoft, marginTop: 4}}>{f.use}</div>
								{ratio ? (
									<div style={{fontFamily: FONT.en, fontSize: 26, color: C.muted, marginTop: 6, fontWeight: 600}}>{ratio}</div>
								) : null}
							</div>
						</Card>
						<Sfx name="pop" at={at} />
					</React.Fragment>
				);
			})}
		</>
	);
};
