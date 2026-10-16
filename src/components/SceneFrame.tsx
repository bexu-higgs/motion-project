import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {easeInOut, prog} from '../lib/anim';
import {OVERLAP} from '../timeline';
import {Sfx} from './Sfx';

/** Soft cross-transition shared by every scene (fade + slight lift / settle). */
export const SceneFrame: React.FC<{duration: number; children: React.ReactNode; first?: boolean; last?: boolean}> = ({
	duration,
	children,
	first,
	last,
}) => {
	const frame = useCurrentFrame();
	const pin = first ? 1 : prog(frame, 0, OVERLAP + 4);
	const pout = last ? 0 : prog(frame, duration - OVERLAP, OVERLAP, easeInOut);
	return (
		<AbsoluteFill
			style={{
				opacity: pin * (1 - pout),
				transform: `translateY(${(1 - pin) * 40 - pout * 30}px) scale(${1 - pout * 0.02})`,
			}}
		>
			{!first ? <Sfx name="whoosh-soft" at={0} /> : null}
			{children}
		</AbsoluteFill>
	);
};
