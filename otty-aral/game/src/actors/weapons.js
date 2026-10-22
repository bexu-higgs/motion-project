// Қарулар: сипаттамалары және егжей-тегжейлі процедуралық модельдері. Олжа заттарының модельдері.
import * as THREE from 'three';
import { mergeParts, roundedBox, mat4 } from '../gfx/geom.js';

// hold — кеудедегі ұяшық орны; grip/fore/mag/muzzle — қару кеңістігіндегі нүктелер
export const WEAPONS = {
  fists: { id: 'fists', slot: 0, dmg: 18, rpm: 150, mag: 0, reload: 0, spreadHip: 0, spreadAim: 0, range: 1.9, recoil: 0, auto: true, ammo: null, rarity: 0, melee: true },
  pistol: {
    id: 'pistol', slot: 2, dmg: 26, rpm: 330, mag: 12, reload: 1.5, spreadHip: 0.035, spreadAim: 0.012, bloom: 0.012, range: 70, falloff: 25, recoil: 0.018, auto: false,
    ammo: 'ammo_9', rarity: 0, sound: 'pistol', zoom: 1.25, tracer: 0xffe9a0,
    hold: { x: -0.03, y: 0.14, z: 0.36 }, grip: [0, -0.05, -0.02], fore: [0.015, -0.07, 0.0], magPos: [0, -0.1, -0.01], muzzle: [0, 0.03, 0.17],
  },
  smg: {
    id: 'smg', slot: 1, dmg: 17, rpm: 850, mag: 30, reload: 2.0, spreadHip: 0.045, spreadAim: 0.02, bloom: 0.006, range: 70, falloff: 25, recoil: 0.012, auto: true,
    ammo: 'ammo_9', rarity: 1, sound: 'smg', zoom: 1.35, tracer: 0xffe9a0,
    hold: { x: -0.12, y: 0.12, z: 0.26 }, grip: [0, -0.07, 0.0], fore: [0, -0.02, 0.17], magPos: [0, -0.13, 0.08], muzzle: [0, 0.02, 0.36],
  },
  ak: {
    id: 'ak', slot: 1, dmg: 32, rpm: 600, mag: 30, reload: 2.5, spreadHip: 0.05, spreadAim: 0.012, bloom: 0.008, range: 160, falloff: 60, recoil: 0.03, auto: true,
    ammo: 'ammo_762', rarity: 1, sound: 'ak', zoom: 1.5, tracer: 0xffc070,
    hold: { x: -0.13, y: 0.12, z: 0.27 }, grip: [0, -0.07, -0.01], fore: [0, 0.0, 0.2], magPos: [0, -0.14, 0.09], muzzle: [0, 0.035, 0.6],
  },
  m4: {
    id: 'm4', slot: 1, dmg: 27, rpm: 720, mag: 30, reload: 2.2, spreadHip: 0.04, spreadAim: 0.008, bloom: 0.006, range: 170, falloff: 70, recoil: 0.018, auto: true,
    ammo: 'ammo_556', rarity: 2, sound: 'm4', zoom: 1.6, tracer: 0xffe090,
    hold: { x: -0.13, y: 0.12, z: 0.25 }, grip: [0, -0.07, -0.01], fore: [0, 0.0, 0.21], magPos: [0, -0.13, 0.08], muzzle: [0, 0.035, 0.58],
  },
  shotgun: {
    id: 'shotgun', slot: 1, dmg: 19, pellets: 8, rpm: 75, mag: 5, reload: 0.55, perShell: true, spreadHip: 0.09, spreadAim: 0.07, bloom: 0, range: 30, falloff: 10, recoil: 0.07, auto: false,
    ammo: 'ammo_12', rarity: 1, sound: 'shotgun', zoom: 1.2, tracer: 0xffd080,
    hold: { x: -0.13, y: 0.12, z: 0.3 }, grip: [0, -0.07, -0.01], fore: [0, -0.02, 0.2], magPos: [0, -0.04, 0.3], muzzle: [0, 0.03, 0.72],
  },
  sniper: {
    id: 'sniper', slot: 1, dmg: 140, rpm: 42, mag: 5, reload: 3.0, spreadHip: 0.06, spreadAim: 0.0008, bloom: 0, range: 420, falloff: 300, recoil: 0.09, auto: false,
    ammo: 'ammo_300', rarity: 3, sound: 'sniper', zoom: 4.5, scope: true, tracer: 0xfff0c0, bolt: true,
    hold: { x: -0.13, y: 0.12, z: 0.27 }, grip: [0, -0.07, -0.01], fore: [0, -0.01, 0.2], magPos: [0, -0.1, 0.07], muzzle: [0, 0.03, 0.8],
  },
};

