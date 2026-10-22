// Ерекше нысандар: Бәйтерек, қамал, шамшырақ, жел диірмені, мұржа, цистерна, айлақ, қайық.
import * as THREE from 'three';
import { Builder } from './builder.js';
import { cyl, uvBox, mergeParts, mat4, colorize } from '../gfx/geom.js';
import { Furn } from './prefabs.js';

// Бәйтерек монументі (кішірейтілген)
export function bayterek(ctx, x, y, z) {
  const b = new Builder(ctx, x, y, z, 0, 1);
  // Сатылы тұғыр
  for (let i = 0; i < 4; i++) {
    const r = 9 - i * 1.4;
    b.cyl(0, i * 0.35, 0, r, 0.35, 'concrete', 0xe8e4dc, { seg: 32 });
  }
  const H = 34, top = H + 1.4;
  // Орталық діңгек
  b.cyl(0, 1.4, 0, 1.4, H - 2, 'paint', 0xf6f6f6, { seg: 20, tile: 0, rt: 1.1 });
  // Тармақтар — вазаға ұқсас тор
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const yy = 1.4 + t * (H + 3);
      const rr = 1.6 + Math.sin(Math.min(1, t * 1.15) * Math.PI) * 2.2 + (t > 0.8 ? (t - 0.8) * 22 : 0);
      pts.push(new THREE.Vector3(Math.cos(a + t * 0.9) * rr, yy, Math.sin(a + t * 0.9) * rr));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 24, 0.16, 6, false);
    b.geo(tube, 'paint', 0xffffff, 0, 0, 0);
    tube.dispose();
  }
  // Алтын шар
  const sphere = new THREE.SphereGeometry(4.2, 36, 24);
  b.geo(sphere, 'gold', 0xffd77a, 0, top + 4.2, 0);
  sphere.dispose();
  // Шардағы тор жолақтары
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.TorusGeometry(4.25, 0.06, 4, 48);
    b.geo(ring, 'paint', 0xffffff, 0, top + 4.2, 0, 0, i * Math.PI / 6, 0, { cast: false });
    ring.dispose();
  }
  ctx.col.addCyl(x, z, 1.6, y, y + H + 2, 'concrete', false);
  ctx.landmarks.push({ x, z, y: y + top + 4 });
  return b;
}

