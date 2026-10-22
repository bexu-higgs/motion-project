// Кейіпкер моделі: процедуралық қаңқа (SkinnedMesh), киім үлгілері, процедуралық анимация және қолға IK.
import * as THREE from 'three';
import { roundedBox, capsule } from '../gfx/geom.js';
import { clamp, lerp, damp } from '../core/rng.js';

// Сүйек атаулары және тыныштық күйдегі орны (ата-анасына қатысты)
const BONES = [
  ['root', null, 0, 0, 0],
  ['hips', 'root', 0, 0.98, 0],
  ['spine', 'hips', 0, 0.12, 0],
  ['chest', 'spine', 0, 0.2, 0],
  ['neck', 'chest', 0, 0.22, 0],
  ['head', 'neck', 0, 0.08, 0],
  ['upperArmL', 'chest', 0.19, 0.15, 0],
  ['foreArmL', 'upperArmL', 0, -0.28, 0],
  ['handL', 'foreArmL', 0, -0.25, 0],
  ['upperArmR', 'chest', -0.19, 0.15, 0],
  ['foreArmR', 'upperArmR', 0, -0.28, 0],
  ['handR', 'foreArmR', 0, -0.25, 0],
  ['thighL', 'hips', 0.1, -0.04, 0],
  ['shinL', 'thighL', 0, -0.44, 0],
  ['footL', 'shinL', 0, -0.42, 0],
  ['thighR', 'hips', -0.1, -0.04, 0],
  ['shinR', 'thighR', 0, -0.44, 0],
  ['footR', 'shinR', 0, -0.42, 0],
];
const BI = {};
BONES.forEach((b, i) => { BI[b[0]] = i; });
const BIND = {}; // әлемдік тыныштық орны
for (const [n, p, x, y, z] of BONES) {
  const pp = p ? BIND[p] : [0, 0, 0];
  BIND[n] = [pp[0] + x, pp[1] + y, pp[2] + z];
}

export const OUTFITS = {
  batyr: { skin: 0xd9a77e, hair: 0x1c1410, hairStyle: 'short', hat: 'borik', top: 0x23468a, topAlt: 0x2f5aa8, trim: 0xe0b040, pants: 0x6a5238, boots: 0x2a1a10, coat: true, gloves: null, beard: true, female: false },
  sarbaz: { skin: 0xcf9b72, hair: 0x2a1e14, hairStyle: 'short', hat: 'cap', capColor: 0x4a5236, top: 0x5a6340, topAlt: 0x4a5236, trim: 0x3a3f2a, pants: 0x4f573a, boots: 0x1e1a16, camo: true, gloves: 0x2a2a22, female: false },
  kalalyk: { skin: 0xe0b08a, hair: 0x2a1a10, hairStyle: 'short', hat: null, top: 0xc0392b, topAlt: 0xa93226, trim: 0xf0f0f0, pants: 0x2c3e66, boots: 0xf2f2f2, hood: true, gloves: null, female: false },
  aru: { skin: 0xe8bc98, hair: 0x140d0a, hairStyle: 'long', hat: null, top: 0xd62839, topAlt: 0xb81e2e, trim: 0xf4d35e, pants: 0x1d1d2b, boots: 0x2b1b12, gloves: null, female: true },
  mergen: { skin: 0xc8946a, hair: 0x1e1612, hairStyle: 'short', hat: 'takiya', top: 0x6b5a3a, topAlt: 0x5a4a2e, trim: 0x2e4a2a, pants: 0x4a4030, boots: 0x3a2a1a, gloves: 0x4a3a2a, beard: true, female: false },
  tomiris: { skin: 0xdcae86, hair: 0x2a160c, hairStyle: 'bun', hat: null, top: 0x7a1020, topAlt: 0x5a0c18, trim: 0xe6b73a, pants: 0x3a2a20, boots: 0x5a3a1a, gloves: null, coat: true, female: true },
};

const BOT_PALETTE = {
  tops: [0x2e86de, 0xc0392b, 0x27ae60, 0x8e44ad, 0xf39c12, 0x34495e, 0x16a085, 0xd35400, 0x7f8c8d, 0x2c3e50, 0xe84393, 0x6c5ce7],
  pants: [0x2c3e50, 0x34495e, 0x3b3b3b, 0x4a4030, 0x2c3e66, 0x5a4a3a, 0x1d1d2b],
  skins: [0xe8bc98, 0xd9a77e, 0xc8946a, 0xe0b08a, 0xb98058, 0xf0c8a8],
  hairs: [0x140d0a, 0x2a1a10, 0x4a2e1a, 0x1c1410, 0x6a4a2a],
  boots: [0x1e1a16, 0x3a2416, 0x2b1b12, 0xf2f2f2, 0x5a3a1a],
};

