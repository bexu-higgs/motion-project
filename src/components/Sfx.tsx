import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';

export type SfxName =
	| 'whoosh'
	| 'whoosh-soft'
	| 'click'
	| 'pop'
	| 'shimmer'
	| 'chime'
	| 'success'
	| 'type-1'
	| 'type-2'
	| 'type-3'
	| 'type-4';

/** Whole-mix gain (voice, music, UI sounds). The render lands near -15 LUFS, peaks below -1 dBFS. */
export const MASTER_GAIN = 1.25;

const LEVEL: Record<SfxName, number> = {
	whoosh: 0.75,
	'whoosh-soft': 0.8,
	click: 0.8,
	pop: 0.75,
	shimmer: 0.7,
	chime: 0.75,
	success: 0.75,
	'type-1': 0.8,
	'type-2': 0.8,
	'type-3': 0.8,
	'type-4': 0.8,
};

/** A subtle UI sound at `at` (frames, relative to the parent sequence). */
export const Sfx: React.FC<{name: SfxName; at: number; gain?: number}> = ({name, at, gain = 1}) => (
	<Sequence from={Math.max(0, Math.round(at))} durationInFrames={150} layout="none" name={`sfx:${name}`}>
		<Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={LEVEL[name] * gain * MASTER_GAIN} />
	</Sequence>
);
