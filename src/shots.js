// "Generated" example shots. Each returns { root, update(t) } and is a pure
// function of absolute time t, so shots can be reused across scenes.
import { el, css, svgEl, attr, clamp, lerp, noise1, ease } from './engine.js';
import { IMG } from './assets.js';
import { createRig, walkPose, jumpPose, GROUND } from './art/rig.js';

// Face centre inside the 600×800 portrait (after the head offset).
const FACE = { x: 292 / 600, y: 372 / 800 };

function img(parent, key, cls = '') {
  const i = el('img', cls, parent);
  i.src = IMG[key].url;
  i.draggable = false;
  return i;
}

// Horizontally tileable parallax strip that covers a w×h frame.
function strip(parent, key, h, { yShift = 0, scale = 1 } = {}) {
  const src = IMG[key];
  const lh = h * scale;
  const lw = (src.w / src.h) * lh;
  const s = el('div', 'lyr', parent);
  css(s, { width: lw * 2 + 'px', height: lh + 'px', top: (h - lh) / 2 + yShift + 'px' });
  for (let i = 0; i < 2; i++) {
    const im = img(s, key);
    css(im, { width: lw + 'px', height: lh + 'px', left: i * lw + 'px' });
  }
  return {
    el: s,
    set(offset) {
      const o = ((offset % lw) + lw) % lw;
      css(s, { transform: `translate3d(${(-o).toFixed(2)}px,0,0)` });
    },
  };
}

function cover(parent, key, w, h, { s = 1.08, ox = 0.5, oy = 0.5 } = {}) {
  const src = IMG[key];
  const k = Math.max(w / src.w, h / src.h) * s;
  const iw = src.w * k, ih = src.h * k;
  const i = img(parent, key);
  css(i, { width: iw + 'px', height: ih + 'px', left: (w - iw) * ox + 'px', top: (h - ih) * oy + 'px', transformOrigin: '50% 50%' });
  return i;
}

function bokeh(parent, w, h, n, seed, colors) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = (Math.sin(seed * 91.7 + i * 12.9898) * 43758.5453) % 1;
    const rr = Math.abs(r);
    const size = (0.05 + rr * 0.12) * w;
    const d = el('div', 'lyr', parent);
    const c = colors[i % colors.length];
    css(d, { width: size + 'px', height: size + 'px', borderRadius: '50%', background: `radial-gradient(circle, ${c} 0%, ${c.replace(/[\d.]+\)$/, '0)')} 70%)` });
    out.push({ d, size, x0: (i / n) * w * 1.4, y: h * (0.15 + ((rr * 7.3) % 1) * 0.6), sp: 0.6 + rr });
  }
  return out;
}

const GRADES = {
  studio: 'radial-gradient(70% 60% at 62% 30%, rgba(255,214,180,0.10), transparent 70%)',
  city: 'linear-gradient(180deg, rgba(10,30,60,0.0) 40%, rgba(5,10,20,0.55) 100%)',
  forest: 'radial-gradient(80% 60% at 25% 10%, rgba(255,240,190,0.22), transparent 70%), linear-gradient(180deg, transparent 50%, rgba(6,14,10,0.6) 100%)',
  dusk: 'radial-gradient(70% 50% at 75% 75%, rgba(255,170,110,0.25), transparent 70%), linear-gradient(180deg, transparent 50%, rgba(18,10,20,0.6) 100%)',
  lab: 'linear-gradient(180deg, transparent 55%, rgba(2,8,12,0.65) 100%)',
  labStyled: 'linear-gradient(115deg, rgba(255,150,70,0.0) 30%, rgba(255,150,70,0.28) 62%, rgba(255,150,70,0.0) 80%), linear-gradient(180deg, transparent 50%, rgba(2,10,14,0.7) 100%)',
};