export function randomOutfit(rng) {
  const female = rng.chance(0.35);
  const base = rng.chance(0.3) ? { ...OUTFITS[rng.pick(Object.keys(OUTFITS))] } : {
    skin: rng.pick(BOT_PALETTE.skins), hair: rng.pick(BOT_PALETTE.hairs), hairStyle: female ? rng.pick(['long', 'bun']) : 'short',
    hat: female ? null : rng.pick([null, null, 'cap', 'takiya', 'borik']), capColor: rng.pick(BOT_PALETTE.tops),
    top: rng.pick(BOT_PALETTE.tops), trim: rng.pick([0xf0f0f0, 0x222222, 0xd9a83a]), pants: rng.pick(BOT_PALETTE.pants),
    boots: rng.pick(BOT_PALETTE.boots), hood: rng.chance(0.25), coat: rng.chance(0.15), camo: rng.chance(0.12), gloves: rng.chance(0.3) ? 0x222222 : null,
    beard: !female && rng.chance(0.3), female,
  };
  if (!base.topAlt) base.topAlt = new THREE.Color(base.top).multiplyScalar(0.85).getHex();
  return base;
}

// ---- Геометрия жинау ----
class PartBuilder {
  constructor() { this.parts = []; }
  add(g, bone, color, m, blend) { // blend: {parent, from, to} — y бойынша тегіс салмақ
    const c = g.clone();
    if (m) c.applyMatrix4(m);
    this.parts.push({ g: c, bone, color, blend });
  }
  build() {
    let total = 0, totalIdx = 0;
    for (const p of this.parts) { total += p.g.attributes.position.count; totalIdx += p.g.index ? p.g.index.count : p.g.attributes.position.count; }
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    const si = new Uint16Array(total * 4), sw = new Float32Array(total * 4);
    const idx = new Uint32Array(totalIdx);
    let vo = 0, io = 0;
    const c = new THREE.Color();
    for (const p of this.parts) {
      const g = p.g;
      if (!g.attributes.normal) g.computeVertexNormals();
      const P = g.attributes.position, N = g.attributes.normal;
      c.set(p.color);
      for (let i = 0; i < P.count; i++) {
        const k = vo + i;
        pos[k * 3] = P.getX(i); pos[k * 3 + 1] = P.getY(i); pos[k * 3 + 2] = P.getZ(i);
        nor[k * 3] = N.getX(i); nor[k * 3 + 1] = N.getY(i); nor[k * 3 + 2] = N.getZ(i);
        const ao = 0.72 + 0.28 * Math.min(1, P.getY(i) / 1.7);
        col[k * 3] = c.r * ao; col[k * 3 + 1] = c.g * ao; col[k * 3 + 2] = c.b * ao;
        si[k * 4] = BI[p.bone]; sw[k * 4] = 1;
        if (p.blend) {
          const y = P.getY(i);
          const t = clamp((y - p.blend.from) / (p.blend.to - p.blend.from), 0, 1);
          const wp = t * t * (3 - 2 * t) * 0.5;
          si[k * 4 + 1] = BI[p.blend.parent];
          sw[k * 4] = 1 - wp; sw[k * 4 + 1] = wp;
        }
      }
      if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; }
      else { for (let i = 0; i < P.count; i++) idx[io++] = i + vo; }
      vo += P.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }
}

const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

const GEO_CACHE = new Map();

