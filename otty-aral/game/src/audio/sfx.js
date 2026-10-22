// Дыбыс эффектілерінің кітапханасы — барлығы синтезделеді.
import {
  SR, buf, filter, sweep, noise, brown, envExp, envAD, mix, gain, softclip, normalize, fadeOut, fadeIn,
  tone, modal, pluck, reverb, loopify, concat, delay, rngf, Biquad,
} from './dsp.js';

// ---------- Атыс ----------
const GUN = {
  pistol: { len: 0.9, body: 0.045, crackHp: 2500, lp0: 9000, lp1: 1800, tone: 2100, tq: 1.2, f0: 220, f1: 70, thump: 0.06, thumpG: 0.7, drive: 1.6, tail: 0.32, echo: 0.16, mech: [3900, 5200], mechG: 0.18 },
  smg: { len: 0.8, body: 0.04, crackHp: 2800, lp0: 9000, lp1: 2200, tone: 2600, tq: 1.4, f0: 230, f1: 85, thump: 0.05, thumpG: 0.6, drive: 1.8, tail: 0.28, echo: 0.14, mech: [4300, 6100], mechG: 0.14 },
  ak: { len: 1.2, body: 0.085, crackHp: 1800, lp0: 7000, lp1: 1200, tone: 1350, tq: 1.0, f0: 180, f1: 48, thump: 0.1, thumpG: 1.0, drive: 2.4, tail: 0.5, echo: 0.22, mech: [3100, 4700], mechG: 0.12 },
  m4: { len: 1.1, body: 0.07, crackHp: 2200, lp0: 9000, lp1: 1700, tone: 1900, tq: 1.3, f0: 200, f1: 58, thump: 0.08, thumpG: 0.85, drive: 2.0, tail: 0.45, echo: 0.2, mech: [3600, 5600], mechG: 0.12 },
  shotgun: { len: 1.5, body: 0.16, crackHp: 1200, lp0: 6000, lp1: 700, tone: 800, tq: 0.8, f0: 140, f1: 38, thump: 0.16, thumpG: 1.3, drive: 2.8, tail: 0.7, echo: 0.26, mech: [2400, 3800], mechG: 0.1 },
  sniper: { len: 1.9, body: 0.13, crackHp: 1500, lp0: 9000, lp1: 1000, tone: 1150, tq: 0.9, f0: 160, f1: 36, thump: 0.14, thumpG: 1.25, drive: 2.6, tail: 1.0, echo: 0.34, mech: [3000, 4400], mechG: 0.1 },
};

function gunshot(p, seed, far = false) {
  const L = p.len;
  const dry = buf(L);
  // 1) Соққы толқыны (crack)
  const crack = noise(0.012, seed);
  filter(crack, 'hp', p.crackHp);
  envExp(crack, 0.0002, 0.0025);
  mix(dry, crack, 0, far ? 0.25 : 1.3);
  // 2) Негізгі жарылыс денесі
  const body = noise(L * 0.6, seed + 1);
  envExp(body, 0.0006, p.body);
  sweep(body, 'lp', (t) => p.lp1 + (p.lp0 - p.lp1) * Math.exp(-t / (p.body * 0.8)), 0.8);
  const res = body.slice();
  filter(res, 'bp', p.tone, p.tq);
  mix(dry, body, 0, 0.9);
  mix(dry, res, 0, 1.4);
  // 3) Төменгі жиілікті соққы
  const th = tone(p.thump * 4, (t) => p.f1 + (p.f0 - p.f1) * Math.exp(-t / (p.thump * 0.35)));
  envExp(th, 0.001, p.thump);
  softclip(th, 1.5);
  mix(dry, th, 0, p.thumpG);
  // 4) Механика (ысырма шыртылы)
  if (!far) {
    const m = modal(0.08, [[p.mech[0], 0.012, 1], [p.mech[1], 0.008, 0.7], [p.mech[0] * 1.73, 0.006, 0.4]], seed + 5);
    mix(dry, m, 0.018, p.mechG);
  }
  softclip(dry, p.drive);
  // 5) Кеңістік: шағылысу + жаңғырық
  let wetSrc = dry.slice();
  filter(wetSrc, 'lp', far ? 1400 : 3200);
  let out;
  if (far) {
    filter(dry, 'lp', 1100);
    filter(dry, 'hp', 90);
    out = reverb(dry, { room: 0.88, damp: 0.5, wet: p.tail * 2.2, dry: 0.55, tail: 1.2, predelay: 0.03 });
  } else {
    out = reverb(dry, { room: 0.82, damp: 0.35, wet: p.tail, dry: 1, tail: 0.9, predelay: 0.012 });
  }
  const echo = wetSrc;
  filter(echo, 'lp', 1500);
  mix(out, echo, p.echo, far ? 0.35 : 0.22);
  mix(out, echo, p.echo * 2.3, 0.1);
  fadeOut(out, 0.25);
  return normalize(out, far ? 0.75 : 0.98);
}

