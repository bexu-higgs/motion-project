import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';

export type SfxName = 'tap' | 'pop' | 'whoosh' | 'swipe' | 'rotate' | 'toggle' | 'error' | 'success' | 'tick';

const LEVEL: Record<SfxName, number> = {
  tap: 0.55,
  pop: 0.45,
  whoosh: 0.35,
  swipe: 0.45,
  rotate: 0.45,
  toggle: 0.55,
  error: 0.45,
  success: 0.4,
  tick: 0.35,
};

/** One soft UI sound at a frame (relative to the enclosing scene). */
export const Sfx: React.FC<{name: SfxName; at: number; volume?: number}> = ({name, at, volume}) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={45} layout="none" name={`sfx:${name}`}>
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume ?? LEVEL[name]} />
  </Sequence>
);