export function buildCharacterGeometry(o, gear = {}) {
  const key = JSON.stringify(o) + '|' + (gear.vest || 0) + (gear.helm || 0) + (gear.pack ? 1 : 0);
  if (GEO_CACHE.has(key)) return GEO_CACHE.get(key);
  const pb = new PartBuilder();
  const B = BIND;
  const sk = o.skin, fem = o.female;
  const sh = fem ? 0.92 : 1;
  // ---- Бас ----
  const hy = B.head[1] + 0.1;
  pb.add(new THREE.SphereGeometry(0.116, 14, 10), 'head', sk, M(0, hy, 0.005, 0, 0, 0, 0.98, 1.1, 1.04));
  pb.add(new THREE.SphereGeometry(0.06, 8, 6), 'head', sk, M(0, hy - 0.07, 0.035, 0, 0, 0, 1.2, 0.7, 1.0)); // иек
  for (const s of [-1, 1]) {
    pb.add(new THREE.SphereGeometry(0.025, 7, 5), 'head', 0xffffff, M(s * 0.043, hy + 0.013, 0.1, 0, 0, 0, 1.25, 0.9, 0.6));
    pb.add(new THREE.SphereGeometry(0.015, 6, 4), 'head', 0x140a06, M(s * 0.043, hy + 0.012, 0.112));
    pb.add(new THREE.BoxGeometry(0.05, 0.012, 0.014), 'head', o.hair, M(s * 0.043, hy + 0.045, 0.106, 0, 0, s * -0.12));
    pb.add(new THREE.SphereGeometry(0.024, 6, 4), 'head', sk, M(s * 0.112, hy + 0.0, -0.005, 0, 0, 0, 0.5, 1, 0.8));
  }
  pb.add(new THREE.ConeGeometry(0.018, 0.045, 6), 'head', new THREE.Color(sk).multiplyScalar(0.92).getHex(), M(0, hy - 0.01, 0.112, Math.PI / 2 * 0.85, 0, 0));
  pb.add(new THREE.BoxGeometry(0.042, 0.008, 0.012), 'head', fem ? 0xb84a4a : 0x8a4a3a, M(0, hy - 0.048, 0.1));
  if (o.beard) pb.add(new THREE.SphereGeometry(0.07, 10, 5, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), 'head', o.hair, M(0, hy - 0.025, 0.035, 0, 0, 0, 1.15, 0.9, 1.05));
  // Шаш
  const hairCap = new THREE.SphereGeometry(0.121, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.52);
  pb.add(hairCap, 'head', o.hair, M(0, hy + 0.012, -0.01, -0.25, 0, 0, 1, 1.05, 1.06));
  if (o.hairStyle === 'long') {
    pb.add(roundedBox(0.22, 0.32, 0.07, 0.03, 1), 'head', o.hair, M(0, hy - 0.12, -0.075));
    pb.add(roundedBox(0.05, 0.2, 0.06, 0.02, 1), 'head', o.hair, M(-0.1, hy - 0.06, 0.02));
    pb.add(roundedBox(0.05, 0.2, 0.06, 0.02, 1), 'head', o.hair, M(0.1, hy - 0.06, 0.02));
  } else if (o.hairStyle === 'bun') {
    pb.add(new THREE.SphereGeometry(0.06, 10, 8), 'head', o.hair, M(0, hy + 0.06, -0.12));
    pb.add(new THREE.TorusGeometry(0.04, 0.012, 6, 12), 'head', o.trim, M(0, hy + 0.06, -0.09, 0.3, 0, 0));
  }
  // Бас киім
  if (!gear.helm) {
    if (o.hat === 'cap') {
      pb.add(new THREE.SphereGeometry(0.126, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), 'head', o.capColor || 0x333333, M(0, hy + 0.02, -0.005));
      pb.add(roundedBox(0.16, 0.012, 0.1, 0.005, 1), 'head', o.capColor || 0x333333, M(0, hy + 0.025, 0.13, -0.15, 0, 0));
    } else if (o.hat === 'takiya') {
      pb.add(new THREE.CylinderGeometry(0.115, 0.123, 0.07, 16), 'head', 0x1a1a1a, M(0, hy + 0.085, -0.005));
      pb.add(new THREE.CylinderGeometry(0.124, 0.124, 0.02, 16), 'head', 0xd9a83a, M(0, hy + 0.06, -0.005));
      pb.add(new THREE.SphereGeometry(0.115, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.2), 'head', 0x1a1a1a, M(0, hy + 0.08, -0.005));
    } else if (o.hat === 'borik') {
      pb.add(new THREE.CylinderGeometry(0.1, 0.12, 0.13, 16), 'head', 0x8a1a1a, M(0, hy + 0.11, -0.005));
      pb.add(new THREE.TorusGeometry(0.128, 0.035, 5, 12), 'head', 0x5a3a22, M(0, hy + 0.06, -0.005, Math.PI / 2, 0, 0));
      pb.add(new THREE.SphereGeometry(0.1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.4), 'head', 0x8a1a1a, M(0, hy + 0.15, -0.005));
      pb.add(new THREE.SphereGeometry(0.02, 6, 6), 'head', 0xd9a83a, M(0, hy + 0.21, -0.005));
    }
  }
  // Мойын
  pb.add(new THREE.CylinderGeometry(0.048, 0.055, 0.12, 10), 'neck', sk, M(0, B.neck[1] + 0.04, 0));
  // ---- Тұлға ----
  const topC = o.top, alt = o.topAlt;
  pb.add(roundedBox(0.38 * sh, 0.3, 0.22, 0.075, 2), 'chest', topC, M(0, B.chest[1] + 0.1, 0));
  if (fem) pb.add(roundedBox(0.28, 0.1, 0.06, 0.03, 1), 'chest', topC, M(0, B.chest[1] + 0.08, 0.09));
  pb.add(roundedBox(0.31 * sh, 0.22, 0.19, 0.06, 2), 'spine', alt, M(0, B.spine[1] + 0.08, 0));
  pb.add(roundedBox(0.35 * sh, 0.19, 0.21, 0.065, 2), 'hips', o.pants, M(0, B.hips[1] - 0.03, 0));
  pb.add(roundedBox(0.335 * sh, 0.045, 0.205, 0.015, 1), 'hips', 0x1e1a16, M(0, B.hips[1] + 0.06, 0));
  pb.add(new THREE.BoxGeometry(0.05, 0.035, 0.01), 'hips', 0xc0a050, M(0, B.hips[1] + 0.06, 0.104));
  // Жаға мен сыдырма
  pb.add(roundedBox(0.2, 0.05, 0.17, 0.02, 1), 'chest', o.trim, M(0, B.chest[1] + 0.25, -0.01));
  pb.add(new THREE.BoxGeometry(0.012, 0.42, 0.01), 'chest', o.trim, M(0, B.chest[1] + 0.02, 0.107));
  if (o.hood) pb.add(roundedBox(0.26, 0.12, 0.1, 0.04, 1), 'chest', alt, M(0, B.chest[1] + 0.26, -0.1, 0.4, 0, 0));
  if (o.camo) for (const [x, y, s] of [[0.08, 0.1, 0.06], [-0.1, 0.18, 0.05], [0.05, -0.05, 0.07]]) pb.add(new THREE.SphereGeometry(s, 6, 4), 'chest', 0x3a3f2a, M(x, B.chest[1] + y, 0.09, 0, 0, 0, 1, 1, 0.3));
  // Қалталар
  for (const s of [-1, 1]) pb.add(new THREE.BoxGeometry(0.08, 0.07, 0.015), 'chest', alt, M(s * 0.09, B.chest[1] + 0.13, 0.105));
  // Шапан етегі (ою жиекті)
  if (o.coat) {
    pb.add(roundedBox(0.34, 0.4, 0.04, 0.02, 1), 'hips', topC, M(0, B.hips[1] - 0.22, -0.12, 0.14, 0, 0));
    for (const s of [-1, 1]) pb.add(roundedBox(0.13, 0.36, 0.035, 0.015, 1), 'hips', topC, M(s * 0.1, B.hips[1] - 0.2, 0.115, -0.1, 0, 0));
    pb.add(new THREE.BoxGeometry(0.35, 0.03, 0.05), 'hips', o.trim, M(0, B.hips[1] - 0.41, -0.15, 0.14, 0, 0));
    pb.add(new THREE.BoxGeometry(0.02, 0.5, 0.012), 'chest', o.trim, M(0.03, B.chest[1], 0.108));
  }
  // ---- Қолдар ----
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const ua = B['upperArm' + side], fa = B['foreArm' + side], hd = B['hand' + side];
    pb.add(new THREE.SphereGeometry(0.078, 8, 6), 'upperArm' + side, topC, M(ua[0] + s * 0.012, ua[1] - 0.02, 0, 0, 0, 0, 1, 1.05, 1));
    pb.add(capsule(0.06, 0.19, 8, 2), 'upperArm' + side, topC, M(ua[0], ua[1] - 0.14, 0), { parent: 'chest', from: ua[1] - 0.06, to: ua[1] + 0.05 });
    const sleeve = o.camo || o.coat || o.hood || o.hat === 'cap';
    pb.add(new THREE.SphereGeometry(0.056, 7, 5), 'foreArm' + side, topC, M(fa[0], fa[1] - 0.005, 0));
    pb.add(capsule(0.052, 0.18, 8, 2), 'foreArm' + side, sleeve ? alt : sk, M(fa[0], fa[1] - 0.12, 0), { parent: 'upperArm' + side, from: fa[1] - 0.04, to: fa[1] + 0.04 });
    if (sleeve) pb.add(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8), 'foreArm' + side, o.trim, M(fa[0], fa[1] - 0.22, 0));
    const hc = o.gloves || sk;
    pb.add(roundedBox(0.075, 0.095, 0.042, 0.018, 1), 'hand' + side, hc, M(hd[0], hd[1] - 0.05, 0.005));
    pb.add(roundedBox(0.024, 0.055, 0.026, 0.01, 1), 'hand' + side, hc, M(hd[0] + s * -0.035, hd[1] - 0.035, 0.024, 0, 0, s * 0.4));
  }
  // ---- Аяқтар ----
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const th = B['thigh' + side], sn = B['shin' + side], ft = B['foot' + side];
    pb.add(capsule(0.088, 0.28, 8, 2), 'thigh' + side, o.pants, M(th[0], th[1] - 0.2, 0), { parent: 'hips', from: th[1] - 0.08, to: th[1] + 0.04 });
    pb.add(new THREE.SphereGeometry(0.074, 7, 5), 'shin' + side, o.pants, M(sn[0], sn[1] - 0.01, 0.005));
    pb.add(capsule(0.07, 0.28, 8, 2), 'shin' + side, o.pants, M(sn[0], sn[1] - 0.2, 0), { parent: 'thigh' + side, from: sn[1] - 0.06, to: sn[1] + 0.04 });
    if (o.camo) pb.add(roundedBox(0.09, 0.1, 0.04, 0.02, 1), 'shin' + side, 0x2a2a22, M(sn[0], sn[1] - 0.02, 0.06));
    // Етік
    pb.add(roundedBox(0.105, 0.16, 0.11, 0.035, 1), 'shin' + side, o.boots, M(ft[0], ft[1] + 0.1, 0));
    pb.add(roundedBox(0.1, 0.085, 0.24, 0.035, 1), 'foot' + side, o.boots, M(ft[0], ft[1] - 0.02, 0.045));
    pb.add(roundedBox(0.105, 0.025, 0.25, 0.01, 1), 'foot' + side, 0x1a1410, M(ft[0], ft[1] - 0.065, 0.045));
    void s;
  }
  // ---- Жабдықтар ----
  if (gear.vest) {
    const vc = [0, 0x6b7048, 0x3c4048, 0x1e2024][gear.vest];
    pb.add(roundedBox(0.4 * sh, 0.34, 0.26, 0.06, 2), 'chest', vc, M(0, B.chest[1] + 0.08, 0));
    for (let i = -1; i <= 1; i++) pb.add(roundedBox(0.09, 0.1, 0.05, 0.015, 1), 'chest', new THREE.Color(vc).multiplyScalar(0.8).getHex(), M(i * 0.11, B.chest[1] - 0.02, 0.14));
    if (gear.vest >= 2) pb.add(roundedBox(0.3, 0.2, 0.03, 0.02, 1), 'chest', new THREE.Color(vc).multiplyScalar(1.2).getHex(), M(0, B.chest[1] + 0.14, 0.135));
    if (gear.vest === 3) for (const s of [-1, 1]) pb.add(roundedBox(0.1, 0.06, 0.12, 0.02, 1), 'chest', vc, M(s * 0.2, B.chest[1] + 0.2, 0));
  }
  if (gear.helm) {
    const hc = [0, 0x5a6040, 0x3a4048, 0x1a1c20][gear.helm];
    pb.add(new THREE.SphereGeometry(0.138, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.55), 'head', hc, M(0, hy + 0.015, -0.005, -0.1, 0, 0, 1, 1, 1.05));
    pb.add(new THREE.TorusGeometry(0.135, 0.012, 4, 20), 'head', new THREE.Color(hc).multiplyScalar(0.7).getHex(), M(0, hy - 0.005, -0.01, Math.PI / 2 - 0.1, 0, 0));
    if (gear.helm >= 2) pb.add(roundedBox(0.16, 0.04, 0.03, 0.015, 1), 'head', 0x111111, M(0, hy + 0.08, 0.115, -0.3, 0, 0));
    if (gear.helm === 3) {
      pb.add(roundedBox(0.2, 0.07, 0.04, 0.02, 1), 'head', 0x0a0a0a, M(0, hy + 0.02, 0.12, 0.05, 0, 0));
      pb.add(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), 'head', 0x222222, M(0.11, hy + 0.1, -0.02, 0, 0, 0.3));
    }
  }
  if (gear.pack) {
    pb.add(roundedBox(0.3, 0.38, 0.16, 0.05, 2), 'chest', 0x5a4a32, M(0, B.chest[1] + 0.02, -0.18));
    pb.add(roundedBox(0.24, 0.14, 0.06, 0.03, 1), 'chest', 0x4a3a26, M(0, B.chest[1] - 0.08, -0.27));
  }
  const geo = pb.build();
  GEO_CACHE.set(key, geo);
  return geo;
}

