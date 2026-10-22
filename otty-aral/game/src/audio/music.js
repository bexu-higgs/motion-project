// Процедуралық қазақы әуен: домбыра (Карплус-Стронг), қобыз бурдоны, дауылпаз.
import { SR, buf, filter, noise, envExp, envAD, mix, softclip, normalize, tone, pluck, reverb, Biquad, rngf } from './dsp.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Домбыра шертпесі: екі ішек (әуен + бурдон), корпус резонансы
function dombraStrum(len, melody, drone, accent, seed, up) {
  const b = buf(len);
  const off = up ? 0.012 : 0.006;
  const s1 = pluck(len, mtof(melody), { damp: 0.9965, bright: 0.25 + accent * 0.15, seed, pos: 0.18 });
  const s2 = pluck(len, mtof(drone), { damp: 0.996, bright: 0.2, seed: seed + 1, pos: 0.22 });
  mix(b, up ? s2 : s1, 0, up ? 0.55 : 0.8 * (0.7 + accent * 0.3));
  mix(b, up ? s1 : s2, off, up ? 0.6 : 0.55);
  // Тырнақ соққысы
  const n = noise(0.01, seed + 2); filter(n, 'hp', 3000); envExp(n, 0, 0.002);
  mix(b, n, 0, 0.12 + accent * 0.1);
  return b;
}

function bodyFilter(b) {
  const f1 = new Biquad('peak', 220, 1.2, 5), f2 = new Biquad('peak', 950, 1.5, 3), f3 = new Biquad('hp', 80), f4 = new Biquad('lp', 6500);
  for (let i = 0; i < b.length; i++) b[i] = f4.p(f3.p(f2.p(f1.p(b[i]))));
  return b;
}

function drum(len, accent, seed) {
  const b = buf(len);
  const t = tone(0.4, (x) => 52 + 55 * Math.exp(-x / 0.03)); envExp(t, 0.002, 0.16);
  const n = noise(0.15, seed); filter(n, 'bp', 320, 0.9); envExp(n, 0.001, 0.04);
  const jingle = noise(0.25, seed + 1); filter(jingle, 'hp', 6000); envExp(jingle, 0.001, 0.07);
  mix(b, t, 0, 0.9 * accent); mix(b, n, 0, 0.5 * accent); mix(b, jingle, 0.005, 0.12);
  return b;
}

// Қобыз — ысқылы, қыржыңдаған дыбыс
function kobyz(len, midi, seed) {
  const b = buf(len);
  const f = mtof(midi);
  const r = rngf(seed);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t * 2);
    ph += f * vib / SR;
    const x = ph - Math.floor(ph);
    b[i] = (2 * x - 1) * 0.6 + r() * 0.12;
  }
  filter(b, 'bp', 700, 0.7);
  const f2 = b.slice(); filter(f2, 'bp', 1600, 2);
  mix(b, f2, 0, 0.6);
  envAD(b, 0.4, len - 1.2, 0.8);
  return b;
}

function sybyzgy(len, midi, seed) {
  const b = tone(len, (t) => mtof(midi) * (1 + 0.008 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t * 3)));
  const br = noise(len, seed); filter(br, 'bp', mtof(midi) * 2, 2);
  mix(b, br, 0, 0.25);
  envAD(b, 0.06, len * 0.6, len * 0.35);
  return b;
}

