// Rasterises the procedural SVG art once at load time into bitmap URLs so
// per-frame rendering only composites images.
import { portraitSVG, LOOKS } from './art/character.js';
import * as E from './art/env.js';

export const IMG = {};

function rasterize(svg, w, h, { blur = 0, scale = 1 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale);
      c.height = Math.round(h * scale);
      const ctx = c.getContext('2d');
      if (blur) ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve({ url: URL.createObjectURL(b), w: c.width, h: c.height }), 'image/png');
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

export async function loadAssets() {
  const jobs = {
    citySky: [E.citySky(), 2400, 1400, { scale: 0.7 }],
    cityFar: [E.cityFar(), 2400, 1400, { scale: 0.7, blur: 2.5 }],
    cityMid: [E.cityMid(), 2400, 1400, { scale: 0.7, blur: 1.2 }],
    cityNear: [E.cityNear(), 2400, 1400, { scale: 0.7 }],
    forestSky: [E.forestSky(), 2400, 1400, { scale: 0.7 }],
    forest0: [E.forestLayer(0), 2400, 1400, { scale: 0.7, blur: 3 }],
    forest1: [E.forestLayer(1), 2400, 1400, { scale: 0.7, blur: 1.5 }],
    forest2: [E.forestLayer(2), 2400, 1400, { scale: 0.7 }],
    building: [E.buildingScene(), 1400, 1400, { scale: 0.8 }],
    buildingSoft: [E.buildingScene(), 1400, 1400, { scale: 0.8, blur: 3 }],
    lab: [E.labScene(), 1600, 1400, { scale: 0.7 }],
    labSoft: [E.labScene(), 1600, 1400, { scale: 0.7, blur: 3 }],
    style: [E.styleScene(), 1200, 1500, { scale: 0.6 }],
    studio: [E.studioScene(), 1600, 900, { scale: 0.7 }],
    steppe: [E.steppeScene(), 2400, 1400, { scale: 0.7 }],
  };
  for (const k in LOOKS) jobs['hero_' + k] = [portraitSVG(LOOKS[k], { id: k }), 600, 800, { scale: 2 }];
  const entries = await Promise.all(Object.entries(jobs).map(async ([k, [svg, w, h, o]]) => [k, await rasterize(svg, w, h, o)]));
  for (const [k, v] of entries) IMG[k] = v;
  // decode everything up-front so the first frame of a shot never stalls
  await Promise.all(
    Object.values(IMG).map((v) => {
      const i = new Image();
      i.src = v.url;
      return i.decode();
    }),
  );
  // film grain tile
  const g = document.createElement('canvas');
  g.width = g.height = 256;
  const gx = g.getContext('2d');
  const d = gx.createImageData(256, 256);
  let s = 1234567;
  for (let i = 0; i < d.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = (s / 2147483647) * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  gx.putImageData(d, 0, 0);
  IMG.grain = { url: g.toDataURL() };
}
