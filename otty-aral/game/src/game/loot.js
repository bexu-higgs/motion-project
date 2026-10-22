// Олжа: жердегі заттар (инстансталған модельдер), өлім қораптары, әуе жүгі.
import * as THREE from 'three';
import { ITEMS, makeItemGeometry, WEAPONS, AMMO_PACK } from '../actors/weapons.js';
import { RNG } from '../core/rng.js';

const TABLES = [
  // 0 — қарапайым
  [['pistol', 11], ['smg', 11], ['ak', 8], ['m4', 4], ['shotgun', 8], ['sniper', 0.7], ['ammo_9', 12], ['ammo_762', 8], ['ammo_556', 6], ['ammo_12', 6], ['ammo_300', 1.5],
    ['vest1', 9], ['vest2', 3], ['helm1', 9], ['helm2', 3], ['medkit', 6], ['kymyz', 10], ['gloo', 12], ['grenade', 4]],
  // 1 — орташа
  [['pistol', 6], ['smg', 9], ['ak', 9], ['m4', 6], ['shotgun', 6], ['sniper', 1.2], ['ammo_9', 10], ['ammo_762', 10], ['ammo_556', 9], ['ammo_12', 6], ['ammo_300', 2.5],
    ['vest1', 6], ['vest2', 6], ['vest3', 0.8], ['helm1', 6], ['helm2', 6], ['helm3', 0.8], ['medkit', 8], ['kymyz', 9], ['gloo', 10], ['grenade', 5]],
  // 2 — әскери
  [['pistol', 2], ['smg', 6], ['ak', 10], ['m4', 10], ['shotgun', 4], ['sniper', 3], ['ammo_9', 6], ['ammo_762', 11], ['ammo_556', 11], ['ammo_12', 4], ['ammo_300', 5],
    ['vest1', 2], ['vest2', 8], ['vest3', 3], ['helm1', 2], ['helm2', 8], ['helm3', 3], ['medkit', 10], ['kymyz', 6], ['gloo', 11], ['grenade', 7]],
];

const RARITY_HEX = [0xd0d0d0, 0x3a9aff, 0xb45cff, 0xffb02e];

