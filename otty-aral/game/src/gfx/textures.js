// Процедуралық текстуралар: барлығы кодпен салынады, сыртқы файл қажет емес.
import * as THREE from 'three';
import { TileNoise, RNG, clamp } from '../core/rng.js';
import { cacheGet, cacheSet } from '../core/cache.js';

const tn = new TileNoise(1337);

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Пиксельдік генератор: fn(u, v, out[4]) -> биіктік (0..1)
function pixels(size, fn) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const h = new Float32Array(size * size);
  const out = [0, 0, 0, 255];
  const inv = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out[3] = 255;
      const hv = fn(x * inv, y * inv, out, x, y);
      const i = (y * size + x);
      h[i] = hv;
      d[i * 4] = out[0]; d[i * 4 + 1] = out[1]; d[i * 4 + 2] = out[2]; d[i * 4 + 3] = out[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx, h };
}

function heightFromCanvas(c) {
  const size = c.width;
  const d = c.getContext('2d').getImageData(0, 0, size, size).data;
  const h = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) h[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  return h;
}

function normalFromHeight(h, size, strength) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const s = strength * size / 256;
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1 + size) % size) * size, yp = ((y + 1) % size) * size, yr = y * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size, xp = (x + 1) % size;
      const dx = (h[yr + xp] - h[yr + xm]) * s;
      const dy = (h[yp + x] - h[ym + x]) * s;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (yr + x) * 4;
      d[i] = (-dx * inv * 0.5 + 0.5) * 255;
      d[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
      d[i + 2] = (inv * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Шетіне жақын салынған пішіндерді қайталау (плиткалық жалғасу үшін)
function wrapDraw(size, x, y, r, draw) {
  for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
    const px = x + ox * size, py = y + oy * size;
    if (px + r < 0 || px - r > size || py + r < 0 || py - r > size) continue;
    draw(px, py);
  }
}

const mix = (a, b, t) => a + (b - a) * t;
function mixc(out, c1, c2, t) {
  out[0] = mix(c1[0], c2[0], t); out[1] = mix(c1[1], c2[1], t); out[2] = mix(c1[2], c2[2], t);
}

// ---------- Генераторлар ----------
const GEN = {
  grass(size, rng) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 4, 5);
      const n2 = tn.fbm(u + 0.3, v + 0.7, 16, 3);
      const dry = clamp((tn.fbm(u + 0.5, v, 3, 3) - 0.55) * 4, 0, 1);
      mixc(o, [46, 74, 26], [96, 128, 44], n);
      o[0] = mix(o[0], 140, dry * 0.5); o[1] = mix(o[1], 132, dry * 0.4); o[2] = mix(o[2], 62, dry * 0.3);
      const k = 0.8 + n2 * 0.4;
      o[0] *= k; o[1] *= k; o[2] *= k;
      return n * 0.5 + n2 * 0.5;
    });
    const ctx = p.ctx;
    const blades = size * 6;
    for (let i = 0; i < blades; i++) {
      const x = rng.float(0, size), y = rng.float(0, size);
      const len = rng.float(3, 9) * size / 256;
      const ang = -Math.PI / 2 + rng.float(-0.7, 0.7);
      const g = rng.float(70, 160);
      ctx.strokeStyle = `rgba(${g * 0.55 | 0},${g | 0},${g * 0.3 | 0},${rng.float(0.25, 0.6)})`;
      ctx.lineWidth = rng.float(0.6, 1.4) * size / 256;
      wrapDraw(size, x, y, len, (px, py) => {
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.cos(ang) * len * 0.5 + 1, py + Math.sin(ang) * len * 0.5, px + Math.cos(ang) * len, py + Math.sin(ang) * len);
        ctx.stroke();
      });
    }
    // Ұсақ гүлдер
    for (let i = 0; i < size / 6; i++) {
      const x = rng.float(0, size), y = rng.float(0, size);
      ctx.fillStyle = rng.pick(['#f4e27a', '#ffffff', '#d9a7e8', '#f28c8c']);
      ctx.globalAlpha = 0.7;
      wrapDraw(size, x, y, 2, (px, py) => { ctx.beginPath(); ctx.arc(px, py, size / 300 + 0.5, 0, 7); ctx.fill(); });
    }
    ctx.globalAlpha = 1;
    return { c: p.c, h: heightFromCanvas(p.c), ns: 2.0 };
  },

  dirt(size, rng) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 6, 5);
      const cell = tn.cell(u, v, 24);
      const peb = clamp(1 - cell.d1 * 3.2, 0, 1);
      mixc(o, [86, 64, 44], [138, 108, 76], n);
      const pv = peb * (0.5 + cell.id * 0.6);
      o[0] = mix(o[0], 150 + cell.id * 40, pv * 0.6); o[1] = mix(o[1], 135 + cell.id * 30, pv * 0.6); o[2] = mix(o[2], 115, pv * 0.6);
      const fine = 0.85 + tn.value(u, v, 128) * 0.3;
      o[0] *= fine; o[1] *= fine; o[2] *= fine;
      return n * 0.6 + pv * 0.6;
    });
    return { c: p.c, h: p.h, ns: 3.0 };
  },

  sand(size) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 4, 4);
      const rip = Math.sin((v + tn.fbm(u, v, 3, 3) * 0.15) * Math.PI * 2 * 14) * 0.5 + 0.5;
      const grain = tn.value(u, v, 256);
      mixc(o, [196, 172, 128], [228, 206, 160], n * 0.7 + grain * 0.3);
      const k = 0.93 + rip * 0.07;
      o[0] *= k; o[1] *= k; o[2] *= k;
      return rip * 0.4 + grain * 0.6;
    });
    return { c: p.c, h: p.h, ns: 1.5 };
  },

  rock(size) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 4, 6);
      const n2 = tn.fbm(u + 0.37, v + 0.11, 12, 4);
      const strata = Math.sin((v * 9 + n * 2.5) * Math.PI * 2) * 0.5 + 0.5;
      const c = tn.cell(u + n * 0.08, v + n2 * 0.08, 5);
      const crack = clamp((c.d2 - c.d1) * 14, 0, 1);
      const lich = clamp((tn.fbm(u + 0.2, v + 0.4, 6, 4) - 0.6) * 5, 0, 1);
      const base = 96 + n * 62 + n2 * 26 + strata * 14 + c.id * 10;
      o[0] = base; o[1] = base * 0.97; o[2] = base * 0.92;
      o[0] = mix(o[0], 118, lich * 0.55); o[1] = mix(o[1], 126, lich * 0.55); o[2] = mix(o[2], 72, lich * 0.55);
      const cr = 0.72 + crack * 0.28;
      o[0] *= cr; o[1] *= cr; o[2] *= cr;
      return n * 0.5 + n2 * 0.3 + crack * 0.25 + strata * 0.1;
    });
    return { c: p.c, h: p.h, ns: 4.0 };
  },

  concrete(size, rng) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 3, 5);
      const f = tn.value(u, v, 200);
      const stain = clamp((tn.fbm(u + 0.4, v + 0.1, 2, 4) - 0.5) * 3, 0, 1);
      const b = 150 + n * 40 + f * 22 - stain * 30;
      o[0] = b; o[1] = b; o[2] = b * 0.97;
      return n * 0.4 + f * 0.6;
    });
    const ctx = p.ctx;
    for (let i = 0; i < size / 3; i++) {
      const x = rng.float(0, size), y = rng.float(0, size), r = rng.float(0.5, 2) * size / 256;
      ctx.fillStyle = `rgba(60,60,60,${rng.float(0.2, 0.5)})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    // Плита жігі
    ctx.strokeStyle = 'rgba(70,70,70,0.35)'; ctx.lineWidth = size / 256;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    return { c: p.c, h: heightFromCanvas(p.c), ns: 1.6 };
  },

  plaster(size) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 8, 5);
      const f = tn.value(u, v, 160);
      const b = 212 + n * 30 + f * 13;
      o[0] = b; o[1] = b; o[2] = b;
      return n * 0.5 + f * 0.5;
    });
    return { c: p.c, h: p.h, ns: 1.8 };
  },

  brick(size) {
    const rows = 8, cols = 4;
    const p = pixels(size, (u, v, o) => {
      const r = Math.floor(v * rows);
      const off = (r % 2) * 0.5;
      const cu = u * cols + off;
      const ci = Math.floor(cu);
      const fu = cu - ci, fv = v * rows - r;
      const mort = fu < 0.04 || fu > 0.96 || fv < 0.08 || fv > 0.92;
      const id = tn.hash(ci, r, 64);
      const n = tn.fbm(u, v, 8, 4);
      if (mort) {
        const b = 170 + n * 30; o[0] = b; o[1] = b * 0.97; o[2] = b * 0.92;
        return 0.1;
      }
      o[0] = 140 + id * 50 + n * 30; o[1] = 62 + id * 22 + n * 18; o[2] = 44 + id * 15 + n * 10;
      if (id > 0.85) { o[0] *= 0.7; o[1] *= 0.7; o[2] *= 0.7; }
      const e = Math.min(fu, 1 - fu, fv * 0.5, (1 - fv) * 0.5) * 8;
      return 0.6 + clamp(e, 0, 0.3) + n * 0.1;
    });
    return { c: p.c, h: p.h, ns: 5.0 };
  },

  wood(size) {
    const planks = 6;
    const p = pixels(size, (u, v, o) => {
      const pi = Math.floor(u * planks);
      const fu = u * planks - pi;
      const id = tn.hash(pi, 3, 64);
      const warp = tn.fbm(u, v, 4, 3) * 0.6;
      const grain = Math.sin((fu * 8 + warp * 6 + id * 10) * Math.PI * 2 + v * 3) * 0.5 + 0.5;
      const fine = tn.value(u * 0.2 + id, v, 220);
      const seam = fu < 0.03 || fu > 0.97;
      const b = 0.75 + grain * 0.18 + fine * 0.1 + id * 0.15;
      o[0] = 132 * b; o[1] = 92 * b; o[2] = 58 * b;
      if (seam) { o[0] *= 0.35; o[1] *= 0.35; o[2] *= 0.35; return 0; }
      const nail = (Math.abs(fu - 0.5) < 0.05) && ((v * 4) % 1 < 0.02);
      if (nail) { o[0] = 60; o[1] = 60; o[2] = 62; }
      return 0.6 + grain * 0.2;
    });
    return { c: p.c, h: p.h, ns: 3.0 };
  },

  crate(size) {
    const p = pixels(size, (u, v, o) => {
      const frame = u < 0.1 || u > 0.9 || v < 0.1 || v > 0.9;
      const diag = Math.abs(u - v) < 0.07 && !frame;
      const grain = Math.sin((u * 30 + tn.fbm(u, v, 4, 3) * 4) * 3.1) * 0.5 + 0.5;
      const pl = Math.floor(v * 5);
      const id = tn.hash(pl, 1, 32);
      let b = 0.72 + grain * 0.14 + id * 0.12;
      if (frame || diag) b *= 0.82;
      o[0] = 170 * b; o[1] = 128 * b; o[2] = 78 * b;
      if (!frame && !diag && ((v * 5) % 1) < 0.03) { o[0] *= 0.4; o[1] *= 0.4; o[2] *= 0.4; return 0.2; }
      return frame || diag ? 0.9 : 0.6;
    });
    return { c: p.c, h: p.h, ns: 4.0 };
  },

  metal(size) {
    const ridges = 12;
    const p = pixels(size, (u, v, o) => {
      const r = Math.sin(u * ridges * Math.PI * 2);
      const n = tn.fbm(u, v, 6, 4);
      const streak = clamp((tn.value(u * 1, v * 0.05, 64) - 0.6) * 3, 0, 1) * clamp(tn.fbm(u, v, 3, 3) * 2 - 0.6, 0, 1);
      const rust = clamp((tn.fbm(u + 0.7, v + 0.2, 5, 5) - 0.63) * 5, 0, 1);
      const b = 200 + r * 22 + n * 20;
      o[0] = b; o[1] = b; o[2] = b;
      o[0] = mix(o[0], 120, rust); o[1] = mix(o[1], 70, rust); o[2] = mix(o[2], 40, rust);
      o[0] = mix(o[0], 110, streak * 0.5); o[1] = mix(o[1], 80, streak * 0.5); o[2] = mix(o[2], 60, streak * 0.5);
      return r * 0.5 + 0.5;
    });
    return { c: p.c, h: p.h, ns: 3.0 };
  },

  paint(size) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 6, 4);
      const scratch = clamp((tn.value(u, v * 0.1, 128) - 0.9) * 10, 0, 1);
      const b = 215 + n * 30 - scratch * 60;
      o[0] = b; o[1] = b; o[2] = b;
      return n;
    });
    return { c: p.c, h: p.h, ns: 0.8 };
  },

  roof(size) {
    const rows = 8, cols = 8;
    const p = pixels(size, (u, v, o) => {
      const r = Math.floor(v * rows);
      const fv = v * rows - r;
      const cu = u * cols + (r % 2) * 0.5;
      const ci = Math.floor(cu), fu = cu - ci;
      const id = tn.hash(ci, r, 64);
      const curve = Math.sin(fu * Math.PI);
      const n = tn.fbm(u, v, 8, 3);
      const shade = 0.55 + curve * 0.35 + fv * 0.25;
      o[0] = (150 + id * 40 + n * 20) * shade; o[1] = (66 + id * 18) * shade; o[2] = (40 + id * 10) * shade;
      if (fv > 0.92) { o[0] *= 0.5; o[1] *= 0.5; o[2] *= 0.5; }
      return curve * 0.6 + fv * 0.4;
    });
    return { c: p.c, h: p.h, ns: 4.0 };
  },

  felt(size) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 10, 5);
      const f = tn.value(u, v, 256);
      const b = 0.86 + n * 0.1 + f * 0.06;
      o[0] = 236 * b; o[1] = 226 * b; o[2] = 204 * b;
      return n * 0.5 + f * 0.5;
    });
    return { c: p.c, h: p.h, ns: 1.5 };
  },

  // Кереге торы: киіз үстінде қызыл ағаш айқас таяқтар
  kerege(size) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 8, 4);
      const b = 0.82 + n * 0.12;
      o[0] = 232 * b; o[1] = 220 * b; o[2] = 196 * b;
      const w = 0.035;
      const d1 = Math.abs(((u + v) * 4) % 1 - 0.5), d2 = Math.abs(((u - v + 4) * 4) % 1 - 0.5);
      const l1 = d1 > 0.5 - w ? 1 : 0, l2 = d2 > 0.5 - w ? 1 : 0;
      if (l1 || l2) {
        const g = 0.75 + tn.value(u, v, 64) * 0.25;
        o[0] = 150 * g; o[1] = 42 * g; o[2] = 30 * g;
        return 0.9;
      }
      return 0.3 + n * 0.2;
    });
    // Түйіспелердегі қайыс байлау
    const ctx = p.ctx;
    ctx.fillStyle = '#3a2416';
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const x = (i + 0.5) / 8 * size, y = (j + 0.5) / 8 * size;
      if ((i + j) % 2) continue;
      ctx.beginPath(); ctx.arc(x, y, size / 90, 0, 7); ctx.fill();
    }
    return { c: p.c, h: heightFromCanvas(p.c), ns: 3.0 };
  },

  // Уықтар: шаңыраққа қарай тартылған қызыл сырлы таяқтар
  uyk(size) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 8, 4);
      const b = 0.86 + n * 0.1;
      o[0] = 250 * b; o[1] = 240 * b; o[2] = 218 * b;
      const f = (u * 4) % 1;
      if (f < 0.14) {
        const g = 0.8 + Math.sin(f / 0.14 * Math.PI) * 0.25;
        o[0] = 170 * g; o[1] = 50 * g; o[2] = 34 * g;
        if (((v * 6) % 1) < 0.05) { o[0] = 230; o[1] = 190; o[2] = 70; }
        return 0.9;
      }
      return 0.3 + n * 0.2;
    });
    return { c: p.c, h: p.h, ns: 3.0 };
  },

  ornament(size) {
    const c = canvas(size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#9c1a1c'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#7a1214'; ctx.fillRect(0, 0, size, size * 0.08); ctx.fillRect(0, size * 0.92, size, size * 0.08);
    ctx.strokeStyle = '#e8b93a'; ctx.lineWidth = size * 0.02;
    ctx.beginPath(); ctx.moveTo(0, size * 0.1); ctx.lineTo(size, size * 0.1); ctx.moveTo(0, size * 0.9); ctx.lineTo(size, size * 0.9); ctx.stroke();
    // Қошқар мүйіз — 2 мотив
    const motif = (cx, cy, s, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.45);
        ctx.lineTo(cx, cy);
        ctx.bezierCurveTo(cx + dir * s * 0.05, cy - s * 0.35, cx + dir * s * 0.55, cy - s * 0.4, cx + dir * s * 0.55, cy - s * 0.05);
        ctx.bezierCurveTo(cx + dir * s * 0.55, cy + s * 0.2, cx + dir * s * 0.28, cy + s * 0.22, cx + dir * s * 0.28, cy + s * 0.02);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(cx - s * 0.18, cy + s * 0.3); ctx.lineTo(cx + s * 0.18, cy + s * 0.3); ctx.stroke();
    };
    motif(size * 0.25, size * 0.5, size * 0.5, '#f2c94c');
    motif(size * 0.75, size * 0.5, size * 0.5, '#f7f1e3');
    ctx.fillStyle = '#f2c94c';
    for (let i = 0; i < 8; i++) {
      const x = (i + 0.5) * size / 8;
      ctx.beginPath(); ctx.moveTo(x, size * 0.12); ctx.lineTo(x + size * 0.03, size * 0.17); ctx.lineTo(x - size * 0.03, size * 0.17); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, size * 0.88); ctx.lineTo(x + size * 0.03, size * 0.83); ctx.lineTo(x - size * 0.03, size * 0.83); ctx.fill();
    }
    return { c, h: heightFromCanvas(c), ns: 1.0 };
  },

  carpet(size) {
    const c = canvas(size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7d1418'; ctx.fillRect(0, 0, size, size);
    const b = size * 0.08;
    ctx.fillStyle = '#1d2f5a'; ctx.fillRect(b, b, size - 2 * b, size - 2 * b);
    ctx.fillStyle = '#a81e22'; ctx.fillRect(b * 1.5, b * 1.5, size - 3 * b, size - 3 * b);
    ctx.strokeStyle = '#e9c46a'; ctx.lineWidth = size * 0.012;
    ctx.strokeRect(b * 1.2, b * 1.2, size - 2.4 * b, size - 2.4 * b);
    // Ортадағы ромб медальон
    const cx = size / 2, cy = size / 2;
    for (let k = 0; k < 3; k++) {
      const s = size * (0.32 - k * 0.09);
      ctx.fillStyle = ['#1d2f5a', '#e9c46a', '#f4ecd8'][k];
      ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#7d1418'; ctx.lineWidth = size * 0.02; ctx.lineCap = 'round';
    for (const d of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.bezierCurveTo(cx + d * size * 0.03, cy - size * 0.08, cx + d * size * 0.1, cy - size * 0.08, cx + d * size * 0.1, cy - size * 0.02); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.bezierCurveTo(cx + d * size * 0.03, cy + size * 0.08, cx + d * size * 0.1, cy + size * 0.08, cx + d * size * 0.1, cy + size * 0.02); ctx.stroke();
    }
    // Бұрыштағы мүйіздер
    ctx.strokeStyle = '#e9c46a'; ctx.lineWidth = size * 0.014;
    for (const [x, y] of [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]]) {
      ctx.beginPath(); ctx.arc(x * size, y * size, size * 0.05, 0, Math.PI * 1.6); ctx.stroke();
    }
    // Түк текстурасы
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const k = 0.85 + Math.random() * 0.2;
      img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
    }
    ctx.putImageData(img, 0, 0);
    return { c, h: heightFromCanvas(c), ns: 1.0 };
  },

  asphalt(size, rng) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 6, 4);
      const g = tn.value(u, v, 256);
      const b = 58 + n * 22 + g * 26;
      o[0] = b; o[1] = b; o[2] = b * 1.03;
      return g;
    });
    const ctx = p.ctx;
    for (let i = 0; i < size; i++) {
      ctx.fillStyle = `rgba(${rng.int(120, 170)},${rng.int(120, 170)},${rng.int(120, 170)},0.5)`;
      ctx.fillRect(rng.float(0, size), rng.float(0, size), size / 256 + 0.5, size / 256 + 0.5);
    }
    return { c: p.c, h: heightFromCanvas(p.c), ns: 1.5 };
  },

  leaves(size, rng) {
    const c = canvas(size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2e5a22'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size * 3; i++) {
      const x = rng.float(0, size), y = rng.float(0, size);
      const r = rng.float(3, 8) * size / 256;
      const g = rng.float(0.6, 1.3);
      ctx.fillStyle = `rgb(${46 * g | 0},${(92 + rng.float(0, 40)) * g | 0},${30 * g | 0})`;
      const a = rng.float(0, Math.PI);
      wrapDraw(size, x, y, r * 2, (px, py) => {
        ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.45, a, 0, 7); ctx.fill();
      });
    }
    return { c, h: heightFromCanvas(c), ns: 3.0 };
  },

  bark(size) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u * 1, v, 8, 4);
      const ridge = Math.abs(Math.sin((u * 10 + tn.fbm(u, v, 4, 3) * 2) * Math.PI));
      const b = 0.5 + ridge * 0.4 + n * 0.2;
      o[0] = 96 * b; o[1] = 70 * b; o[2] = 50 * b;
      return ridge;
    });
    return { c: p.c, h: p.h, ns: 5.0 };
  },

  birch(size, rng) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 6, 4);
      const b = 220 + n * 30;
      o[0] = b; o[1] = b * 0.98; o[2] = b * 0.92;
      return 0.5 + n * 0.2;
    });
    const ctx = p.ctx;
    for (let i = 0; i < 26; i++) {
      const y = rng.float(0, size), x = rng.float(0, size), w = rng.float(10, 50) * size / 256, h = rng.float(1.5, 5) * size / 256;
      ctx.fillStyle = `rgba(30,28,26,${rng.float(0.6, 0.95)})`;
      wrapDraw(size, x, y, w, (px, py) => { ctx.beginPath(); ctx.ellipse(px, py, w / 2, h / 2, 0, 0, 7); ctx.fill(); });
    }
    return { c: p.c, h: heightFromCanvas(p.c), ns: 2.0 };
  },

  camo(size) {
    const p = pixels(size, (u, v, o) => {
      const a = tn.fbm(u, v, 3, 4), b = tn.fbm(u + 0.33, v + 0.71, 4, 4), c = tn.fbm(u + 0.6, v + 0.2, 5, 3);
      let col = [92, 98, 64];
      if (a > 0.55) col = [58, 70, 40];
      if (b > 0.58) col = [118, 98, 68];
      if (c > 0.62) col = [36, 36, 30];
      const f = 0.92 + tn.value(u, v, 200) * 0.12;
      o[0] = col[0] * f; o[1] = col[1] * f; o[2] = col[2] * f;
      return f;
    });
    return { c: p.c, h: p.h, ns: 1.0 };
  },

  fabric(size) {
    const p = pixels(size, (u, v, o, x, y) => {
      const w = ((x >> 1) + (y >> 1)) % 2 ? 0.92 : 1.0;
      const n = tn.fbm(u, v, 6, 3);
      const b = (200 + n * 40) * w;
      o[0] = b; o[1] = b; o[2] = b;
      return w;
    });
    return { c: p.c, h: p.h, ns: 0.8 };
  },

  burlap(size) {
    const p = pixels(size, (u, v, o, x, y) => {
      const wx = Math.sin(x * Math.PI / 2) * 0.5 + 0.5, wy = Math.sin(y * Math.PI / 2) * 0.5 + 0.5;
      const n = tn.fbm(u, v, 6, 4);
      const b = 0.7 + (wx * 0.5 + wy * 0.5) * 0.2 + n * 0.2;
      o[0] = 170 * b; o[1] = 145 * b; o[2] = 100 * b;
      return wx * wy;
    });
    return { c: p.c, h: p.h, ns: 2.0 };
  },

  stone(size) {
    const p = pixels(size, (u, v, o) => {
      const rows = 5;
      const r = Math.floor(v * rows);
      const cu = u * 3 + (r % 2) * 0.5 + tn.hash(r, 5, 32) * 0.3;
      const ci = Math.floor(cu);
      const fu = cu - ci, fv = v * rows - r;
      const id = tn.hash(ci, r, 32);
      const n = tn.fbm(u, v, 6, 5);
      const edge = Math.min(fu, 1 - fu) * 3, edgev = Math.min(fv, 1 - fv) * 1.7;
      const e = Math.min(edge, edgev);
      if (e < 0.08) { const b = 90 + n * 30; o[0] = b; o[1] = b * 0.95; o[2] = b * 0.88; return 0; }
      const b = 135 + id * 45 + n * 35;
      o[0] = b; o[1] = b * 0.93; o[2] = b * 0.82;
      return clamp(e * 3, 0, 1) * 0.6 + n * 0.4;
    });
    return { c: p.c, h: p.h, ns: 5.0 };
  },

  hay(size) {
    const p = pixels(size, (u, v, o) => {
      const s = Math.sin((u * 40 + tn.fbm(u, v, 4, 3) * 8) * Math.PI) * 0.5 + 0.5;
      const n = tn.value(u, v, 128);
      const b = 0.7 + s * 0.25 + n * 0.1;
      o[0] = 210 * b; o[1] = 170 * b; o[2] = 90 * b;
      return s;
    });
    return { c: p.c, h: p.h, ns: 2.5 };
  },

  water(size) {
    const p = pixels(size, (u, v, o) => {
      const n = tn.fbm(u, v, 4, 5, 0.55);
      o[0] = o[1] = o[2] = n * 255;
      return n;
    });
    return { c: p.c, h: p.h, ns: 6.0, normalOnly: true };
  },

  glass(size) {
    const c = canvas(size);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#4a6c8a'); g.addColorStop(0.45, '#8fb4cf'); g.addColorStop(0.5, '#c5dceb'); g.addColorStop(0.55, '#7ea3bf'); g.addColorStop(1, '#2f4a63');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    return { c, h: null };
  },
};

export class TextureLib {
  constructor(renderer, size, normals) {
    this.size = size;
    this.normals = normals;
    this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.t = {};
  }

  _tex(c, srgb) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = this.aniso;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    return t;
  }

  async generateAll(onProgress) {
    const names = Object.keys(GEN);
    const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
    const toCanvas = (data, size) => {
      const c = canvas(size);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(size, size);
      img.data.set(data);
      ctx.putImageData(img, 0, 0);
      return c;
    };
    const pixelsOf = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < names.length; i++) {
      const n = names[i];
      const s = (n === 'ornament' || n === 'carpet') ? Math.min(512, this.size) : this.size;
      const key = `tex:${s}:${this.normals ? 1 : 0}:${n}`;
      const entry = {};
      const cached = await cacheGet(key);
      if (cached && cached.size === s) {
        if (cached.map) entry.map = this._tex(toCanvas(cached.map, s), true);
        if (cached.normal) entry.normal = this._tex(toCanvas(cached.normal, s), false);
      } else {
        const r = GEN[n](s, new RNG(hash(n)));
        const store = { size: s };
        if (!r.normalOnly) { entry.map = this._tex(r.c, true); store.map = pixelsOf(r.c); }
        if ((this.normals || r.normalOnly) && r.h) {
          const nc = normalFromHeight(r.h, s, r.ns || 2);
          entry.normal = this._tex(nc, false);
          store.normal = pixelsOf(nc);
        }
        cacheSet(key, store);
      }
      this.t[n] = entry;
      if (onProgress) onProgress((i + 1) / names.length);
      await new Promise((res) => setTimeout(res, 0));
    }
    return this.t;
  }
}

// Бөлшектер мен UI үшін шағын атлас (4x2): жұмсақ дөңгелек, түтін, ұшқын, жалын, сынық, сақина, оқ ізі, жұлдыз
export function makeParticleAtlas() {
  const S = 128;
  const c = canvas(S * 4);
  c.height = S * 2;
  const ctx = c.getContext('2d');
  const rng = new RNG(99);
  const cell = (i) => [(i % 4) * S, Math.floor(i / 4) * S];
  // 0: жұмсақ дөңгелек
  let [x, y] = cell(0);
  let g = ctx.createRadialGradient(x + S / 2, y + S / 2, 0, x + S / 2, y + S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, S, S);
  // 1: түтін бұлты
  [x, y] = cell(1);
  for (let i = 0; i < 26; i++) {
    const px = x + S / 2 + rng.float(-28, 28), py = y + S / 2 + rng.float(-28, 28), r = rng.float(14, 30);
    g = ctx.createRadialGradient(px, py, 0, px, py, r);
    const a = rng.float(0.12, 0.3);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
  }
  // 2: ұшқын (созылған)
  [x, y] = cell(2);
  g = ctx.createLinearGradient(x, y + S / 2, x + S, y + S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y + S / 2 - 6, S, 12);
  // 3: жалын (ауыз от)
  [x, y] = cell(3);
  ctx.save(); ctx.translate(x + S / 2, y + S / 2);
  for (let k = 0; k < 5; k++) {
    ctx.rotate(Math.PI * 2 / 5);
    g = ctx.createLinearGradient(0, 0, 0, -S / 2);
    g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.5, 'rgba(255,200,80,0.8)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(0, -S / 2 + rng.float(0, 14)); ctx.lineTo(10, 0); ctx.fill();
  }
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill();
  ctx.restore();
  // 4: сынық (мұз/шыны)
  [x, y] = cell(4);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.moveTo(x + 64, y + 10); ctx.lineTo(x + 100, y + 60); ctx.lineTo(x + 70, y + 118); ctx.lineTo(x + 30, y + 70); ctx.closePath(); ctx.fill();
  // 5: сақина
  [x, y] = cell(5);
  g = ctx.createRadialGradient(x + S / 2, y + S / 2, S * 0.3, x + S / 2, y + S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, S, S);
  // 6: оқ тесігі
  [x, y] = cell(6);
  g = ctx.createRadialGradient(x + S / 2, y + S / 2, 0, x + S / 2, y + S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.18, 'rgba(10,10,10,0.95)'); g.addColorStop(0.3, 'rgba(40,40,40,0.6)'); g.addColorStop(1, 'rgba(60,60,60,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, S, S);
  ctx.strokeStyle = 'rgba(20,20,20,0.6)'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = rng.float(0, 7);
    ctx.beginPath(); ctx.moveTo(x + 64, y + 64); ctx.lineTo(x + 64 + Math.cos(a) * rng.float(20, 50), y + 64 + Math.sin(a) * rng.float(20, 50)); ctx.stroke();
  }
  // 7: жұлдызша (жарқыл)
  [x, y] = cell(7);
  ctx.save(); ctx.translate(x + S / 2, y + S / 2);
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 4);
    g = ctx.createLinearGradient(-S / 2, 0, S / 2, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-S / 2, -2 - (k % 2) * 2, S, 4 + (k % 2) * 4);
  }
  ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