export const RARITY_COLORS = ['#c8c8c8', '#4aa3ff', '#b45cff', '#ffb02e'];
export const AMMO_FOR = { ammo_9: ['pistol', 'smg'], ammo_556: ['m4'], ammo_762: ['ak'], ammo_12: ['shotgun'], ammo_300: ['sniper'] };
export const AMMO_PACK = { ammo_9: 30, ammo_556: 30, ammo_762: 30, ammo_12: 10, ammo_300: 10 };

const C = {
  metal: 0x2b2d30, metal2: 0x3c3f44, black: 0x161718, wood: 0x8a4a22, woodD: 0x5a2e14, tan: 0xb59a6a, olive: 0x4f5a34,
  steel: 0x8a8e94, brass: 0xc9a23a, orange: 0x9a4a18, red: 0xc0392b, white: 0xf2f2f2, blue: 0x2f9fe8, leather: 0x7a4a26,
};

const box = (w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0) => ({ g: new THREE.BoxGeometry(w, h, d), m: mat4(x, y, z, rx, ry, rz), color });
const rbox = (w, h, d, r, x, y, z, color, rx = 0) => ({ g: roundedBox(w, h, d, r, 2), m: mat4(x, y, z, rx), color });
const cylZ = (r, len, x, y, z, color, seg = 10, r2) => ({ g: new THREE.CylinderGeometry(r2 ?? r, r, len, seg).rotateX(Math.PI / 2), m: mat4(x, y, z), color });

function rail(parts, len, x, y, z, color = C.black) {
  parts.push(box(0.024, 0.008, len, x, y, z, color));
  const n = Math.floor(len / 0.012);
  for (let i = 0; i < n; i += 2) parts.push(box(0.028, 0.006, 0.006, x, y + 0.006, z - len / 2 + i * 0.012 + 0.006, color));
}