// Мергендік мылтықтың ысырмасы
function boltCycle(seed) {
  const b = buf(0.6);
  const up = modal(0.05, [[2200, 0.01, 1], [3500, 0.008, 0.6]], seed);
  mix(b, up, 0.0, 0.6);
  const slide = noise(0.12, seed + 1); filter(slide, 'bp', 3000, 1.5); envAD(slide, 0.02, 0.06, 0.04);
  mix(b, slide, 0.05, 0.35);
  mix(b, modal(0.06, [[1800, 0.012, 1], [2900, 0.01, 0.5]], seed + 2), 0.18, 0.7);
  const slide2 = noise(0.1, seed + 3); filter(slide2, 'bp', 2600, 1.5); envAD(slide2, 0.02, 0.05, 0.03);
  mix(b, slide2, 0.26, 0.3);
  mix(b, modal(0.08, [[1500, 0.015, 1], [2400, 0.012, 0.7], [600, 0.02, 0.4]], seed + 4), 0.36, 0.9);
  return normalize(b, 0.7);
}

function pumpCycle(seed) {
  const b = buf(0.5);
  const s1 = noise(0.1, seed); filter(s1, 'bp', 1800, 1.2); envAD(s1, 0.01, 0.04, 0.05);
  mix(b, s1, 0, 0.5);
  mix(b, modal(0.08, [[900, 0.02, 1], [1700, 0.015, 0.6], [2900, 0.01, 0.4]], seed + 1), 0.09, 1);
  const s2 = noise(0.1, seed + 2); filter(s2, 'bp', 1600, 1.2); envAD(s2, 0.01, 0.04, 0.05);
  mix(b, s2, 0.2, 0.5);
  mix(b, modal(0.08, [[1100, 0.02, 1], [2100, 0.015, 0.6]], seed + 3), 0.3, 1.1);
  return normalize(b, 0.8);
}

// ---------- Оқтау ----------
function click(seed, f = 3000, dur = 0.05, g = 1) {
  const b = modal(dur, [[f, dur * 0.25, 1], [f * 1.48, dur * 0.18, 0.6], [f * 0.53, dur * 0.3, 0.4]], seed);
  const n = noise(0.01, seed + 9); filter(n, 'hp', 2000); envExp(n, 0.0002, 0.002);
  mix(b, n, 0, 0.6);
  return gain(b, g);
}
function slideNoise(seed, dur, f) {
  const n = noise(dur, seed); filter(n, 'bp', f, 1.4); envAD(n, dur * 0.2, dur * 0.4, dur * 0.4);
  return n;
}
function reloadSound(kind, seed) {
  const L = kind === 'sniper' ? 2.2 : kind === 'pistol' ? 1.3 : 2.0;
  const b = buf(L);
  // Оқшантайды шығару
  mix(b, slideNoise(seed, 0.12, 2200), 0.05, 0.4);
  mix(b, click(seed + 1, 2400, 0.06), 0.15, 0.8);
  mix(b, modal(0.1, [[420, 0.03, 1], [760, 0.02, 0.5]], seed + 2), 0.2, 0.35);
  // Мата шуы
  const cloth = noise(0.3, seed + 3); filter(cloth, 'bp', 900, 0.8); envAD(cloth, 0.08, 0.1, 0.12);
  mix(b, cloth, 0.35, 0.22);
  // Жаңасын салу
  const tIn = kind === 'pistol' ? 0.7 : 1.0;
  mix(b, slideNoise(seed + 4, 0.1, 2600), tIn - 0.08, 0.35);
  mix(b, click(seed + 5, 3200, 0.07, 1.1), tIn, 1);
  mix(b, modal(0.12, [[380, 0.04, 1], [620, 0.03, 0.6]], seed + 6), tIn, 0.5);
  // Ысырманы тарту
  const tB = kind === 'pistol' ? 1.0 : 1.45;
  mix(b, click(seed + 7, 2000, 0.06, 0.8), tB, 1);
  mix(b, slideNoise(seed + 8, 0.08, 3000), tB + 0.02, 0.5);
  mix(b, click(seed + 9, 2800, 0.08, 1.2), tB + 0.12, 1);
  return normalize(reverb(b, { room: 0.5, wet: 0.08, tail: 0.2 }), 0.75);
}
function shellInsert(seed) {
  const b = buf(0.3);
  mix(b, slideNoise(seed, 0.06, 2500), 0, 0.4);
  mix(b, click(seed + 1, 1900, 0.07), 0.07, 1);
  mix(b, modal(0.1, [[700, 0.03, 1]], seed + 2), 0.07, 0.3);
  return normalize(b, 0.6);
}
function dryFire(seed) { return normalize(click(seed, 3400, 0.05), 0.5); }
function weaponSwitch(seed) {
  const b = buf(0.45);
  const cl = noise(0.25, seed); filter(cl, 'bp', 1100, 0.7); envAD(cl, 0.05, 0.05, 0.12);
  mix(b, cl, 0, 0.45);
  mix(b, click(seed + 1, 2600, 0.06), 0.2, 0.8);
  mix(b, click(seed + 2, 1800, 0.05), 0.3, 0.5);
  return normalize(b, 0.6);
}

