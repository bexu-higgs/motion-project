// Small deterministic animation toolkit: every value is a pure function of t.
"use strict";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => u * u * (3 - 2 * u);

const Ease = {
  linear: (u) => u,
  inQuad: (u) => u * u,
  outQuad: (u) => 1 - (1 - u) * (1 - u),
  inCubic: (u) => u * u * u,
  outCubic: (u) => 1 - Math.pow(1 - u, 3),
  inOutCubic: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  inOutQuart: (u) => (u < 0.5 ? 8 * u * u * u * u : 1 - Math.pow(-2 * u + 2, 4) / 2),
  outQuart: (u) => 1 - Math.pow(1 - u, 4),
  outQuint: (u) => 1 - Math.pow(1 - u, 5),
  inExpo: (u) => (u === 0 ? 0 : Math.pow(2, 10 * u - 10)),
  outExpo: (u) => (u === 1 ? 1 : 1 - Math.pow(2, -10 * u)),
  inOutExpo: (u) =>
    u === 0 ? 0 : u === 1 ? 1 : u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2,
  inOutSine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
  outSine: (u) => Math.sin((u * Math.PI) / 2),
  outBack: (u) => {
    const s = 1.70158;
    return 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);
  },
  outBackSoft: (u) => {
    const s = 0.9;
    return 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);
  },
  outElastic: (u) =>
    u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

// Progress of t through [a, b], eased.
function prog(t, a, b, ease = Ease.linear) {
  if (b <= a) return t >= b ? 1 : 0;
  return ease(clamp((t - a) / (b - a)));
}

// 0 -> 1 -> 0 envelope: rises over [a, a+din], falls over [b-dout, b].
function win(t, a, b, din = 0.3, dout = 0.3, ein = Ease.outCubic, eout = Ease.inCubic) {
  return Math.min(prog(t, a, a + din, ein), 1 - prog(t, b - dout, b, eout));
}

// Seeded PRNG (mulberry32) so particles and grain repeat exactly per frame.
function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Apply a style object only when values change (keeps per-frame DOM work low).
function css(el, styles) {
  const cache = el.__css || (el.__css = {});
  for (const k in styles) {
    const v = styles[k];
    if (cache[k] !== v) {
      el.style[k] = v;
      cache[k] = v;
    }
  }
}

window.A = { clamp, lerp, smooth, Ease, prog, win, rng, css };