// Ескі қамал
export function fortress(ctx, x, y, z) {
  const rng = ctx.rng;
  const b = new Builder(ctx, x, y, z, 0, 2);
  const S = 46, H = 6.5, T = 1.6;
  ctx.terrain.flattenRect(x, z, S + 8, S + 8, y - 0.1, 8);
  b.box(0, -2, 0, S + 2, 2.1, S + 2, 'stone', 0x9a9284, { nc: true });
  ctx.col.addBox(x - S / 2 - 1, y - 2, z - S / 2 - 1, x + S / 2 + 1, y + 0.1, z + S / 2 + 1, 'concrete', true);
  b.box(0, 0.1, 0, S, 0.04, S, 'dirt', 0xffffff, { nc: true, cast: false, tile: 4 });
  const merlons = (axis, a0, a1, fixed, yy) => {
    const len = a1 - a0, n = Math.floor(len / 1.4);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i + 0.5) * len / n;
      if (i % 2) continue;
      if (axis === 'x') b.box(a, yy, fixed, 0.8, 0.9, T * 0.35, 'stone', 0xb0a898, { walk: false });
      else b.box(fixed, yy, a, T * 0.35, 0.9, 0.8, 'stone', 0xb0a898, { walk: false });
    }
  };
  const sides = [
    ['x', S / 2 - T / 2, [{ at: S / 2, w: 4, y: 0, h: 4.2, kind: 'none' }]],
    ['x', -S / 2 + T / 2, [{ at: S * 0.3, w: 5, y: 0, h: H, kind: 'none' }]],
    ['z', -S / 2 + T / 2, [{ at: S * 0.6, w: 3.5, y: 0, h: H, kind: 'none' }]],
    ['z', S / 2 - T / 2, []],
  ];
  for (const [axis, fixed, ops] of sides) {
    b.wall(axis, -S / 2 + (axis === 'z' ? T : 0), S / 2 - (axis === 'z' ? T : 0), fixed, 0.1, H, T, 'stone', 0xc2b8a6, ops);
    const inner = fixed - Math.sign(fixed) * (T / 2 - T * 0.175 - 0.05);
    const outer = fixed + Math.sign(fixed) * (T / 2 - T * 0.175);
    merlons(axis, -S / 2 + 2, S / 2 - 2, outer, H + 0.1);
    void inner;
  }
  // Бұрыштағы мұнаралар
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const tx = sx * (S / 2), tz = sz * (S / 2);
    b.cyl(tx, 0, tz, 3.4, H + 3, 'stone', 0xb8ae9c, { seg: 18, rt: 3.0 });
    b.cyl(tx, H + 3, tz, 3.4, 0.3, 'stone', 0xa89e8c, { seg: 18 });
    for (let k = 0; k < 10; k += 2) {
      const a = k / 10 * Math.PI * 2;
      b.box(tx + Math.cos(a) * 3.0, H + 3.3, tz + Math.sin(a) * 3.0, 0.9, 1.0, 0.9, 'stone', 0xb0a898, { walk: false });
    }
    // Мұнара төбесіне баспалдақ (ішкі бұрыштан)
    b.loot(tx - sx * 1.0, H + 3.3, tz - sz * 1.0, 1);
  }
  // Қабырға үстіне шығатын баспалдақтар
  b.stairs(-S / 2 + T + 0.7, 0.1, -S / 2 + T + 0.6 + 26 * 0.32, '-z', H, 1.3, 'stone', 0xa89e8c);
  b.stairs(S / 2 - T - 0.7, 0.1, S / 2 - T - 0.6 - 26 * 0.32, '+z', H, 1.3, 'stone', 0xa89e8c);
  b.stairs(-S / 2 + 2.4 + 0.32 * 0, 0.1, -S / 2 + T + 0.7, '+x', H, 1.3, 'stone', 0xa89e8c);
  // Мұнаралардың төбесіне шығу: қабырға үстінен ±
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.stairs(sx * (S / 2 - 2.2), H + 0.1, sz * (S / 2 - T / 2), sx > 0 ? '+x' : '-x', 3.0 + 0.2, 1.2, 'stone', 0xa89e8c);
  }
  // Орталық қирандылар (донжон)
  const kw = 14, kd = 12;
  b.wall('x', -kw / 2, kw / 2, kd / 2, 0.1, 5, 0.9, 'stone', 0xb4aa98, [{ at: 4, w: 2, y: 0, h: 3, kind: 'none' }, { at: 10, w: 1.2, y: 2.2, h: 1.4, kind: 'none' }]);
  b.wall('x', -kw / 2, kw / 2 - 5, -kd / 2, 0.1, 3.5, 0.9, 'stone', 0xb4aa98, []);
  b.wall('z', -kd / 2, kd / 2, -kw / 2, 0.1, 4.2, 0.9, 'stone', 0xb4aa98, [{ at: 6, w: 1.2, y: 2.0, h: 1.4, kind: 'none' }]);
  b.wall('z', -kd / 2 + 4, kd / 2, kw / 2, 0.1, 2.5, 0.9, 'stone', 0xb4aa98, []);
  // Құлаған тастар
  for (let i = 0; i < 14; i++) {
    const g = new THREE.DodecahedronGeometry(rng.float(0.3, 0.9), 0);
    const px = rng.float(-kw, kw), pz = rng.float(-kd, kd);
    b.geo(g, 'stone', 0xa89e8c, px, 0.2, pz, rng.float(0, 3), rng.float(0, 3), 0);
    g.dispose();
  }
  b.loot(0, 0.1, 0, 1); b.loot(-4, 0.1, 3); b.loot(4, 0.1, -3);
  b.loot(-15, 0.1, 15); b.loot(15, 0.1, -12); b.loot(12, 0.1, 14);
  b.loot(-S / 2 + 1, H + 0.1, 0); b.loot(S / 2 - 1, H + 0.1, 5);
  // Ішкі ағаш күркелер
  for (const [px, pz] of [[-16, -14], [16, 12]]) {
    b.box(px, 0.1, pz, 5, 0.1, 4, 'wood', 0x8a6a4a, { nc: true, cast: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(px + sx * 2.3, 0.1, pz + sz * 1.8, 0.15, 2.6, 0.15, 'wood', 0x6a4a2a);
    b.geo(uvBox(5.6, 0.1, 4.6, 2), 'fabric', 0x8a5a3a, px, 2.75, pz, 0.12, 0, 0);
    Furn.crate(b, px - 1, 0.2, pz, 0.9); Furn.crate(b, px + 1, 0.2, pz - 0.6, 0.7);
  }
  // Ту
  b.geo(cyl(0.06, 0.06, 6, 6), 'flatMetal', 0x888888, S / 2, H + 3.3 + 3, S / 2);
  const flag = new THREE.PlaneGeometry(2.4, 1.3, 8, 4);
  b.geo(flag, 'fabric', 0x00afca, S / 2 + 1.2, H + 3.3 + 5.2, S / 2, 0, 0, 0, { cast: false });
  flag.dispose();
  for (const [ox, oz] of [[0, S / 2 + 4], [-S / 2 - 4, -S / 2 + S * 0.3], [S / 2 * 0.2, -S / 2 - 4]]) {
    b.door(ox, oz, ox * 0.5, oz * 0.6);
  }
  return b;
}

// Шамшырақ
export function lighthouse(ctx, x, y, z) {
  const b = new Builder(ctx, x, y, z, 0, 1);
  ctx.terrain.flattenRect(x, z, 12, 12, y, 6);
  b.cyl(0, -1, 0, 4, 1.4, 'stone', 0xb8b0a0, { seg: 20 });
  const H = 22, seg = 7;
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg, t1 = (i + 1) / seg;
    const r0 = 2.6 - t0 * 0.9, r1 = 2.6 - t1 * 0.9;
    const g = new THREE.CylinderGeometry(r1, r0, H / seg, 20);
    g.translate(0, H / seg / 2, 0);
    b.geo(g, 'paint', i % 2 ? 0xd23a2a : 0xf6f6f2, 0, 0.4 + t0 * H, 0);
    g.dispose();
  }
  ctx.col.addCyl(x, z, 2.6, y, y + H, 'concrete', false);
  b.cyl(0, H + 0.4, 0, 2.3, 0.3, 'paint', 0x333333, { seg: 20 });
  b.geo(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 16, 1, true), 'glass', 0xcfe6ff, 0, H + 1.8, 0);
  b.geo(new THREE.SphereGeometry(0.7, 12, 8), 'lamp', 0xffffff, 0, H + 1.8, 0, 0, 0, 0, { cast: false });
  b.geo(new THREE.ConeGeometry(1.7, 1.4, 16), 'paint', 0xd23a2a, 0, H + 3.6, 0);
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2;
    b.box(Math.cos(a) * 2.2, H + 0.7, Math.sin(a) * 2.2, 0.06, 1.0, 0.06, 'paint', 0x222222, { nc: true, cast: false });
  }
  b.geo(new THREE.TorusGeometry(2.2, 0.04, 4, 32), 'paint', 0x222222, 0, H + 1.7, 0, Math.PI / 2, 0, 0, { cast: false });
  ctx.landmarks.push({ x, z, y: y + H + 2, light: true });
  return b;
}

