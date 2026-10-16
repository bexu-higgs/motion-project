import '@fontsource-variable/inter';
import React from 'react';
import {Composition, continueRender, delayRender} from 'remotion';
import {Video} from './Video';
import {FPS, HEIGHT, TOTAL_FRAMES, WIDTH} from './timeline';

if (typeof document !== 'undefined') {
  const handle = delayRender('Loading Inter');
  Promise.all(['400', '500', '600', '700', '800'].map((w) => document.fonts.load(`${w} 40px "Inter Variable"`)))
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
}

export const Root: React.FC = () => (
  <Composition id="HiggsfieldMaxTutorial" component={Video} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
);