export class Loot {
  constructor(match) {
    this.match = match;
    this.scene = match.scene;
    this.items = [];
    this.meshes = {};
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });
    const types = Object.keys(ITEMS);
    for (const t of types) {
      const g = makeItemGeometry(t);
      if (!g) continue;
      const max = t.startsWith('ammo') ? 140 : 90;
      const im = new THREE.InstancedMesh(g, this.mat, max);
      im.count = 0;
      im.castShadow = true;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(im);
      this.meshes[t] = { im, max, list: [] };
    }
    // Сирек заттардың жарқыраған сақинасы
    const rg = new THREE.RingGeometry(0.28, 0.42, 24);
    rg.rotateX(-Math.PI / 2);
    this.rings = new THREE.InstancedMesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), 700);
    this.rings.count = 0;
    this.rings.frustumCulled = false;
    this.rings.renderOrder = 2;
    this.scene.add(this.rings);
    this.boxes = [];
    this.boxGeo = this.makeBoxGeo();
    this.dirty = true;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(1, 1, 1); this._p = new THREE.Vector3(); this._c = new THREE.Color();
  }

  makeBoxGeo() {
    const g = new THREE.BoxGeometry(0.9, 0.55, 0.6);
    g.translate(0, 0.275, 0);
    return g;
  }

  clear() {
    this.items.length = 0;
    for (const b of this.boxes) { this.scene.remove(b.mesh); }
    this.boxes.length = 0;
    this.dirty = true;
  }

  spawnAll(spots, seed) {
    this.clear();
    const rng = new RNG(seed);
    for (const s of spots) {
      if (!rng.chance(s.tier >= 1 ? 0.9 : 0.78)) continue;
      const tier = Math.min(2, Math.max(0, s.tier));
      const type = rng.weighted(TABLES[tier]);
      this.add(type, s.x, s.y, s.z, undefined, rng.float(0, 6.28));
      if (ITEMS[type].kind === 'weapon' && WEAPONS[type].ammo) {
        this.add(WEAPONS[type].ammo, s.x + rng.float(-0.6, 0.6), s.y, s.z + rng.float(0.3, 0.7), undefined, rng.float(0, 6.28));
        if (rng.chance(0.5)) this.add(WEAPONS[type].ammo, s.x + rng.float(-0.6, 0.6), s.y, s.z - rng.float(0.3, 0.7), undefined, rng.float(0, 6.28));
      } else if (rng.chance(0.3)) {
        this.add(rng.weighted(TABLES[tier]), s.x + rng.float(-0.7, 0.7), s.y, s.z + rng.float(-0.7, 0.7), undefined, rng.float(0, 6.28));
      }
    }
  }

  add(type, x, y, z, amount, rot = Math.random() * 6.28, mag) {
    const it = { type, x, y, z, rot, amount: amount ?? (type.startsWith('ammo') ? AMMO_PACK[type] : 1), mag, id: Math.random(), claimedBy: null };
    this.items.push(it);
    this.dirty = true;
    return it;
  }

  drop(type, x, y, z, mag) {
    const g = this.match.world.col.groundAt(x, z, 0.3, y + 0.5);
    return this.add(type, x, g + 0.03, z, 1, Math.random() * 6.28, mag);
  }

  remove(it) {
    const i = this.items.indexOf(it);
    if (i >= 0) { this.items.splice(i, 1); this.dirty = true; }
  }

  // Өлім қорабы — марқұмның барлық заттары
  deathBox(actor) {
    const x = actor.pos.x, z = actor.pos.z;
    const y = this.match.world.col.groundAt(x, z, 0.3, actor.pos.y + 0.5);
    const contents = [];
    for (const [k, v] of Object.entries(actor.ammo)) if (v > 0) contents.push({ type: k, amount: v });
    for (const [k, v] of Object.entries(actor.items)) if (v > 0) contents.push({ type: k, amount: v });
    if (actor.vest.lvl && actor.vest.dur > 20) contents.push({ type: 'vest' + actor.vest.lvl, amount: 1 });
    if (actor.helm.lvl && actor.helm.dur > 15) contents.push({ type: 'helm' + actor.helm.lvl, amount: 1 });
    // Қарулар қораптың жанына тасталады
    actor.weapons.forEach((w, i) => { if (w) this.add(w.id, x + Math.cos(i * 2.1) * 0.9, y + 0.03, z + Math.sin(i * 2.1) * 0.9, 1, Math.random() * 6, w.mag); });
    if (!contents.length) return null;
    const mesh = new THREE.Mesh(this.boxGeo, this.match.boxMat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = actor.yaw;
    mesh.castShadow = true;
    this.scene.add(mesh);
    const box = { x, y, z, contents, mesh, owner: actor.name, t: this.match.time };
    this.boxes.push(box);
    return box;
  }

  // Әуе жүгі
  airdropBox(x, y, z) {
    const mesh = new THREE.Mesh(this.boxGeo, this.match.dropMat);
    mesh.scale.set(1.4, 1.5, 1.4);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    const rng = new RNG((x * 1000) | 0);
    const contents = [
      { type: rng.pick(['sniper', 'm4', 'ak']), amount: 1 }, { type: 'vest3', amount: 1 }, { type: 'helm3', amount: 1 },
      { type: 'medkit', amount: 2 }, { type: 'gloo', amount: 3 }, { type: 'ammo_300', amount: 20 }, { type: 'ammo_556', amount: 60 }, { type: 'ammo_762', amount: 60 },
    ];
    const box = { x, y, z, contents, mesh, airdrop: true, t: this.match.time };
    this.boxes.push(box);
    return box;
  }

  // Қорапты ашу: актер автоматты түрде алады; қарулар жерге тасталады
  openBox(box, actor) {
    const left = [];
    for (const c of box.contents) {
      const it = ITEMS[c.type];
      if (it.kind === 'weapon') {
        this.add(c.type, box.x + (Math.random() - 0.5) * 1.6, box.y + 0.03, box.z + (Math.random() - 0.5) * 1.6, 1);
        continue;
      }
      let ok;
      if (it.kind === 'ammo') {
        const before = actor.ammo[c.type];
        ok = actor.pickup(c.type, c.amount, false);
        const took = actor.ammo[c.type] - before;
        if (took < c.amount) left.push({ type: c.type, amount: c.amount - took });
        continue;
      }
      let rem = c.amount;
      while (rem > 0 && actor.pickup(c.type, 1, false)) rem--;
      if (rem > 0) left.push({ type: c.type, amount: rem });
      void ok;
    }
    box.contents = left;
    if (!left.length) {
      this.scene.remove(box.mesh);
      this.boxes.splice(this.boxes.indexOf(box), 1);
    }
  }

  nearest(x, y, z, r, filter) {
    let best = null, bd = r * r;
    for (const it of this.items) {
      const dx = it.x - x, dz = it.z - z, dy = it.y - y;
      if (Math.abs(dy) > 2.2) continue;
      const d = dx * dx + dz * dz;
      if (d < bd && (!filter || filter(it))) { bd = d; best = it; }
    }
    return best;
  }

  nearestBox(x, y, z, r) {
    let best = null, bd = r * r;
    for (const b of this.boxes) {
      if (b.falling) continue;
      const dx = b.x - x, dz = b.z - z;
      if (Math.abs(b.y - y) > 2.2) continue;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  update(dt, cam) {
    // Жарқыраған сақиналар айналады
    if (!this.dirty && (this.match.frame & 7) !== 0) return;
    this.dirty = false;
    for (const t of Object.keys(this.meshes)) this.meshes[t].n = 0;
    let rn = 0;
    const m = this._m, q = this._q, e = this._e, s = this._s, p = this._p;
    const cx = cam.position.x, cz = cam.position.z;
    for (const it of this.items) {
      const M = this.meshes[it.type];
      if (!M || M.n >= M.max) continue;
      const dx = it.x - cx, dz = it.z - cz;
      if (dx * dx + dz * dz > 200 * 200) continue;
      e.set(0, it.rot, 0);
      q.setFromEuler(e);
      p.set(it.x, it.y, it.z);
      m.compose(p, q, s);
      M.im.setMatrixAt(M.n++, m);
      const rar = ITEMS[it.type].rarity;
      if (rn < 700 && dx * dx + dz * dz < 80 * 80) {
        p.y += 0.02;
        m.compose(p, q, this._s.set(1, 1, 1));
        this.rings.setMatrixAt(rn, m);
        this.rings.setColorAt(rn, this._c.setHex(RARITY_HEX[rar]));
        rn++;
      }
    }
    for (const t of Object.keys(this.meshes)) {
      const M = this.meshes[t];
      M.im.count = M.n;
      M.im.instanceMatrix.needsUpdate = true;
    }
    this.rings.count = rn;
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
  }
}
