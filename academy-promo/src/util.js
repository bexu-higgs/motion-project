'use strict';
// Animation helpers shared by scenes.js. All motion is a pure function of time.
window.U = (() => {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const eo = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const ei = (x) => Math.pow(clamp(x), 3);
  const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const sine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x));
  // damped spring step response (iOS-like): f = natural frequency (Hz), z = damping ratio
  function spring(t, f = 1.6, z = 0.6) {
    if (t <= 0) return 0;
    const w = 2 * Math.PI * f;
    if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
  }
  // damped oscillation starting at 1 (for swings / wobbles)
  function wobble(t, f = 1, z = 0.2) {
    if (t <= 0) return 1;
    const w = 2 * Math.PI * f;
    return Math.exp(-z * w * t) * Math.cos(w * Math.sqrt(1 - z * z) * t);
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function bezier(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return [
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ];
  }
  return { clamp, lerp, seg, eo, ei, eio, sine, spring, wobble, rng, bezier };
})();