// ---------- Қадамдар ----------
function footstep(surface, seed) {
  const b = buf(0.32);
  const r = rngf(seed);
  const thud = tone(0.1, (t) => 70 + 60 * Math.exp(-t / 0.02));
  envExp(thud, 0.002, 0.03);
  if (surface === 'grass' || surface === 'dirt') {
    const n = noise(0.18, seed); filter(n, 'bp', surface === 'grass' ? 2600 : 1600, 0.6); envAD(n, 0.01, 0.03, 0.12);
    // Сықырлаған шөп
    for (let i = 0; i < 14; i++) {
      const c = noise(0.004, seed + i); filter(c, 'hp', 3000); envExp(c, 0, 0.0015);
      mix(b, c, 0.01 + Math.abs(r()) * 0.12, 0.25 * Math.abs(r()));
    }
    mix(b, n, 0, 0.55); mix(b, thud, 0, 0.6);
  } else if (surface === 'concrete' || surface === 'metal_floor') {
    const t = noise(0.05, seed); filter(t, 'bp', 1800, 1.0); envExp(t, 0.0005, 0.012);
    const scuff = noise(0.12, seed + 3); filter(scuff, 'bp', 4500, 0.8); envAD(scuff, 0.01, 0.02, 0.06);
    mix(b, t, 0, 1); mix(b, scuff, 0.02, 0.18); mix(b, thud, 0, 0.5);
  } else if (surface === 'wood') {
    const m = modal(0.2, [[180 + r() * 15, 0.05, 1], [330, 0.035, 0.6], [520, 0.025, 0.4], [870, 0.015, 0.25]], seed);
    const t = noise(0.03, seed + 1); filter(t, 'bp', 1200, 1.2); envExp(t, 0.0005, 0.008);
    mix(b, m, 0, 0.7); mix(b, t, 0, 0.6); mix(b, thud, 0, 0.4);
  } else if (surface === 'metal') {
    const m = modal(0.28, [[420 + r() * 30, 0.08, 1], [1130, 0.05, 0.6], [2240, 0.03, 0.4], [3170, 0.02, 0.25]], seed);
    mix(b, m, 0, 0.5); mix(b, thud, 0, 0.5);
  } else if (surface === 'sand') {
    const n = noise(0.22, seed); filter(n, 'lp', 2200); filter(n, 'hp', 300); envAD(n, 0.02, 0.04, 0.14);
    mix(b, n, 0, 0.7); mix(b, thud, 0, 0.35);
  } else if (surface === 'water') {
    const n = noise(0.3, seed); filter(n, 'bp', 1200, 0.5); envAD(n, 0.01, 0.05, 0.2);
    mix(b, n, 0, 0.7);
    for (let i = 0; i < 4; i++) {
      const bub = tone(0.05, (t) => 600 + Math.abs(r()) * 900 + t * 8000); envExp(bub, 0.002, 0.012);
      mix(b, bub, 0.03 + i * 0.03, 0.2);
    }
  } else if (surface === 'cloth') {
    const n = noise(0.2, seed); filter(n, 'lp', 1500); envAD(n, 0.01, 0.03, 0.1);
    mix(b, n, 0, 0.6); mix(b, thud, 0, 0.6);
  }
  return normalize(b, 0.55 + Math.abs(r()) * 0.1);
}

