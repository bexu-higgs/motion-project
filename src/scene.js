'use strict';
/*
 * Бексұлтан — AI course intro.
 * Deterministic canvas renderer: renderFrame(t) draws the frame at time t (s).
 * All timing comes from timeline.json (word onsets measured on the voiceover),
 * so typography, motion and sound share one clock.
 *
 *   ?w=1080&h=1920   output size (default 9:16)
 *   ?render          frame-capture mode (no UI, no realtime playback)
 */

const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1080), H = +(Q.get('h') || 1920);
const RENDER = Q.has('render');
const cv = document.getElementById('c');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const U = Math.min(W, H) / 1080;
const PORTRAIT = H >= W;
const CX = W / 2, CY = H / 2;
const FONT = 'Montserrat';

// ───────────────────────────── math ─────────────────────────────
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutExpo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inCubic: x => x * x * x,
  inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: x => 1 - Math.pow(1 - x, 4),
  inQuart: x => x * x * x * x,
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  outBack: (x, s = 1.2) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
};
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const frac = x => x - Math.floor(x);
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const col = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ──────────────────────────── palette ────────────────────────────
const BG = [3, 5, 9];
const CYAN = [72, 226, 255];
const BLUE = [56, 118, 255];
const VIOLET = [142, 112, 255];
const WHITE = [242, 247, 252];
const STEEL = [150, 172, 196];

// ─────────────────────────── typography ──────────────────────────
const fontStr = (w, s) => `${w} ${s}px ${FONT}`;
const CAP = 0.70; // Montserrat cap-height / em

function fit(text, weight, track, maxW, maxSize) {
  ctx.font = fontStr(weight, 100);
  const n = [...text].length;
  const w100 = ctx.measureText(text).width + (n - 1) * track * 100;
  return Math.min(maxSize, (maxW / w100) * 100);
}

// Lays out a word letter-by-letter (kerning preserved via prefix widths).
function layout(text, weight, size, track, cx, cy, align = 'center') {
  ctx.font = fontStr(weight, size);
  const chars = [...text];
  const tr = track * size;
  const total = ctx.measureText(text).width + (chars.length - 1) * tr;
  const left = align === 'left' ? cx : cx - total / 2;
  const letters = chars.map((ch, i) => {
    const x = left + ctx.measureText(chars.slice(0, i).join('')).width + i * tr;
    return { ch, x, w: ctx.measureText(ch).width };
  });
  const cap = CAP * size;
  return { text, weight, size, letters, width: total, left, right: left + total, cx: left + total / 2,
           cy, base: cy + cap / 2, top: cy - cap / 2, cap };
}

// Draw one letter with its own transform. o: {dx, dy, s, sx, skew, a, c, stroke, lw}
function drawLetter(L, i, o = {}) {
  const lt = L.letters[i];
  const a = o.a === undefined ? 1 : o.a;
  if (a <= 0.003) return;
  const lx = lt.x + lt.w / 2 + (o.dx || 0), ly = L.cy + (o.dy || 0);
  const s = o.s === undefined ? 1 : o.s;
  ctx.save();
  ctx.translate(lx, ly);
  ctx.transform(s * (o.sx || 1), 0, (o.skew || 0) * s, s, 0, 0);
  ctx.font = fontStr(L.weight, L.size);
  ctx.globalAlpha *= a;
  if (o.stroke) {
    ctx.strokeStyle = col(o.c || WHITE);
    ctx.lineWidth = o.lw || 1.5 * U;
    ctx.strokeText(lt.ch, -lt.w / 2, L.cap / 2);
  } else {
    ctx.fillStyle = col(o.c || WHITE);
    ctx.fillText(lt.ch, -lt.w / 2, L.cap / 2);
  }
  ctx.restore();
}

// Sample glyph interiors into points (per letter) for particle work.
function sampleGlyphs(L, step, seed) {
  const r = rng(seed);
  const pad = Math.ceil(L.size * 0.3);
  const w = Math.ceil(L.width + pad * 2), h = Math.ceil(L.size * 1.5);
  const oc = document.createElement('canvas');
  oc.width = w; oc.height = h;
  const o = oc.getContext('2d', { willReadFrequently: true });
  const ox = L.left - pad, oy = L.base - L.size * 1.1;
  const pts = [];
  L.letters.forEach((lt, li) => {
    o.clearRect(0, 0, w, h);
    o.font = fontStr(L.weight, L.size);
    o.fillStyle = '#fff';
    o.fillText(lt.ch, lt.x - ox, L.base - oy);
    const d = o.getImageData(0, 0, w, h).data;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        const xi = x | 0, yi = y | 0;
        if (d[(yi * w + xi) * 4 + 3] > 140) pts.push({ x: x + ox, y: y + oy, li, r: r(), r2: r(), r3: r() });
      }
    }
  });
  return pts;
}

// ─────────────────────────── timeline ────────────────────────────
let C, TL;          // cues, timeline
let S = {};         // scene data built once fonts + cues are ready

// Camera zoom keyframes [t, zoom, easing-into-this-key]
function camZoom(t) {
  const k = S.zoomKeys;
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t < k[i][0]) {
      const [t0, z0] = k[i - 1], [t1, z1, e] = k[i];
      return lerp(z0, z1, (e || E.inOutSine)(prog(t, t0, t1)));
    }
  }
  return k[k.length - 1][1];
}
function camShake(t) {
  let x = 0, y = 0;
  for (const [t0, amp] of S.shakes) {
    const d = t - t0;
    if (d < 0 || d > 0.6) continue;
    const env = amp * Math.exp(-d * 9);
    x += env * Math.sin(d * 71 + t0) ; y += env * Math.cos(d * 57 + t0 * 3);
  }
  return [x * U, y * U];
}