const BUILD = {
  pistol() {
    const p = [];
    p.push(rbox(0.03, 0.034, 0.18, 0.006, 0, 0.022, 0.07, C.metal2));
    for (let i = 0; i < 6; i++) p.push(box(0.031, 0.02, 0.003, 0, 0.026, -0.005 + i * 0.006, C.black));
    p.push(box(0.028, 0.025, 0.15, 0, -0.004, 0.065, C.black));
    p.push(rbox(0.03, 0.105, 0.046, 0.008, 0, -0.055, -0.005, C.black, 0.22));
    p.push(box(0.006, 0.02, 0.05, 0, -0.03, 0.035, C.black));
    p.push(box(0.008, 0.008, 0.008, 0, 0.044, 0.155, C.black));
    p.push(box(0.02, 0.008, 0.01, 0, 0.044, 0.0, C.black));
    p.push(cylZ(0.006, 0.02, 0, 0.022, 0.165, C.black, 8));
    return p;
  },
  smg() {
    const p = [];
    p.push(rbox(0.06, 0.09, 0.34, 0.012, 0, 0.0, 0.08, C.black));
    p.push(rbox(0.058, 0.04, 0.2, 0.01, 0, -0.06, 0.1, C.metal2));
    rail(p, 0.26, 0, 0.05, 0.08);
    p.push(cylZ(0.012, 0.07, 0, 0.01, 0.28, C.metal, 10));
    p.push(cylZ(0.02, 0.05, 0, 0.01, 0.33, C.black, 10));
    p.push(rbox(0.038, 0.11, 0.045, 0.01, 0, -0.08, -0.01, C.black, 0.25));
    p.push(box(0.032, 0.2, 0.05, 0, -0.15, 0.1, C.black, 0.08));
    p.push(box(0.012, 0.04, 0.2, 0, 0.02, -0.17, C.metal, 0));
    p.push(box(0.012, 0.04, 0.2, 0, -0.04, -0.17, C.metal, 0));
    p.push(box(0.05, 0.11, 0.025, 0, -0.01, -0.27, C.black));
    p.push(box(0.03, 0.035, 0.05, 0, 0.075, 0.05, C.black));
    p.push(box(0.022, 0.022, 0.003, 0, 0.075, 0.075, 0x3a7a3a));
    return p;
  },
  ak() {
    const p = [];
    p.push(box(0.055, 0.075, 0.33, 0, 0.0, 0.05, C.metal));
    p.push(rbox(0.05, 0.03, 0.27, 0.012, 0, 0.045, 0.03, C.metal2));
    p.push(cylZ(0.011, 0.32, 0, 0.022, 0.38, C.metal, 10));
    p.push(cylZ(0.011, 0.22, 0, 0.055, 0.31, C.metal2, 8));
    p.push(rbox(0.056, 0.05, 0.2, 0.012, 0, 0.012, 0.31, C.wood));
    p.push(rbox(0.048, 0.03, 0.17, 0.01, 0, 0.056, 0.31, C.wood));
    for (let i = 0; i < 3; i++) p.push(box(0.057, 0.006, 0.01, 0, 0.0, 0.25 + i * 0.05, C.woodD));
    p.push(box(0.008, 0.035, 0.008, 0, 0.055, 0.51, C.metal));
    p.push(box(0.03, 0.01, 0.012, 0, 0.04, 0.51, C.metal));
    p.push(cylZ(0.016, 0.055, 0, 0.022, 0.56, C.metal2, 10));
    p.push(box(0.03, 0.02, 0.04, 0, 0.062, 0.13, C.metal));
    // Иілген оқшантай
    for (let i = 0; i < 5; i++) {
      const a = i * 0.12;
      p.push(box(0.034, 0.05, 0.065, 0, -0.06 - i * 0.042, 0.08 + i * 0.012 + i * i * 0.003, i === 4 ? C.metal : C.orange, -a));
    }
    p.push(rbox(0.034, 0.1, 0.042, 0.01, 0, -0.08, -0.015, C.woodD, 0.28));
    p.push(box(0.006, 0.006, 0.06, 0, -0.055, 0.03, C.metal));
    p.push(box(0.006, 0.03, 0.006, 0, -0.04, 0.0, C.metal));
    p.push(box(0.045, 0.065, 0.24, 0, -0.02, -0.21, C.wood, 0.14));
    p.push(box(0.047, 0.09, 0.02, 0, -0.045, -0.33, C.woodD, 0.14));
    p.push(box(0.004, 0.01, 0.06, 0.028, 0.02, 0.07, C.metal2));
    return p;
  },
  m4() {
    const p = [];
    p.push(box(0.05, 0.06, 0.22, 0, 0.012, 0.04, C.black));
    p.push(box(0.045, 0.045, 0.16, 0, -0.035, 0.03, C.metal2));
    rail(p, 0.2, 0, 0.048, 0.04);
    p.push(rbox(0.06, 0.06, 0.24, 0.012, 0, 0.014, 0.27, C.tan));
    for (let i = 0; i < 5; i++) p.push(box(0.062, 0.012, 0.02, 0, 0.0, 0.18 + i * 0.045, 0x8a7550));
    rail(p, 0.22, 0, 0.05, 0.27, 0x8a7550);
    p.push(cylZ(0.01, 0.16, 0, 0.018, 0.46, C.metal, 10));
    p.push(cylZ(0.014, 0.05, 0, 0.018, 0.55, C.black, 8));
    p.push(box(0.008, 0.045, 0.012, 0, 0.065, 0.39, C.black));
    // Коллиматорлық көздеу
    p.push(rbox(0.038, 0.04, 0.07, 0.01, 0, 0.075, 0.06, C.black));
    p.push(box(0.03, 0.028, 0.003, 0, 0.078, 0.096, 0xc8302a));
    p.push(rbox(0.035, 0.1, 0.042, 0.01, 0, -0.07, -0.015, C.black, 0.28));
    p.push(box(0.032, 0.17, 0.06, 0, -0.12, 0.08, C.metal2, 0.12));
    p.push(cylZ(0.015, 0.2, 0, 0.0, -0.15, C.black, 10));
    p.push(rbox(0.045, 0.08, 0.14, 0.012, 0, -0.012, -0.23, C.tan));
    p.push(box(0.047, 0.1, 0.02, 0, -0.022, -0.305, C.black));
    return p;
  },
  shotgun() {
    const p = [];
    p.push(box(0.05, 0.07, 0.2, 0, 0.0, 0.02, C.metal));
    p.push(cylZ(0.014, 0.58, 0, 0.026, 0.41, C.metal2, 12));
    p.push(cylZ(0.012, 0.44, 0, -0.008, 0.34, C.metal, 10));
    p.push(rbox(0.05, 0.05, 0.16, 0.015, 0, -0.004, 0.33, C.wood));
    for (let i = 0; i < 6; i++) p.push(box(0.052, 0.005, 0.006, 0, -0.004 + (i % 2) * 0.01, 0.27 + i * 0.022, C.woodD));
    p.push(box(0.008, 0.012, 0.008, 0, 0.046, 0.69, C.brass));
    p.push(rbox(0.034, 0.1, 0.045, 0.01, 0, -0.07, -0.02, C.wood, 0.3));
    p.push(box(0.045, 0.075, 0.28, 0, -0.03, -0.22, C.wood, 0.13));
    p.push(box(0.047, 0.1, 0.02, 0, -0.06, -0.36, C.black, 0.13));
    for (let i = 0; i < 4; i++) p.push(cylZ(0.008, 0.05, 0.03, -0.0 - i * 0.0, -0.02 - i * 0.015, C.red, 6));
    return p;
  },
  sniper() {
    const p = [];
    p.push(cylZ(0.022, 0.24, 0, 0.012, 0.06, C.metal, 12));
    p.push(cylZ(0.012, 0.6, 0, 0.018, 0.48, C.metal2, 10, 0.009));
    p.push(cylZ(0.016, 0.06, 0, 0.018, 0.79, C.black, 10));
    // Оптика
    p.push(cylZ(0.019, 0.26, 0, 0.085, 0.06, C.black, 14));
    p.push(cylZ(0.026, 0.06, 0, 0.085, 0.21, C.black, 14, 0.019));
    p.push(cylZ(0.024, 0.05, 0, 0.085, -0.08, C.black, 14, 0.019));
    p.push(box(0.04, 0.003, 0.003, 0, 0.085, 0.24, 0x7ab0ff));
    p.push({ g: new THREE.CircleGeometry(0.022, 14), m: mat4(0, 0.085, 0.241), color: 0x4a7aff });
    p.push(cylZ(0.009, 0.025, 0, 0.115, 0.06, C.black, 8));
    for (const z of [-0.0, 0.12]) p.push(box(0.02, 0.05, 0.02, 0, 0.05, z, C.black));
    // Ысырма тұтқасы
    p.push({ g: new THREE.CylinderGeometry(0.005, 0.005, 0.06, 6).rotateZ(Math.PI / 2), m: mat4(-0.04, 0.012, -0.03), color: C.steel });
    p.push({ g: new THREE.SphereGeometry(0.012, 8, 6), m: mat4(-0.072, 0.008, -0.03), color: C.black });
    // Қундақ
    p.push(rbox(0.06, 0.07, 0.42, 0.018, 0, -0.03, 0.18, C.olive));
    p.push(rbox(0.04, 0.11, 0.05, 0.012, 0, -0.08, -0.04, C.olive, 0.25));
    p.push(box(0.05, 0.1, 0.26, 0, -0.04, -0.2, C.olive, 0.08));
    p.push(box(0.048, 0.04, 0.16, 0, 0.03, -0.17, 0x3f4a2a));
    p.push(box(0.052, 0.13, 0.025, 0, -0.05, -0.33, C.black, 0.08));
    p.push(box(0.032, 0.06, 0.07, 0, -0.08, 0.07, C.black));
    for (const s of [-1, 1]) p.push(box(0.008, 0.008, 0.18, s * 0.012, -0.065, 0.44, C.metal, 0.05));
    return p;
  },
};

