import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {Background} from './components/Background';
import {FONT} from './theme';
import {TIMELINE, type SceneId} from './timeline';
import {S01Intro} from './scenes/S01Intro';
import {S02Link} from './scenes/S02Link';
import {S03Register} from './scenes/S03Register';
import {S04Premium} from './scenes/S04Premium';
import {S05Annual} from './scenes/S05Annual';
import {S06Monthly} from './scenes/S06Monthly';
import {S07MaxDiscount} from './scenes/S07MaxDiscount';
import {S08Payment} from './scenes/S08Payment';
import {S09Deadline} from './scenes/S09Deadline';
import {S10Recap} from './scenes/S10Recap';

const SCENES: Record<SceneId, React.FC> = {
  s1: S01Intro,
  s2: S02Link,
  s3: S03Register,
  s4: S04Premium,
  s5: S05Annual,
  s6: S06Monthly,
  s7: S07MaxDiscount,
  s8: S08Payment,
  s9: S09Deadline,
  s10: S10Recap,
};

export const Video: React.FC = () => (
  <AbsoluteFill style={{fontFamily: FONT, overflow: 'hidden'}}>
    <Background />
    {TIMELINE.map((s) => {
      const Scene = SCENES[s.id];
      return (
        <Sequence key={s.id} from={s.start} durationInFrames={s.duration} name={`${s.id} · ${s.name}`}>
          <Scene />
        </Sequence>
      );
    })}
    {/* Recorded narration (optional): public/vo/<line>.wav listed in src/vo-timings.json */}
    {TIMELINE.flatMap((s) =>
      Object.values(s.cues)
        .filter((c) => c.file)
        .map((c) => (
          <Sequence key={c.id} from={s.start + c.from} name={`vo:${c.id}`} layout="none">
            <Audio src={staticFile(c.file as string)} />
          </Sequence>
        )),
    )}
  </AbsoluteFill>
);