// ─────────────────────────── build scene ─────────────────────────
function build() {
  const portrait = PORTRAIT;
  const textW = portrait ? 0.84 * W : 0.56 * W;

  // Сәлем
  {
    const s = fit('СӘЛЕМ!', 800, 0.02, portrait ? 0.70 * W : 0.42 * W, 215 * U);
    S.salem = layout('СӘЛЕМ!', 800, s, 0.02, CX, CY);
  }
  // Бексұлтан
  {
    const s = fit('БЕКСҰЛТАН', 800, 0.035, PORTRAIT ? 0.76 * W : 0.5 * W, 170 * U);
    S.name = layout('БЕКСҰЛТАН', 800, s, 0.035, CX, CY);
  }
  // Сіздерге
  {
    const s = fit('СІЗДЕРГЕ', 700, 0.06, portrait ? 0.74 * W : 0.46 * W, 150 * U);
    S.siz = layout('СІЗДЕРГЕ', 700, s, 0.06, CX, CY);
  }
  // Hero: ЖАСАНДЫ / ИНТЕЛЛЕКТ — two layers of one neural net
  {
    const s = fit('ИНТЕЛЛЕКТ', 800, 0.045, portrait ? 0.78 * W : 0.54 * W, 170 * U);
    const sep = s * (portrait ? 1.95 : 1.75);
    S.zh = layout('ЖАСАНДЫ', 800, s, 0.07, CX, CY - sep / 2);
    S.in = layout('ИНТЕЛЛЕКТ', 800, s, 0.045, CX, CY + sep / 2);
    S.zhPts = sampleGlyphs(S.zh, Math.max(4, 6.5 * U), 11);
    S.inPts = sampleGlyphs(S.in, Math.max(4, 6.5 * U), 12);
    S.meshTop = S.zh.letters.map(l => [l.x + l.w / 2, S.zh.base + 0.2 * s]);
    S.meshBot = S.in.letters.map(l => [l.x + l.w / 2, S.in.top - 0.2 * s]);
    S.heroBox = { l: Math.min(S.zh.left, S.in.left) - 46 * U, r: Math.max(S.zh.right, S.in.right) + 46 * U,
                  t: S.zh.top - 70 * U, b: S.in.base + 70 * U };
  }
  // Lessons: three modules
  {
    const modW = portrait ? 0.82 * W : 0.40 * W;
    const fs = fit('САБАҚТАРДЫ', 700, 0.05, modW - 120 * U, 96 * U);
    const modH = fs * 1.62, gap = modH * 0.62;
    S.modW = modW; S.modH = modH; S.modGap = gap;
    S.mods = ['НАҚТЫ', 'БАЗАЛЫҚ', 'САБАҚТАРДЫ'].map((w, k) => {
      const y = CY + (k - 1) * (modH + gap);
      return { L: layout(w, 700, fs, 0.05, CX, y), y, idx: '0' + (k + 1) };
    });
    S.root = [CX, S.mods[0].y - modH / 2 - gap * 1.1];
  }
  // Final phrase
  {
    const s1 = fit('ҮЙРЕТЕТІН', 700, 0.06, portrait ? 0.76 * W : 0.44 * W, 132 * U);
    const s2 = fit('БОЛАМЫН!', 800, 0.03, portrait ? 0.80 * W : 0.50 * W, 185 * U);
    S.ui = layout('ҮЙРЕТЕТІН', 700, s1, 0.06, CX, CY - 0.36 * s1 - CAP * s1 / 2 - 6 * U);
    S.bol = layout('БОЛАМЫН!', 800, s2, 0.03, CX, CY + 0.30 * s2 + CAP * s2 / 2 + 6 * U);
    S.lineW = Math.min(Math.max(S.ui.width, S.bol.width) + 80 * U, 0.88 * W);
  }
  // Lockup
  {
    const markY = CY - (portrait ? 190 : 150) * U;
    S.markY = markY;
    const ns = (portrait ? 100 : 84) * U;
    S.lkName = layout('БЕКСҰЛТАН', 700, ns, 0.2, CX, CY + 20 * U);
    S.lkDesc = layout('ЖАСАНДЫ ИНТЕЛЛЕКТ', 600, 30 * U, 0.42, CX, CY + 146 * U);
    S.lkDivY = CY + 94 * U;
  }

  // Particles: fragments of СӘЛЕМ that re-assemble into БЕКСҰЛТАН
  {
    const src = sampleGlyphs(S.salem, Math.max(4, 6 * U), 21);
    const dst = sampleGlyphs(S.name, Math.max(3.5, 5.2 * U), 22);
    const r = rng(5);
    S.parts = dst.map((d, j) => {
      const s = src[(j * 7919) % src.length];
      const th = r() * Math.PI * 2, ph = (r() - 0.5) * Math.PI * 0.9, rad = (140 + r() * 420) * U;
      return {
        sx: s.x + (r() - 0.5) * 4 * U, sy: s.y + (r() - 0.5) * 4 * U,
        tx: d.x, ty: d.y, li: d.li,
        cx: Math.cos(th) * Math.cos(ph) * rad, cy: Math.sin(ph) * rad * (PORTRAIT ? 1.25 : 0.8),
        cz: Math.sin(th) * Math.cos(ph) * rad * 1.4,
        jit: r(), line: r() < 0.16, sz: 0.8 + r() * 0.9, sl: s.li,
      };
    });
  }

  // 3D network
  {
    const r = rng(77);
    const nodes = [];
    const RX = PORTRAIT ? 0.62 * W : 0.46 * W, RY = PORTRAIT ? 0.40 * H : 0.46 * H, RZ = 0.5 * Math.max(W, H) * 0.6;
    let guard = 0;
    while (nodes.length < 74 && guard++ < 5000) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, rr = 0.45 + 0.55 * Math.cbrt(r());
      const x = Math.sqrt(1 - u * u) * Math.cos(th) * RX * rr;
      const y = u * RY * rr;
      const z = Math.sqrt(1 - u * u) * Math.sin(th) * RZ * rr;
      const b = S.heroBox;
      if (Math.abs(z) < RZ * 0.5 && CX + x > b.l - 30 * U && CX + x < b.r + 30 * U && CY + y > b.t && CY + y < b.b) continue;
      nodes.push({ x, y, z, d: Math.hypot(x / RX, y / RY, z / RZ), major: r() < 0.18, v: r() < 0.12, ph: r() });
    }
    const edges = [];
    const seen = new Set();
    nodes.forEach((n, i) => {
      const ds = nodes.map((m, j) => [Math.hypot(n.x - m.x, n.y - m.y, n.z - m.z), j]).sort((a, b) => a[0] - b[0]);
      for (let k = 1; k <= 3; k++) {
        const j = ds[k][1], key = i < j ? i + '_' + j : j + '_' + i;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ a: i, b: j, per: 1.4 + r() * 2.6, ph: r(), v: r() < 0.14 });
      }
    });
    S.nodes = nodes; S.edges = edges;
    // structured lattice targets for the "learning" phase
    const g = 72 * U;
    const pts = [];
    const m = S.mods, top = m[0].y - S.modH / 2 - 40 * U, bot = m[2].y + S.modH / 2 + 40 * U;
    const ml = CX - S.modW / 2 - 40 * U, mr = CX + S.modW / 2 + 40 * U;
    for (let y = CY - Math.floor(H / 2 / g) * g + g * 0.5; y < H - g * 0.5; y += g) {
      for (let x = CX - Math.floor(W / 2 / g) * g + g * 0.5; x < W - g * 0.4; x += g) {
        if (x > ml && x < mr && y > top && y < bot) continue;
        if (Math.abs(x - CX) < g * 0.6 && y < top && y > S.root[1] - g) continue;
        if (y < 0.08 * H || y > 0.92 * H) continue;
        pts.push([x, y, r()]);
      }
    }
    pts.sort((a, b) => a[2] - b[2]);
    nodes.forEach((n, i) => { n.lt = pts[i % pts.length]; });
    // a few lattice nodes get orthogonal links into the modules
    S.links = [];
    const r2 = rng(91);
    for (let k = 0; k < 3; k++) {
      const my = m[k].y;
      const cand = nodes.filter(n => Math.abs(n.lt[1] - my) < g * 1.6).sort((a, b) => Math.abs(a.lt[1] - my) - Math.abs(b.lt[1] - my));
      cand.slice(0, PORTRAIT ? 2 : 4).forEach(n => S.links.push({ n, k, side: n.lt[0] < CX ? -1 : 1, d: r2() }));
    }
  }

  // Dot field
  {
    const g = 40 * U;
    S.dots = [];
    for (let y = -g * 2; y < H + g * 2; y += g) for (let x = -g * 2; x < W + g * 2; x += g) S.dots.push([x + g / 2, y + g / 2]);
  }

  // Ripple waves (time, strength, speed)
  S.waves = [
    [C.pulse1, 0.35, 900], [C.pulse2, 0.4, 950], [C.salem, 1.0, 1500],
    [C.name + 8 * C.nameStagger + 0.1, 0.45, 1300], [C.hero, 1.0, 1700],
    [C.intel + 0.3, 0.35, 1400], [C.shift, 0.45, 1500], [C.bol + 0.1, 0.9, 1600], [C.lockup + 0.35, 0.45, 1200],
  ];
  S.shakes = [[C.salem + 0.02, 1.2], [C.hero, 3.2], [C.bol + 0.1, 4.5]];

  S.zoomKeys = [
    [0, 1.0], [C.salem, 1.0], [C.gather, 1.025],
    [C.name + 1.6, 1.08, E.inOutCubic],                 // push-in on the name
    [C.flow + 0.9, 1.0, E.inOutCubic],                  // release with the ribbon
    [C.collapse, 1.035],
    [C.hero - 0.02, 1.14, E.inExpo],                     // rush into the core
    [C.hero, 0.95], [C.hero + 0.7, 1.0, E.outExpo],      // burst
    [C.shift, 1.055],
    [C.shift + 0.8, 1.0, E.inOutCubic],
    [C.converge, 1.03],
    [C.ui - 0.02, 1.0, E.inOutCubic],
    [C.lockup, 1.045],
    [C.lockup + 0.6, 1.0, E.inOutCubic],
    [C.end, 1.03],
  ];

  // Ribbon head path: reaches the first letter of СІЗДЕРГЕ exactly at its onset.
  {
    const L = S.siz;
    const x0 = -0.2 * W, x1 = L.left - 10 * U, x2 = L.right + 10 * U, x3 = 1.25 * W;
    const t0 = C.flow, t1 = C.siz - 0.02, t2 = C.siz + 0.42, t3 = C.siz + 0.85;
    S.head = t => {
      if (t < t1) return lerp(x0, x1, E.inCubic(prog(t, t0, t1)) * 0.6 + prog(t, t0, t1) * 0.4);
      if (t < t2) return lerp(x1, x2, prog(t, t1, t2));
      return lerp(x2, x3, E.outCubic(prog(t, t2, t3)));
    };
    S.headInv = x => { let lo = t0, hi = t3; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (S.head(m) < x) lo = m; else hi = m; } return lo; };
  }

  // glow / grain buffers
  S.g1 = document.createElement('canvas'); S.g1.width = Math.ceil(W / 4); S.g1.height = Math.ceil(H / 4);
  S.g2 = document.createElement('canvas'); S.g2.width = Math.ceil(W / 10); S.g2.height = Math.ceil(H / 10);
  S.off = document.createElement('canvas'); S.off.width = W; S.off.height = H;
  S.grain = [0, 1, 2, 3].map(k => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const o = c.getContext('2d'); const d = o.createImageData(256, 256); const r = rng(300 + k);
    for (let i = 0; i < d.data.length; i += 4) { const v = (r() * 255) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    o.putImageData(d, 0, 0); return c;
  });
}

// ─────────────────────────── drawing ─────────────────────────────
function waveAt(t, x, y) {
  let v = 0;
  for (const [t0, s, sp] of S.waves) {
    const d = t - t0;
    if (d < 0 || d > 2.2) continue;
    const r = d * sp * U, w = 80 * U;
    const dist = Math.hypot(x - CX, y - CY);
    v += s * Math.exp(-Math.pow((dist - r) / w, 2)) * Math.exp(-d * 1.4);
  }
  return v;
}