// Жел диірмені (айналатын қалақтар — динамикалық)
export function windTurbine(ctx, x, y, z, yaw) {
  const b = new Builder(ctx, x, y, z, 0, 0);
  const H = 42;
  b.cyl(0, -0.5, 0, 2.6, 0.9, 'concrete', 0xb0b0b0, { seg: 16 });
  b.cyl(0, 0.4, 0, 1.6, H, 'paint', 0xf4f4f4, { seg: 16, tile: 0, rt: 0.9 });
  const nac = new THREE.Group();
  const parts = [];
  parts.push({ g: uvBox(1.6, 1.6, 4.6, 2), m: mat4(0, 0, 0.6), color: 0xf0f0f0 });
  parts.push({ g: new THREE.SphereGeometry(0.75, 12, 8), m: mat4(0, 0, -1.9, 0, 0, 0, 1, 1, 1.4), color: 0xf4f4f4 });
  const nacGeo = mergeParts(parts);
  const mesh = new THREE.Mesh(nacGeo, ctx.mats.paint);
  mesh.castShadow = true;
  nac.add(mesh);
  const rotor = new THREE.Group();
  rotor.position.set(0, 0, -2.4);
  const blades = [];
  for (let i = 0; i < 3; i++) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, 0); shape.quadraticCurveTo(-0.9, 4, -0.25, 19); shape.lineTo(0.15, 19.5); shape.quadraticCurveTo(0.6, 6, 0.5, 0); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false, curveSegments: 6 });
    blades.push({ g, m: mat4(0, 0, 0, 0, 0, i * Math.PI * 2 / 3), color: 0xf8f8f8 });
  }
  const rg = mergeParts(blades);
  const rmesh = new THREE.Mesh(rg, ctx.mats.paint);
  rmesh.castShadow = true;
  rotor.add(rmesh);
  nac.add(rotor);
  nac.position.set(x, y + H + 0.6, z);
  nac.rotation.y = yaw;
  ctx.scene.add(nac);
  ctx.animated.push({ obj: rotor, axis: 'z', speed: 0.9 + ctx.rng.float(-0.2, 0.2) });
  ctx.col.addCyl(x, z, 1.6, y, y + H, 'metal', false);
  // Төменгі шағын қызмет кабинасы
  b.box(3.4, 0, 0, 2.2, 2.4, 1.6, 'metal', 0xdedede);
  b.box(3.4, 2.4, 0, 2.4, 0.1, 1.8, 'paint', 0x666666, { nc: true });
  return b;
}

