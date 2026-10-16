import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C} from '../theme';

/** Dark graphite stage with two slow, soft light pools (purple + cyan) and fine grain. */
export const Background: React.FC = () => {
	const frame = useCurrentFrame();
	const t = frame / 30;
	const ax = 260 + Math.sin(t * 0.21) * 90;
	const ay = 420 + Math.cos(t * 0.17) * 120;
	const bx = 820 + Math.cos(t * 0.19) * 100;
	const by = 1500 + Math.sin(t * 0.23) * 130;
	return (
		<AbsoluteFill style={{background: C.bg}}>
			<AbsoluteFill
				style={{
					background: `radial-gradient(720px 720px at ${ax}px ${ay}px, rgba(139,92,246,0.24), transparent 70%),
					radial-gradient(760px 760px at ${bx}px ${by}px, rgba(34,211,238,0.15), transparent 70%),
					radial-gradient(1200px 900px at 540px 960px, rgba(255,255,255,0.025), transparent 75%)`,
				}}
			/>
			{/* soft top light + vignette */}
			<AbsoluteFill
				style={{
					background:
						'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, transparent 22%, transparent 70%, rgba(0,0,0,0.45) 100%)',
				}}
			/>
			<AbsoluteFill style={{opacity: 0.06, mixBlendMode: 'overlay'}}>
				<svg width="100%" height="100%">
					<filter id="grain">
						<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={7} stitchTiles="stitch" />
						<feColorMatrix type="saturate" values="0" />
					</filter>
					<rect width="100%" height="100%" filter="url(#grain)" />
				</svg>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