// Негізгі мәзір әуені (~29 с, циклды)
export function menuTheme() {
  const E = 0.155; // сегіздік нота
  // D Дориан: D E F G A B C
  const A1 = [69, 69, 69, 67, 69, 72, 74, 72, 69, 67, 65, 67, 69, 69, 67, 65, 64, 65, 62, 62, 62, 62, 64, 65];
  const B1 = [67, 67, 69, 72, 72, 74, 74, 72, 69, 72, 69, 67, 65, 67, 69, 67, 65, 64, 62, 62, 62, 62, 57, 60];
  const A2 = [74, 74, 74, 72, 74, 76, 77, 76, 74, 72, 69, 72, 74, 74, 72, 69, 67, 69, 62, 62, 62, 62, 64, 65];
  const B2 = [67, 69, 71, 72, 71, 69, 74, 72, 69, 67, 69, 67, 65, 64, 65, 67, 64, 62, 62, 62, 62, 62, 62, 62];
  const melody = [...A1, ...B1, ...A2, ...B2, ...A1, ...B2];
  const bars = melody.length / 6;
  const L = melody.length * E + 3;
  const left = buf(L), right = buf(L);
  const dom = buf(L);
  for (let i = 0; i < melody.length; i++) {
    const inBeat = i % 3;
    const accent = inBeat === 0 ? 1 : 0.55;
    const up = inBeat === 1;
    const drone = (Math.floor(i / 6) % 4 === 3 && inBeat === 0) ? 57 : 50;
    const s = dombraStrum(0.9, melody[i], drone, accent, 1000 + i * 7, up);
    // Кейбір қағыстарда қосымша «шалма» (жылдам үштік)
    mix(dom, s, i * E + (inBeat === 2 ? 0.01 : 0), 0.9);
    if (inBeat === 2 && i % 12 === 11) {
      const s2 = dombraStrum(0.5, melody[i], 50, 0.4, 3000 + i, true);
      mix(dom, s2, i * E + E * 0.5, 0.5);
    }
  }
  bodyFilter(dom);
  // Дауылпаз
  const drums = buf(L);
  for (let bar = 0; bar < bars; bar++) {
    mix(drums, drum(0.5, 1, 50 + bar), bar * 6 * E, 0.7);
    mix(drums, drum(0.5, 0.55, 80 + bar), bar * 6 * E + 3 * E, 0.6);
    if (bar % 2 === 1) mix(drums, drum(0.5, 0.35, 120 + bar), bar * 6 * E + 5 * E, 0.5);
  }
  // Қобыз бурдоны
  const drone = buf(L);
  const segLen = 24 * E;
  for (let k = 0; k * segLen < L - 2; k++) {
    const note = [50, 50, 53, 50, 48, 50][k % 6];
    mix(drone, kobyz(segLen + 1.2, note, 900 + k), k * segLen, 0.22);
  }
  // Сыбызғы — екінші бөлімде
  const flute = buf(L);
  const fl = [[74, 4], [72, 2], [69, 4], [67, 2], [69, 6], [72, 4], [74, 2], [76, 4], [74, 8]];
  let t0 = 48 * E;
  for (const [n, d] of fl) { mix(flute, sybyzgy(d * E + 0.25, n, n * 3), t0, 0.13); t0 += d * E; }
  // Стерео араластыру
  for (let i = 0; i < L * SR; i++) {
    const d = dom[i] || 0, dr = drums[i] || 0, k = drone[i] || 0, f = flute[i] || 0;
    left[i] = d * 0.85 + dr * 0.8 + k * 1.0 + f * 0.7;
    right[i] = d * 0.7 + dr * 0.8 + k * 0.8 + f * 1.0;
  }
  const rl = reverb(left, { room: 0.86, damp: 0.4, wet: 0.35, dry: 1, tail: 0.01, predelay: 0.02 });
  const rr = reverb(right, { room: 0.86, damp: 0.4, wet: 0.35, dry: 1, tail: 0.01, predelay: 0.025, spread: 23 });
  softclip(rl, 1.1); softclip(rr, 1.1);
  const loopLen = Math.floor(melody.length * E * SR);
  const outL = new Float32Array(loopLen), outR = new Float32Array(loopLen);
  for (let i = 0; i < loopLen; i++) {
    outL[i] = rl[i] + (rl[i + loopLen] || 0);
    outR[i] = rr[i] + (rr[i + loopLen] || 0);
  }
  normalize(outL, 0.8); normalize(outR, 0.8);
  return [outL, outR];
}

// Жеңіс әуені
export function victoryTheme() {
  const L = 6;
  const left = buf(L), right = buf(L);
  const dom = buf(L);
  const E = 0.11;
  const notes = [62, 65, 69, 74, 72, 74, 77, 81, 79, 77, 74, 77, 74, 74, 74, 74, 74, 74];
  notes.forEach((n, i) => mix(dom, dombraStrum(1.6, n, i > 12 ? 62 : 50, i % 3 === 0 ? 1 : 0.6, 7000 + i, i % 3 === 1), i * E, 0.8));
  bodyFilter(dom);
  const brass = buf(L);
  for (const [n, t, d] of [[62, 1.3, 2.5], [69, 1.3, 2.5], [74, 1.3, 2.5], [78, 1.3, 2.5]]) {
    const s = tone(d, mtof(n), 'saw'); filter(s, 'lp', 2400); envAD(s, 0.08, d * 0.5, d * 0.45);
    mix(brass, s, t, 0.12);
  }
  const drums = buf(L);
  for (let i = 0; i < 8; i++) mix(drums, drum(0.5, i % 2 ? 0.6 : 1, 60 + i), i * 3 * E, 0.7);
  mix(drums, drum(0.8, 1.2, 99), 1.3, 1);
  const sw = noise(2.5, 5); filter(sw, 'hp', 5000); envAD(sw, 1.0, 0.2, 1.2);
  mix(drums, sw, 0.3, 0.12);
  for (let i = 0; i < L * SR; i++) { left[i] = dom[i] * 0.9 + brass[i] + drums[i]; right[i] = dom[i] * 0.75 + brass[i] * 1.1 + drums[i]; }
  const rl = reverb(left, { room: 0.85, wet: 0.3, tail: 1.0 });
  const rr = reverb(right, { room: 0.85, wet: 0.3, tail: 1.0, spread: 23 });
  normalize(rl, 0.85); normalize(rr, 0.85);
  return [rl, rr];
}

export function defeatTheme() {
  const L = 4.5;
  const b = buf(L);
  for (const [n, t, d] of [[62, 0, 1.4], [60, 1.0, 1.4], [57, 2.0, 2.4]]) mix(b, kobyz(d + 0.6, n + 12, n), t, 0.5);
  const dom = buf(L);
  [57, 53, 50].forEach((n, i) => mix(dom, dombraStrum(2.0, n, 50, 1, 800 + i, false), i * 1.0, 0.7));
  bodyFilter(dom);
  mix(b, dom, 0, 0.8);
  const out = reverb(b, { room: 0.88, wet: 0.4, tail: 1.5 });
  softclip(out, 1.1);
  normalize(out, 0.75);
  return [out, out];
}