// ---- Модель ----
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0);

export class CharacterModel {
  constructor(material, outfit) {
    this.material = material;
    this.outfit = outfit;
    this.gear = { vest: 0, helm: 0, pack: false };
    this.group = new THREE.Group();
    this.bones = {};
    const list = [];
    for (const [n, p, x, y, z] of BONES) {
      const b = new THREE.Bone();
      b.name = n;
      b.position.set(x, y, z);
      if (p) this.bones[p].add(b);
      this.bones[n] = b;
      list.push(b);
    }
    this.boneList = list;
    this.skeleton = new THREE.Skeleton(list);
    const geo = buildCharacterGeometry(outfit, this.gear);
    this.mesh = new THREE.SkinnedMesh(geo, material);
    this.mesh.add(this.bones.root);
    this.mesh.bind(this.skeleton);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.rest = {};
    for (const b of list) this.rest[b.name] = b.position.clone();
    // Қару ұяшығы (кеудеде)
    this.socket = new THREE.Object3D();
    this.bones.chest.add(this.socket);
    this.weaponMesh = null;
    this.weaponDef = null;
    this.phase = 0;
    this.st = { crouch: 0, air: 0, run: 0, aim: 0, dive: 0, chute: 0, dead: 0, lowGun: 0, reload: 0, heal: 0, throwT: 0, recoil: 0, yawOff: 0 };
    this.parachute = null;
  }