// ------------------------------------------------------------------ bust shot
// env: studio | city | forest | dusk | lab | labStyled ; walk: tracking-shot bob + parallax
export function bustShot(parent, { w, h, env = 'studio', look, walk = false, speed = 1, s = 1.12, fx = 0.5, fy = 0.4, seed = 1, phase = 0 }) {
  const root = el('div', 'shot', parent);
  css(root, { width: w + 'px', height: h + 'px' });
  const layers = [];
  let bgImg = null;
  let bok = [];
  if (env === 'studio') {
    const b = el('div', 'fill', root);
    css(b, { background: 'radial-gradient(90% 70% at 50% 35%, #2a3440 0%, #141a22 55%, #080b10 100%)' });
    const glow = el('div', 'fill', root);
    css(glow, { background: 'radial-gradient(40% 30% at 22% 30%, rgba(62,230,255,0.18), transparent 70%)' });
  } else if (env === 'city') {
    layers.push([strip(root, 'citySky', h, { scale: 1.1 }), 0.02]);
    layers.push([strip(root, 'cityFar', h, { scale: 1.1, yShift: -h * 0.06 }), 0.12]);
    layers.push([strip(root, 'cityMid', h, { scale: 1.25, yShift: -h * 0.04 }), 0.3]);
    layers.push([strip(root, 'cityNear', h, { scale: 1.3, yShift: h * 0.02 }), 0.7]);
    bok = bokeh(root, w, h, 7, seed, ['rgba(255,200,140,0.35)', 'rgba(62,230,255,0.3)', 'rgba(255,110,180,0.22)']);
  } else if (env === 'forest') {
    layers.push([strip(root, 'forestSky', h, { scale: 1.1 }), 0.02]);
    layers.push([strip(root, 'forest0', h, { scale: 1.1 }), 0.1]);
    layers.push([strip(root, 'forest1', h, { scale: 1.2 }), 0.25]);
    layers.push([strip(root, 'forest2', h, { scale: 1.35, yShift: h * 0.05 }), 0.6]);
    bok = bokeh(root, w, h, 6, seed, ['rgba(255,246,200,0.30)', 'rgba(200,255,190,0.22)']);
  } else if (env === 'dusk') {
    bgImg = cover(root, 'buildingSoft', w, h, { s: 1.15, ox: 0.2, oy: 0.35 });
  } else if (env === 'lab' || env === 'labStyled') {
    bgImg = cover(root, 'labSoft', w, h, { s: 1.12 });
  }
  const grade0 = el('div', 'fill', root);
  css(grade0, { background: GRADES[env] || 'none' });

  const lookKey = 'hero_' + (look || { studio: 'studio', city: 'city', forest: 'forest', dusk: 'dusk', lab: 'lab', labStyled: 'lab' }[env]);
  const ph = h * s, pw = ph * 0.75;
  const hero = img(root, lookKey);
  const left = w * fx - FACE.x * pw, top = h * fy - FACE.y * ph;
  css(hero, { width: pw + 'px', height: ph + 'px', left: left + 'px', top: top + 'px', transformOrigin: '50% 100%' });

  // light wrap / style grade on top of the character
  const over = el('div', 'fill', root);
  if (env === 'labStyled') {
    css(over, { background: 'linear-gradient(105deg, rgba(47,227,255,0.16) 0%, transparent 35%, transparent 55%, rgba(255,150,70,0.22) 80%, rgba(255,150,70,0.05) 100%)' });
    const beam = el('div', 'fill', root);
    css(beam, { background: 'linear-gradient(120deg, transparent 52%, rgba(255,190,120,0.16) 60%, transparent 72%)' });
  } else if (env === 'city') {
    css(over, { background: 'linear-gradient(90deg, rgba(62,230,255,0.10), transparent 30%, transparent 70%, rgba(255,110,180,0.08))' });
  } else if (env === 'forest') {
    css(over, { background: 'linear-gradient(200deg, rgba(255,236,180,0.14), transparent 45%)' });
  } else if (env === 'dusk') {
    css(over, { background: 'linear-gradient(240deg, rgba(255,170,110,0.18), transparent 50%)' });
  }
  const vig = el('div', 'fill', root);
  css(vig, { background: 'radial-gradient(100% 80% at 50% 40%, transparent 55%, rgba(0,0,0,0.55) 100%)' });

  function update(t) {
    const tt = t + phase;
    const travel = walk ? tt * w * 0.55 * speed : tt * w * 0.03;
    for (const [L, k] of layers) L.set(travel * k + seed * 300);
    for (const b of bok) {
      const x = ((((b.x0 - travel * 0.9 * b.sp) % (w * 1.4)) + w * 1.4) % (w * 1.4)) - w * 0.2;
      css(b.d, { transform: `translate3d(${x.toFixed(1)}px,${(b.y - b.size / 2).toFixed(1)}px,0)` });
    }
    if (bgImg) css(bgImg, { transform: `scale(${(1 + tt * 0.004).toFixed(4)}) translate3d(${(walk ? -tt * 6 : 0).toFixed(2)}px,0,0)` });
    let y = 0, r = 0, sc = 1;
    if (walk) {
      const st = (tt * Math.PI) / 0.56;
      y = -Math.abs(Math.sin(st)) * h * 0.012;
      r = Math.sin(st / 2) * 0.7;
    } else {
      sc = 1 + Math.sin(tt * 1.3) * 0.003;
      y = noise1(tt * 0.3, seed) * h * 0.003;
    }
    css(hero, { transform: `translate3d(0,${y.toFixed(2)}px,0) rotate(${r.toFixed(3)}deg) scale(${sc.toFixed(4)})` });
  }
  update(0);
  // portrait (600×800 art units) → frame pixels
  const map = (x, y) => ({ x: left + (x / 600) * pw, y: top + (y / 800) * ph });
  return { root, update, map, faceAt: { x: w * fx, y: h * fy }, faceW: pw * 0.36 };
}