// ---------- Соққылар ----------
function impact(kind, seed) {
  const b = buf(0.6);
  const r = rngf(seed);
  if (kind === 'dirt' || kind === 'grass' || kind === 'sand') {
    const t = noise(0.2, seed); filter(t, 'lp', 2500); envExp(t, 0.0005, 0.03);
    const th = tone(0.08, (x) => 90 + 120 * Math.exp(-x / 0.01)); envExp(th, 0.0005, 0.02);
    mix(b, t, 0, 0.8); mix(b, th, 0, 0.6);
    for (let i = 0; i < 10; i++) { const c = noise(0.006, seed + i); filter(c, 'bp', 2000 + Math.abs(r()) * 2000, 1); envExp(c, 0, 0.002); mix(b, c, 0.02 + Math.abs(r()) * 0.15, 0.25); }
  } else if (kind === 'concrete') {
    const t = noise(0.1, seed); filter(t, 'bp', 2400, 0.8); envExp(t, 0.0002, 0.012);
    mix(b, t, 0, 1);
    for (let i = 0; i < 12; i++) { const c = noise(0.008, seed + i); filter(c, 'hp', 2500); envExp(c, 0, 0.003); mix(b, c, 0.02 + Math.abs(r()) * 0.25, 0.3 * Math.abs(r())); }
  } else if (kind === 'metal') {
    const m = modal(0.5, [[1850 + r() * 200, 0.12, 1], [3300, 0.08, 0.7], [5200, 0.05, 0.5], [740, 0.1, 0.3]], seed);
    const t = noise(0.02, seed + 1); filter(t, 'hp', 3000); envExp(t, 0, 0.003);
    mix(b, m, 0, 0.6); mix(b, t, 0, 0.8);
    if (Math.abs(r()) > 0.4) { // Рикошет ызыңы
      const w = tone(0.35, (x) => 3400 - x * 4500); envAD(w, 0.01, 0.05, 0.25); filter(w, 'bp', 2500, 0.8);
      mix(b, w, 0.02, 0.22);
    }
  } else if (kind === 'wood') {
    const m = modal(0.25, [[240 + r() * 30, 0.05, 1], [520, 0.035, 0.7], [910, 0.02, 0.4]], seed);
    const t = noise(0.05, seed + 1); filter(t, 'bp', 1600, 0.9); envExp(t, 0.0003, 0.01);
    mix(b, m, 0, 0.8); mix(b, t, 0, 0.8);
    for (let i = 0; i < 5; i++) { const c = noise(0.006, seed + i); filter(c, 'bp', 3000, 1); envExp(c, 0, 0.002); mix(b, c, 0.02 + Math.abs(r()) * 0.1, 0.2); }
  } else if (kind === 'cloth') {
    const t = noise(0.15, seed); filter(t, 'lp', 1200); envExp(t, 0.001, 0.03);
    mix(b, t, 0, 0.8);
  } else if (kind === 'flesh') {
    const th = tone(0.12, (x) => 110 + 160 * Math.exp(-x / 0.012)); envExp(th, 0.0005, 0.035); softclip(th, 2);
    const t = noise(0.12, seed); filter(t, 'lp', 1400); envExp(t, 0.001, 0.03);
    const s = noise(0.04, seed + 1); filter(s, 'bp', 3500, 1); envExp(s, 0, 0.006);
    mix(b, th, 0, 1); mix(b, t, 0, 0.6); mix(b, s, 0, 0.3);
  } else if (kind === 'armor') {
    const m = modal(0.3, [[620, 0.05, 1], [1340, 0.035, 0.6], [2150, 0.02, 0.35]], seed);
    const th = tone(0.08, (x) => 120 + 100 * Math.exp(-x / 0.01)); envExp(th, 0.0005, 0.025);
    mix(b, m, 0, 0.7); mix(b, th, 0, 0.8);
  } else if (kind === 'ice') {
    const m = modal(0.4, [[2600 + r() * 300, 0.08, 1], [4100, 0.05, 0.7], [6300, 0.03, 0.5], [8100, 0.02, 0.3]], seed);
    const t = noise(0.05, seed + 1); filter(t, 'hp', 4000); envExp(t, 0, 0.008);
    mix(b, m, 0, 0.5); mix(b, t, 0, 0.6);
  }
  return normalize(b, 0.7);
}

// Басқа тигенде — қоңыраулы «дің» (Free Fire стилінде)
function headshotDing(seed) {
  const b = buf(0.9);
  const m = modal(0.9, [[2093, 0.35, 1], [4186, 0.18, 0.5], [5274, 0.12, 0.35], [3136, 0.25, 0.4]], seed);
  envExp(m, 0.001, 0.5);
  mix(b, m, 0, 0.6);
  mix(b, impact('armor', seed + 1), 0, 0.5);
  return normalize(reverb(b, { room: 0.6, wet: 0.15, tail: 0.3 }), 0.8);
}

function whiz(seed) {
  const b = buf(0.35);
  const n = noise(0.35, seed);
  sweep(n, 'bp', (t) => 4200 - t * 7000, 3);
  envAD(n, 0.12, 0.02, 0.18);
  mix(b, n, 0, 1);
  const c = noise(0.01, seed + 1); filter(c, 'hp', 3000); envExp(c, 0, 0.002);
  mix(b, c, 0.12, 0.8);
  return normalize(b, 0.55);
}

