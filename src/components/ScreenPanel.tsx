import React from 'react';
import {Freeze, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import type {Callout, FocusKey, Rect, RecordingSlot, Segment} from '../config';
import {hasFile} from '../lib/assets';
import {easeInOut, prog} from '../lib/anim';
import {C, FONT, FPS} from '../theme';
import {IconFilm} from './Icons';
import {Sfx} from './Sfx';

type Props = {
	slot: RecordingSlot;
	width: number;
	height: number;
	style?: React.CSSProperties;
	/** frame (relative to the parent sequence) at which playback starts */
	startAt?: number;
	/** frames the placeholder progress bar spans (purely informative) */
	planned?: number;
};

const isStill = (file: string) => /\.(png|jpe?g|webp)$/i.test(file);
/** Screenshots ignore `segments`: their timeline is simply the scene's. */
const segmentsOf = (slot: RecordingSlot): Segment[] =>
	(!isStill(slot.file) && slot.segments) || [{start: 0, end: 3600}];

/** Output seconds -> source seconds. Past the last segment the last frame is held. */
function toSource(segs: Segment[], t: number): number {
	let out = 0;
	for (const s of segs) {
		const len = (s.end - s.start) / (s.rate ?? 1);
		if (t < out + len) return s.start + (t - out) * (s.rate ?? 1);
		out += len;
	}
	return segs[segs.length - 1].end;
}

/** Source seconds -> output seconds (null if that moment was cut out). */
function toOutput(segs: Segment[], src: number): number | null {
	let out = 0;
	for (const s of segs) {
		if (src >= s.start && src <= s.end) return out + (src - s.start) / (s.rate ?? 1);
		out += (s.end - s.start) / (s.rate ?? 1);
	}
	return null;
}

function focusAt(keys: FocusKey[] | undefined, size: [number, number], src: number): Rect {
	const full = {x: 0, y: 0, w: size[0], h: size[1]};
	if (!keys || keys.length === 0) return full;
	if (src <= keys[0].at) return keys[0];
	for (let i = 0; i < keys.length - 1; i++) {
		const a = keys[i];
		const b = keys[i + 1];
		if (src <= b.at) {
			const t = easeInOut((src - a.at) / Math.max(0.001, b.at - a.at));
			return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t};
		}
	}
	return keys[keys.length - 1];
}

/**
 * A real screen recording inside a rounded panel, with camera moves (focus) and
 * callouts that stay locked to UI elements while zooming. Missing file -> placeholder.
 */
export const ScreenPanel: React.FC<Props> = ({slot, width, height, style, startAt = 0, planned = 240}) => {
	const frame = useCurrentFrame();
	const exists = hasFile(slot.file);
	const frameStyle: React.CSSProperties = {
		position: 'absolute',
		width,
		height,
		borderRadius: 34,
		overflow: 'hidden',
		background: '#0A0B0D',
		border: `1px solid ${C.borderStrong}`,
		boxShadow: '0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(139,92,246,0.10), 0 0 80px rgba(139,92,246,0.10)',
		...style,
	};

	if (!exists) return <Placeholder slot={slot} width={width} height={height} style={frameStyle} planned={planned} />;

	const segs = segmentsOf(slot);
	const t = Math.max(0, (frame - startAt) / FPS);
	const src = toSource(segs, t);
	const [sw, sh] = slot.size;
	const r = focusAt(slot.focus, slot.size, src);
	const k = Math.min(width / r.w, height / r.h);
	const clampAxis = (offset: number, scaled: number, box: number) =>
		scaled >= box ? Math.min(0, Math.max(box - scaled, offset)) : (box - scaled) / 2;
	const vx = clampAxis(width / 2 - k * (r.x + r.w / 2), k * sw, width);
	const vy = clampAxis(height / 2 - k * (r.y + r.h / 2), k * sh, height);
	const callouts = (slot.callouts ?? []).map((c, i) => (
		<CalloutMark key={i} c={c} k={k} vx={vx} vy={vy} segs={segs} startAt={startAt} />
	));

	if (isStill(slot.file)) {
		return (
			<div style={frameStyle}>
				<div style={{position: 'absolute', left: vx, top: vy, width: k * sw, height: k * sh}}>
					<Img src={staticFile(slot.file)} style={{width: '100%', height: '100%', display: 'block'}} />
				</div>
				{callouts}
			</div>
		);
	}

	let out = startAt;
	const clips = segs.map((s, i) => {
		const len = Math.round(((s.end - s.start) / (s.rate ?? 1)) * FPS);
		const from = out;
		out += len;
		return (
			<Sequence key={i} from={from} durationInFrames={len} layout="none">
				<OffthreadVideo
					src={staticFile(slot.file)}
					startFrom={Math.round(s.start * FPS)}
					playbackRate={s.rate ?? 1}
					muted
					style={{width: '100%', height: '100%'}}
				/>
			</Sequence>
		);
	});
	const last = segs[segs.length - 1];
	const first = segs[0];

	return (
		<div style={frameStyle}>
			<div style={{position: 'absolute', left: vx, top: vy, width: k * sw, height: k * sh}}>
				{frame < startAt ? (
					<Freeze frame={0}>
						<OffthreadVideo src={staticFile(slot.file)} startFrom={Math.round(first.start * FPS)} muted style={{width: '100%', height: '100%'}} />
					</Freeze>
				) : null}
				{clips}
				{frame >= out ? (
					<Freeze frame={0}>
						<OffthreadVideo
							src={staticFile(slot.file)}
							startFrom={Math.max(0, Math.round(last.end * FPS) - 1)}
							muted
							style={{width: '100%', height: '100%'}}
						/>
					</Freeze>
				) : null}
			</div>
			{callouts}
		</div>
	);
};