  setGear(vest, helm, pack) {
    if (this.gear.vest === vest && this.gear.helm === helm && this.gear.pack === pack) return;
    this.gear = { vest, helm, pack };
    this.mesh.geometry = buildCharacterGeometry(this.outfit, this.gear);
  }

  setWeapon(def, mesh) {
    if (this.weaponMesh) this.socket.remove(this.weaponMesh);
    this.weaponDef = def;
    this.weaponMesh = mesh;
    if (mesh) this.socket.add(mesh);
  }

  ensureParachute(make) {
    if (!this.parachute) { this.parachute = make(); this.group.add(this.parachute); }
    return this.parachute;
  }

  // Екі сүйекті IK: upper/lower сүйектерін target (әлемдік) нүктесіне жеткізу
  ik(upper, lower, hand, target, pole) {
    upper.parent.updateMatrixWorld(true);
    const S = _v1.setFromMatrixPosition(upper.matrixWorld);
    const a = 0.28, b = 0.25 + 0.05;
    const toT = _v2.subVectors(target, S);
    let d = toT.length();
    d = clamp(d, 0.05, a + b - 0.002);
    toT.normalize();
    const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const perp = _v3.copy(pole).addScaledVector(toT, -pole.dot(toT));
    if (perp.lengthSq() < 1e-6) perp.set(0, -1, 0);
    perp.normalize();
    const E = _v4.copy(S).addScaledVector(toT, a * cosA).addScaledVector(perp, a * sinA);
    // Иық: (0,-1,0) бағытын E-S бағытына бұру (ата-ана кеңістігінде)
    upper.parent.getWorldQuaternion(_q1).invert();
    const dirU = _v2.subVectors(E, S).normalize().applyQuaternion(_q1);
    upper.quaternion.setFromUnitVectors(DOWN, dirU);
    upper.updateMatrixWorld(true);
    upper.getWorldQuaternion(_q2).invert();
    const T = _v3.copy(target);
    const dirL = T.sub(E).normalize().applyQuaternion(_q2);
    lower.quaternion.setFromUnitVectors(DOWN, dirL);
    lower.updateMatrixWorld(true);
    if (hand) hand.rotation.set(0, 0, 0);
  }