function drawBackground(t) {
  // deep gradient, tinted per act
  const tintHero = prog(t, C.collapse, C.hero) * (1 - prog(t, C.shift, C.shift + 1));
  const tintLearn = prog(t, C.shift, C.shift + 1) * (1 - prog(t, C.converge, C.ui));
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * 0.75);
  const core = mixc(mixc([10, 16, 26], [8, 22, 40], tintHero), [16, 14, 36], tintLearn);
  g.addColorStop(0, col(core));
  g.addColorStop(0.55, col([6, 9, 15]));
  g.addColorStop(1, col(BG));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawDots(t) {
  const base = 0.045 + 0.03 * prog(t, C.shift, C.shift + 1) * (1 - prog(t, C.converge, C.ui));
  const sz = 1.7 * U;
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y] of S.dots) {
    const w = waveAt(t, x, y);
    const a = base + w * 0.55;
    if (a < 0.01) continue;
    ctx.fillStyle = col(w > 0.05 ? mixc(STEEL, CYAN, clamp(w * 1.5)) : STEEL, a);
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function glowDot(x, y, r, c, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col(c, a));
  g.addColorStop(0.35, col(c, a * 0.35));
  g.addColorStop(1, col(c, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function ring(x, y, r, c, a, lw, dash) {
  if (a <= 0.003 || r <= 0) return;
  ctx.save();
  ctx.strokeStyle = col(c, a);
  ctx.lineWidth = lw;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ── Act 1: pulse + СӘЛЕМ! ──
function drawIntro(t) {
  if (t > C.salem + 0.4) return;
  ctx.globalCompositeOperation = 'lighter';
  const a = prog(t, 0.05, 0.22) * (1 - prog(t, C.salem - 0.02, C.salem + 0.1));
  let pulse = 0;
  for (const p of [C.pulse1, C.pulse2]) pulse += Math.exp(-Math.max(0, t - p) * 9) * (t >= p ? 1 : 0);
  glowDot(CX, CY, (40 + 40 * pulse) * U, CYAN, a * (0.35 + 0.5 * pulse));
  ctx.fillStyle = col(WHITE, a);
  ctx.beginPath(); ctx.arc(CX, CY, 2.6 * U * (1 + 0.6 * pulse), 0, Math.PI * 2); ctx.fill();
  for (const p of [C.pulse1, C.pulse2]) {
    const d = t - p;
    if (d < 0 || d > 1) continue;
    ring(CX, CY, E.outExpo(d / 1) * 220 * U, CYAN, 0.45 * (1 - d), 1.2 * U);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawSalem(t) {
  const L = S.salem;
  if (t < C.salem - 0.1 || t > C.salemOut + 0.6) return;
  const n = L.letters.length;
  const breathe = 1 + 0.035 * E.outCubic(prog(t, C.salem + 0.3, C.salemOut));
  ctx.save();
  ctx.translate(CX, CY); ctx.scale(breathe, breathe); ctx.translate(-CX, -CY);
  // mask: letters rise from under the baseline
  ctx.beginPath(); ctx.rect(0, L.top - L.size * 0.5, W, L.cap + L.size * 0.5 + L.size * 0.06); ctx.clip();
  for (let i = 0; i < n; i++) {
    const t0 = C.salem - 0.05 + i * 0.03;
    const p = E.outExpo(prog(t, t0, t0 + 0.55));
    const out = prog(t, C.salemOut + i * 0.015, C.salemOut + 0.26 + i * 0.015);
    const xc = L.letters[i].x + L.letters[i].w / 2;
    const dx = (xc - CX) * 0.38 * (1 - p);
    drawLetter(L, i, { dx, dy: (1 - p) * L.size * 1.0, a: clamp(p * 1.6) * (1 - E.inCubic(out)), c: mixc(CYAN, WHITE, clamp(p * 1.3)) });
  }
  ctx.restore();
  // light burst on the exact pronunciation
  const d = t - C.salem;
  if (d >= -0.02 && d < 1.6) {
    ctx.globalCompositeOperation = 'lighter';
    const k = Math.max(0, d);
    const wv = E.outExpo(clamp(k / 0.3)) * W * 0.62;
    const a = Math.exp(-k * 3.2);
    const gr = ctx.createLinearGradient(CX - wv, 0, CX + wv, 0);
    gr.addColorStop(0, col(CYAN, 0)); gr.addColorStop(0.5, col(WHITE, 0.9 * a)); gr.addColorStop(1, col(CYAN, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(CX - wv, L.base + L.size * 0.16, wv * 2, 1.6 * U);
    const gr2 = ctx.createLinearGradient(CX - wv, 0, CX + wv, 0);
    gr2.addColorStop(0, col(BLUE, 0)); gr2.addColorStop(0.5, col(CYAN, 0.22 * a)); gr2.addColorStop(1, col(BLUE, 0));
    ctx.fillStyle = gr2;
    ctx.fillRect(CX - wv, L.base + L.size * 0.16 - 14 * U, wv * 2, 30 * U);
    glowDot(CX, CY, W * 0.55, BLUE, 0.16 * Math.exp(-k * 4.5));
    const rr = E.outExpo(clamp(k / 1.5)) * Math.max(W, H) * 0.7;
    ring(CX, CY, rr, CYAN, 0.5 * (1 - clamp(k / 1.5)), 1.4 * U, [2 * U, 9 * U]);
    ring(CX, CY, rr * 0.86, CYAN, 0.22 * (1 - clamp(k / 1.5)), 1 * U);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ── Act 2: fragments assemble БЕКСҰЛТАН ──
function partPos(p, t) {
  const drift = E.outCubic(prog(t, C.salemOut, C.salemOut + 1.5));
  const sw = 0.5 * drift + 0.12 * Math.max(0, t - C.salemOut - 1.5);
  const cs = Math.cos(sw), sn = Math.sin(sw);
  const ox = p.cx * drift, oz = p.cz * drift;
  let x = p.sx + (ox * cs - oz * sn), z = ox * sn + oz * cs, y = p.sy + p.cy * drift - 30 * U * drift;
  const arrive = C.name + p.li * C.nameStagger + p.jit * 0.05;
  const start = Math.max(C.gather, arrive - 1.05 - p.jit * 0.2);
  const g = E.inOutCubic(prog(t, start, arrive));
  x = lerp(x, p.tx, g); y = lerp(y, p.ty, g); z = lerp(z, 0, g);
  const f = 900 * U / (900 * U + z);
  return [CX + (x - CX) * f, CY + (y - CY) * f, f, arrive, g];
}

function drawParticles(t) {
  if (t < C.salemOut || t > C.name + 1.2) return;
  ctx.globalCompositeOperation = 'lighter';
  const dt = 1 / 60;
  for (const p of S.parts) {
    const [x, y, f, arrive, g] = partPos(p, t);
    const out = prog(t, C.salemOut + p.sl * 0.015, C.salemOut + 0.26 + p.sl * 0.015);
    let a = out * (1 - prog(t, arrive, arrive + 0.16)) * clamp(f * 0.9, 0.2, 1);
    if (a < 0.01) continue;
    const c = mixc(WHITE, CYAN, clamp(prog(t, C.salemOut, C.salemOut + 0.5) * (1 - g * 0.6)));
    const s = 2.3 * U * p.sz * f * (1 - 0.35 * g);
    ctx.fillStyle = col(c, a * 0.85);
    if (p.line && g < 0.92) {
      const [px, py] = partPos(p, t - dt * 2);
      ctx.strokeStyle = col(c, a * 0.7);
      ctx.lineWidth = 1 * U;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
    } else {
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawName(t) {
  const L = S.name;
  if (t < C.name - 0.1 || t > C.siz + 0.4) return;
  const n = L.letters.length;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a0 = C.name + i * C.nameStagger;
    const p = E.outCubic(prog(t, a0 - 0.04, a0 + 0.14));
    const s = 1 + 0.07 * (1 - E.outCubic(prog(t, a0 - 0.04, a0 + 0.32)));
    // exit: the name streams forward (left letters first) as the ribbon arrives
    const q = E.inCubic(prog(t, C.flow + i * 0.028, C.flow + 0.3 + i * 0.028));
    if (q > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawLetter(L, i, { dx: q * 220 * U, sx: 1 + q * 2.2, a: (1 - q) * 0.9, c: mixc(WHITE, CYAN, q) });
      ctx.globalCompositeOperation = 'source-over';
      continue;
    }
    drawLetter(L, i, { a: p, s, c: mixc(CYAN, WHITE, prog(t, a0, a0 + 0.3)) });
    const fl = 1 - prog(t, a0, a0 + 0.3);
    if (fl > 0 && p > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawLetter(L, i, { a: fl * 0.7, s, c: CYAN });
      // construction frame snapping onto each glyph
      const lt = L.letters[i];
      const pad = 6 * U * (1 + 3 * fl);
      ctx.strokeStyle = col(CYAN, 0.4 * fl * fl);
      ctx.lineWidth = 1 * U;
      ctx.strokeRect(lt.x - pad, L.top - pad, lt.w + pad * 2, L.cap + pad * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // light sweep
  const sp = prog(t, C.nameSweep, C.nameSweep + 0.75);
  if (sp > 0 && sp < 1) {
    const o = S.off.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, W, H);
    o.font = fontStr(L.weight, L.size);
    o.fillStyle = '#fff';
    L.letters.forEach(lt => o.fillText(lt.ch, lt.x, L.base));
    o.globalCompositeOperation = 'source-in';
    const bx = lerp(L.left - L.size, L.right + L.size, E.inOutSine(sp));
    const gr = o.createLinearGradient(bx - L.size * 0.6, L.top, bx + L.size * 0.6, L.base);
    gr.addColorStop(0, 'rgba(120,230,255,0)'); gr.addColorStop(0.5, 'rgba(200,245,255,0.95)'); gr.addColorStop(1, 'rgba(120,230,255,0)');
    o.fillStyle = gr; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85;
    ctx.drawImage(S.off, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  // hairlines extending from the name
  const hp = E.outExpo(prog(t, C.name + 0.42, C.name + 1.2)) * (1 - E.inCubic(prog(t, C.flow, C.flow + 0.45)));
  if (hp > 0) {
    const len = (W / 2 - L.width / 2 - 34 * U) * hp, y = L.cy;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = col(CYAN, 0.45 * hp);
    ctx.fillRect(L.left - 22 * U - len, y, len, 1 * U);
    ctx.fillRect(L.right + 22 * U, y, len, 1 * U);
    ctx.fillStyle = col(WHITE, 0.8 * hp);
    ctx.fillRect(L.left - 22 * U - len - 2 * U, y - 1.5 * U, 4 * U, 4 * U);
    ctx.fillRect(L.right + 22 * U + len - 2 * U, y - 1.5 * U, 4 * U, 4 * U);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ── Act 3: flowing ribbon carries СІЗДЕРГЕ, then collapses into the core ──
function ribbonPoint(k, M, u, t, collapse) {
  const x = lerp(-0.25 * W, 1.25 * W, u);
  const A = (PORTRAIT ? 0.05 * H : 0.07 * H);
  const yc = CY + A * Math.sin(u * Math.PI * 1.6 - 0.9 + t * 0.7) * (0.5 + 0.5 * Math.sin(u * Math.PI));
  const tw = u * Math.PI * 2.2 + t * 1.6;
  const th = (k / (M - 1)) * Math.PI;
  const spread = (PORTRAIT ? 70 : 60) * U * (0.6 + 0.4 * Math.sin(u * Math.PI));
  const off = Math.cos(th + tw) * spread;
  const depth = Math.sin(th + tw);
  let px = x, py = yc + off;
  if (collapse > 0) {
    const sw = collapse * 1.2 * (u - 0.5);
    const dx = px - CX, dy = py - CY;
    const c = Math.cos(sw), s = Math.sin(sw);
    px = CX + (dx * c - dy * s) * (1 - collapse);
    py = CY + (dx * s + dy * c) * (1 - collapse);
  }
  return [px, py, depth];
}

function drawRibbon(t) {
  if (t < C.flow || t > C.hero + 0.05) return;
  const M = 26, N = 70;
  const head = S.head(t);
  const tailX = lerp(-0.25 * W, 1.25 * W, 0) + (head + 0.25 * W) * 0 ;
  const coll = E.inExpo(prog(t, C.collapse, C.hero - 0.03));
  const appear = prog(t, C.flow, C.flow + 0.2);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1.1 * U;
  for (let k = 0; k < M; k++) {
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const [x, y, dep] = ribbonPoint(k, M, u, t, coll);
      const xu = lerp(-0.25 * W, 1.25 * W, u);
      if (xu > head && coll === 0) break;
      if (prev) {
        const near = coll > 0 ? 0 : Math.exp(-Math.max(0, head - xu) / (90 * U));
        const fadeTail = clamp((xu + 0.25 * W) / (0.35 * W));
        const a = (0.10 + 0.16 * (dep * 0.5 + 0.5)) * appear * fadeTail + near * 0.55 + coll * 0.25;
        const c = k % 7 === 3 ? VIOLET : mixc(BLUE, CYAN, dep * 0.5 + 0.5 + near);
        ctx.strokeStyle = col(c, clamp(a));
        ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(x, y); ctx.stroke();
      }
      prev = [x, y];
    }
  }
  // data beads flowing forward along the ribbon
  for (let j = 0; j < 36; j++) {
    const k = (j * 7) % M;
    const u = frac(j * 0.618 + (t - C.flow) * 0.28);
    const xu = lerp(-0.25 * W, 1.25 * W, u);
    if (xu > head && coll === 0) continue;
    const [x, y, dep] = ribbonPoint(k, M, u, t, coll);
    const a = (0.5 + 0.5 * dep) * appear * 0.9;
    ctx.fillStyle = col(WHITE, a);
    ctx.fillRect(x - 1.5 * U, y - 1.5 * U, 3 * U, 3 * U);
  }
  // head flare
  if (coll === 0 && head < 1.2 * W) {
    const [hx, hy] = ribbonPoint(M >> 1, M, (head + 0.25 * W) / (1.5 * W), t, 0);
    glowDot(hx, hy, 90 * U, CYAN, 0.35);
  }
  // collapse core
  if (coll > 0) glowDot(CX, CY, (30 + 90 * coll) * U, CYAN, 0.6 * coll);
  ctx.globalCompositeOperation = 'source-over';
}

function drawSiz(t) {
  const L = S.siz;
  if (t < C.siz - 0.2 || t > C.hero) return;
  const s = 1 + 0.05 * E.inOutSine(prog(t, C.siz + 0.5, C.collapse + 0.3));
  const q = E.inCubic(prog(t, C.collapse, C.hero - 0.12));
  ctx.save();
  ctx.translate(CX, CY); ctx.scale(s, s); ctx.translate(-CX, -CY);
  L.letters.forEach((lt, i) => {
    const t0 = S.headInv(lt.x);
    const p = E.outExpo(prog(t, t0, t0 + 0.55));
    const xc = lt.x + lt.w / 2;
    drawLetter(L, i, {
      dx: -(1 - p) * 46 * U + (CX - xc) * q, skew: -0.28 * (1 - p),
      a: clamp(p * 1.4) * Math.pow(1 - q, 2), c: mixc(mixc(CYAN, WHITE, p), CYAN, q),
    });
    const fl = (1 - prog(t, t0, t0 + 0.35)) * (t >= t0 ? 1 : 0);
    if (fl > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawLetter(L, i, { dx: -(1 - p) * 46 * U, skew: -0.28 * (1 - p), a: fl * 0.8, c: CYAN });
      ctx.globalCompositeOperation = 'source-over';
    }
  });
  ctx.restore();
}

// ── Act 4: HERO — ЖАСАНДЫ / ИНТЕЛЛЕКТ inside an intelligent system ──
function netState(t) {
  const yaw = 0.16 * (t - C.hero) + 0.25 * E.inOutCubic(prog(t, C.lockup, C.end)) ;
  const pitch = 0.22 + 0.04 * Math.sin((t - C.hero) * 0.6);
  return { yaw, pitch };
}
function project(n, st, grow) {
  const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
  let x = n.x * cy - n.z * sy, z = n.x * sy + n.z * cy;
  let y = n.y * cp - z * sp; z = n.y * sp + z * cp;
  x *= grow; y *= grow; z *= grow;
  const F = 1500 * U, f = F / (F + z);
  return [CX + x * f, CY + y * f, f, z];
}

function drawNetwork(t) {
  const on = t >= C.hero - 0.02 && t < C.converge + 0.6;
  const ghost = t >= C.ui ? 0.45 * prog(t, C.bol + 0.1, C.bol + 1.2) + 0.55 * prog(t, C.lockup + 0.3, C.lockup + 1.4) : 0;
  if (!on && ghost <= 0) return;
  const st = netState(t);
  const m = on ? E.inOutCubic(prog(t, C.shift, C.shift + 0.85)) : 0;           // morph to lattice
  const conv = on ? E.inOutCubic(prog(t, C.converge, C.ui - 0.05)) : 0;        // collapse to the line
  const P = S.nodes.map((n, i) => {
    let grow = on ? E.outExpo(prog(t, C.hero + n.d * 0.18, C.hero + 0.9 + n.d * 0.35)) : 1;
    let [x, y, f, z] = project(n, st, grow);
    if (m > 0) {
      const mi = clamp(m * 1.25 - (i % 10) * 0.025);
      x = lerp(x, n.lt[0], mi); y = lerp(y, n.lt[1], mi); f = lerp(f, 1, mi);
    }
    if (conv > 0) {
      const cx = CX + ((i / S.nodes.length) - 0.5) * S.lineW;
      x = lerp(x, cx, conv); y = lerp(y, CY, conv);
    }
    return [x, y, f, z];
  });
  const A = on ? 1 - conv : ghost * 0.24;
  ctx.globalCompositeOperation = 'lighter';
  // edges
  const ea = (1 - m) * A;
  if (ea > 0.01) {
    ctx.lineWidth = 1 * U;
    for (const e of S.edges) {
      const p = P[e.a], q = P[e.b];
      const fa = Math.min(p[2], q[2]);
      const grow = on ? prog(t, C.hero + 0.15 + S.nodes[e.a].d * 0.3, C.hero + 0.8 + S.nodes[e.a].d * 0.4) : 1;
      if (grow <= 0) continue;
      const qx = lerp(p[0], q[0], grow), qy = lerp(p[1], q[1], grow);
      const dep = clamp((fa - 0.75) / 0.5);
      ctx.strokeStyle = col(e.v ? VIOLET : mixc(BLUE, CYAN, dep), (0.07 + 0.2 * dep) * ea);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(qx, qy); ctx.stroke();
      // data packets
      if (on && t > C.hero + 0.6) {
        const ph = frac((t - C.hero) / e.per + e.ph);
        if (ph < 0.32) {
          const u = ph / 0.32;
          const px = lerp(p[0], q[0], u), py = lerp(p[1], q[1], u);
          const bx = lerp(p[0], q[0], Math.max(0, u - 0.18)), by = lerp(p[1], q[1], Math.max(0, u - 0.18));
          const gr = ctx.createLinearGradient(bx, by, px, py);
          gr.addColorStop(0, col(CYAN, 0)); gr.addColorStop(1, col(WHITE, 0.75 * ea * (0.4 + 0.6 * dep)));
          ctx.strokeStyle = gr; ctx.lineWidth = 1.6 * U;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(px, py); ctx.stroke();
          ctx.lineWidth = 1 * U;
        }
      }
    }
  }
  // lattice hairlines + orthogonal links (learning phase)
  if (m > 0 && conv < 1) {
    const la = m * (1 - conv);
    const g = 72 * U;
    ctx.lineWidth = 1 * U;
    for (const e of S.edges) {
      const p = S.nodes[e.a].lt, q = S.nodes[e.b].lt;
      if (Math.abs(p[0] - q[0]) > g * 3.1 || Math.abs(p[1] - q[1]) > g * 3.1) continue;
      const ep = prog(m, 0.55 + e.ph * 0.25, 1);
      if (ep <= 0) continue;
      ctx.strokeStyle = col(e.v ? VIOLET : BLUE, 0.22 * la * ep);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(lerp(p[0], q[0], ep), p[1]);
      if (ep > 0.5) ctx.lineTo(q[0], lerp(p[1], q[1], (ep - 0.5) * 2));
      ctx.stroke();
      const ph = frac((t - C.shift) / e.per + e.ph);
      if (ph < 0.25 && ep >= 1) {
        const u = ph / 0.25, L1 = Math.abs(q[0] - p[0]), L2 = Math.abs(q[1] - p[1]), d = u * (L1 + L2);
        const x = d < L1 ? lerp(p[0], q[0], d / L1) : q[0], y = d < L1 ? p[1] : lerp(p[1], q[1], (d - L1) / Math.max(L2, 1));
        ctx.fillStyle = col(CYAN, 0.8 * la);
        ctx.fillRect(x - 1.5 * U, y - 1.5 * U, 3 * U, 3 * U);
      }
    }
    for (const lk of S.links) {
      const tk = [C.mod1, C.mod2, C.mod3][lk.k];
      const lp = E.outCubic(prog(t, tk - 0.1 + lk.d * 0.2, tk + 0.35 + lk.d * 0.2));
      if (lp <= 0) continue;
      const nx = lk.n.lt[0], ny = lk.n.lt[1], my = S.mods[lk.k].y;
      const ex = CX + lk.side * S.modW / 2;
      const ax = lerp(nx, ex, 0.5);
      ctx.strokeStyle = col(CYAN, 0.28 * la);
      ctx.beginPath();
      const segs = [[nx, ny], [ax, ny], [ax, my], [ex, my]];
      let total = 0; for (let i = 1; i < 4; i++) total += Math.hypot(segs[i][0] - segs[i - 1][0], segs[i][1] - segs[i - 1][1]);
      let rem = total * lp;
      ctx.moveTo(nx, ny);
      for (let i = 1; i < 4 && rem > 0; i++) {
        const d = Math.hypot(segs[i][0] - segs[i - 1][0], segs[i][1] - segs[i - 1][1]);
        const k = Math.min(1, rem / d); rem -= d;
        ctx.lineTo(lerp(segs[i - 1][0], segs[i][0], k), lerp(segs[i - 1][1], segs[i][1], k));
      }
      ctx.stroke();
    }
  }
  // nodes
  P.forEach(([x, y, f], i) => {
    const n = S.nodes[i];
    const grow = on ? prog(t, C.hero + n.d * 0.18, C.hero + 0.35 + n.d * 0.3) : 1;
    const a = A * grow * clamp((f - 0.6) / 0.5, 0.25, 1);
    if (a < 0.01) return;
    const c = n.v ? VIOLET : n.major ? WHITE : CYAN;
    if (m > 0.5) {
      const s = (n.major ? 5 : 3.4) * U;
      ctx.fillStyle = col(n.major ? CYAN : mixc(STEEL, CYAN, 0.4), a * (n.major ? 0.85 : 0.6));
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      if (n.major) { ctx.strokeStyle = col(CYAN, a * 0.35); ctx.lineWidth = 1 * U; ctx.strokeRect(x - 7 * U, y - 7 * U, 14 * U, 14 * U); }
    } else {
      const r = (n.major ? 3.2 : 1.9) * U * f;
      ctx.fillStyle = col(c, a * 0.9);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (n.major) ring(x, y, 8 * U * f, CYAN, a * 0.35 * (1 - m * 2), 1 * U);
      if (n.major && on) glowDot(x, y, 22 * U * f, CYAN, a * 0.25);
    }
  });
  ctx.globalCompositeOperation = 'source-over';
}

function drawHero(t) {
  if (t < C.hero - 0.05 || t > C.shift + 0.7) return;
  const ZH = S.zh, IN = S.in;
  const out = prog(t, C.shift, C.shift + 0.42);         // scan-out at "туралы"
  const outY = lerp(ZH.top - 30 * U, IN.base + 30 * U, E.inOutCubic(out));
  const rnd = (p, k) => p.r * k;

  // core burst at onset
  const d = t - C.hero;
  ctx.globalCompositeOperation = 'lighter';
  if (d >= 0 && d < 1.5) {
    glowDot(CX, CY, W * 0.6, BLUE, 0.22 * Math.exp(-d * 4));
    glowDot(CX, CY, 140 * U, WHITE, 0.5 * Math.exp(-d * 9));
    ring(CX, CY, E.outExpo(clamp(d / 1.2)) * Math.max(W, H) * 0.65, CYAN, 0.45 * (1 - clamp(d / 1.2)), 1.5 * U);
    ring(CX, CY, E.outExpo(clamp(d / 1.4)) * Math.max(W, H) * 0.5, CYAN, 0.25 * (1 - clamp(d / 1.4)), 1 * U, [3 * U, 10 * U]);
  }

  const plate = prog(t, C.hero, C.hero + 0.4) * (1 - out);
  if (plate > 0) {
    ctx.globalCompositeOperation = 'source-over';
    const b = S.heroBox, rx = (b.r - b.l) * 0.62, ry = (b.b - b.t) * 0.62;
    ctx.save();
    ctx.translate(CX, CY); ctx.scale(1, ry / rx);
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    pg.addColorStop(0, `rgba(3,6,12,${0.72 * plate})`); pg.addColorStop(0.6, `rgba(3,6,12,${0.5 * plate})`); pg.addColorStop(1, 'rgba(3,6,12,0)');
    ctx.fillStyle = pg; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
  }
  // ЖАСАНДЫ — generated: algorithmic dot field, then a scanning beam renders solid glyphs
  const beamY = lerp(ZH.top - 0.22 * ZH.size, ZH.base + 0.22 * ZH.size, E.inOutCubic(prog(t, C.hero + 0.1, C.hero + 0.62)));
  const dotsOn = 1 - prog(t, C.hero + 0.62, C.hero + 0.9);
  for (const p of S.zhPts) {
    const ta = C.hero - 0.02 + (p.x - ZH.left) / ZH.width * 0.24 + rnd(p, 0.1);
    if (t < ta || p.y < beamY || p.y < outY) continue;
    const a = prog(t, ta, ta + 0.06) * dotsOn;
    const s = 2 * U;
    ctx.fillStyle = col(p.r2 < 0.12 ? WHITE : CYAN, a * 0.85);
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.beginPath(); ctx.rect(0, Math.max(outY, -1), W, Math.max(0, beamY - outY)); ctx.clip();
  ZH.letters.forEach((_, i) => drawLetter(ZH, i, { c: WHITE }));
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  const ba = prog(t, C.hero + 0.08, C.hero + 0.16) * (1 - prog(t, C.hero + 0.58, C.hero + 0.75));
  if (ba > 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, beamY - 10 * U, W, 12 * U); ctx.clip();
    ZH.letters.forEach((_, i) => drawLetter(ZH, i, { c: CYAN, a: ba }));
    ctx.restore();
    const gr = ctx.createLinearGradient(ZH.left - 80 * U, 0, ZH.right + 80 * U, 0);
    gr.addColorStop(0, col(CYAN, 0)); gr.addColorStop(0.2, col(CYAN, 0.8 * ba)); gr.addColorStop(0.8, col(CYAN, 0.8 * ba)); gr.addColorStop(1, col(CYAN, 0));
    ctx.fillStyle = gr; ctx.fillRect(ZH.left - 80 * U, beamY - 0.75 * U, ZH.width + 160 * U, 1.5 * U);
    const gr2 = ctx.createLinearGradient(0, beamY - 26 * U, 0, beamY);
    gr2.addColorStop(0, col(CYAN, 0)); gr2.addColorStop(1, col(CYAN, 0.10 * ba));
    ctx.fillStyle = gr2; ctx.fillRect(ZH.left - 40 * U, beamY - 26 * U, ZH.width + 80 * U, 26 * U);
  }

  // Neural layer: every letter of ЖАСАНДЫ is a neuron feeding every letter of ИНТЕЛЛЕКТ
  const meshGrow = E.outCubic(prog(t, C.intel - 0.32, C.intel + 0.02));
  const meshA = (1 - E.inCubic(out)) * prog(t, C.intel - 0.32, C.intel - 0.2);
  if (meshA > 0) {
    ctx.lineWidth = 1 * U;
    S.meshTop.forEach(([x0, y0], a) => {
      S.meshBot.forEach(([x1, y1], b) => {
        const ab = C.intel + b * 0.05;                  // arrival = activation of letter b
        const sig = prog(t, ab - 0.2, ab);
        const x = lerp(x0, x1, meshGrow), y = lerp(y0, y1, meshGrow);
        const hot = sig > 0 && sig < 1 ? 1 : 0;
        ctx.strokeStyle = col(mixc(BLUE, CYAN, 0.5), (0.10 + 0.05 * ((a + b) % 3 === 0)) * meshA);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
        if (hot) {
          const u = E.inCubic(sig);
          const px = lerp(x0, x1, u), py = lerp(y0, y1, u);
          ctx.fillStyle = col(WHITE, 0.8 * meshA);
          ctx.fillRect(px - 1.2 * U, py - 1.2 * U, 2.4 * U, 2.4 * U);
        }
        // idle traffic during the hold
        if (t > C.intel + 0.8) {
          const ph = frac((t - C.intel) * 0.55 + ((a * 13 + b * 7) % 17) / 17);
          if (ph < 0.18 && (a * 5 + b) % 4 === 0) {
            const u = ph / 0.18;
            ctx.fillStyle = col(CYAN, 0.6 * meshA);
            ctx.fillRect(lerp(x0, x1, u) - 1 * U, lerp(y0, y1, u) - 1 * U, 2 * U, 2 * U);
          }
        }
      });
    });
    // neuron nodes
    S.meshTop.forEach(([x, y]) => {
      ctx.fillStyle = col(CYAN, 0.9 * meshA);
      ctx.beginPath(); ctx.arc(x, y, 2.6 * U, 0, Math.PI * 2); ctx.fill();
    });
    S.meshBot.forEach(([x, y], b) => {
      const ab = C.intel + b * 0.05;
      const act = prog(t, ab - 0.02, ab + 0.05);
      ctx.fillStyle = col(act > 0 ? WHITE : STEEL, (0.35 + 0.6 * act) * meshA);
      ctx.beginPath(); ctx.arc(x, y, (2.2 + 1.2 * act) * U, 0, Math.PI * 2); ctx.fill();
      const fl = (t >= ab) ? 1 - prog(t, ab, ab + 0.45) : 0;
      if (fl > 0) { ring(x, y, (6 + 26 * (1 - fl)) * U, CYAN, 0.7 * fl * meshA, 1.2 * U); glowDot(x, y, 34 * U, CYAN, 0.5 * fl * meshA); }
    });
  }

  // ИНТЕЛЛЕКТ — each letter fires when its signals arrive: outline, then solid
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.beginPath(); ctx.rect(0, Math.max(outY, IN.top - IN.size), W, H); ctx.clip();
  IN.letters.forEach((lt, b) => {
    const ab = C.intel + b * 0.05;
    const pOut = prog(t, ab - 0.01, ab + 0.12);
    const pFill = E.outCubic(prog(t, ab + 0.04, ab + 0.3));
    const dy = (1 - E.outCubic(prog(t, ab - 0.01, ab + 0.4))) * -0.10 * IN.size;
    if (pOut > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawLetter(IN, b, { dy, stroke: true, c: CYAN, a: pOut * (1 - pFill * 0.9), lw: 1.4 * U });
      ctx.globalCompositeOperation = 'source-over';
    }
    drawLetter(IN, b, { dy, a: pFill, c: mixc(CYAN, WHITE, pFill) });
  });
  ctx.restore();

  // second, slower scan across the whole block (system "reading" the result)
  const s2 = prog(t, C.scan2, C.scan2 + 1.1);
  if (s2 > 0 && s2 < 1) {
    const b = S.heroBox;
    const y = lerp(b.t, b.b, E.inOutSine(s2));
    const a = Math.sin(s2 * Math.PI);
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y - 14 * U, W, 14 * U); ctx.clip();
    ZH.letters.forEach((_, i) => drawLetter(ZH, i, { c: CYAN, a: 0.55 * a }));
    IN.letters.forEach((_, i) => drawLetter(IN, i, { c: CYAN, a: 0.55 * a }));
    ctx.restore();
    const gr = ctx.createLinearGradient(b.l, 0, b.r, 0);
    gr.addColorStop(0, col(CYAN, 0)); gr.addColorStop(0.5, col(CYAN, 0.55 * a)); gr.addColorStop(1, col(CYAN, 0));
    ctx.fillStyle = gr; ctx.fillRect(b.l, y, b.r - b.l, 1 * U);
    ctx.globalCompositeOperation = 'source-over';
  }

  // scan-out beam (abstract → structure)
  if (out > 0 && out < 1) {
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(S.heroBox.l, 0, S.heroBox.r, 0);
    gr.addColorStop(0, col(CYAN, 0)); gr.addColorStop(0.5, col(WHITE, 0.8)); gr.addColorStop(1, col(CYAN, 0));
    ctx.fillStyle = gr; ctx.fillRect(S.heroBox.l, outY, S.heroBox.r - S.heroBox.l, 1.5 * U);
    for (const p of S.zhPts.concat(S.inPts)) {
      const dd = outY - p.y;
      if (dd < 0 || dd > 90 * U) continue;
      ctx.fillStyle = col(CYAN, 0.7 * (1 - dd / (90 * U)));
      ctx.fillRect(p.x - 1 * U, p.y - dd * 0.25 - 1 * U, 2 * U, 2 * U);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawHUD(t) {
  if (t < C.hero || t > C.shift + 0.6) return;
  const b = S.heroBox;
  const inA = E.outExpo(prog(t, C.hero + 0.1, C.hero + 0.8));
  const outA = 1 - E.inCubic(prog(t, C.shift, C.shift + 0.45));
  const A = inA * outA;
  if (A <= 0) return;
  ctx.globalCompositeOperation = 'lighter';
  // corner brackets frame the hero block
  const cx = (b.l + b.r) / 2, cy = (b.t + b.b) / 2;
  const L = 26 * U;
  ctx.strokeStyle = col(CYAN, 0.6 * A);
  ctx.lineWidth = 1.5 * U;
  [[b.l, b.t, 1, 1], [b.r, b.t, -1, 1], [b.l, b.b, 1, -1], [b.r, b.b, -1, -1]].forEach(([x, y, sx, sy]) => {
    const px = lerp(cx, x, inA), py = lerp(cy, y, inA);
    ctx.beginPath(); ctx.moveTo(px, py + sy * L); ctx.lineTo(px, py); ctx.lineTo(px + sx * L, py); ctx.stroke();
  });
  // computation indicator under the frame (algorithmic pattern)
  for (let i = 0; i < 16; i++) {
    const on = ((Math.floor((t - C.hero) * 9) * 7 + i * 13) % 11) < 5;
    ctx.fillStyle = col(on ? CYAN : STEEL, (on ? 0.55 : 0.15) * A);
    ctx.fillRect(b.r - (16 - i) * 9 * U, b.b + 16 * U, 5 * U, 5 * U);
  }
  for (let i = 0; i < 3; i++) {
    const w = (40 + 50 * (0.5 + 0.5 * Math.sin((t - C.hero) * (1.3 + i) + i * 2))) * U;
    ctx.fillStyle = col(i === 1 ? VIOLET : CYAN, 0.4 * A);
    ctx.fillRect(b.l, b.t - (22 + i * 8) * U, w * inA, 2 * U);
  }
  // orbit arcs (top / bottom) with ticks
  const R = Math.max(b.r - b.l, b.b - b.t) * (PORTRAIT ? 0.62 : 0.5) + 30 * U;
  const rot = (t - C.hero) * 0.06;
  const sweep = E.outExpo(prog(t, C.hero + 0.15, C.hero + 1.2)) * (1 - E.inCubic(prog(t, C.shift, C.shift + 0.45)));
  [[-Math.PI / 2, 1], [Math.PI / 2, -1]].forEach(([mid, dir]) => {
    const span = 0.62 * sweep;
    const a0 = mid - span + rot * dir, a1 = mid + span + rot * dir;
    ctx.strokeStyle = col(STEEL, 0.28 * A); ctx.lineWidth = 1 * U;
    ctx.beginPath(); ctx.arc(CX, CY, R, a0, a1); ctx.stroke();
    ctx.strokeStyle = col(CYAN, 0.5 * A); ctx.lineWidth = 2 * U;
    ctx.beginPath(); ctx.arc(CX, CY, R, mid - span * 0.18 + rot * dir * 3, mid + span * 0.05 + rot * dir * 3); ctx.stroke();
    ctx.lineWidth = 1 * U; ctx.strokeStyle = col(STEEL, 0.3 * A);
    for (let a = a0; a <= a1; a += 0.035) {
      const big = Math.abs(((a - a0) / 0.035) % 5) < 0.5;
      const r1 = R + (big ? 10 : 5) * U;
      ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * R, CY + Math.sin(a) * R); ctx.lineTo(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1); ctx.stroke();
    }
  });
  ctx.globalCompositeOperation = 'source-over';
}

// ── Act 5: structured learning — modules, connectors, lattice ──
function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawLessons(t) {
  if (t < C.shift || t > C.ui + 0.1) return;
  const conv = E.inOutCubic(prog(t, C.converge, C.ui - 0.05));
  const textOut = E.inCubic(prog(t, C.converge, C.converge + 0.3));
  const times = [C.mod1, C.mod2, C.mod3];
  const mw = S.modW, mh = S.modH;
  ctx.globalCompositeOperation = 'lighter';
  // root node (the core, now the origin of the structure) + spine
  const rootA = prog(t, C.shift + 0.2, C.shift + 0.5) * (1 - conv);
  if (rootA > 0) {
    const [rx, ry] = S.root;
    ctx.fillStyle = col(WHITE, rootA);
    ctx.fillRect(rx - 4 * U, ry - 4 * U, 8 * U, 8 * U);
    ctx.strokeStyle = col(CYAN, 0.5 * rootA); ctx.lineWidth = 1 * U;
    ctx.strokeRect(rx - 11 * U, ry - 11 * U, 22 * U, 22 * U);
    glowDot(rx, ry, 40 * U, CYAN, 0.3 * rootA);
  }
  for (let k = 0; k < 3; k++) {
    const T = times[k];
    const M = S.mods[k];
    const y = lerp(M.y, CY, conv), h = lerp(mh, 2 * U, conv), w = lerp(mw, S.lineW, conv);
    const x = CX - w / 2;
    // connector from previous module (or root)
    const fromY = k === 0 ? S.root[1] + 11 * U : S.mods[k - 1].y + mh / 2;
    const toY = M.y - mh / 2;
    const cp = E.inOutCubic(prog(t, T - 0.42, T - 0.18)) * (1 - conv);
    if (cp > 0) {
      ctx.fillStyle = col(CYAN, 0.55);
      ctx.fillRect(CX - 0.5 * U, fromY, 1 * U, (toY - fromY) * cp);
      const midY = (fromY + toY) / 2;
      if (cp > 0.5) {
        ctx.fillStyle = col(WHITE, 0.85 * (cp - 0.5) * 2);
        ctx.beginPath(); ctx.arc(CX, midY, 3 * U, 0, Math.PI * 2); ctx.fill();
      }
      // small index tag on the connector
      ctx.font = fontStr(600, 17 * U);
      ctx.fillStyle = col(CYAN, 0.75 * clamp((cp - 0.5) * 2) * (1 - textOut));
      ctx.fillText(M.idx, CX + 14 * U, midY + 6 * U);
    }
    // border draws out from the connector entry (top-centre) both ways
    const bp = E.inOutCubic(prog(t, T - 0.24, T + 0.16));
    if (bp <= 0) continue;
    const per = 2 * (w + h);
    ctx.save();
    roundRectPath(x, y - h / 2, w, h, Math.min(14 * U, h / 2));
    ctx.fillStyle = col(CYAN, 0.045 * bp);
    ctx.fill();
    ctx.strokeStyle = col(CYAN, 0.7);
    ctx.lineWidth = 1.3 * U;
    ctx.setLineDash([per * bp / 2, per]);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(2 * CX, 0); ctx.scale(-1, 1);
    roundRectPath(x, y - h / 2, w, h, Math.min(14 * U, h / 2));
    ctx.strokeStyle = col(CYAN, 0.7); ctx.lineWidth = 1.3 * U;
    ctx.setLineDash([per * bp / 2, per]);
    ctx.stroke();
    ctx.restore();
    // corner accents
    if (bp > 0.9 && conv < 0.5) {
      const ca = (bp - 0.9) * 10 * (1 - conv * 2);
      ctx.fillStyle = col(WHITE, 0.8 * ca);
      [[x, y - h / 2], [x + w, y - h / 2], [x, y + h / 2], [x + w, y + h / 2]].forEach(([px, py]) => ctx.fillRect(px - 2 * U, py - 2 * U, 4 * U, 4 * U));
    }
    // word written in progressively, a cursor leading
    ctx.globalCompositeOperation = 'source-over';
    const L = M.L;
    let lastX = L.left;
    L.letters.forEach((lt, i) => {
      const ti = T + 0.02 + i * 0.034;
      const p = E.outCubic(prog(t, ti, ti + 0.22));
      if (p > 0) lastX = lt.x + lt.w;
      drawLetter(L, i, { dy: (1 - p) * 14 * U - textOut * 30 * U + (y - M.y), a: p * (1 - textOut), c: mixc(CYAN, WHITE, p) });
    });
    const cur = prog(t, T, T + 0.05) * (1 - prog(t, T + 0.04 + L.letters.length * 0.034 + 0.25, T + 0.04 + L.letters.length * 0.034 + 0.35));
    if (cur > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = col(CYAN, 0.9 * cur);
      ctx.fillRect(lastX + 8 * U, L.top, 3 * U, L.cap);
    }
    ctx.globalCompositeOperation = 'lighter';
  }
  // the converged line
  if (conv > 0) {
    const a = conv;
    ctx.fillStyle = col(WHITE, 0.9 * a);
    ctx.fillRect(CX - S.lineW / 2, CY - 0.75 * U, S.lineW, 1.5 * U);
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ── Act 6: ҮЙРЕТЕТІН / line / БОЛАМЫН! ──
function drawFinal(t) {
  if (t < C.ui - 0.1 || t > C.lockup + 0.8) return;
  const UI = S.ui, BO = S.bol;
  const close = E.inOutCubic(prog(t, C.lockup - 0.05, C.lockup + 0.3));       // shutter closes into the line
  const lineShrink = E.inOutCubic(prog(t, C.lockup + 0.22, C.lockup + 0.55));
  const breathe = 1 + 0.025 * E.inOutSine(prog(t, C.bol + 0.3, C.lockup));
  ctx.save();
  ctx.translate(CX, CY); ctx.scale(breathe, breathe); ctx.translate(-CX, -CY);
  // divider line, flaring on the impact
  const land = C.bol + 0.1;
  const imp = t >= land ? Math.exp(-(t - land) * 5) : 0;
  const lw = S.lineW * (1 + 0.08 * imp) * (1 - lineShrink);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = col(WHITE, 0.9);
  ctx.fillRect(CX - lw / 2, CY - 0.75 * U, lw, 1.5 * U);
  if (lw > 4 * U) {
    ctx.fillStyle = col(CYAN, 1);
    ctx.fillRect(CX - lw / 2 - 3 * U, CY - 3 * U, 6 * U, 6 * U);
    ctx.fillRect(CX + lw / 2 - 3 * U, CY - 3 * U, 6 * U, 6 * U);
  }
  const gr = ctx.createLinearGradient(CX - lw / 2, 0, CX + lw / 2, 0);
  gr.addColorStop(0, col(CYAN, 0)); gr.addColorStop(0.5, col(CYAN, 0.25 + 0.5 * imp)); gr.addColorStop(1, col(CYAN, 0));
  ctx.fillStyle = gr; ctx.fillRect(CX - lw / 2, CY - 18 * U, lw, 36 * U);
  ctx.globalCompositeOperation = 'source-over';

  // ҮЙРЕТЕТІН rises out of the line
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, CY - 2 * U); ctx.clip();
  UI.letters.forEach((_, i) => {
    const t0 = C.ui - 0.04 + i * 0.03;
    const p = E.outExpo(prog(t, t0, t0 + 0.6));
    const dy = (1 - p) * (CY - UI.top + UI.size * 0.3) + close * (CY - UI.top + UI.size * 0.35);
    drawLetter(UI, i, { dy, a: clamp(p * 2), c: mixc(CYAN, WHITE, p) });
  });
  ctx.restore();
  // БОЛАМЫН! lands with weight
  ctx.save();
  ctx.beginPath(); ctx.rect(0, CY + 2 * U, W, H); ctx.clip();
  BO.letters.forEach((lt, i) => {
    const t0 = C.bol - 0.06 + i * 0.022;
    const p = prog(t, t0, t0 + 0.2);
    const s = lerp(1.32, 1, E.outCubic(p)) ;
    const dy = -close * (BO.base - CY + 10 * U);
    drawLetter(BO, i, { s, dy, a: clamp(p * 2.2), c: WHITE });
    const fl = t >= t0 + 0.16 ? 1 - prog(t, t0 + 0.16, t0 + 0.5) : 0;
    if (fl > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawLetter(BO, i, { s, dy, a: fl * 0.75, c: CYAN });
      ctx.globalCompositeOperation = 'source-over';
    }
  });
  ctx.restore();
  ctx.restore();
  // impact light
  if (imp > 0) {
    ctx.globalCompositeOperation = 'lighter';
    glowDot(CX, CY + BO.cap * 0.6, W * 0.6, BLUE, 0.2 * imp);
    const k = t - land;
    ring(CX, CY, E.outExpo(clamp(k / 1.1)) * Math.max(W, H) * 0.6, CYAN, 0.4 * (1 - clamp(k / 1.1)), 1.4 * U);
    ctx.globalCompositeOperation = 'source-over';
  }
  // line collapses to the core point → becomes the mark
  if (lineShrink > 0) {
    const mv = E.inOutCubic(prog(t, C.lockup + 0.3, C.lockup + 0.7));
    const y = lerp(CY, S.markY, mv);
    ctx.globalCompositeOperation = 'lighter';
    glowDot(CX, y, 50 * U, CYAN, 0.6 * (1 - mv * 0.5));
    ctx.fillStyle = col(WHITE, 1 - mv);
    ctx.beginPath(); ctx.arc(CX, y, 3.5 * U, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ── Lockup ──
function drawMark(t, x, y, p) {
  if (p <= 0) return;
  const R = 60 * U;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = col(WHITE, 0.9); ctx.lineWidth = 2 * U;
  const sw = E.inOutCubic(clamp(p * 1.2));
  ctx.beginPath(); ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sw); ctx.stroke();
  const n = E.outBack(prog(p, 0.35, 1));
  const tri = [0, 1, 2].map(k => {
    const a = -Math.PI / 2 + k * Math.PI * 2 / 3 + (t - C.lockup) * 0.15;
    return [x + Math.cos(a) * 29 * U * n, y + Math.sin(a) * 29 * U * n];
  });
  ctx.strokeStyle = col(CYAN, 0.75 * clamp(n)); ctx.lineWidth = 1.3 * U;
  ctx.beginPath(); tri.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.stroke();
  tri.forEach(([px, py]) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(px, py); ctx.stroke(); });
  tri.forEach(([px, py]) => { ctx.fillStyle = col(WHITE, clamp(n)); ctx.beginPath(); ctx.arc(px, py, 3.4 * U, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = col(CYAN, 1);
  ctx.beginPath(); ctx.arc(x, y, 4 * U, 0, Math.PI * 2); ctx.fill();
  const oa = -Math.PI / 2 + (t - C.lockup) * 1.1;
  ctx.fillStyle = col(CYAN, clamp(n));
  ctx.beginPath(); ctx.arc(x + Math.cos(oa) * R, y + Math.sin(oa) * R, 3 * U, 0, Math.PI * 2); ctx.fill();
  glowDot(x, y, 90 * U, CYAN, 0.18 * clamp(p));
  ctx.globalCompositeOperation = 'source-over';
}

function drawLockup(t) {
  if (t < C.lockup + 0.4) return;
  const p = prog(t, C.lockup + 0.42, C.lockup + 1.1);
  drawMark(t, CX, S.markY, p);
  const N = S.lkName;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, N.top - 40 * U, W, N.cap + 40 * U + 4 * U); ctx.clip();
  N.letters.forEach((_, i) => {
    const t0 = C.lockup + 0.68 + i * 0.03;
    const q = E.outExpo(prog(t, t0, t0 + 0.6));
    drawLetter(N, i, { dy: (1 - q) * N.cap * 1.4, a: q, c: WHITE });
  });
  ctx.restore();
  const dv = E.inOutCubic(prog(t, C.lockup + 0.85, C.lockup + 1.4));
  ctx.globalCompositeOperation = 'lighter';
  const dw = 320 * U * dv;
  const gr = ctx.createLinearGradient(CX - dw / 2, 0, CX + dw / 2, 0);
  gr.addColorStop(0, col(CYAN, 0)); gr.addColorStop(0.5, col(CYAN, 0.9)); gr.addColorStop(1, col(CYAN, 0));
  ctx.fillStyle = gr; ctx.fillRect(CX - dw / 2, S.lkDivY, dw, 1.2 * U);
  ctx.globalCompositeOperation = 'source-over';
  const D = S.lkDesc;
  D.letters.forEach((lt, i) => {
    const t0 = C.lockup + 0.98 + i * 0.016;
    const q = E.outCubic(prog(t, t0, t0 + 0.45));
    drawLetter(D, i, { dx: (lt.x + lt.w / 2 - CX) * 0.12 * (1 - q), a: q * 0.85, c: mixc(STEEL, CYAN, 0.35) });
  });
  // final light sweep over the name
  const sp = prog(t, C.lockup + 1.5, C.lockup + 2.3);
  if (sp > 0 && sp < 1) {
    const o = S.off.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, W, H);
    o.font = fontStr(N.weight, N.size); o.fillStyle = '#fff';
    N.letters.forEach(lt => o.fillText(lt.ch, lt.x, N.base));
    o.globalCompositeOperation = 'source-in';
    const bx = lerp(N.left - 200 * U, N.right + 200 * U, E.inOutSine(sp));
    const g2 = o.createLinearGradient(bx - 90 * U, 0, bx + 90 * U, 0);
    g2.addColorStop(0, 'rgba(120,230,255,0)'); g2.addColorStop(0.5, 'rgba(210,248,255,1)'); g2.addColorStop(1, 'rgba(120,230,255,0)');
    o.fillStyle = g2; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8; ctx.drawImage(S.off, 0, 0); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ─────────────────────────── post ────────────────────────────────
function post(t, frame) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // bloom: blurred, contrast-thresholded copies added back
  const g1 = S.g1.getContext('2d'), g2 = S.g2.getContext('2d');
  g1.filter = 'none'; g1.clearRect(0, 0, S.g1.width, S.g1.height);
  g1.filter = 'contrast(1.9) brightness(0.8) blur(2.5px)';
  g1.drawImage(cv, 0, 0, S.g1.width, S.g1.height);
  g2.filter = 'none'; g2.clearRect(0, 0, S.g2.width, S.g2.height);
  g2.filter = 'contrast(1.6) brightness(0.9) blur(3px)';
  g2.drawImage(cv, 0, 0, S.g2.width, S.g2.height);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.34; ctx.drawImage(S.g1, 0, 0, W, H);
  ctx.globalAlpha = 0.32; ctx.drawImage(S.g2, 0, 0, W, H);
  ctx.globalAlpha = 1;
  // grain (also breaks up gradient banding)
  const gt = S.grain[frame % 4];
  const pat = ctx.createPattern(gt, 'repeat');
  pat.setTransform(new DOMMatrix().translate((frame * 73) % 256, (frame * 151) % 256));
  ctx.globalAlpha = 0.035; ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // vignette
  const v = ctx.createRadialGradient(CX, CY, Math.min(W, H) * 0.35, CX, CY, Math.hypot(W, H) * 0.58);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  // head / tail
  const fade = Math.max(1 - prog(t, 0, 0.12), E.inCubic(prog(t, C.end - 0.45, C.end)));
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
}

function renderFrame(t, frame = Math.round(t * 60)) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  drawBackground(t);
  const z = camZoom(t), [sx, sy] = camShake(t);
  ctx.setTransform(z, 0, 0, z, CX - z * CX + sx, CY - z * CY + sy);
  drawDots(t);
  drawNetwork(t);
  drawIntro(t);
  drawSalem(t);
  drawParticles(t);
  drawName(t);
  drawRibbon(t);
  drawSiz(t);
  drawHUD(t);
  drawHero(t);
  drawLessons(t);
  drawFinal(t);
  drawLockup(t);
  post(t, frame);
}

// ─────────────────────────── boot ────────────────────────────────
window.ready = (async () => {
  if (RENDER) document.body.classList.add('render');
  TL = await (await fetch('timeline.json')).json();
  C = TL.cues;
  await Promise.all([400, 500, 600, 700, 800].map(w => document.fonts.load(fontStr(w, 40), 'ӘҰҚҢҒӨҮІҺ АБВ 01')));
  build();
  renderFrame(0);
  window.renderFrame = renderFrame;
  window.DURATION = TL.duration;
  return true;
})();

if (!RENDER) {
  // realtime preview, synced to the final mix when it exists
  const btn = document.getElementById('play');
  const audio = new Audio('../output/intro_mix.wav');
  btn.onclick = async () => {
    await window.ready;
    btn.style.opacity = 0;
    audio.currentTime = 0;
    let t0 = performance.now();
    audio.play().then(() => { t0 = performance.now() - audio.currentTime * 1000; }).catch(() => {});
    const loop = () => {
      const t = audio.paused && audio.currentTime === 0 ? (performance.now() - t0) / 1000 : audio.currentTime;
      renderFrame(Math.min(t, TL.duration));
      if (t < TL.duration) requestAnimationFrame(loop); else btn.style.opacity = 1;
    };
    loop();
  };
}