const CalloutMark: React.FC<{c: Callout; k: number; vx: number; vy: number; segs: Segment[]; startAt: number}> = ({
	c,
	k,
	vx,
	vy,
	segs,
	startAt,
}) => {
	const frame = useCurrentFrame();
	const a = toOutput(segs, c.from);
	const b = toOutput(segs, c.to) ?? (a === null ? null : a + (c.to - c.from));
	if (a === null || b === null) return null;
	const fa = startAt + a * FPS;
	const fb = startAt + b * FPS;
	const pin = prog(frame, fa - 4, 12);
	const pout = prog(frame, fb - 8, 8, easeInOut);
	const o = pin * (1 - pout);
	const pad = 10;
	const x = vx + k * c.x - pad;
	const y = vy + k * c.y - pad;
	const w = k * c.w + pad * 2;
	const h = k * c.h + pad * 2;
	const ripple = c.click ? interpolate(frame, [fa, fa + 18], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
	const labelAbove = y > 90;
	return (
		<>
			{c.click ? <Sfx name="click" at={fa} /> : null}
			<div
				style={{
					position: 'absolute',
					left: x,
					top: y,
					width: w,
					height: h,
					borderRadius: 16,
					border: `3px solid ${C.cyan}`,
					boxShadow: `0 0 0 6px rgba(34,211,238,0.16), 0 0 40px rgba(34,211,238,0.45)`,
					opacity: o,
					transform: `scale(${1.06 - 0.06 * pin})`,
				}}
			/>
			{c.click && ripple > 0 && ripple < 1 ? (
				<div
					style={{
						position: 'absolute',
						left: x + w / 2 - 70,
						top: y + h / 2 - 70,
						width: 140,
						height: 140,
						borderRadius: 999,
						border: `4px solid ${C.cyanSoft}`,
						opacity: 1 - ripple,
						transform: `scale(${0.2 + ripple})`,
					}}
				/>
			) : null}
			{c.label ? (
				<div
					style={{
						position: 'absolute',
						left: Math.max(16, x),
						top: labelAbove ? y - 64 : y + h + 12,
						padding: '8px 18px',
						borderRadius: 14,
						background: C.cyan,
						color: '#06181C',
						fontFamily: FONT.en,
						fontSize: 30,
						fontWeight: 700,
						opacity: o,
						whiteSpace: 'nowrap',
					}}
				>
					{c.label}
				</div>
			) : null}
		</>
	);
};

const Placeholder: React.FC<{slot: RecordingSlot; width: number; height: number; style: React.CSSProperties; planned: number}> = ({
	slot,
	width,
	height,
	style,
	planned,
}) => {
	const frame = useCurrentFrame();
	const compact = height < 480;
	return (
		<div style={{...style, background: 'repeating-linear-gradient(135deg, #111216 0 22px, #14151a 22px 44px)'}}>
			<div
				style={{
					position: 'absolute',
					inset: 14,
					borderRadius: 24,
					border: `3px dashed rgba(127,231,246,0.35)`,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: compact ? 10 : 18,
					padding: 30,
					textAlign: 'center',
				}}
			>
				{!compact ? <IconFilm size={84} color={C.cyanSoft} stroke={1.6} /> : null}
				<div style={{fontFamily: FONT.kk, fontSize: compact ? 36 : 44, fontWeight: 700, color: C.text}}>{slot.slotTitle}</div>
				<div style={{fontFamily: FONT.en, fontSize: compact ? 24 : 28, color: C.muted, maxWidth: width - 120, lineHeight: 1.35}}>
					{slot.shot}
				</div>
				<div
					style={{
						fontFamily: 'ui-monospace, Menlo, monospace',
						fontSize: compact ? 20 : 24,
						color: C.cyanSoft,
						opacity: 0.85,
					}}
				>
					public/{slot.file}
				</div>
			</div>
			<div style={{position: 'absolute', left: 40, right: 40, bottom: 34, height: 6, borderRadius: 9, background: 'rgba(255,255,255,0.08)'}}>
				<div
					style={{
						width: `${Math.min(100, (frame / planned) * 100)}%`,
						height: '100%',
						borderRadius: 9,
						background: C.gradient,
					}}
				/>
			</div>
			<div
				style={{
					position: 'absolute',
					top: 30,
					right: 34,
					fontFamily: FONT.en,
					fontSize: 20,
					fontWeight: 700,
					letterSpacing: 2,
					color: '#0E0F12',
					background: C.cyanSoft,
					padding: '6px 12px',
					borderRadius: 8,
				}}
			>
				PLACEHOLDER
			</div>
		</div>
	);
};
