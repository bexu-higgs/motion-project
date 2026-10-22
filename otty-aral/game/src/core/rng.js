// Тұқымды кездейсоқ сандар және шу функциялары (simplex, мәндік, плиткалы).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1) { this.next = mulberry32(seed); }
  float(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.next()); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  weighted(entries) { // [[value, weight], ...]
    let sum = 0;
    for (const e of entries) sum += e[1];
    let r = this.next() * sum;
    for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// --- 2D Simplex шуы ---
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

export class Simplex {
  constructor(seed = 1) {
    const r = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  noise(xin, yin) {
    const perm = this.perm;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = GRAD[perm[ii + perm[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * (n0 + n1 + n2);
  }
  fbm(x, y, oct = 5, lac = 2, gain = 0.5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let o = 0; o < oct; o++) { s += a * this.noise(x * f, y * f); n += a; a *= gain; f *= lac; }
    return s / n;
  }
  ridged(x, y, oct = 5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let o = 0; o < oct; o++) { const v = 1 - Math.abs(this.noise(x * f, y * f)); s += a * v * v; n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }
}

// --- Плиткалы мәндік шу (текстуралар үшін, шетінде жалғасады) ---
export class TileNoise {
  constructor(seed = 7) {
    const r = mulberry32(seed);
    this.vals = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) this.vals[i] = r();
  }
  hash(ix, iy, p) {
    ix = ((ix % p) + p) % p; iy = ((iy % p) + p) % p;
    return this.vals[((ix * 73856093) ^ (iy * 19349663)) & 4095];
  }
  // x, y ∈ [0,1) — period ұяшық саны
  value(x, y, period) {
    const fx = x * period, fy = y * period;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const a = this.hash(ix, iy, period), b = this.hash(ix + 1, iy, period);
    const c = this.hash(ix, iy + 1, period), d = this.hash(ix + 1, iy + 1, period);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  fbm(x, y, period, oct = 4, gain = 0.5) {
    let a = 1, p = period, s = 0, n = 0;
    for (let o = 0; o < oct; o++) { s += a * this.value(x, y, p); n += a; a *= gain; p *= 2; }
    return s / n;
  }
  // Вороной (жасушалық) шу — тас, қабыршақ т.б. үшін
  cell(x, y, period) {
    const fx = x * period, fy = y * period;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    let d1 = 9, d2 = 9, id = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox, cy = iy + oy;
      const h = this.hash(cx, cy, period), h2 = this.hash(cx + 17, cy + 31, period);
      const px = cx + h, py = cy + h2;
      const d = (px - fx) * (px - fx) + (py - fy) * (py - fy);
      if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) d2 = d;
    }
    return { d1: Math.sqrt(d1), d2: Math.sqrt(d2), id };
  }
}