// ------------------------------------------------------------------ full-body walk (city tracking shot)
export function walkShot(parent, { w, h, figH = 0.62, groundY = 0.88, speed = 1, seed = 2, env = 'city' }) {
  const root = el('div', 'shot', parent);
  css(root, { width: w + 'px', height: h + 'px' });
  const layers = [];
  if (env === 'city') {
    layers.push([strip(root, 'citySky', h, { scale: 1.05 }), 0.02]);
    layers.push([strip(root, 'cityFar', h, { scale: 1.0, yShift: -h * 0.12 }), 0.1]);
    layers.push([strip(root, 'cityMid', h, { scale: 1.05, yShift: -h * 0.1 }), 0.28]);
    layers.push([strip(root, 'cityNear', h, { scale: 1.0, yShift: -h * 0.03 }), 1]);
  }
  const bok = bokeh(root, w, h, 6, seed, ['rgba(255,200,140,0.3)', 'rgba(62,230,255,0.25)']);
  const g = el('div', 'fill', root);
  css(g, { background: 'linear-gradient(180deg, transparent 55%, rgba(3,6,10,0.7) 100%), linear-gradient(90deg, rgba(62,230,255,0.08), transparent 40%)' });
  const svg = svgEl('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: 'position:absolute;left:0;top:0;overflow:visible' }, root);
  const k = (h * figH) / 905; // rig height ≈ 905 units (head top → sole)
  const holder = svgEl('g', { transform: `translate(${w * 0.5},${h * groundY - GROUND * k}) scale(${k})` }, svg);
  const rig = createRig(holder, 'hero', { rim: '#5fe6ff', rimK: 0.9 });
  const vig = el('div', 'fill', root);
  css(vig, { background: 'radial-gradient(100% 80% at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)' });
  // walking speed in px/s that matches the stride (≈ 615 rig units/s)
  const v = 615 * k * speed;
  function update(t) {
    rig.pose(walkPose(t * speed, 1.1));
    const travel = t * v;
    for (const [L, kk] of layers) L.set(travel * kk + seed * 200);
    for (const b of bok) {
      const x = ((((b.x0 - travel * 1.3 * b.sp) % (w * 1.4)) + w * 1.4) % (w * 1.4)) - w * 0.2;
      css(b.d, { transform: `translate3d(${x.toFixed(1)}px,${(b.y - b.size / 2).toFixed(1)}px,0)` });
    }
  }
  update(0);
  return { root, update };
}

// ------------------------------------------------------------------ jump (video-reference demo)
export function jumpShot(parent, { w, h, skin = 'hero', env = 'studio', figH = 0.6, groundY = 0.84, arrows = true }) {
  const root = el('div', 'shot', parent);
  css(root, { width: w + 'px', height: h + 'px' });
  let bg;
  if (env === 'studio') bg = cover(root, 'studio', w, h, { s: 1.02 });
  else bg = cover(root, 'steppe', w, h, { s: 1.05, ox: 0.6, oy: 0.75 });
  const svg = svgEl('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: 'position:absolute;left:0;top:0;overflow:visible' }, root);
  const k = (h * figH) / 905;
  const gx = w * 0.42, gy = h * groundY - GROUND * k;
  // motion arrows: dotted arc up and back down
  const arr = svgEl('g', { opacity: 0 }, svg);
  const arc = svgEl('path', { d: `M${gx - 60},${h * groundY - 40} C${gx - 70},${h * 0.18} ${gx + 120},${h * 0.18} ${gx + 120},${h * groundY - 40}`, fill: 'none', stroke: '#3ee6ff', 'stroke-width': 4, 'stroke-dasharray': '2 14', 'stroke-linecap': 'round' }, arr);
  svgEl('path', { d: `M${gx + 106},${h * groundY - 66} L${gx + 120},${h * groundY - 36} L${gx + 136},${h * groundY - 64}`, fill: 'none', stroke: '#3ee6ff', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, arr);
  const up = svgEl('path', { d: `M${gx - 150},${h * 0.62} L${gx - 150},${h * 0.32} M${gx - 166},${h * 0.36} L${gx - 150},${h * 0.3} L${gx - 134},${h * 0.36}`, fill: 'none', stroke: '#8ff3ff', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.8 }, arr);
  const holder = svgEl('g', { transform: `translate(${gx},${gy}) scale(${k})` }, svg);
  const rig = createRig(holder, skin, skin === 'hero' ? { rim: '#ffdca8', rimK: 0.8, key: '#ffcf9e' } : { rim: '#9fefff', rimK: 0.6 });
  const vig = el('div', 'fill', root);
  css(vig, { background: 'radial-gradient(100% 90% at 50% 45%, transparent 60%, rgba(0,0,0,0.5) 100%)' });
  function update(t, { arrowsK = 1 } = {}) {
    rig.pose(jumpPose(t));
    attr(arr, { opacity: (arrows ? arrowsK : 0).toFixed(3) });
    attr(arc, { 'stroke-dashoffset': (-t * 40).toFixed(1) });
    if (bg) css(bg, { transform: `scale(${(1 + t * 0.003).toFixed(4)})` });
  }
  update(0);
  return { root, update, rig };
}

// ------------------------------------------------------------------ plain environment / style plates
export function plateShot(parent, { w, h, key, ox = 0.5, oy = 0.5, s = 1.08, thirds = false }) {
  const root = el('div', 'shot', parent);
  css(root, { width: w + 'px', height: h + 'px' });
  const i = cover(root, key, w, h, { s, ox, oy });
  let grid = null;
  if (thirds) {
    grid = svgEl('svg', { width: w, height: h, style: 'position:absolute;left:0;top:0' }, root);
    for (const k of [1 / 3, 2 / 3]) {
      svgEl('line', { x1: w * k, y1: 0, x2: w * k, y2: h, stroke: '#fff', 'stroke-opacity': 0.28, 'stroke-width': 1.5 }, grid);
      svgEl('line', { x1: 0, y1: h * k, x2: w, y2: h * k, stroke: '#fff', 'stroke-opacity': 0.28, 'stroke-width': 1.5 }, grid);
    }
    for (const [x, y] of [[1 / 3, 2 / 3], [1 / 3, 1 / 3], [2 / 3, 1 / 3]]) svgEl('circle', { cx: w * x, cy: h * y, r: 5, fill: '#ffb066', opacity: 0.9 }, grid);
  }
  const vig = el('div', 'fill', root);
  css(vig, { background: 'radial-gradient(100% 80% at 50% 45%, transparent 60%, rgba(0,0,0,0.5) 100%)' });
  function update(t) {
    css(i, { transform: `scale(${(1 + t * 0.004).toFixed(4)})` });
  }
  return { root, update };
}
