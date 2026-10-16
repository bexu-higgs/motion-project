import React from 'react';
import {Img, staticFile} from 'remotion';
import {LOGO_FILES} from '../config';
import {firstExisting, hasFile} from '../lib/assets';
import {C, FONT} from '../theme';
import {IconPhoto} from './Icons';

/** A generated image (or the reference photo). Missing file -> labelled placeholder. */
export const ImageSlot: React.FC<{
	file: string;
	width: number;
	height: number;
	label?: string;
	radius?: number;
	style?: React.CSSProperties;
}> = ({file, width, height, label, radius = 26, style}) => {
	const exists = hasFile(file);
	const base: React.CSSProperties = {
		position: 'relative',
		width,
		height,
		borderRadius: radius,
		overflow: 'hidden',
		background: '#0B0C0F',
		border: `1px solid ${C.borderStrong}`,
		boxShadow: '0 26px 70px rgba(0,0,0,0.45)',
		flexShrink: 0,
		...style,
	};
	if (exists) {
		const src = staticFile(file);
		return (
			<div style={base}>
				{/* blurred fill so any aspect ratio sits nicely, the image itself is never cropped */}
				<Img src={src} style={{position: 'absolute', inset: -40, width: width + 80, height: height + 80, objectFit: 'cover', filter: 'blur(28px) brightness(0.55)'}} />
				<Img src={src} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain'}} />
			</div>
		);
	}
	const small = width < 260;
	return (
		<div style={{...base, background: 'repeating-linear-gradient(135deg, #111216 0 18px, #15161b 18px 36px)'}}>
			<div
				style={{
					position: 'absolute',
					inset: 10,
					borderRadius: radius - 8,
					border: '2px dashed rgba(180,156,255,0.4)',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 10,
					textAlign: 'center',
					padding: 12,
				}}
			>
				<IconPhoto size={small ? 40 : 60} color={C.purpleSoft} stroke={1.6} />
				{label ? (
					<div style={{fontFamily: FONT.kk, fontSize: small ? 22 : 28, fontWeight: 650, color: C.text, lineHeight: 1.2}}>{label}</div>
				) : null}
				<div style={{fontFamily: 'ui-monospace, Menlo, monospace', fontSize: small ? 15 : 18, color: C.purpleSoft, wordBreak: 'break-all'}}>
					{file}
				</div>
			</div>
		</div>
	);
};

/**
 * The official Higgsfield logo file, displayed as-is (never redrawn, recoloured or
 * distorted). A file with a solid black background (like the supplied JPG) sits on
 * a black plate, so its own background blends into the plate with no visible edge.
 */
export const LogoSlot: React.FC<{maxWidth: number; maxHeight: number; style?: React.CSSProperties}> = ({maxWidth, maxHeight, style}) => {
	const file = firstExisting(LOGO_FILES);
	if (file) {
		const img = (
			<Img
				src={staticFile(file)}
				style={{maxWidth, maxHeight, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block'}}
			/>
		);
		if (!/\.jpe?g$/i.test(file)) return <div style={style}>{img}</div>;
		return (
			<div
				style={{
					background: '#000',
					borderRadius: 36,
					padding: '18px 34px',
					border: '1px solid rgba(255,255,255,0.10)',
					boxShadow: '0 30px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.6)',
					...style,
				}}
			>
				{img}
			</div>
		);
	}
	return (
		<div
			style={{
				width: Math.min(maxWidth, 560),
				height: Math.min(maxHeight, 150),
				borderRadius: 24,
				border: '3px dashed rgba(255,255,255,0.35)',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 6,
				...style,
			}}
		>
			<div style={{fontFamily: FONT.en, fontSize: 30, fontWeight: 700, letterSpacing: 4, color: C.text}}>OFFICIAL LOGO</div>
			<div style={{fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 20, color: C.muted}}>public/brand/higgsfield-logo.svg</div>
		</div>
	);
};