// ---------- Интерфейс ----------
function uiClick(seed) {
  const b = tone(0.08, (t) => 1500 - t * 4000); envExp(b, 0.001, 0.015);
  const n = noise(0.02, seed); filter(n, 'hp', 3000); envExp(n, 0, 0.004);
  mix(b, n, 0, 0.3);
  return normalize(b, 0.45);
}
function uiTick() { const b = tone(0.04, 2400); envExp(b, 0.0005, 0.006); return normalize(b, 0.3); }
function hitmarker(seed) {
  const b = buf(0.1);
  const t = tone(0.06, 3200); envExp(t, 0.0003, 0.008);
  const t2 = tone(0.06, 4700); envExp(t2, 0.0003, 0.006);
  const n = noise(0.01, seed); filter(n, 'hp', 5000); envExp(n, 0, 0.002);
  mix(b, t, 0, 0.6); mix(b, t2, 0, 0.3); mix(b, n, 0, 0.4);
  return normalize(b, 0.45);
}
function bell(f, len = 0.8) {
  const m = modal(len, [[f, len * 0.4, 1], [f * 2.0, len * 0.25, 0.4], [f * 2.76, len * 0.18, 0.3], [f * 5.4, len * 0.08, 0.15]], 5);
  envExp(m, 0.002, len * 0.4);
  return m;
}
function killChime(head) {
  const b = buf(1.4);
  const notes = head ? [1318.5, 1568, 1975.5] : [1318.5, 1975.5];
  notes.forEach((f, i) => mix(b, bell(f, 0.7), i * 0.07, 0.6));
  const w = noise(0.4, 7); sweep(w, 'bp', (t) => 1500 + t * 9000, 1.5); envAD(w, 0.15, 0.05, 0.2);
  mix(b, w, 0, 0.15);
  return normalize(reverb(b, { room: 0.7, wet: 0.25, tail: 0.6 }), 0.7);
}
function countBeep(f = 880) {
  const b = tone(0.25, f, 'tri'); envAD(b, 0.005, 0.08, 0.15); filter(b, 'lp', 3000);
  return normalize(b, 0.4);
}
function zoneWarn() {
  const b = buf(2.0);
  for (let i = 0; i < 3; i++) {
    const t = tone(0.45, (x) => 660 + Math.sin(x * 20) * 30 + x * 400, 'saw');
    filter(t, 'lp', 2200); envAD(t, 0.03, 0.25, 0.15);
    mix(b, t, i * 0.55, 0.4);
  }
  return normalize(reverb(b, { room: 0.75, wet: 0.3, tail: 0.6 }), 0.55);
}
function pickup(seed) {
  const b = buf(0.35);
  const n = noise(0.2, seed); filter(n, 'bp', 1400, 0.7); envAD(n, 0.02, 0.04, 0.12);
  mix(b, n, 0, 0.5);
  const up = tone(0.15, (t) => 700 + t * 1500); envExp(up, 0.005, 0.05);
  mix(b, up, 0.05, 0.25);
  return normalize(b, 0.5);
}
function pickupWeapon(seed) {
  const b = buf(0.5);
  mix(b, weaponSwitch(seed), 0, 0.6);
  mix(b, modal(0.25, [[820, 0.06, 1], [1650, 0.04, 0.6], [2700, 0.03, 0.4]], seed + 3), 0.08, 0.6);
  return normalize(b, 0.6);
}
function armorEquip(seed) {
  const b = buf(0.8);
  const r = rngf(seed);
  // Жабысқақ ілмек (велкро) жыртылуы
  const v = noise(0.35, seed); filter(v, 'bp', 2600, 0.6);
  for (let i = 0; i < v.length; i++) v[i] *= (Math.abs(r()) > 0.5 ? 1 : 0.2) * Math.sin(Math.PI * i / v.length);
  mix(b, v, 0.05, 0.5);
  mix(b, click(seed + 2, 1600, 0.06), 0.45, 0.6);
  mix(b, modal(0.2, [[300, 0.05, 1], [520, 0.04, 0.5]], seed + 3), 0.45, 0.4);
  return normalize(b, 0.6);
}
function healStart(seed) {
  const b = buf(1.0);
  const r = rngf(seed);
  // Сыдырма
  for (let i = 0; i < 26; i++) {
    const c = noise(0.006, seed + i); filter(c, 'bp', 3000 + Math.abs(r()) * 1500, 1.2); envExp(c, 0, 0.002);
    mix(b, c, 0.05 + i * 0.012, 0.35);
  }
  const cl = noise(0.4, seed + 50); filter(cl, 'bp', 900, 0.7); envAD(cl, 0.1, 0.1, 0.2);
  mix(b, cl, 0.4, 0.3);
  return normalize(b, 0.55);
}
function healDone() {
  const b = buf(1.2);
  [784, 988, 1175, 1568].forEach((f, i) => { const t = tone(0.5, f, 'tri'); envExp(t, 0.005, 0.15); mix(b, t, i * 0.06, 0.25); });
  return normalize(reverb(b, { room: 0.7, wet: 0.3, tail: 0.5 }), 0.5);
}
function drink(seed) {
  const b = buf(1.6);
  for (let i = 0; i < 4; i++) {
    const g = tone(0.12, (t) => 260 - t * 600); envAD(g, 0.01, 0.03, 0.07); filter(g, 'lp', 1200);
    const n = noise(0.1, seed + i); filter(n, 'bp', 700, 1); envExp(n, 0.005, 0.03);
    mix(b, g, 0.2 + i * 0.32, 0.6); mix(b, n, 0.2 + i * 0.32, 0.3);
  }
  return normalize(b, 0.55);
}
function glooThrow(seed) {
  const b = buf(0.6);
  const w = noise(0.5, seed); sweep(w, 'bp', (t) => 500 + t * 3000, 1.2); envAD(w, 0.1, 0.1, 0.25);
  mix(b, w, 0, 0.6);
  mix(b, click(seed + 1, 2400, 0.05), 0, 0.4);
  return normalize(b, 0.55);
}
function glooDeploy(seed) {
  const b = buf(1.8);
  const r = rngf(seed);
  const wh = tone(0.4, (t) => 90 + 200 * Math.exp(-t / 0.06)); envExp(wh, 0.005, 0.12); softclip(wh, 2);
  mix(b, wh, 0, 0.8);
  const rush = noise(0.6, seed); sweep(rush, 'bp', (t) => 1200 + t * 6000, 0.8); envAD(rush, 0.02, 0.1, 0.4);
  mix(b, rush, 0, 0.45);
  // Мұз кристалдарының сыңғыры
  for (let i = 0; i < 40; i++) {
    const f = 3000 + Math.abs(r()) * 6000;
    const m = modal(0.25, [[f, 0.05 + Math.abs(r()) * 0.08, 1], [f * 1.51, 0.03, 0.4]], seed + i);
    mix(b, m, Math.abs(r()) * 0.6, 0.12);
  }
  // Сықырлау
  for (let i = 0; i < 30; i++) { const c = noise(0.005, seed + 100 + i); filter(c, 'hp', 2500); envExp(c, 0, 0.0015); mix(b, c, Math.abs(r()) * 0.5, 0.3); }
  return normalize(reverb(b, { room: 0.75, wet: 0.25, tail: 0.5 }), 0.85);
}
function glooBreak(seed) {
  const b = buf(1.4);
  const r = rngf(seed);
  const n = noise(0.5, seed); filter(n, 'hp', 1500); envExp(n, 0.001, 0.08);
  mix(b, n, 0, 0.8);
  for (let i = 0; i < 50; i++) {
    const f = 2000 + Math.abs(r()) * 7000;
    const m = modal(0.3, [[f, 0.04 + Math.abs(r()) * 0.06, 1]], seed + i);
    mix(b, m, Math.abs(r()) * 0.4, 0.15);
  }
  const th = tone(0.2, (t) => 80 + 100 * Math.exp(-t / 0.03)); envExp(th, 0.002, 0.06);
  mix(b, th, 0, 0.6);
  return normalize(reverb(b, { room: 0.7, wet: 0.2, tail: 0.4 }), 0.85);
}
function explosion(seed, far = false) {
  const L = 3.2;
  const b = buf(L);
  const boom = tone(1.2, (t) => 28 + 70 * Math.exp(-t / 0.15)); envExp(boom, 0.003, 0.45); softclip(boom, 3);
  mix(b, boom, 0, 1.2);
  const n = noise(2.4, seed);
  sweep(n, 'lp', (t) => 300 + 6000 * Math.exp(-t / 0.12), 0.7);
  envExp(n, 0.002, 0.6);
  mix(b, n, 0, 1.0);
  const cr = noise(0.03, seed + 1); filter(cr, 'hp', 1000); envExp(cr, 0, 0.006);
  mix(b, cr, 0, far ? 0.2 : 1.2);
  // Шашыраған сынықтар
  const r = rngf(seed + 2);
  for (let i = 0; i < 25; i++) {
    const c = impact(Math.abs(r()) > 0.5 ? 'concrete' : 'dirt', seed + 10 + i);
    mix(b, c, 0.3 + Math.abs(r()) * 1.4, 0.12 * Math.abs(r()));
  }
  softclip(b, 1.5);
  if (far) { filter(b, 'lp', 900); }
  const out = reverb(b, { room: 0.9, damp: 0.45, wet: far ? 0.9 : 0.5, tail: 2.0, predelay: 0.03 });
  fadeOut(out, 0.6);
  return normalize(out, 0.98);
}
function grenadeBounce(seed) { return normalize(modal(0.2, [[1200, 0.04, 1], [2300, 0.03, 0.6], [3800, 0.02, 0.3]], seed), 0.4); }
function grenadePin(seed) {
  const b = buf(0.4);
  mix(b, modal(0.25, [[3800, 0.08, 1], [5900, 0.05, 0.6]], seed), 0, 0.5);
  mix(b, click(seed + 1, 2200, 0.05), 0.12, 0.6);
  return normalize(b, 0.5);
}
function jump(seed) {
  const n = noise(0.25, seed); filter(n, 'bp', 700, 0.6); envAD(n, 0.03, 0.03, 0.12);
  return normalize(n, 0.35);
}
function land(seed) {
  const b = buf(0.4);
  const th = tone(0.15, (t) => 60 + 80 * Math.exp(-t / 0.02)); envExp(th, 0.002, 0.05);
  const n = noise(0.25, seed); filter(n, 'lp', 1500); envExp(n, 0.002, 0.05);
  mix(b, th, 0, 1); mix(b, n, 0, 0.6);
  return normalize(b, 0.6);
}
function chuteOpen(seed) {
  const b = buf(1.2);
  const w = noise(0.3, seed); filter(w, 'lp', 700); envExp(w, 0.005, 0.08);
  mix(b, w, 0, 1);
  const fl = noise(1.0, seed + 1); filter(fl, 'bp', 400, 0.6);
  for (let i = 0; i < fl.length; i++) fl[i] *= (0.5 + 0.5 * Math.sin(i / SR * 2 * Math.PI * 18)) * Math.exp(-i / SR / 0.35);
  mix(b, fl, 0.05, 0.6);
  return normalize(b, 0.8);
}
function punch(seed) {
  const b = buf(0.3);
  const w = noise(0.12, seed); sweep(w, 'bp', (t) => 600 + t * 5000, 1); envAD(w, 0.04, 0.01, 0.05);
  mix(b, w, 0, 0.4);
  mix(b, impact('flesh', seed + 1), 0.08, 0.9);
  return normalize(b, 0.7);
}
function heartbeat() {
  const b = buf(1.0);
  for (const [t, g] of [[0, 1], [0.24, 0.7]]) {
    const h = tone(0.2, (x) => 48 + 30 * Math.exp(-x / 0.02)); envExp(h, 0.005, 0.06); filter(h, 'lp', 200);
    mix(b, h, t, g);
  }
  return normalize(b, 0.8);
}
function airdropFlare(seed) {
  const n = noise(2.0, seed); filter(n, 'bp', 2500, 0.5);
  const r = rngf(seed);
  for (let i = 0; i < n.length; i++) n[i] *= 0.6 + 0.4 * Math.abs(r());
  envAD(n, 0.05, 1.5, 0.4);
  return normalize(n, 0.4);
}
function crateLand(seed) {
  const b = buf(1.0);
  mix(b, land(seed), 0, 1);
  mix(b, modal(0.5, [[160, 0.12, 1], [310, 0.08, 0.6], [520, 0.05, 0.4]], seed + 1), 0, 0.6);
  return normalize(reverb(b, { room: 0.6, wet: 0.2, tail: 0.3 }), 0.8);
}

