// Әлемді жинау: жер бедері, елді мекендер, өсімдіктер, су, аспан.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { StaticBatch, uvBox } from '../gfx/geom.js';
import { Terrain } from './terrain.js';
import { CollisionWorld } from './physics.js';
import { POIS, ROADS, poi, roadDist } from './map.js';
import { Builder } from './builder.js';
import { house, shed, warehouse, container, watchtower, yurt, barn, hangar, sandbags, vehicle, fence, lampPost, bench, haystack, electricPole, campfire, Furn } from './prefabs.js';
import { bayterek, fortress, lighthouse, windTurbine, chimney, tank, pier, boat, waterTower, helipad, radar } from './landmarks.js';
import { Vegetation, windUniform } from './vegetation.js';
import { Sky } from './sky.js';
import { Water } from './water.js';

const CONTAINER_COLS = [0xb03a2e, 0x2e6fb0, 0x3a8a4a, 0xd08a2a, 0x7a3ab0, 0x8a8a8a, 0x2a8a8a];

export class World {
  constructor(scene, renderer, tex, mats, quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.tex = tex;
    this.mats = mats;
    this.q = quality;
    this.footprints = [];
  }

  async build(progress) {
    const step = async (p, label) => { progress(p, label); await new Promise((r) => setTimeout(r, 0)); };
    this.terrain = new Terrain(this.q.tex >= 512 ? 250 : 200);
    this.col = new CollisionWorld(this.terrain);
    this.batch = new StaticBatch(150);
    this.ctx = {
      scene: this.scene, batch: this.batch, mats: this.mats, col: this.col, terrain: this.terrain,
      rng: new RNG(2024), lootSpots: [], doors: [], landmarks: [], animated: [], smokeSources: [], extraTrees: [], boats: [], tex: this.tex,
      fires: [],
    };
    await step(0.1, 'buildings');
    this.buildPOIs();
    await step(0.45, 'buildings');
    this.buildScatter();
    this.buildRoadProps();
    await step(0.6, 'terrain');
    this.scene.add(this.terrain.buildMesh(this.tex, this.q));
    this.batch.build(this.scene);
    await step(0.75, 'nature');
    this.veg = new Vegetation(this.ctx, this.q);
    this.veg.build();
    this.sky = new Sky(this.scene, this.q);
    this.water = new Water(this.scene, this.tex.water.normal, this.terrain.heightTexture(256), this.terrain.size, this.q.waterDetail);
    this.envMap = this.sky.makeEnv(this.renderer);
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.55;
    this.addOutdoorLoot();
    await step(0.9, 'nature');
  }

  // Ауданы бос па (ғимараттар бір-біріне кірмеуі үшін)
  reserve(x, z, w, d, pad = 2) {
    for (const f of this.footprints) {
      if (Math.abs(f.x - x) < (f.w + w) / 2 + pad && Math.abs(f.z - z) < (f.d + d) / 2 + pad) return false;
    }
    this.footprints.push({ x, z, w, d });
    return true;
  }

  H(x, z) { return this.terrain.heightAt(x, z); }

  houseAt(x, z, rot, o) {
    const W = o.w || 9, D = o.d || 7;
    const fw = rot % 2 ? D + 2.5 : W + 2.5, fd = rot % 2 ? W + 2.5 : D + 2.5;
    if (!this.reserve(x, z, fw, fd, 1.5)) return null;
    return house(this.ctx, x, o.y ?? this.H(x, z) + 0.05, z, rot, o);
  }