  // a: анимация күйі; dt
  // a = { speed, moveAngle (дененің бағытына қатысты), crouch, air, aimPitch, aiming, running, dive, chute, dead, reloading, healing, firing, armed, near, holster }
  animate(a, dt) {
    const B = this.bones, st = this.st;
    st.crouch = damp(st.crouch, a.crouch ? 1 : 0, 12, dt);
    st.air = damp(st.air, a.air ? 1 : 0, 10, dt);
    st.dive = damp(st.dive, a.dive ? 1 : 0, 5, dt);
    st.chute = damp(st.chute, a.chute ? 1 : 0, 5, dt);
    st.dead = a.dead ? Math.min(1, st.dead + dt * 2.2) : 0;
    st.aim = damp(st.aim, a.aiming ? 1 : 0, 14, dt);
    st.lowGun = damp(st.lowGun, (a.running && !a.firing && !a.aiming) || a.healing || a.holster ? 1 : 0, 8, dt);
    st.reload = damp(st.reload, a.reloading ? 1 : 0, 10, dt);
    st.recoil = Math.max(0, st.recoil - dt * 9);
    if (a.fireKick) { st.recoil = Math.min(1, st.recoil + a.fireKick); a.fireKick = 0; }
    st.throwT = Math.max(0, st.throwT - dt);

    const speed = a.speed;
    const stride = a.crouch ? 0.9 : speed > 4.5 ? 1.55 : 1.15;
    this.phase += (speed * dt / stride) * Math.PI;
    const ph = this.phase;
    const mv = clamp(speed / 6, 0, 1);
    // Жүріс бағыты: артқа жүргенде цикл кері
    let ma = a.moveAngle || 0;
    let back = 1;
    if (Math.abs(ma) > Math.PI / 2 + 0.2) { back = -1; ma = ma > 0 ? ma - Math.PI : ma + Math.PI; }
    st.yawOff = damp(st.yawOff, speed > 0.3 ? clamp(ma, -1.2, 1.2) * 0.8 : 0, 8, dt);

    const legA = (a.crouch ? 0.45 : 0.55 + mv * 0.35) * Math.min(1, speed / 1.5);
    const kneeA = (a.crouch ? 0.5 : 0.7 + mv * 0.6) * Math.min(1, speed / 1.5);
    const sL = Math.sin(ph) * back, cL = Math.cos(ph);
    const sR = -sL, cR = -cL;

    // Тұлға
    const bob = Math.abs(Math.sin(ph)) * 0.035 * Math.min(1, speed / 2);
    B.root.position.set(0, 0, 0);
    B.root.rotation.set(0, 0, 0);
    B.hips.position.y = this.rest.hips.y - st.crouch * 0.44 + bob - st.air * 0.04;
    B.hips.rotation.set(0, st.yawOff, Math.sin(ph) * 0.04 * mv);
    const pitch = a.aimPitch || 0;
    const lean = mv * 0.14 * (1 - st.aim) + st.crouch * 0.35;
    B.spine.rotation.set(lean - pitch * 0.3, -st.yawOff * 0.5, 0);
    B.chest.rotation.set(-pitch * 0.45 - st.recoil * 0.06, -st.yawOff * 0.5, 0);
    B.neck.rotation.set(-pitch * 0.15, 0, 0);
    B.head.rotation.set(-pitch * 0.1 - lean * 0.6, 0, 0);
    // Тыныс алу (тұрғанда)
    this.idleT = (this.idleT || Math.random() * 10) + dt;
    const idle = 1 - mv;
    if (idle > 0.01) {
      B.chest.rotation.x += Math.sin(this.idleT * 1.7) * 0.022 * idle;
      B.head.rotation.y += Math.sin(this.idleT * 0.37) * 0.12 * idle * (1 - st.aim);
      B.spine.rotation.z += Math.sin(this.idleT * 0.6) * 0.015 * idle;
    }

    // Аяқтар
    const legs = [['L', sL, cL], ['R', sR, cR]];
    for (const [s, sn, cs] of legs) {
      const th = B['thigh' + s], sh = B['shin' + s], ft = B['foot' + s];
      let tx = -sn * legA, kx = Math.max(0, cs * back) * kneeA + 0.05, fx = 0;
      // Отыру
      tx = lerp(tx, -1.4 + tx * 0.5 + (s === 'L' ? -0.15 : 0.25), st.crouch);
      kx = lerp(kx, 2.15 + kx * 0.4 + (s === 'L' ? 0 : 0.2), st.crouch);
      fx = lerp(fx, -0.75, st.crouch);
      // Ауада
      tx = lerp(tx, -0.55 + (s === 'L' ? 0.25 : -0.1), st.air);
      kx = lerp(kx, 0.95, st.air);
      th.rotation.set(tx, 0, (s === 'L' ? 1 : -1) * 0.03);
      sh.rotation.set(kx, 0, 0);
      ft.rotation.set(fx - kx * 0.25 + Math.max(0, -tx) * 0.1, 0, 0);
    }

    // Еркін құлау / парашют
    if (st.dive > 0.01) {
      B.root.rotation.x = st.dive * 1.35;
      B.root.position.y = st.dive * 0.9;
      for (const s of ['L', 'R']) {
        const k = s === 'L' ? 1 : -1;
        B['thigh' + s].rotation.x = lerp(B['thigh' + s].rotation.x, 0.25, st.dive);
        B['thigh' + s].rotation.z = lerp(B['thigh' + s].rotation.z, k * 0.25, st.dive);
        B['shin' + s].rotation.x = lerp(B['shin' + s].rotation.x, 0.7, st.dive);
      }
      B.head.rotation.x = lerp(B.head.rotation.x, -0.9, st.dive);
    }
    if (st.chute > 0.01) {
      for (const s of ['L', 'R']) {
        B['thigh' + s].rotation.x = lerp(B['thigh' + s].rotation.x, -0.25 + Math.sin(ph * 0.3 + (s === 'L' ? 0 : 1)) * 0.1, st.chute);
        B['shin' + s].rotation.x = lerp(B['shin' + s].rotation.x, 0.35, st.chute);
      }
    }
    // Өлім — артқа құлау
    if (st.dead > 0) {
      const t = st.dead;
      const e = 1 - Math.pow(1 - t, 3);
      B.root.rotation.x = -e * Math.PI / 2 * 0.98;
      B.root.position.y = e * 0.12;
      B.root.position.z = -e * 0.2;
      B.hips.position.y = lerp(B.hips.position.y, this.rest.hips.y, e);
      for (const s of ['L', 'R']) {
        B['thigh' + s].rotation.set(lerp(B['thigh' + s].rotation.x, -0.2, e), 0, (s === 'L' ? 1 : -1) * 0.2 * e);
        B['shin' + s].rotation.x = lerp(B['shin' + s].rotation.x, 0.3, e);
      }
    }

    this.mesh.updateMatrixWorld(true);

    // Қолдар
    const def = this.weaponDef;
    const armed = !!(def && this.weaponMesh) && st.dead < 0.3;
    if (this.weaponMesh) this.weaponMesh.visible = armed;
    const simple = !a.near;
    if (armed && st.dive < 0.5 && st.chute < 0.5) {
      // Қару ұяшығының орны (кеуде кеңістігінде)
      const g = def.hold;
      const low = st.lowGun;
      const sk = this.socket;
      sk.position.set(lerp(g.x, g.x + 0.05, low), lerp(g.y, g.y - 0.12, low) - st.reload * 0.05, lerp(g.z, g.z - 0.06, low) - st.recoil * 0.05);
      sk.rotation.set(lerp(0, 0.75, low) + st.recoil * 0.12 + st.reload * 0.35, lerp(0, 0.55, low) - st.reload * 0.2, lerp(0, 0.35, low));
      sk.updateMatrixWorld(true);
      if (simple) {
        this._fkArms(true);
      } else {
        const gripR = _v4.set(def.grip[0], def.grip[1], def.grip[2]).applyMatrix4(sk.matrixWorld);
        const tR = gripR.clone();
        const fore = new THREE.Vector3(def.fore[0], def.fore[1], def.fore[2]);
        if (st.reload > 0.05) fore.lerp(new THREE.Vector3(def.magPos[0], def.magPos[1] - 0.06 - Math.sin(performance.now() * 0.012) * 0.03 * st.reload, def.magPos[2]), st.reload);
        const tL = fore.applyMatrix4(sk.matrixWorld);
        const poleR = new THREE.Vector3(-0.8, -1, -0.3).applyQuaternion(this.group.quaternion);
        const poleL = new THREE.Vector3(0.9, -1, -0.2).applyQuaternion(this.group.quaternion);
        this.ik(B.upperArmR, B.foreArmR, B.handR, tR, poleR);
        this.ik(B.upperArmL, B.foreArmL, B.handL, tL, poleL);
      }
    } else {
      this._fkArms(false, ph, mv, back);
    }
    if (st.throwT > 0) {
      const t = 1 - st.throwT / 0.5;
      B.upperArmR.rotation.set(-2.6 + t * 3.2, 0, -0.3);
      B.foreArmR.rotation.set(-0.8 + t * 0.6, 0, 0);
    }
    this.mesh.updateMatrixWorld(true);
    if (this.parachute) {
      this.parachute.visible = st.chute > 0.05;
      this.parachute.scale.setScalar(Math.max(0.01, st.chute));
    }
  }