export function makeWeaponGeometry(id) {
  if (!BUILD[id]) return null;
  return mergeParts(BUILD[id]());
}

// ---- Олжа заттарының модельдері ----
const ITEM_BUILD = {
  ammo(color) {
    const p = [rbox(0.26, 0.14, 0.16, 0.015, 0, 0.07, 0, 0x3f4a2a)];
    p.push(box(0.262, 0.03, 0.162, 0, 0.12, 0, color));
    p.push(box(0.08, 0.012, 0.02, 0, 0.145, 0, 0x222222));
    for (let i = 0; i < 3; i++) p.push({ g: new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), m: mat4(-0.05 + i * 0.05, 0.17, 0.04), color: C.brass });
    return p;
  },
  medkit() {
    const p = [rbox(0.34, 0.2, 0.22, 0.03, 0, 0.1, 0, 0xf2f2f2)];
    p.push(box(0.04, 0.12, 0.225, 0, 0.1, 0, C.red));
    p.push(box(0.12, 0.04, 0.225, 0, 0.1, 0, C.red));
    p.push(box(0.12, 0.02, 0.04, 0, 0.21, 0, 0x555555));
    return p;
  },
  kymyz() {
    const p = [];
    p.push({ g: new THREE.SphereGeometry(0.13, 14, 10), m: mat4(0, 0.14, 0, 0, 0, 0, 1, 1.15, 0.6), color: C.leather });
    p.push({ g: new THREE.CylinderGeometry(0.03, 0.045, 0.1, 10), m: mat4(0, 0.31, 0), color: 0x5a3216 });
    p.push({ g: new THREE.CylinderGeometry(0.036, 0.036, 0.025, 10), m: mat4(0, 0.37, 0), color: 0xd9a83a });
    p.push({ g: new THREE.TorusGeometry(0.135, 0.01, 6, 20), m: mat4(0, 0.14, 0, 0, Math.PI / 2, 0, 1, 1.15, 1), color: 0xd9a83a });
    p.push({ g: new THREE.TorusGeometry(0.06, 0.012, 6, 14), m: mat4(0, 0.14, 0.08, 0, 0, 0), color: 0xd9a83a });
    return p;
  },
  gloo() {
    const p = [{ g: new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12), m: mat4(0, 0.1, 0), color: 0x2f7fe8 }];
    p.push({ g: new THREE.CylinderGeometry(0.062, 0.062, 0.03, 12), m: mat4(0, 0.05, 0), color: 0xdfefff });
    p.push({ g: new THREE.OctahedronGeometry(0.06, 0), m: mat4(0, 0.25, 0, 0, 0.5, 0, 1, 1.4, 1), color: 0xbfe6ff });
    p.push(box(0.02, 0.06, 0.03, 0.06, 0.16, 0, 0x888888));
    return p;
  },
  grenade() {
    const p = [{ g: new THREE.SphereGeometry(0.06, 12, 10), m: mat4(0, 0.07, 0, 0, 0, 0, 1, 1.25, 1), color: 0x3f4a2a }];
    for (let i = 0; i < 3; i++) p.push({ g: new THREE.TorusGeometry(0.06, 0.004, 4, 14), m: mat4(0, 0.04 + i * 0.03, 0, Math.PI / 2, 0, 0, 1 - Math.abs(i - 1) * 0.08, 1 - Math.abs(i - 1) * 0.08, 1), color: 0x2f3820 });
    p.push({ g: new THREE.CylinderGeometry(0.02, 0.025, 0.04, 8), m: mat4(0, 0.15, 0), color: C.steel });
    p.push(box(0.012, 0.08, 0.02, 0.03, 0.12, 0, C.steel, 0, 0, 0.3));
    p.push({ g: new THREE.TorusGeometry(0.018, 0.003, 4, 10), m: mat4(-0.03, 0.16, 0, 0, Math.PI / 2, 0), color: C.steel });
    return p;
  },
  vest(level) {
    const col = [0, 0x6b7048, 0x3c4048, 0x1e2024][level];
    const p = [rbox(0.42, 0.12, 0.5, 0.05, 0, 0.06, 0, col)];
    for (let i = -1; i <= 1; i++) p.push(rbox(0.1, 0.05, 0.12, 0.015, i * 0.12, 0.12, 0.12, new THREE.Color(col).multiplyScalar(0.8).getHex()));
    p.push(box(0.1, 0.13, 0.04, 0, 0.06, -0.25, col));
    if (level >= 2) p.push(rbox(0.3, 0.03, 0.22, 0.02, 0, 0.13, -0.06, new THREE.Color(col).multiplyScalar(1.25).getHex()));
    return p;
  },
  helm(level) {
    const col = [0, 0x5a6040, 0x3a4048, 0x1a1c20][level];
    const p = [{ g: new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m: mat4(0, 0.02, 0), color: col }];
    p.push({ g: new THREE.TorusGeometry(0.148, 0.012, 4, 20), m: mat4(0, 0.02, 0, Math.PI / 2, 0, 0), color: new THREE.Color(col).multiplyScalar(0.7).getHex() });
    if (level === 3) p.push(rbox(0.2, 0.07, 0.04, 0.02, 0, 0.05, 0.14, 0x0a0a0a));
    return p;
  },
};

