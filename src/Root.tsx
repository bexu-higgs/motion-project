import '@fontsource-variable/inter';
import React from 'react';
import {Composition, continueRender, delayRender} from 'remotion';
import {Video} from './Video';
import {FPS, HEIGHT, TOTAL_FRAMES, WIDTH} from './timeline';

if (typeof document !== 'undefined') {
  const handle = delayRender('Loading Inter');
  // load the Latin + Cyrillic(-ext) subsets so Kazakh letters (ә ғ қ ң ө ұ ү һ і) never fall back
  const sample = 'AaZz 09 АаЯя ӘәҒғҚқҢңӨөҰұҮүҺһІі';
  Promise.all(['300', '400', '500', '600', '700', '800'].map((w) => document.fonts.load(`${w} 40px "Inter Variable"`, sample)))
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
}

export const Root: React.FC = () => (
  <Composition id="HiggsfieldMaxTutorial" component={Video} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
);
