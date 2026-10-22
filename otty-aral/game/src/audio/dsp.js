// Дыбыс синтезі үшін DSP құралдары (Float32Array, 44.1 кГц).
export const SR = 44100;

export function buf(sec) { return new Float32Array(Math.max(1, Math.ceil(sec * SR))); }

export class Biquad {
  constructor(type, freq, q = 0.707, gain = 0) { this.type = type; this.q = q; this.gain = gain; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(freq); }
  set(freq, q = this.q) {
    freq = Math.max(10, Math.min(SR * 0.49, freq));
    const w = 2 * Math.PI * freq / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    const A = Math.pow(10, this.gain / 40);
    switch (this.type) {
      case 'hp': b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
      case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
      case 'peak': b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; break;
      case 'notch': b0 = 1; b1 = -2 * cs; b2 = 1; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
      default: b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

export function filter(b, type, freq, q = 0.707, gain = 0) {
  const f = new Biquad(type, freq, q, gain);
  for (let i = 0; i < b.length; i++) b[i] = f.p(b[i]);
  return b;
}

// Жиілігі уақыт бойынша өзгеретін сүзгі: freqFn(t) — секунд
export function sweep(b, type, freqFn, q = 0.707) {
  const f = new Biquad(type, freqFn(0), q);
  for (let i = 0; i < b.length; i++) {
    if ((i & 31) === 0) f.set(freqFn(i / SR));
    b[i] = f.p(b[i]);
  }
  return b;
}

export function rngf(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
}

export function noise(len, seed = 1) {
  const b = buf(len), r = rngf(seed);
  for (let i = 0; i < b.length; i++) b[i] = r();
  return b;
}

// Қоңыр (brown) шу — желге ұқсас
export function brown(len, seed = 1) {
  const b = buf(len), r = rngf(seed);
  let v = 0;
  for (let i = 0; i < b.length; i++) { v = (v + r() * 0.04) * 0.995; b[i] = v * 6; }
  return b;
}

export function envExp(b, attack, decay, start = 0) {
  const s0 = Math.floor(start * SR);
  for (let i = 0; i < b.length; i++) {
    const t = (i - s0) / SR;
    if (t < 0) { b[i] = 0; continue; }
    const a = attack > 0 ? Math.min(1, t / attack) : 1;
    b[i] *= a * Math.exp(-Math.max(0, t - attack) / decay);
  }
  return b;
}

export function envAD(b, attack, hold, release) {
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let g;
    if (t < attack) g = t / attack;
    else if (t < attack + hold) g = 1;
    else g = Math.max(0, 1 - (t - attack - hold) / release);
    b[i] *= g;
  }
  return b;
}

export function mix(dst, src, offsetSec = 0, gain = 1) {
  const o = Math.floor(offsetSec * SR);
  const n = Math.min(src.length, dst.length - o);
  for (let i = 0; i < n; i++) if (o + i >= 0) dst[o + i] += src[i] * gain;
  return dst;
}

export function gain(b, g) { for (let i = 0; i < b.length; i++) b[i] *= g; return b; }

export function softclip(b, drive = 1) {
  const k = Math.tanh(drive);
  for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * drive) / k;
  return b;
}

export function normalize(b, peak = 0.95) {
  let m = 0;
  for (let i = 0; i < b.length; i++) { const a = Math.abs(b[i]); if (a > m) m = a; }
  if (m > 0) gain(b, peak / m);
  return b;
}

export function fadeOut(b, sec) {
  const n = Math.min(b.length, Math.floor(sec * SR));
  for (let i = 0; i < n; i++) b[b.length - 1 - i] *= i / n;
  return b;
}

export function fadeIn(b, sec) {
  const n = Math.min(b.length, Math.floor(sec * SR));
  for (let i = 0; i < n; i++) b[i] *= i / n;
  return b;
}

// Синусоида (жиілікті функция ретінде беруге болады)
export function tone(len, freq, type = 'sine', phase0 = 0) {
  const b = buf(len);
  let ph = phase0;
  const ff = typeof freq === 'function' ? freq : () => freq;
  for (let i = 0; i < b.length; i++) {
    const f = ff(i / SR);
    ph += f / SR;
    const x = ph - Math.floor(ph);
    switch (type) {
      case 'saw': b[i] = 2 * x - 1; break;
      case 'square': b[i] = x < 0.5 ? 1 : -1; break;
      case 'tri': b[i] = 4 * Math.abs(x - 0.5) - 1; break;
      default: b[i] = Math.sin(2 * Math.PI * x);
    }
  }
  return b;
}

// Модалды синтез — металл, ағаш соққылары
export function modal(len, modes, seed = 3) {
  const b = buf(len), r = rngf(seed);
  for (const [f, decay, amp] of modes) {
    const ph = (r() + 1) * Math.PI;
    const w = 2 * Math.PI * f / SR;
    for (let i = 0; i < b.length; i++) b[i] += Math.sin(w * i + ph) * Math.exp(-i / SR / decay) * amp;
  }
  return b;
}

// Карплус-Стронг — шертпелі ішек (домбыра)
export function pluck(len, freq, { damp = 0.996, bright = 0.3, seed = 9, pos = 0.25 } = {}) {
  const b = buf(len);
  const N = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(N);
  const r = rngf(seed);
  // Шерту орнына байланысты бастапқы пішін
  for (let i = 0; i < N; i++) line[i] = r() * (0.6 + 0.4 * Math.sin(Math.PI * i / N));
  const pn = Math.floor(N * pos);
  for (let i = N - 1; i >= pn; i--) line[i] -= line[i - pn] * 0.6;
  let lp = 0, idx = 0;
  const a = 0.5 * (1 - bright);
  for (let i = 0; i < b.length; i++) {
    const cur = line[idx];
    const nx = line[(idx + 1) % N];
    const v = (cur * (1 - a) + nx * a) * damp;
    lp = v;
    line[idx] = lp;
    b[i] = cur;
    idx = (idx + 1) % N;
  }
  return b;
}

// Freeverb тәрізді жаңғырық (моно)
const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLP = [556, 441, 341, 225];
export function reverb(input, { room = 0.84, damp = 0.3, wet = 0.3, dry = 1, spread = 0, tail = 1.5, predelay = 0.01 } = {}) {
  const extra = Math.floor(tail * SR);
  const out = new Float32Array(input.length + extra);
  const pd = Math.floor(predelay * SR);
  const combs = COMBS.map((l) => ({ b: new Float32Array(l + spread), i: 0, f: 0 }));
  const alls = ALLP.map((l) => ({ b: new Float32Array(l + spread), i: 0 }));
  for (let n = 0; n < out.length; n++) {
    const xi = n - pd;
    const x = (xi >= 0 && xi < input.length ? input[xi] : 0) * 0.015;
    let s = 0;
    for (const c of combs) {
      const y = c.b[c.i];
      c.f = y * (1 - damp) + c.f * damp;
      c.b[c.i] = x + c.f * room;
      c.i = (c.i + 1) % c.b.length;
      s += y;
    }
    for (const a of alls) {
      const y = a.b[a.i];
      a.b[a.i] = s + y * 0.5;
      a.i = (a.i + 1) % a.b.length;
      s = y - s;
    }
    out[n] = s * wet + (n < input.length ? input[n] * dry : 0);
  }
  return out;
}

// Цикл жігін жасыру: соңғы бөлігін басына араластыру
export function loopify(b, xfSec) {
  const n = Math.floor(xfSec * SR);
  const L = b.length - n;
  const out = new Float32Array(L);
  for (let i = 0; i < L; i++) out[i] = b[i];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    out[i] = b[i] * Math.sqrt(t) + b[L + i] * Math.sqrt(1 - t);
  }
  return out;
}

export function concat(...parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const o = new Float32Array(n);
  let k = 0;
  for (const p of parts) { o.set(p, k); k += p.length; }
  return o;
}

export function delay(b, sec, fb = 0.3, wet = 0.3, lpHz = 3000) {
  const d = Math.floor(sec * SR);
  const out = new Float32Array(b.length + d * 4);
  const lp = new Biquad('lp', lpHz);
  const line = new Float32Array(d);
  let i2 = 0;
  for (let i = 0; i < out.length; i++) {
    const x = i < b.length ? b[i] : 0;
    const y = line[i2];
    line[i2] = lp.p(x + y * fb);
    i2 = (i2 + 1) % d;
    out[i] = x + y * wet;
  }
  return out;
}
