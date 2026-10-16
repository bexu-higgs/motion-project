import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, continueRender, delayRender, interpolate, Sequence, staticFile} from 'remotion';
import {Background} from './components/Background';
import {Captions} from './components/Captions';
import {SceneFrame} from './components/SceneFrame';
import {MASTER_GAIN} from './components/Sfx';
import {StepHeader} from './components/StepHeader';
import {AdScene} from './scenes/AdScene';
import {FormatScene} from './scenes/FormatScene';
import {IntroScene} from './scenes/IntroScene';
import {IterateScene} from './scenes/IterateScene';
import {ModelScene} from './scenes/ModelScene';
import {PracticeScene} from './scenes/PracticeScene';
import {PromptScene} from './scenes/PromptScene';
import {WrapScene} from './scenes/WrapScene';
import {ALL_LINES, Section, SectionId, TIMELINE} from './timeline';
import {FONT} from './theme';

const SCENES: Record<SectionId, React.FC<{sec: Section}>> = {
	intro: IntroScene,
	model: ModelScene,
	prompt: PromptScene,
	ad: AdScene,
	iterate: IterateScene,
	format: FormatScene,
	practice: PracticeScene,
	wrap: WrapScene,
};

const MUSIC_LEVEL = 0.33;
const MUSIC_DUCKED = 0.14;

/** Music sits lower while the narrator speaks, rises gently in the pauses. */
function musicVolume(f: number) {
	let duck = 0;
	for (const l of ALL_LINES) {
		const d = f < l.start ? l.start - f : f > l.end ? f - l.end : 0;
		duck = Math.max(duck, interpolate(d, [0, 14], [1, 0], {extrapolateRight: 'clamp'}));
	}
	const level = MUSIC_LEVEL + (MUSIC_DUCKED - MUSIC_LEVEL) * duck;
	const fadeIn = interpolate(f, [0, 20], [0, 1], {extrapolateRight: 'clamp'});
	const fadeOut = interpolate(f, [TIMELINE.total - 60, TIMELINE.total], [1, 0], {extrapolateLeft: 'clamp'});
	return level * fadeIn * fadeOut * MASTER_GAIN;
}

/** Hold the first frame until the Kazakh (Cyrillic-ext) and Latin font subsets are loaded. */
const useFonts = () => {
	const [handle] = useState(() => delayRender('Loading fonts'));
	useEffect(() => {
		const sample = 'Аа әғқңөұүһі ӘҒҚҢӨҰҮҺІ Aa';
		const faces = [FONT.kk, FONT.en].map((f) => f.split(',')[0]);
		const weights = [400, 500, 600, 650, 700, 750, 780];
		Promise.all(faces.flatMap((face) => weights.map((w) => document.fonts.load(`${w} 40px ${face}`, sample))))
			.then(() => document.fonts.ready)
			.then(() => continueRender(handle))
			.catch(() => continueRender(handle));
	}, [handle]);
};

export const Lesson: React.FC = () => {
	useFonts();
	const last = TIMELINE.sections.length - 1;
	return (
		<AbsoluteFill>
			<Background />
			{TIMELINE.sections.map((sec, i) => {
				const Scene = SCENES[sec.id];
				return (
					<Sequence key={sec.id} from={sec.from} durationInFrames={sec.duration} name={sec.id}>
						<SceneFrame duration={sec.duration} first={i === 0} last={i === last}>
							<Scene sec={sec} />
						</SceneFrame>
					</Sequence>
				);
			})}
			<StepHeader />
			<Captions />

			{ALL_LINES.map((l) => (
				<Sequence key={l.id} from={l.start} durationInFrames={l.end - l.start + 6} name={`voice ${l.id}`} layout="none">
					<Audio src={staticFile(l.file)} volume={MASTER_GAIN} />
				</Sequence>
			))}
			<Audio src={staticFile('audio/music/bed.flac')} volume={musicVolume} />
		</AbsoluteFill>
	);
};
