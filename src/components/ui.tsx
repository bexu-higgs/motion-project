import React from 'react';
import {C, FONT, PART, PartId} from '../theme';

export const Card: React.FC<{style?: React.CSSProperties; children?: React.ReactNode; glow?: number}> = ({
	style,
	children,
	glow = 0,
}) => (
	<div
		style={{
			position: 'absolute',
			borderRadius: 30,
			background: `linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.03))`,
			border: `1px solid ${glow > 0 ? `rgba(180,156,255,${0.18 + 0.5 * glow})` : C.border}`,
			boxShadow: `0 24px 60px rgba(0,0,0,0.35)${glow > 0 ? `, 0 0 ${40 * glow}px rgba(139,92,246,${0.35 * glow})` : ''}`,
			...style,
		}}
	>
		{children}
	</div>
);

export const Chip: React.FC<{children: React.ReactNode; style?: React.CSSProperties; gradient?: boolean}> = ({
	children,
	style,
	gradient,
}) => (
	<div
		style={{
			display: 'inline-flex',
			alignItems: 'center',
			gap: 12,
			padding: '10px 22px',
			borderRadius: 999,
			fontFamily: FONT.kk,
			fontSize: 30,
			fontWeight: 600,
			color: gradient ? '#0E0F12' : C.text,
			background: gradient ? C.gradient : C.surfaceStrong,
			border: gradient ? 'none' : `1px solid ${C.border}`,
			whiteSpace: 'nowrap',
			...style,
		}}
	>
		{children}
	</div>
);

/** A coloured prompt-component pill (Нысан, Фон, Жарық, Композиция, Стиль). */
export const PartPill: React.FC<{part: PartId; size?: number; style?: React.CSSProperties; dim?: boolean}> = ({
	part,
	size = 40,
	style,
	dim,
}) => {
	const {kk, color} = PART[part];
	return (
		<div
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: size * 0.32,
				padding: `${size * 0.32}px ${size * 0.62}px`,
				borderRadius: 999,
				fontFamily: FONT.kk,
				fontSize: size,
				fontWeight: 650,
				color: dim ? C.muted : C.text,
				background: dim ? 'rgba(255,255,255,0.04)' : `${color}22`,
				border: `2px solid ${dim ? C.border : `${color}AA`}`,
				boxShadow: dim ? 'none' : `0 0 ${size * 0.8}px ${color}33`,
				whiteSpace: 'nowrap',
				...style,
			}}
		>
			<span
				style={{
					width: size * 0.36,
					height: size * 0.36,
					borderRadius: 99,
					background: dim ? C.faint : color,
					boxShadow: dim ? 'none' : `0 0 ${size * 0.4}px ${color}`,
				}}
			/>
			{kk}
		</div>
	);
};

export const IconTile: React.FC<{children: React.ReactNode; size?: number; active?: number}> = ({
	children,
	size = 96,
	active = 1,
}) => (
	<div
		style={{
			width: size,
			height: size,
			borderRadius: size * 0.28,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			background: `linear-gradient(135deg, rgba(139,92,246,${0.18 + 0.2 * active}), rgba(34,211,238,${0.1 + 0.18 * active}))`,
			border: `1px solid rgba(255,255,255,${0.1 + 0.1 * active})`,
			color: C.text,
			flexShrink: 0,
		}}
	>
		{children}
	</div>
);
