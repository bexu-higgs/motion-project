import { el, css, place, prog, ease, clamp, rng, noise1, window01 } from './engine.js';
import { loadAssets, IMG } from './assets.js';
import { SCENES, DURATION, FPS, CUES, cue } from './timeline.js';
import s1 from './scenes/s1-intro.js';
import s2 from './scenes/s2-what.js';
import s3 from './scenes/s3-image.js';
import s4 from './scenes/s4-identity.js';
import s5 from './scenes/s5-multi.js';
import s6 from './scenes/s6-video.js';
import s7 from './scenes/s7-practice.js';
import s8 from './scenes/s8-outro.js';

const SCENE_DEFS = [s1, s2, s3, s4, s5, s6, s7, s8];
const XFADE = 0.55; // scene crossfade length

const stage = document.getElementById('stage');

function buildBackground() {
  const bg = el('div', '', stage);
  bg.id = 'bg';
  const grid = el('div', '', stage);
  grid.id = 'grid';
  const orbs = [
    { s: 900, c: 'rgba(40,140,180,0.22)', x: 100, y: 300 },
    { s: 1100, c: 'rgba(30,90,160,0.16)', x: 500, y: 1100 },
    { s: 700, c: 'rgba(62,230,255,0.10)', x: 650, y: 500 },
  ].map((o) => {
    const d = el('div', 'orb', stage);
    css(d, { width: o.s + 'px', height: o.s + 'px', background: `radial-gradient(circle, ${o.c} 0%, transparent 65%)` });
    return { d, ...o };
  });
  const cv = el('canvas', '', stage);
  cv.id = 'particles';
  cv.width = 1080;
  cv.height = 1920;
  const ctx = cv.getContext('2d');
  const R = rng(4242);
  const P = Array.from({ length: 110 }, () => ({
    x: R() * 1080, y: R() * 1920, z: 0.2 + R() * 0.8, sp: 6 + R() * 22, ph: R() * 6.28, big: R() > 0.93,
  }));
  return {
    grid,
    update(t) {
      for (const [i, o] of orbs.entries()) {
        const x = o.x - o.s / 2 + noise1(t * 0.05, i + 1) * 160;
        const y = o.y - o.s / 2 + noise1(t * 0.04, i + 7) * 140;
        css(o.d, { transform: `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)` });
      }
      css(grid, { transform: `translate3d(0,${((t * 6) % 72).toFixed(2)}px,0)` });
      ctx.clearRect(0, 0, 1080, 1920);
      for (const p of P) {
        const y = (((p.y - t * p.sp * p.z) % 1960) + 1960) % 1960 - 20;
        const x = p.x + Math.sin(t * 0.3 + p.ph) * 14 * p.z;
        const tw = 0.5 + 0.5 * Math.sin(t * (1 + p.z) + p.ph);
        if (p.big) {
          const r = 10 + p.z * 18;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(143,243,255,${0.10 * tw})`);
          g.addColorStop(1, 'rgba(143,243,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 6.283);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(190,245,255,${(0.12 + 0.5 * p.z) * (0.4 + 0.6 * tw)})`;
          ctx.beginPath();
          ctx.arc(x, y, 0.6 + p.z * 1.6, 0, 6.283);
          ctx.fill();
        }
      }
    },
  };
}

function buildProgress() {
  const bar = el('div', '', stage);
  bar.id = 'progress';
  const segs = SCENES.map(() => el('i', '', el('div', 'seg', bar)));
  return {
    update(t) {
      const fadeIn = prog(t, 0.6, 0.8);
      const fadeOut = 1 - prog(t, DURATION - 3.2, 1.2);
      css(bar, { opacity: (fadeIn * fadeOut).toFixed(3) });
      SCENES.forEach(([a, b], i) => {
        const k = clamp((t - a) / (b - a));
        css(segs[i], { transform: `scaleX(${k.toFixed(4)})`, opacity: k > 0 ? '1' : '0' });
      });
    },
  };
}

async function init() {
  await document.fonts.ready;
  await Promise.all([...document.fonts].map((f) => f.load().catch(() => {})));
  await loadAssets();
  const bg = buildBackground();
  const scenesRoot = el('div', 'fill', stage);
  const scenes = SCENE_DEFS.map((def, i) => {
    const [a, b] = SCENES[i];
    const root = el('div', 'scene', scenesRoot);
    const api = def.build(root, { start: a, end: b, index: i });
    // scene-change whoosh at every boundary after the first
    if (i > 0) cue(a - 0.25, 'whoosh', { gain: 0.55, dur: 0.9 });
    return { root, a, b, api, i };
  });
  const progress = buildProgress();
  const vig = el('div', '', stage);
  vig.id = 'vignette';
  const grain = el('div', '', stage);
  grain.id = 'grain';
  css(grain, { backgroundImage: `url(${IMG.grain.url})` });
  const fade = el('div', '', stage);
  fade.id = 'fadeBlack';

  let visible = new Set();
  window.renderFrame = (t) => {
    bg.update(t);
    for (const s of scenes) {
      const on = t >= s.a - XFADE && t <= s.b + XFADE;
      if (on !== visible.has(s)) {
        css(s.root, { display: on ? 'block' : 'none' });
        on ? visible.add(s) : visible.delete(s);
      }
      if (!on) continue;
      // crossfade envelope + gentle camera push
      const first = s.i === 0, last = s.i === scenes.length - 1;
      const kin = first ? 1 : prog(t, s.a - XFADE / 2, XFADE, ease.inOutSine);
      const kout = last ? 0 : prog(t, s.b - XFADE / 2, XFADE, ease.inOutSine);
      const o = Math.min(kin, 1 - kout);
      const push = 1 + 0.025 * clamp((t - s.a) / (s.b - s.a));
      const sc = push * (1 + (1 - kin) * -0.03 + kout * 0.05);
      const blur = (1 - kin) * 10 + kout * 14;
      place(s.root, { s: sc, o, blur, y: (1 - kin) * 30 - kout * 20 });
      s.api.update(t - s.a, t);
    }
    progress.update(t);
    const gr = rng(Math.floor(t * FPS) + 1);
    css(grain, { transform: `translate3d(${Math.floor(gr() * 256)}px,${Math.floor(gr() * 256)}px,0)` });
    css(fade, { opacity: (1 - prog(t, 0, 0.6, ease.outCubic) + prog(t, DURATION - 1.4, 1.3, ease.inOutSine)).toFixed(3) });
  };
  window.DURATION = DURATION;
  window.FPS = FPS;
  window.CUES = CUES.slice().sort((a, b) => a.t - b.t);
  const q = new URLSearchParams(location.search);
  window.renderFrame(parseFloat(q.get('t') || '0'));
  window.READY = true;
}

init().catch((e) => {
  console.error(e);
  window.INIT_ERROR = String(e && e.stack ? e.stack : e);
});
