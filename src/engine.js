// Core animation helpers. Everything is a pure function of time `t` (seconds),
// so any frame can be rendered in any order (needed for parallel rendering).

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const mix = lerp;

export const ease = {
  linear: (x) => x,
  inSine: (x) => 1 - Math.cos((x * Math.PI) / 2),
  outSine: (x) => Math.sin((x * Math.PI) / 2),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutExpo: (x) =>
    x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outBack: (x) => {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
};

// Normalised progress of `t` through [start, start+dur], eased.
export const prog = (t, start, dur, fn = ease.outCubic) => fn(clamp((t - start) / dur));

// Fade in at `a` over `ain`, fade out at `b` over `aout`. Returns 0..1.
export const window01 = (t, a, b, ain = 0.4, aout = 0.4, fin = ease.outCubic, fout = ease.inCubic) =>
  Math.min(prog(t, a, ain, fin), 1 - prog(t, b - aout, aout, fout));

// Deterministic PRNG.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise for organic drift.
export function noise1(x, seed = 0) {
  const h = (n) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

// ---------------------------------------------------------------- DOM helpers
export function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

// Cached style writer: only touches the DOM when a value changes.
const cache = new WeakMap();
export function css(e, props) {
  let c = cache.get(e);
  if (!c) cache.set(e, (c = {}));
  for (const k in props) {
    const v = props[k];
    if (c[k] !== v) {
      c[k] = v;
      if (k.startsWith('--')) e.style.setProperty(k, v);
      else e.style[k] = v;
    }
  }
}

export function attr(e, props) {
  let c = cache.get(e);
  if (!c) cache.set(e, (c = {}));
  for (const k in props) {
    const v = String(props[k]);
    const key = '@' + k;
    if (c[key] !== v) {
      c[key] = v;
      e.setAttribute(k, v);
    }
  }
}

// Transform + opacity + blur in one call.
export function place(e, { x = 0, y = 0, s = 1, sx, sy, r = 0, o = 1, blur = 0, z, origin, extra = '' } = {}) {
  const scale = sx != null || sy != null ? `scale(${sx ?? s},${sy ?? s})` : `scale(${s})`;
  const p = {
    transform: `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) ${scale} rotate(${r.toFixed(3)}deg) ${extra}`,
    opacity: o.toFixed(3),
    filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none',
    visibility: o <= 0.001 ? 'hidden' : 'visible',
  };
  if (z != null) p.zIndex = String(z);
  if (origin) p.transformOrigin = origin;
  css(e, p);
}

// Split text into per-word spans (keeps Kazakh words intact) for staggered reveals.
export function splitWords(parent, text, cls = '') {
  const words = [];
  const parts = text.split(/(\s+)/);
  for (const p of parts) {
    if (/^\s+$/.test(p)) {
      parent.appendChild(document.createTextNode(' '));
      continue;
    }
    if (!p) continue;
    const w = el('span', 'w ' + cls, parent);
    const inner = el('span', 'wi', w);
    inner.textContent = p;
    words.push(inner);
  }
  return words;
}

export function splitChars(parent, text, cls = '') {
  const chars = [];
  for (const ch of text) {
    if (ch === ' ') {
      el('span', 'sp', parent).innerHTML = '&nbsp;';
      continue;
    }
    const c = el('span', 'ch ' + cls, parent);
    c.textContent = ch;
    chars.push(c);
  }
  return chars;
}

// Staggered rise-in for word/char spans; optional exit.
export function revealSpans(spans, t, start, { stagger = 0.06, dur = 0.7, dy = 40, blur = 10, exitAt = Infinity, exitDur = 0.4 } = {}) {
  const n = spans.length;
  spans.forEach((s, i) => {
    const k = prog(t, start + i * stagger, dur, ease.outQuint);
    const ex = prog(t, exitAt + i * stagger * 0.3, exitDur, ease.inCubic);
    const o = k * (1 - ex);
    css(s, {
      transform: `translate3d(0,${((1 - k) * dy - ex * dy * 0.5).toFixed(2)}px,0)`,
      opacity: o.toFixed(3),
      filter: (1 - k) * blur + ex * blur > 0.05 ? `blur(${((1 - k) * blur + ex * blur).toFixed(2)}px)` : 'none',
    });
  });
  return n;
}

// Point along an SVG path (cached lengths).
const lenCache = new WeakMap();
export function pathLen(p) {
  let L = lenCache.get(p);
  if (L == null) lenCache.set(p, (L = p.getTotalLength()));
  return L;
}

// Draw-on effect for an SVG stroke.
export function drawPath(p, k) {
  const L = pathLen(p);
  attr(p, { 'stroke-dasharray': `${L} ${L}`, 'stroke-dashoffset': (L * (1 - clamp(k))).toFixed(2) });
}