// Зауыт мұржасы
export function chimney(ctx, x, y, z, h = 30) {
  const b = new Builder(ctx, x, y, z, 0, 0);
  b.cyl(0, -0.5, 0, 2.6, 2.5, 'brick', 0xffffff, { seg: 16 });
  b.cyl(0, 2, 0, 2.0, h, 'brick', 0xffffff, { seg: 16, rt: 1.3 });
  for (let i = 0; i < 2; i++) {
    const yy = h - 2 - i * 3;
    const r = 2.0 - (yy - 2) / h * 0.7 + 0.08;
    const g = new THREE.CylinderGeometry(r, r + 0.02, 1.2, 16);
    g.translate(0, 0.6, 0);
    b.geo(g, 'paint', i % 2 ? 0xffffff : 0xd23a2a, 0, yy, 0, 0, 0, 0, { cast: false });
    g.dispose();
  }
  b.geo(new THREE.TorusGeometry(1.35, 0.12, 6, 20), 'flatMetal', 0x333333, 0, h + 2, 0, Math.PI / 2, 0, 0);
  ctx.smokeSources.push({ x, y: y + h + 2, z });
  return b;
}

// Цистерна
export function tank(ctx, x, y, z, r = 4, h = 7, col = 0xdedede) {
  const b = new Builder(ctx, x, y, z, 0, 0);
  b.cyl(0, -0.4, 0, r + 0.4, 0.6, 'concrete', 0xaaaaaa, { seg: 20 });
  b.cyl(0, 0.2, 0, r, h, 'paint', col, { seg: 24, tile: 0 });
  const dome = new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.18);
  b.geo(dome, 'paint', col, 0, h + 0.2 - r * Math.cos(Math.PI * 0.18), 0);
  dome.dispose();
  for (let i = 0; i < 3; i++) b.geo(new THREE.TorusGeometry(r + 0.02, 0.05, 4, 32), 'flatMetal', 0x666666, 0, 1.5 + i * 2.2, 0, Math.PI / 2, 0, 0, { cast: false });
  // Сыртқы бұрама баспалдақ емес — тік саты (визуал)
  b.box(r + 0.1, 0.2, 0, 0.5, h, 0.08, 'paint', 0x444444, { nc: true, cast: false });
  return b;
}

