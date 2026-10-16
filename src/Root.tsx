import React from 'react';
import {Composition} from 'remotion';
import {Lesson} from './Lesson';
import {TIMELINE} from './timeline';
import {FPS, H, W} from './theme';

export const Root: React.FC = () => (
	<Composition
		id="HiggsfieldImageBasicsKK"
		component={Lesson}
		width={W}
		height={H}
		fps={FPS}
		durationInFrames={TIMELINE.total}
	/>
);