// ---------- Циклдар ----------
function planeLoop() {
  const L = 4.25;
  const b = buf(L);
  const f0 = 48;
  for (let h = 1; h <= 7; h++) {
    const t = tone(L, f0 * h, h % 2 ? 'saw' : 'sine');
    mix(b, t, 0, 0.5 / h);
  }
  // Пропеллер амплитудалық модуляциясы
  for (let i = 0; i < b.length; i++) b[i] *= 0.7 + 0.3 * Math.sin(2 * Math.PI * 24 * i / SR);
  filter(b, 'lp', 900);
  const n = brown(L, 77); filter(n, 'bp', 500, 0.5);
  mix(b, n, 0, 0.4);
  return normalize(loopify(b, 0.25), 0.6);
}
function windLoop() {
  const L = 4.3;
  const n = noise(L, 21);
  sweep(n, 'bp', (t) => 900 + 500 * Math.sin(t * Math.PI * 2 / 2.0) + 300 * Math.sin(t * 5.1), 0.7);
  const r = brown(L, 22); filter(r, 'lp', 400);
  mix(n, r, 0, 0.8);
  for (let i = 0; i < n.length; i++) n[i] *= 0.75 + 0.25 * Math.sin(2 * Math.PI * i / SR / 2.0);
  return normalize(loopify(n, 0.3), 0.6);
}
function ambientLoop() {
  const L = 8.3;
  const n = brown(L, 31);
  filter(n, 'lp', 700);
  filter(n, 'hp', 60);
  const hiss = noise(L, 32); filter(hiss, 'bp', 3500, 0.5);
  for (let i = 0; i < hiss.length; i++) hiss[i] *= 0.06 * (0.6 + 0.4 * Math.sin(2 * Math.PI * i / SR / 4));
  mix(n, hiss, 0, 1);
  for (let i = 0; i < n.length; i++) n[i] *= 0.7 + 0.3 * Math.sin(2 * Math.PI * i / SR / 8 * 2);
  return normalize(loopify(n, 0.3), 0.5);
}
function wavesLoop() {
  const L = 8.3;
  const n = noise(L, 41);
  sweep(n, 'lp', (t) => 500 + 1400 * Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 4), 2), 0.6);
  for (let i = 0; i < n.length; i++) { const t = i / SR; n[i] *= 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 4 - 0.6), 3); }
  return normalize(loopify(n, 0.3), 0.55);
}
function zoneLoop() {
  const L = 2.0;
  const b = buf(L);
  for (const [f, g] of [[100, 1], [200, 0.5], [300, 0.35], [500, 0.15]]) mix(b, tone(L, f, 'saw'), 0, g * 0.2);
  filter(b, 'lp', 1200);
  for (let i = 0; i < b.length; i++) b[i] *= 0.7 + 0.3 * Math.sin(2 * Math.PI * 4 * i / SR);
  const r = rngf(51);
  for (let i = 0; i < 40; i++) { const c = noise(0.004, 60 + i); filter(c, 'hp', 2000); envExp(c, 0, 0.0015); mix(b, c, Math.abs(r()) * (L - 0.05), 0.4 * Math.abs(r())); }
  return normalize(loopify(b, 0.1), 0.5);
}
function engineLoop() {
  const L = 4.0;
  const b = buf(L);
  const f0 = 46;
  for (let h = 1; h <= 6; h++) mix(b, tone(L, f0 * h, 'saw'), 0, 0.45 / h);
  // Цилиндр соққылары
  for (let i = 0; i < b.length; i++) b[i] *= 0.65 + 0.35 * Math.max(0, Math.sin(2 * Math.PI * 92 * i / SR));
  filter(b, 'lp', 1100);
  const n = brown(L, 90); filter(n, 'bp', 300, 0.6);
  mix(b, n, 0, 0.5);
  const ex = noise(L, 91); filter(ex, 'bp', 1800, 1.2);
  for (let i = 0; i < ex.length; i++) ex[i] *= 0.1 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 23 * i / SR));
  mix(b, ex, 0, 1);
  softclip(b, 1.6);
  return normalize(loopify(b, 0.2), 0.6);
}
function door(seed) {
  const b = buf(0.5);
  mix(b, modal(0.3, [[140, 0.06, 1], [260, 0.05, 0.6], [520, 0.03, 0.3]], seed), 0, 0.9);
  mix(b, click(seed + 1, 2200, 0.05), 0.01, 0.5);
  const n = noise(0.08, seed + 2); filter(n, 'lp', 1500); envExp(n, 0.001, 0.02);
  mix(b, n, 0, 0.6);
  return normalize(b, 0.65);
}
function crash(seed) {
  const b = buf(1.2);
  const r = rngf(seed);
  const n = noise(0.6, seed); filter(n, 'bp', 1400, 0.6); envExp(n, 0.002, 0.12);
  mix(b, n, 0, 1);
  mix(b, modal(0.8, [[420, 0.2, 1], [910, 0.14, 0.7], [1730, 0.1, 0.5], [2650, 0.06, 0.3]], seed + 1), 0, 0.7);
  const th = tone(0.3, (t) => 50 + 90 * Math.exp(-t / 0.03)); envExp(th, 0.002, 0.08);
  mix(b, th, 0, 1);
  for (let i = 0; i < 12; i++) mix(b, impact(Math.abs(r()) > 0.5 ? 'metal' : 'concrete', seed + 10 + i), 0.05 + Math.abs(r()) * 0.4, 0.15);
  softclip(b, 1.8);
  return normalize(reverb(b, { room: 0.6, wet: 0.2, tail: 0.4 }), 0.85);
}