// Ағаш айлақ (су үстіндегі)
export function pier(ctx, x, z, len, rot, y = 1.4) {
  const b = new Builder(ctx, x, 0, z, rot, 0);
  const W = 3;
  b.box(0, y, len / 2, W, 0.18, len, 'wood', 0xa58a68, { tile: 2 });
  for (let i = 0; i <= len / 3; i++) {
    for (const s of [-1, 1]) b.cyl(s * (W / 2 - 0.1), -3, i * 3, 0.14, y + 3.9, 'wood', 0x5a4a3a, { seg: 8, tile: 0, nc: i % 2 === 1 });
  }
  for (let i = 0; i < len / 4; i++) {
    if (ctx.rng.chance(0.4)) Furn.barrel(b, ctx.rng.sign() * 0.9, y + 0.18, i * 4 + 2, ctx.rng.pick([0x2f5f8f, 0x8f3f2f, 0x4f6f3f]));
    else if (ctx.rng.chance(0.4)) Furn.crate(b, ctx.rng.sign() * 0.8, y + 0.18, i * 4 + 2, 0.8);
  }
  b.loot(0, y + 0.18, len - 2);
  return b;
}

// Балықшы қайығы: үстінен қарағандағы пішіні созылып, V тәрізді түпке жиналады
export function boat(ctx, x, z, ry, col = 0x2f6f9f, beached = false) {
  const b = new Builder(ctx, x, 0, z, 0, 0);
  const L = 6.2, W = 2.1, D = 0.95;
  const sh = new THREE.Shape();
  sh.moveTo(-W / 2, -L / 2);
  sh.lineTo(W / 2, -L / 2);
  sh.bezierCurveTo(W / 2, L * 0.15, W * 0.35, L * 0.38, 0, L / 2);
  sh.bezierCurveTo(-W * 0.35, L * 0.38, -W / 2, L * 0.15, -W / 2, -L / 2);
  const hull = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 10 });
  hull.rotateX(Math.PI / 2); // Shape XY -> XZ, экструзия төмен қарай
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const yy = p.getY(i);
    const t = -yy / D; // 0 — жиегі, 1 — түбі
    const zz = p.getZ(i);
    const bow = Math.max(0, (zz / (L / 2)) - 0.4);
    p.setX(i, p.getX(i) * (1 - t * 0.62));
    p.setY(i, yy + bow * bow * 0.9 + (1 - t) * 0);
  }
  hull.computeVertexNormals();
  const y = beached ? 0.55 : 0.45;
  const rx = beached ? 0.04 : 0, rz = beached ? 0.16 : 0;
  b.geo(hull, 'wood', col, 0, y + D * 0.55, 0, rx, ry, rz);
  // Жиегі (ақ жолақ)
  const rim = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false, curveSegments: 10 });
  rim.rotateX(Math.PI / 2);
  rim.scale(1.02, 1, 1.01);
  b.geo(rim, 'paint', 0xf2f2ee, 0, y + D * 0.55 + 0.04, 0, rx, ry, rz);
  hull.dispose(); rim.dispose();
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const at = (lx, lz) => [lx * cs + lz * sn, -lx * sn + lz * cs];
  // Орындықтар, кабина, мотор
  for (const lz of [-1.4, 0.6]) { const [ax, az] = at(0, lz); b.geo(uvBox(W * 0.8, 0.06, 0.35, 1.5), 'wood', 0x8a6a4a, ax, y + 0.25, az, rx, ry, rz, { cast: false }); }
  { const [ax, az] = at(0, -0.4); b.geo(uvBox(1.25, 0.9, 1.2, 1), 'paint', 0xeeeeea, ax, y + 0.3, az, rx, ry, rz); }
  { const [ax, az] = at(0, -0.4); b.geo(uvBox(1.15, 0.32, 1.22, 1), 'glass', 0x9fb6c8, ax, y + 0.85, az, rx, ry, rz, { cast: false }); }
  { const [ax, az] = at(0, -0.4); b.geo(uvBox(1.4, 0.08, 1.4, 1), 'paint', col, ax, y + 1.22, az, rx, ry, rz); }
  { const [ax, az] = at(0, -L / 2 - 0.15); b.geo(uvBox(0.35, 0.55, 0.4, 1), 'paint', 0x222222, ax, y + 0.3, az, rx, ry, rz); }
  ctx.col.addBox(x - 1.8, y - 0.6, z - 1.8, x + 1.8, y + 1.0, z + 1.8, 'wood', true);
  ctx.boats.push(b);
}