  buildPOIs() {
    const ctx = this.ctx, rng = ctx.rng;
    // ---- Бәйтерек ауылы ----
    {
      const p = poi('bayterek');
      const y = p.h;
      const plaza = new Builder(ctx, p.x, y, p.z, 0, 1);
      this.terrain.flattenRect(p.x, p.z, 44, 44, y, 6);
      plaza.box(0, -0.3, 0, 42, 0.42, 42, 'concrete', 0xc8c0b0, { tile: 3 });
      plaza.box(0, 0.12, 0, 38, 0.02, 38, 'stone', 0xd8d0c0, { nc: true, cast: false, tile: 1.1 });
      this.footprints.push({ x: p.x, z: p.z, w: 44, d: 44 });
      bayterek(ctx, p.x, y + 0.12, p.z);
      for (const [lx, lz] of [[-17, -17], [17, -17], [-17, 17], [17, 17], [0, -19], [0, 19], [-19, 0], [19, 0]]) lampPost(plaza, lx, 0.12, lz);
      for (const [lx, lz, ax] of [[-12, -15, true], [12, -15, true], [-12, 15, true], [12, 15, true], [-15, -8, false], [15, 8, false]]) bench(plaza, lx, 0.12, lz, ax);
      for (const [lx, lz] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) ctx.extraTrees.push({ type: 'birch', x: p.x + lx, z: p.z + lz, s: 0.9 });
      plaza.loot(-8, 0.12, 10); plaza.loot(9, 0.12, -9);
      const town = [
        [-38, -20, 0, 12, 8, 2], [-13, -26, 0, 11, 8, 2], [13, -26, 0, 11, 8, 1], [38, -20, 0, 12, 9, 2],
        [-46, 20, 1, 12, 8, 1], [46, 20, 3, 12, 8, 2],
        [-38, 62, 2, 12, 8, 2], [-12, 66, 2, 10, 8, 1], [14, 66, 2, 12, 8, 2], [40, 60, 2, 11, 8, 1],
        [-66, -12, 1, 10, 8, 1], [66, 50, 3, 10, 8, 2], [-66, 48, 1, 10, 7, 1], [64, -14, 3, 10, 8, 1],
      ];
      for (const [dx, dz, rot, w, d, fl] of town) this.houseAt(p.x + dx, p.z + dz, rot, { w, d, floors: fl, style: 'town', tier: 1, y, kind: rng.chance(0.3) ? 'shop' : '' });
      // Көшедегі көліктер
      const street = new Builder(ctx, p.x, y, p.z, 0, 1);
      vehicle(street, 'car', -26, 0, -8, 0); vehicle(street, 'car', 27, 0, 30, Math.PI / 2 * 0); vehicle(street, 'car', -27, 0, 36, 0);
      vehicle(street, 'car', 30, 0, -6, Math.PI / 2);
      Furn.barrel(street, -24, 0, 46, 0x2f5f8f);
    }
    // ---- Ескі зауыт ----
    {
      const p = poi('factory');
      const y = p.h;
      const b = new Builder(ctx, p.x, y, p.z, 0, 1);
      this.reserve(p.x - 8, p.z - 12, 34, 22) && warehouse(ctx, p.x - 8, y, p.z - 12, 0, { w: 30, d: 18, h: 9, color: 0xb8b0a4, tier: 1 });
      this.reserve(p.x + 32, p.z + 28, 14, 22) && warehouse(ctx, p.x + 32, y, p.z + 28, 1, { w: 20, d: 12, h: 6, tier: 1 });
      chimney(ctx, p.x - 34, y, p.z - 34, 32);
      chimney(ctx, p.x - 26, y, p.z - 40, 26);
      this.footprints.push({ x: p.x - 30, z: p.z - 37, w: 14, d: 14 });
      for (const [dx, dz, r] of [[30, -26, 4.5], [41, -14, 4], [26, -40, 3.5]]) {
        this.terrain.flattenRect(p.x + dx, p.z + dz, r * 2 + 2, r * 2 + 2, y, 4);
        tank(ctx, p.x + dx, y, p.z + dz, r, 7 + r * 0.4, rng.pick([0xdedede, 0xd8c8a8, 0xc8d8e8]));
        this.footprints.push({ x: p.x + dx, z: p.z + dz, w: r * 2 + 1, d: r * 2 + 1 });
      }
      // Құбырлар
      b.geo(new THREE.CylinderGeometry(0.4, 0.4, 24, 10).rotateZ(Math.PI / 2), 'paint', 0x8a8a8a, 18, 5.5, -30);
      b.geo(new THREE.CylinderGeometry(0.4, 0.4, 14, 10).rotateX(Math.PI / 2), 'paint', 0x8a8a8a, 6, 5.5, -23);
      for (const px of [10, 18, 26]) b.box(px, 0, -30, 0.3, 5.5, 0.3, 'paint', 0x6a6a6a, { nc: true });
      // Контейнерлер алаңы
      this.footprints.push({ x: p.x - 30, z: p.z + 32, w: 26, d: 20 });
      const cy = this.H(p.x - 30, p.z + 32);
      this.terrain.flattenRect(p.x - 30, p.z + 32, 28, 22, y, 5);
      const cont = [[-40, 24, 0, false], [-40, 27, 0, true], [-33, 24, 0, false], [-26, 24, 0, true], [-40, 36, 1, false], [-22, 38, 0, false], [-30, 42, 0, true]];
      for (const [dx, dz, rot, open] of cont) container(ctx, p.x + dx, y, p.z + dz, rot, rng.pick(CONTAINER_COLS), open);
      container(ctx, p.x - 40, y + 2.6, p.z + 24, 0, rng.pick(CONTAINER_COLS), false);
      container(ctx, p.x - 33, y + 2.6, p.z + 24, 0, rng.pick(CONTAINER_COLS), true);
      void cy;
      this.houseAt(p.x - 48, p.z - 2, 1, { w: 10, d: 8, floors: 2, style: 'town', tier: 1, y });
      vehicle(b, 'truck', 10, 0, 14, Math.PI / 2);
      for (let i = 0; i < 6; i++) Furn.crate(b, -26 + i * 1.1, 0, 4 + (i % 2) * 1.2, 1.0);
      b.loot(-24, 0, 7); b.loot(14, 0, 4);
      sandbags(ctx, b, 0, 0, 20, 4, true, 3);
    }
    // ---- Балықшылар айлағы ----
    {
      const p = poi('harbor');
      const y = p.h;
      this.houseAt(p.x - 26, p.z - 18, 0, { w: 7, d: 6, floors: 1, style: 'village', y: y + 0.05 });
      this.houseAt(p.x - 12, p.z - 26, 0, { w: 7, d: 6, floors: 1, style: 'village', y: y + 0.05 });
      this.houseAt(p.x - 34, p.z + 2, 1, { w: 8, d: 6, floors: 2, style: 'village', y: y + 0.05 });
      this.reserve(p.x + 6, p.z - 22, 18, 12) && warehouse(ctx, p.x + 6, y, p.z - 22, 0, { w: 16, d: 10, h: 5, color: 0x9fb4c4, tier: 0 });
      // Айлақтар — жағалаудан теңізге қарай
      for (const [sx, sz, rot] of [[p.x + 12, p.z + 8, 0], [p.x + 26, p.z - 2, 1], [p.x - 6, p.z + 14, 0]]) {
        // Жағалау шетін табу
        let len = 0;
        const dx = rot === 1 ? 1 : 0, dz = rot === 0 ? 1 : 0;
        for (let t = 0; t < 60; t++) { if (this.H(sx + dx * t, sz + dz * t) < -1.2) { len = t + 14; break; } }
        if (len > 0) {
          pier(ctx, sx, sz, Math.min(len, 46), rot, 1.5);
          boat(ctx, sx + dx * (len - 6) + dz * 4, sz + dz * (len - 6) + dx * 4, rot === 0 ? 0 : Math.PI / 2, rng.pick([0x2f6f9f, 0xb03a2e, 0x3a8a4a]));
        }
      }
      const b = new Builder(ctx, p.x, y, p.z, 0, 0);
      boat(ctx, p.x - 20, p.z + 12, 0.6, 0xd8d0b8, true);
      for (let i = 0; i < 5; i++) Furn.barrel(b, -2 + i * 0.75, 0, -8, rng.pick([0x2f5f8f, 0x8f3f2f]));
      for (let i = 0; i < 4; i++) Furn.crate(b, 4 + (i % 2) * 1.1, Math.floor(i / 2) * 1.0, -6, 1.0);
      container(ctx, p.x + 20, y, p.z - 34, 0, 0x2e6fb0, true, 0);
      b.loot(-6, 0, -4); b.loot(10, 0, 2);
      const hb = new Builder(ctx, p.x, y, p.z, 0, 0);
      // Балық кептіретін жерлер
      for (let i = 0; i < 3; i++) {
        hb.box(-20 + i * 3, 0, -6, 0.1, 2.0, 0.1, 'wood', 0x6a5a4a, { nc: true });
        hb.box(-20 + i * 3, 1.9, -6, 3, 0.05, 0.05, 'wood', 0x6a5a4a, { nc: true, cast: false });
      }
    }
    // ---- Жайлау ----
    {
      const p = poi('jailau');
      const y = p.h;
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const r = 20 + (i % 2) * 4;
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        if (!this.reserve(x, z, 8, 8, 1)) continue;
        yurt(ctx, x, this.H(x, z), z, a + Math.PI, false);
      }
      this.reserve(p.x, p.z - 2, 9, 9, 1);
      yurt(ctx, p.x, y, p.z - 2, Math.PI / 2, true);
      const b = new Builder(ctx, p.x, y, p.z, 0, 0);
      campfire(b, 0, 0, 9);
      ctx.fires.push({ x: p.x, y: y + 0.3, z: p.z + 9 });
      // Мал қорасы
      this.terrain.flattenRect(p.x + 42, p.z + 6, 22, 18, y, 5);
      fence(b, 32, -4, 52, -4, 0); fence(b, 52, -4, 52, 16, 0); fence(b, 52, 16, 32, 16, 0, 0x8a6a4a, 4); fence(b, 32, 16, 32, -4, 0, 0x8a6a4a, 2);
      this.footprints.push({ x: p.x + 42, z: p.z + 6, w: 22, d: 22 });
      haystack(b, 42, 0, 6, 1.6); haystack(b, 46, 0, 10, 1.3);
      this.houseAt(p.x - 40, p.z + 10, 1, { w: 8, d: 6, floors: 1, style: 'village', y: this.H(p.x - 40, p.z + 10) + 0.05 });
      if (this.reserve(p.x + 10, p.z + 40, 8, 8)) shed(ctx, p.x + 10, this.H(p.x + 10, p.z + 40), p.z + 40, 2);
      // Арба
      const cb = new Builder(ctx, p.x - 12, this.H(p.x - 12, p.z + 24), p.z + 24, 0, 0);
      cb.box(0, 0.7, 0, 1.6, 0.12, 3, 'wood', 0x8a5a32);
      for (const s of [-1, 1]) cb.box(s * 0.78, 0.82, 0, 0.06, 0.4, 3, 'wood', 0x8a5a32, { nc: true });
      for (const s of [-1, 1]) cb.geo(new THREE.TorusGeometry(0.55, 0.06, 6, 16), 'wood', 0x5a3a22, s * 0.9, 0.6, 0.3, 0, Math.PI / 2, 0);
      cb.box(0, 0.5, -2.2, 0.08, 0.08, 2, 'wood', 0x5a3a22, { nc: true });
      b.loot(-6, 0, 12); b.loot(14, 0, -6);
    }
    // ---- Әскери база ----
    {
      const p = poi('military');
      const y = p.h;
      this.terrain.flattenRect(p.x, p.z, 150, 150, y, 10);
      this.reserve(p.x - 26, p.z - 30, 16, 26) && hangar(ctx, p.x - 26, y, p.z - 30, 0);
      this.reserve(p.x + 2, p.z - 30, 16, 26) && hangar(ctx, p.x + 2, y, p.z - 30, 0);
      for (const [dx, dz, rot] of [[34, -30, 3], [34, -8, 3], [-40, 18, 1]]) this.houseAt(p.x + dx, p.z + dz, rot, { w: 16, d: 8, floors: 1, style: 'town', tier: 2, y, wallMat: 'concrete', wallColor: 0xb8b8a8 });
      this.houseAt(p.x + 30, p.z + 26, 3, { w: 12, d: 9, floors: 2, style: 'town', tier: 2, y, wallMat: 'concrete' });
      const b = new Builder(ctx, p.x, y, p.z, 0, 2);
      helipad(ctx, b, -6, 0, 26);
      this.footprints.push({ x: p.x - 6, z: p.z + 26, w: 16, d: 16 });
      radar(ctx, b, 18, 0, 44);
      this.footprints.push({ x: p.x + 18, z: p.z + 44, w: 6, d: 6 });
      for (const [dx, dz] of [[-62, -62], [62, -62], [-62, 62], [62, 62]]) {
        this.reserve(p.x + dx, p.z + dz, 8, 14) && watchtower(ctx, p.x + dx, y, p.z + dz, 0, 7);
      }
      // Қоршау (екі қақпамен)
      const F = 70;
      const mf = (x0, z0, x1, z1, gap) => fence(b, x0, z0, x1, z1, 0, 0x6a6a5a, gap);
      mf(-F, -F, F, -F, 17); mf(F, -F, F, F, -1); mf(F, F, -F, F, 17); mf(-F, F, -F, -F, 17);
      sandbags(ctx, b, -10, 0, 8, 5, true, 3); sandbags(ctx, b, 12, 0, 6, 4, false, 3); sandbags(ctx, b, -24, 0, 44, 4, true, 3);
      sandbags(ctx, b, 4, 0, -66, 6, true, 3); sandbags(ctx, b, 40, 0, 52, 5, true, 3);
      vehicle(b, 'jeep', -30, 0, 52, 0.3); vehicle(b, 'truck', 50, 0, 2, 0); vehicle(b, 'jeep', 12, 0, 10, Math.PI / 2);
      for (const [dx, dz, rot] of [[-50, 40, 0], [-50, 48, 0], [52, -48, 1]]) container(ctx, p.x + dx, y, p.z + dz, rot, 0x56603e, rng.chance(0.5), 2);
      // Әскери шатырлар
      for (const [dx, dz] of [[-22, 52], [-10, 54]]) {
        const tb = new Builder(ctx, p.x + dx, y, p.z + dz, 0, 2);
        const tent = new THREE.CylinderGeometry(2.4, 2.4, 6, 3, 1, false);
        tent.rotateX(Math.PI / 2); tent.rotateZ(Math.PI / 6 * 3);
        tb.geo(tent, 'camo', 0xffffff, 0, 1.2, 0, 0, 0, 0);
        tent.dispose();
        tb.collider(0, 0, 0, 3.6, 2.2, 6, 'cloth', false);
        tb.loot(0, 0, 3.6, 0);
      }
      b.loot(-6, 0, 26, 1); b.loot(0, 0, 0, 1); b.loot(-40, 0, 0, 0); b.loot(44, 0, 40, 0);
    }
    // ---- Ескі қамал ----
    {
      const p = poi('fortress');
      this.footprints.push({ x: p.x, z: p.z, w: 56, d: 56 });
      fortress(ctx, p.x, p.h, p.z);
    }
    // ---- Алмалы бау ----
    {
      const p = poi('orchard');
      const y = p.h;
      this.houseAt(p.x - 22, p.z - 26, 0, { w: 10, d: 8, floors: 2, style: 'village', y });
      if (this.reserve(p.x + 18, p.z - 26, 15, 12)) barn(ctx, p.x + 18, y, p.z - 26, 0);
      if (this.reserve(p.x + 40, p.z - 8, 6, 6)) waterTower(ctx, p.x + 40, y, p.z - 8);
      const b = new Builder(ctx, p.x, y, p.z, 0, 0);
      vehicle(b, 'tractor', 4, 0, -14, 0.4);
      for (const [dx, dz] of [[34, -30], [37, -26], [31, -24]]) haystack(b, dx, 0, dz, 1.4);
      fence(b, -40, -38, 44, -38, 0, 0x9a7a5a, 20);
      this.footprints.push({ x: p.x - 3, z: p.z + 16, w: 66, d: 50 });
      if (this.reserve(p.x - 42, p.z + 8, 7, 7)) shed(ctx, p.x - 42, y, p.z + 8, 1);
      b.loot(0, 0, -20); b.loot(-30, 0, 30);
    }
    // ---- Жел диірмендері ----
    {
      const p = poi('windfarm');
      const spots = [[0, 0], [-30, -26], [26, -30], [-24, 30], [30, 26]];
      spots.forEach(([dx, dz], i) => {
        const x = p.x + dx, z = p.z + dz;
        this.footprints.push({ x, z, w: 8, d: 8 });
        windTurbine(ctx, x, this.H(x, z), z, -0.6 + i * 0.05);
      });
      if (this.reserve(p.x + 4, p.z + 14, 8, 8)) shed(ctx, p.x + 4, this.H(p.x + 4, p.z + 14), p.z + 14, 0);
      const cb = new Builder(ctx, p.x - 10, this.H(p.x - 10, p.z + 8), p.z + 8, 0, 0);
      if (this.reserve(p.x - 10, p.z + 8, 8, 4)) container(ctx, p.x - 10, this.H(p.x - 10, p.z + 8), p.z + 8, 0, 0xd8d8d8, true, 0);
      void cb;
    }
    // ---- Шамшырақ ----
    {
      const p = poi('lighthouse');
      this.footprints.push({ x: p.x, z: p.z, w: 10, d: 10 });
      lighthouse(ctx, p.x, p.h, p.z);
      this.houseAt(p.x + 14, p.z - 10, 3, { w: 7, d: 6, floors: 1, style: 'village', y: this.H(p.x + 14, p.z - 10) + 0.05 });
    }
  }

  // Шашыраңқы фермалар, қоралар
  buildScatter() {
    const rng = new RNG(99);
    let placed = 0;
    for (let i = 0; i < 400 && placed < 16; i++) {
      const x = rng.float(-360, 360), z = rng.float(-360, 360);
      const h = this.H(x, z);
      if (h < 3 || h > 30) continue;
      if (this.terrain.normalAt(x, z).y < 0.93) continue;
      let near = 1e9;
      for (const p of POIS) near = Math.min(near, Math.hypot(x - p.x, z - p.z) - p.r);
      if (near < 25) continue;
      const rd = roadDist(x, z);
      if (rd < 8) continue;
      const rot = rng.int(0, 3);
      const b = this.houseAt(x, z, rot, { w: rng.float(7, 10), d: rng.float(6, 8), floors: rng.chance(0.3) ? 2 : 1, style: 'village', y: h + 0.05 });
      if (!b) continue;
      placed++;
      const sx = x + rng.float(-12, 12), sz = z + rng.float(8, 13) * rng.sign();
      if (this.reserve(sx, sz, 6, 6)) shed(this.ctx, sx, this.H(sx, sz), sz, rng.int(0, 3));
      if (rng.chance(0.5)) {
        const fb = new Builder(this.ctx, x, h, z, 0, 0);
        haystack(fb, rng.float(-10, 10), this.H(x, z) - h, rng.float(9, 12), 1.3);
      }
    }
  }

  buildRoadProps() {
    const rng = new RNG(5150);
    const b = new Builder(this.ctx, 0, 0, 0, 0, 0);
    for (const road of ROADS) {
      for (let i = 0; i < road.length - 1; i++) {
        const [ax, az] = road[i], [bx, bz] = road[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const nx = -(bz - az) / len, nz = (bx - ax) / len;
        for (let t = 20; t < len - 10; t += 38) {
          const x = ax + (bx - ax) * t / len + nx * 7.5, z = az + (bz - az) * t / len + nz * 7.5;
          let near = 1e9;
          for (const p of POIS) near = Math.min(near, Math.hypot(x - p.x, z - p.z) - p.r);
          if (near < 5) continue;
          const h = this.H(x, z);
          if (h < 1.5) continue;
          const pb = new Builder(this.ctx, x, h, z, 0, 0);
          electricPole(pb, 0, 0, 0);
        }
        // Тасталған көліктер
        if (rng.chance(0.55)) {
          const t = rng.float(0.3, 0.7);
          const x = ax + (bx - ax) * t + nx * rng.float(-3, 3), z = az + (bz - az) * t + nz * rng.float(-3, 3);
          let near = 1e9;
          for (const p of POIS) near = Math.min(near, Math.hypot(x - p.x, z - p.z) - p.r);
          if (near > 0 && this.reserve(x, z, 5, 5, 0)) {
            const vb = new Builder(this.ctx, x, this.H(x, z), z, 0, 0);
            vehicle(vb, 'car', 0, 0, 0, Math.atan2(bx - ax, bz - az) + rng.float(-0.4, 0.4));
            vb.loot(2.2, 0, 0);
          }
        }
      }
    }
    void b;
  }

  addOutdoorLoot() {
    const rng = new RNG(31);
    for (const p of POIS) {
      const n = Math.floor(p.r / 9);
      for (let i = 0; i < n; i++) {
        const a = rng.float(0, Math.PI * 2), r = rng.float(5, p.r * 0.9);
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        const g = this.col.groundAt(x, z, 0.3, 200);
        if (g < 0.8) continue;
        this.ctx.lootSpots.push({ x, y: g + 0.03, z, tier: p.tier });
      }
    }
    for (let i = 0; i < 60; i++) {
      const x = rng.float(-380, 380), z = rng.float(-380, 380);
      const g = this.H(x, z);
      if (g < 2) continue;
      this.ctx.lootSpots.push({ x, y: this.col.groundAt(x, z, 0.3, g + 0.5) + 0.03, z, tier: 0 });
    }
  }

  get lootSpots() { return this.ctx.lootSpots; }
  get doors() { return this.ctx.doors; }

  update(dt, camPos) {
    windUniform.value += dt;
    this.water.update(dt);
    for (const a of this.ctx.animated) a.obj.rotation[a.axis] += a.speed * dt;
    if (this.veg) { this.veg.updateGrass(camPos.x, camPos.z); this.veg.updateLOD(camPos); }
  }
}