export const ITEMS = {
  ammo_9: { kind: 'ammo', color: 0xe8c84a, rarity: 0 },
  ammo_556: { kind: 'ammo', color: 0x4ac86a, rarity: 0 },
  ammo_762: { kind: 'ammo', color: 0xe86a3a, rarity: 0 },
  ammo_12: { kind: 'ammo', color: 0xd83a3a, rarity: 0 },
  ammo_300: { kind: 'ammo', color: 0x3a8ae8, rarity: 1 },
  vest1: { kind: 'vest', level: 1, rarity: 0 }, vest2: { kind: 'vest', level: 2, rarity: 1 }, vest3: { kind: 'vest', level: 3, rarity: 2 },
  helm1: { kind: 'helm', level: 1, rarity: 0 }, helm2: { kind: 'helm', level: 2, rarity: 1 }, helm3: { kind: 'helm', level: 3, rarity: 2 },
  medkit: { kind: 'medkit', rarity: 1 },
  kymyz: { kind: 'kymyz', rarity: 0 },
  gloo: { kind: 'gloo', rarity: 1 },
  grenade: { kind: 'grenade', rarity: 1 },
};
for (const w of Object.keys(WEAPONS)) if (w !== 'fists') ITEMS[w] = { kind: 'weapon', weapon: w, rarity: WEAPONS[w].rarity };

export function makeItemGeometry(type) {
  const it = ITEMS[type];
  if (!it) return null;
  if (it.kind === 'weapon') {
    const g = makeWeaponGeometry(it.weapon);
    g.rotateZ(Math.PI / 2);
    g.translate(0, 0.04, 0);
    return g;
  }
  if (it.kind === 'ammo') return mergeParts(ITEM_BUILD.ammo(it.color));
  if (it.kind === 'vest') return mergeParts(ITEM_BUILD.vest(it.level));
  if (it.kind === 'helm') return mergeParts(ITEM_BUILD.helm(it.level));
  return mergeParts(ITEM_BUILD[it.kind]());
}