export function waterTower(ctx, x, y, z) {
  const b = new Builder(ctx, x, y, z, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * 1.6, 0, sz * 1.6, 0.25, 10, 0.25, 'paint', 0x6a6a6a);
  b.cyl(0, 10, 0, 2.6, 3.5, 'metal', 0x9fb4c4, { seg: 18 });
  b.geo(new THREE.ConeGeometry(2.8, 1.2, 18), 'metal', 0x7a8a9a, 0, 14.1, 0);
  b.box(0, 10, 0, 4, 0.15, 4, 'paint', 0x555555);
  return b;
}

export function helipad(ctx, b, x, y, z) {
  b.box(x, y, z, 16, 0.15, 16, 'concrete', 0x8a8a86, { tile: 4 });
  b.box(x, y + 0.15, z, 0.8, 0.02, 7, 'paint', 0xf2f2f2, { nc: true, cast: false });
  b.box(x - 2.2, y + 0.15, z, 0.8, 0.02, 7, 'paint', 0xf2f2f2, { nc: true, cast: false });
  b.box(x + 2.2, y + 0.15, z, 0.8, 0.02, 7, 'paint', 0xf2f2f2, { nc: true, cast: false });
  b.box(x, y + 0.15, z, 4.4, 0.02, 0.8, 'paint', 0xf2f2f2, { nc: true, cast: false });
  const ring = new THREE.RingGeometry(6.2, 6.8, 40);
  ring.rotateX(-Math.PI / 2);
  b.geo(ring, 'paint', 0xf2c230, x, y + 0.17, z, 0, 0, 0, { cast: false });
  ring.dispose();
}

export function radar(ctx, b, x, y, z) {
  b.box(x, y, z, 3, 3, 3, 'concrete', 0xbab6ae);
  b.geo(cyl(0.2, 0.3, 3, 8), 'flatMetal', 0x777777, x, y + 4.5, z);
  const dish = colorize(new THREE.SphereGeometry(2.5, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.32), 0xe0e0e0);
  const mesh = new THREE.Mesh(dish, ctx.mats.paint);
  mesh.position.set(b.wx(x, z), b.oy + y + 6, b.wz(x, z));
  mesh.rotation.x = -1.1;
  const holder = new THREE.Group();
  holder.position.copy(mesh.position);
  mesh.position.set(0, 0, 0);
  holder.add(mesh);
  mesh.castShadow = true;
  ctx.scene.add(holder);
  ctx.animated.push({ obj: holder, axis: 'y', speed: 0.6 });
}