  _fkArms(armedSimple, ph = 0, mv = 0, back = 1) {
    const B = this.bones, st = this.st;
    if (armedSimple) {
      B.upperArmR.rotation.set(-1.1, 0, -0.35); B.foreArmR.rotation.set(-0.9, 0, 0);
      B.upperArmL.rotation.set(-1.3, 0, 0.5); B.foreArmL.rotation.set(-0.6, 0, 0);
      return;
    }
    const sw = Math.sin(ph) * back * (0.25 + mv * 0.6);
    let ual = sw, uar = -sw;
    let zL = 0.12, zR = -0.12;
    let fl = -0.25 - mv * 0.9, fr = fl;
    if (st.dive > 0.01) {
      ual = lerp(ual, -0.4, st.dive); uar = lerp(uar, -0.4, st.dive);
      zL = lerp(zL, 1.3, st.dive); zR = lerp(zR, -1.3, st.dive);
      fl = lerp(fl, -0.7, st.dive); fr = lerp(fr, -0.7, st.dive);
    }
    if (st.chute > 0.01) {
      ual = lerp(ual, -2.7, st.chute); uar = lerp(uar, -2.7, st.chute);
      zL = lerp(zL, 0.35, st.chute); zR = lerp(zR, -0.35, st.chute);
      fl = lerp(fl, -0.3, st.chute); fr = lerp(fr, -0.3, st.chute);
    }
    if (st.dead > 0) {
      const e = st.dead;
      ual = lerp(ual, -2.2, e); uar = lerp(uar, -2.0, e); zL = lerp(zL, 0.9, e); zR = lerp(zR, -1.0, e);
    }
    B.upperArmL.rotation.set(ual, 0, zL); B.foreArmL.rotation.set(fl, 0, 0);
    B.upperArmR.rotation.set(uar, 0, zR); B.foreArmR.rotation.set(fr, 0, 0);
    B.handL.rotation.set(0, 0, 0); B.handR.rotation.set(0, 0, 0);
  }

  // Бас сүйегінің әлемдік орны (хитбокс үшін)
  headPos(out) { return out.setFromMatrixPosition(this.bones.head.matrixWorld).add(_v1.set(0, 0.1, 0)); }
  chestPos(out) { return out.setFromMatrixPosition(this.bones.chest.matrixWorld); }
  muzzlePos(out) {
    if (!this.weaponDef || !this.weaponMesh) return this.chestPos(out);
    const m = this.weaponDef.muzzle;
    return out.set(m[0], m[1], m[2]).applyMatrix4(this.socket.matrixWorld);
  }
}

export { BI as BONE_INDEX };