function birdChirp(seed) {
  const r = rngf(seed);
  const b = buf(0.9);
  const n = 2 + Math.floor(Math.abs(r()) * 4);
  const base = 2600 + Math.abs(r()) * 1800;
  for (let i = 0; i < n; i++) {
    const d = 0.06 + Math.abs(r()) * 0.06;
    const t = tone(d, (x) => base + Math.sin(x / d * Math.PI) * 900 * (r() > 0 ? 1 : -1) + Math.sin(x * 260) * 120);
    envAD(t, 0.005, d * 0.4, d * 0.5);
    mix(b, t, i * (d + 0.03), 0.4);
  }
  return normalize(reverb(b, { room: 0.7, wet: 0.2, tail: 0.4 }), 0.35);
}

export const SFX_LIST = [];
function add(name, fn, cat = 'sfx') { SFX_LIST.push({ name, fn, cat }); }

for (const w of Object.keys(GUN)) {
  add('gun_' + w, () => gunshot(GUN[w], w.length * 101 + 7));
  add('gun_' + w + '_far', () => gunshot(GUN[w], w.length * 101 + 9, true));
}
add('bolt', () => boltCycle(11));
add('pump', () => pumpCycle(12));
for (const w of ['pistol', 'rifle', 'sniper']) add('reload_' + w, () => reloadSound(w, w.length * 13));
add('shell', () => shellInsert(14));
add('dry', () => dryFire(15));
add('switch', () => weaponSwitch(16));
for (const s of ['grass', 'dirt', 'concrete', 'wood', 'metal', 'sand', 'water', 'cloth']) for (let i = 0; i < 4; i++) add(`step_${s}_${i}`, () => footstep(s, 100 + i * 17 + s.length));
for (const k of ['dirt', 'concrete', 'metal', 'wood', 'cloth', 'flesh', 'armor', 'ice']) for (let i = 0; i < 2; i++) add(`hit_${k}_${i}`, () => impact(k, 300 + i * 13 + k.length * 7));
add('headshot', () => headshotDing(21));
for (let i = 0; i < 3; i++) add('whiz_' + i, () => whiz(400 + i));
add('ui_click', () => uiClick(5));
add('ui_tick', () => uiTick());
add('hitmarker', () => hitmarker(6));
add('kill', () => killChime(false));
add('kill_head', () => killChime(true));
add('beep', () => countBeep(880));
add('beep_hi', () => countBeep(1320));
add('zone_warn', () => zoneWarn());
add('pickup', () => pickup(7));
add('pickup_weapon', () => pickupWeapon(8));
add('armor', () => armorEquip(9));
add('heal_start', () => healStart(10));
add('heal_done', () => healDone());
add('drink', () => drink(11));
add('gloo_throw', () => glooThrow(12));
add('gloo_deploy', () => glooDeploy(13));
add('gloo_break', () => glooBreak(14));
add('explosion', () => explosion(15));
add('explosion_far', () => explosion(16, true));
add('grenade_bounce', () => grenadeBounce(17));
add('grenade_pin', () => grenadePin(18));
add('jump', () => jump(19));
add('land', () => land(20));
add('chute', () => chuteOpen(21));
add('punch', () => punch(22));
add('heartbeat', () => heartbeat());
add('flare', () => airdropFlare(23));
add('crate_land', () => crateLand(24));
add('plane_loop', () => planeLoop(), 'loop');
add('wind_loop', () => windLoop(), 'loop');
add('ambient_loop', () => ambientLoop(), 'loop');
add('waves_loop', () => wavesLoop(), 'loop');
add('zone_loop', () => zoneLoop(), 'loop');
add('engine_loop', () => engineLoop(), 'loop');
add('door', () => door(26));
add('crash', () => crash(27));
for (let i = 0; i < 4; i++) add('bird_' + i, () => birdChirp(500 + i * 31));

export { GUN, reverb as _reverb, concat, delay, fadeIn, Biquad };
