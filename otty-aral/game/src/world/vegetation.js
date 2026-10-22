// Өсімдіктер: қарағай, қайың, емен, алма ағашы, бұта, тас, шөп (желмен тербеледі).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RNG, Simplex, smoothstep } from '../core/rng.js';
import { gradientColor, colorize, keepAttrs, ensureIndexed } from '../gfx/geom.js';
import { POIS, roadDist } from './map.js';

export const windUniform = { value: 0 };

function addWind(mat, strength, key, noFlip = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windUniform;
    if (noFlip) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize( vNormal );');
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
#else
  vec3 ip = vec3(0.0);
#endif
  float sway = sin(uTime * 1.3 + ip.x * 0.11 + ip.z * 0.07) * 0.6 + sin(uTime * 2.7 + ip.z * 0.3) * 0.25;
  float hk = max(0.0, transformed.y) * ${strength.toFixed(3)};
  transformed.x += sway * hk;
  transformed.z += sway * hk * 0.6;`);
  };
  mat.customProgramCacheKey = () => 'wind' + key;
}

function jitter(g, amt, rng) {
  const p = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let o = map.get(k);
    if (!o) { o = [(rng.next() - 0.5) * amt, (rng.next() - 0.5) * amt, (rng.next() - 0.5) * amt]; map.set(k, o); }
    p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]);
  }
  g.computeVertexNormals();
  return g;
}

function prep(g, color) {
  ensureIndexed(g);
  if (color !== undefined) colorize(g, color);
  keepAttrs(g);
  return g;
}

function scaleUV(g, su, sv) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}

// ---- Ағаш геометриялары: [діңі, жапырағы, (жемісі)] ----
function pineGeo(rng, lod = 0) {
  const H = 9;
  const trunk = scaleUV(new THREE.CylinderGeometry(0.14, 0.3, H, lod ? 5 : 7), 2, 6);
  trunk.translate(0, H / 2, 0);
  const parts = [];
  const levels = lod ? 3 : 6;
  for (let i = 0; i < levels; i++) {
    const t = i / levels;
    const r = 2.6 * (1 - t * 0.8);
    const h = (2.6 - t * 0.9) * (lod ? 1.6 : 1);
    const cone = new THREE.ConeGeometry(r, h, lod ? 6 : 8, lod ? 1 : 2);
    jitter(cone, 0.35, rng);
    cone.translate(0, 2.3 + i * 1.15 * (lod ? 2 : 1) + h / 2, 0);
    scaleUV(cone, 3, 2);
    parts.push(gradientColor(prep(cone), 0x2f5a26, 0x6a9a44, 0.18, () => rng.next()));
  }
  const fol = mergeGeometries(parts.map((g) => keepAttrs(g)));
  return [prep(trunk, 0xffffff), fol];
}

function birchGeo(rng, lod = 0) {
  const H = 8;
  const trunk = scaleUV(new THREE.CylinderGeometry(0.1, 0.18, H, lod ? 5 : 7), 1, 5);
  trunk.translate(0, H / 2, 0);
  const parts = [];
  const nb = lod ? 3 : 4;
  for (let i = 0; i < nb; i++) {
    const s = new THREE.IcosahedronGeometry((1.3 + rng.float(0, 0.6)) * (lod ? 1.25 : 1.1), lod ? 0 : 1);
    jitter(s, 0.4, rng);
    s.scale(1, 1.5, 1);
    s.translate(rng.float(-0.9, 0.9), 4.6 + i * 0.75 * 5 / nb, rng.float(-0.9, 0.9));
    scaleUV(s, 2, 2);
    parts.push(gradientColor(prep(s), 0x4f7f2a, 0x9fbf4a, 0.2, () => rng.next()));
  }
  return [prep(trunk, 0xffffff), mergeGeometries(parts)];
}

function oakGeo(rng, apple = false, lod = 0) {
  const H = apple ? 2.2 : 3.4;
  const tr = apple ? 0.18 : 0.35;
  const trunk = scaleUV(new THREE.CylinderGeometry(tr * 0.7, tr, H + 0.6, lod ? 5 : 7), 2, 3);
  trunk.translate(0, (H + 0.6) / 2, 0);
  const tparts = [prep(trunk, 0xffffff)];
  for (let i = 0; i < (lod ? 0 : 3); i++) {
    const br = scaleUV(new THREE.CylinderGeometry(tr * 0.3, tr * 0.5, H * 0.8, 5), 1, 2);
    br.translate(0, H * 0.4, 0);
    br.rotateZ(0.7); br.rotateY(i * 2.1 + rng.float(0, 0.5));
    br.translate(0, H * 0.8, 0);
    tparts.push(prep(br, 0xffffff));
  }
  const parts = [];
  const n = lod ? 3 : apple ? 4 : 5;
  const R = apple ? 1.7 : 2.6;
  for (let i = 0; i < n; i++) {
    const s = new THREE.IcosahedronGeometry(R * rng.float(0.65, 1.0) * (lod ? 1.1 : 1), lod ? 0 : 1);
    jitter(s, 0.5, rng);
    const a = i / n * Math.PI * 2;
    s.translate(Math.cos(a) * R * 0.55, H + R * 0.6 + rng.float(-0.3, 0.6), Math.sin(a) * R * 0.55);
    scaleUV(s, 2, 2);
    parts.push(gradientColor(prep(s), apple ? 0x2f5f22 : 0x2a4f1c, apple ? 0x6f9f3a : 0x5f8f32, 0.2, () => rng.next()));
  }
  const top = new THREE.IcosahedronGeometry(R * 0.9, lod ? 0 : 1);
  jitter(top, 0.5, rng);
  top.translate(0, H + R * 1.2, 0);
  parts.push(gradientColor(prep(top), apple ? 0x3f6f2a : 0x355f22, apple ? 0x7faf42 : 0x6a9a38, 0.2, () => rng.next()));
  const res = [mergeGeometries(tparts), mergeGeometries(parts)];
  if (apple) {
    const fruits = [];
    for (let i = 0; i < (lod ? 6 : 22); i++) {
      const f = new THREE.IcosahedronGeometry(0.09, 0);
      const a = rng.float(0, Math.PI * 2), r = rng.float(R * 0.9, R * 1.3), yy = H + rng.float(0.2, R * 1.6);
      f.translate(Math.cos(a) * r, yy, Math.sin(a) * r);
      fruits.push(prep(f, rng.chance(0.8) ? 0xc8201a : 0xe0b020));
    }
    res.push(mergeGeometries(fruits));
  }
  return res;
}

function bushGeo(rng, lod = 0) {
  const parts = [];
  for (let i = 0; i < (lod ? 2 : 3); i++) {
    const s = new THREE.IcosahedronGeometry(rng.float(0.7, 1.0), lod ? 0 : 1);
    jitter(s, 0.3, rng);
    s.translate(rng.float(-0.6, 0.6), 0.5 + rng.float(0, 0.3), rng.float(-0.6, 0.6));
    scaleUV(s, 1.5, 1.5);
    parts.push(gradientColor(prep(s), 0x2a4a1c, 0x5f8a34, 0.25, () => rng.next()));
  }
  return [mergeGeometries(parts)];
}

function rockGeo(rng, lod = 0) {
  const s = new THREE.IcosahedronGeometry(1, lod ? 1 : 2);
  const N = new Simplex(rng.int(1, 9999));
  const p = s.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + N.noise(x * 1.3, z * 1.3 + y) * 0.25 + N.noise(x * 3, y * 3) * 0.08;
    p.setXYZ(i, x * k * 1.3, y * k * 0.75, z * k);
  }
  s.computeVertexNormals();
  scaleUV(s, 1.5, 1.5);
  return [gradientColor(prep(s), 0x6f6a62, 0xa8a49a, 0.2, () => rng.next())];
}

function grassGeo(rng) {
  const pos = [], col = [], idx = [];
  const blades = 14;
  for (let i = 0; i < blades; i++) {
    const a = rng.float(0, Math.PI * 2), r = rng.float(0, 0.35);
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    const h = rng.float(0.22, 0.5), w = rng.float(0.025, 0.045);
    const ang = rng.float(0, Math.PI);
    const dx = Math.cos(ang) * w, dz = Math.sin(ang) * w;
    const lean = rng.float(-0.15, 0.15);
    const base = pos.length / 3;
    pos.push(bx - dx, 0, bz - dz, bx + dx, 0, bz + dz, bx + lean * 0.5 - dx * 0.5, h * 0.55, bz + lean * 0.3 - dz * 0.5, bx + lean * 0.5 + dx * 0.5, h * 0.55, bz + lean * 0.3 + dz * 0.5, bx + lean, h, bz + lean * 0.6);
    const g = rng.float(0.8, 1.15);
    const cb = [0.035 * g, 0.065 * g, 0.012 * g], cm = [0.075 * g, 0.135 * g, 0.022 * g], ct = [0.14 * g, 0.23 * g, 0.045 * g];
    col.push(...cb, ...cb, ...cm, ...cm, ...ct);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Шөп нормалі жоғары қарасын — жарықтандыру біркелкі
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

export class Vegetation {
  constructor(ctx, quality) {
    this.ctx = ctx;
    this.q = quality;
    const T = ctx.tex;
    this.mBark = new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normal || null, roughness: 0.95, vertexColors: true });
    this.mBirch = new THREE.MeshStandardMaterial({ map: T.birch.map, roughness: 0.85, vertexColors: true });
    this.mLeaves = new THREE.MeshStandardMaterial({ map: T.leaves.map, normalMap: T.leaves.normal || null, roughness: 0.82, vertexColors: true });
    this.mRock = new THREE.MeshStandardMaterial({ map: T.rock.map, normalMap: T.rock.normal || null, roughness: 0.92, vertexColors: true });
    this.mFruit = new THREE.MeshStandardMaterial({ roughness: 0.4, vertexColors: true });
    this.mGrass = new THREE.MeshStandardMaterial({ roughness: 0.95, vertexColors: true, side: THREE.DoubleSide });
    addWind(this.mLeaves, 0.012, 'L');
    addWind(this.mGrass, 0.25, 'G', true);
    this.chunk = 340;
  }

  build() {
    const ctx = this.ctx;
    const rng = new RNG(777);
    const T = ctx.terrain;
    const N = new Simplex(31337);
    const two = (fn) => { const s1 = rng.int(1, 1e6); return [fn(new RNG(s1), 0), fn(new RNG(s1), 1)]; };
    const [pn, pf] = two((r, l) => pineGeo(r, l));
    const [bn, bf] = two((r, l) => birchGeo(r, l));
    const [on, of] = two((r, l) => oakGeo(r, false, l));
    const [an, af] = two((r, l) => oakGeo(r, true, l));
    const [un, uf] = two((r, l) => bushGeo(r, l));
    const [rn, rf] = two((r, l) => rockGeo(r, l));
    const types = {
      pine: { geos: pn, far: pf, mats: [this.mBark, this.mLeaves], list: [], r: 0.3 },
      birch: { geos: bn, far: bf, mats: [this.mBirch, this.mLeaves], list: [], r: 0.18 },
      oak: { geos: on, far: of, mats: [this.mBark, this.mLeaves], list: [], r: 0.38 },
      apple: { geos: an, far: af, mats: [this.mBark, this.mLeaves, this.mFruit], list: [], r: 0.2 },
      bush: { geos: un, far: uf, mats: [this.mLeaves], list: [], r: 0 },
      rock: { geos: rn, far: rf, mats: [this.mRock], list: [], r: 1 },
    };
    const tmp = [];
    const free = (x, z, rad) => {
      ctx.col.query(x - rad, z - rad, x + rad, z + rad, tmp);
      for (const s of tmp) if (s.maxY > T.heightAt(x, z) + 0.3) return false;
      return true;
    };
    const place = (type, x, z, s, cast = true) => {
      const y = T.heightAt(x, z);
      const t = types[type];
      t.list.push({ x, y, z, s, ry: rng.float(0, Math.PI * 2) });
      if (t.r > 0 && type !== 'rock') ctx.col.addCyl(x, z, t.r * s, y - 1, y + 6 * s, 'wood', false);
      void cast;
    };
    const dens = this.q.veg;
    const tries = Math.floor(9000 * dens);
    for (let i = 0; i < tries; i++) {
      const x = rng.float(-440, 440), z = rng.float(-440, 440);
      const y = T.heightAt(x, z);
      if (y < 2.6) continue;
      const n = T.normalAt(x, z);
      if (n.y < 0.82) continue;
      const forest = N.fbm(x / 160, z / 160, 3);
      let nearPoi = 1e9;
      for (const p of POIS) nearPoi = Math.min(nearPoi, Math.hypot(x - p.x, z - p.z) - p.r);
      if (nearPoi < -10) continue;
      if (roadDist(x, z) < 6) continue;
      const pr = smoothstep(-0.25, 0.35, forest) * 0.85 + 0.08;
      if (rng.next() > pr) continue;
      if (!free(x, z, 2.2)) continue;
      const mountain = y > 22;
      let type;
      if (mountain) type = rng.chance(0.75) ? 'pine' : 'birch';
      else type = rng.weighted([['pine', 2], ['birch', 3], ['oak', 2.5], ['bush', 4]]);
      place(type, x, z, rng.float(0.8, 1.25));
    }
    // Тастар
    for (let i = 0; i < Math.floor(700 * dens); i++) {
      const x = rng.float(-440, 440), z = rng.float(-440, 440);
      const y = T.heightAt(x, z);
      if (y < 0.5) continue;
      const n = T.normalAt(x, z);
      const steep = n.y < 0.9 || y > 20;
      if (!steep && rng.chance(0.75)) continue;
      if (roadDist(x, z) < 5) continue;
      let nearPoi = 1e9;
      for (const p of POIS) nearPoi = Math.min(nearPoi, Math.hypot(x - p.x, z - p.z) - p.r);
      if (nearPoi < 0) continue;
      if (!free(x, z, 2.5)) continue;
      const s = rng.chance(0.15) ? rng.float(2.2, 3.6) : rng.float(0.5, 1.6);
      types.rock.list.push({ x, y: y - s * 0.2, z, s, ry: rng.float(0, 6.28) });
      ctx.col.addCyl(x, z, s * 1.05, y - 2, y + s * 0.55, 'concrete', true);
    }
    // Алмалы бау: қатар-қатар алма ағаштары
    const orch = POIS.find((p) => p.id === 'orchard');
    for (let ix = -4; ix <= 4; ix++) for (let iz = -3; iz <= 3; iz++) {
      const x = orch.x - 28 + ix * 7, z = orch.z + 16 + iz * 7;
      if (Math.abs(ix) < 1 && iz < 0) continue;
      if (!free(x, z, 2)) continue;
      types.apple.list.push({ x, y: T.heightAt(x, z), z, s: rng.float(0.9, 1.15), ry: rng.float(0, 6.28) });
      ctx.col.addCyl(x, z, 0.22, T.heightAt(x, z), T.heightAt(x, z) + 3, 'wood', false);
    }
    // Нақты елді мекендердегі әсемдік ағаштар
    for (const extra of ctx.extraTrees) types[extra.type].list.push({ ...extra, y: T.heightAt(extra.x, extra.z), ry: rng.float(0, 6) });

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    this.lod = [];
    for (const [name, t] of Object.entries(types)) {
      if (!t.list.length) continue;
      const mk = (geos) => (geos.length > 1 ? mergeGeometries(geos, true) : geos[0]);
      const gN = mk(t.geos), gF = mk(t.far);
      const mats = t.geos.length > 1 ? t.mats : t.mats[0];
      const n = t.list.length;
      const near = new THREE.InstancedMesh(gN, mats, n);
      const far = new THREE.InstancedMesh(gF, mats, n);
      near.castShadow = this.q.shadows > 0 && name !== 'bush';
      near.receiveShadow = true;
      far.castShadow = false; far.receiveShadow = true;
      near.frustumCulled = false; far.frustumCulled = false;
      near.count = 0; far.count = 0;
      const mats4 = t.list.map((it) => {
        e.set(name === 'rock' ? rng.float(-0.2, 0.2) : 0, it.ry, 0);
        q.setFromEuler(e);
        const m = new THREE.Matrix4();
        m.compose(pv.set(it.x, it.y - (name === 'rock' ? 0 : 0.15), it.z), q, sv.set(it.s, it.s, it.s));
        return m;
      });
      ctx.scene.add(near); ctx.scene.add(far);
      this.lod.push({ name, near, far, list: t.list, mats: mats4, nearR: name === 'bush' || name === 'rock' ? 70 : 110 });
    }
    this.lodPos = new THREE.Vector3(1e9, 0, 0);
    this.types = types;
    // Шөп
    if (this.q.grass > 0) this.initGrass();
  }

  // Жақын/алыс деңгейлерді қайта бөлу (камера едәуір жылжығанда)
  updateLOD(cam, force = false) {
    if (!this.lod) return;
    if (!force && this.lodPos.distanceToSquared(cam) < 64) return;
    this.lodPos.copy(cam);
    const draw = this.q.draw + 40;
    const q = this.q.veg < 0.7 ? 0.7 : 1;
    for (const L of this.lod) {
      let nN = 0, nF = 0;
      const nr2 = (L.nearR * q) ** 2, fr2 = draw * draw;
      for (let i = 0; i < L.list.length; i++) {
        const it = L.list[i];
        const dx = it.x - cam.x, dz = it.z - cam.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < nr2) L.near.setMatrixAt(nN++, L.mats[i]);
        else if (d2 < fr2) L.far.setMatrixAt(nF++, L.mats[i]);
      }
      L.near.count = nN; L.far.count = nF;
      L.near.instanceMatrix.needsUpdate = true; L.far.instanceMatrix.needsUpdate = true;
    }
  }

  initGrass() {
    const rng = new RNG(5);
    const geo = grassGeo(rng);
    this.grassCount = this.q.grass;
    this.grass = new THREE.InstancedMesh(geo, this.mGrass, this.grassCount);
    this.grass.frustumCulled = false;
    this.grass.receiveShadow = true;
    this.grass.castShadow = false;
    this.ctx.scene.add(this.grass);
    this.grassSpacing = 1.15;
    this.grassRadius = Math.sqrt(this.grassCount) * this.grassSpacing / 2;
    this.lastGX = 1e9; this.lastGZ = 1e9;
    this._tmp = [];
  }

  grassAllowed(x, z, y) {
    if (y < 2.4) return false;
    const T = this.ctx.terrain;
    const w = T.grassWeight ? T.grassWeight(x, z) : 1;
    if (w < 0.45) return false;
    this.ctx.col.query(x - 0.3, z - 0.3, x + 0.3, z + 0.3, this._tmp);
    for (const s of this._tmp) if (s.maxY > y + 0.05 && s.minY < y + 1) return false;
    return true;
  }

  updateGrass(px, pz) {
    if (!this.grass) return;
    const sp = this.grassSpacing;
    const gx = Math.round(px / sp), gz = Math.round(pz / sp);
    if (Math.abs(gx - this.lastGX) < 2 && Math.abs(gz - this.lastGZ) < 2) return;
    this.lastGX = gx; this.lastGZ = gz;
    const n = Math.floor(Math.sqrt(this.grassCount));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    const T = this.ctx.terrain;
    let k = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const cx = gx - (n >> 1) + i, cz = gz - (n >> 1) + j;
      const h1 = Math.sin(cx * 127.1 + cz * 311.7) * 43758.5453;
      const r1 = h1 - Math.floor(h1);
      const h2 = Math.sin(cx * 269.5 + cz * 183.3) * 43758.5453;
      const r2 = h2 - Math.floor(h2);
      const x = (cx + r1 - 0.5) * sp, z = (cz + r2 - 0.5) * sp;
      const d = Math.hypot(x - px, z - pz);
      const y = T.heightAt(x, z);
      let s = (0.8 + r1 * 0.6) * (1 - smoothstep(this.grassRadius * 0.7, this.grassRadius, d));
      if (s < 0.05 || !this.grassAllowed(x, z, y)) s = 0;
      e.set(0, r2 * 6.28, 0);
      q.setFromEuler(e);
      m4.compose(pv.set(x, y - 0.02, z), q, sv.set(s, s, s));
      this.grass.setMatrixAt(k++, m4);
    }
    this.grass.count = k;
    this.grass.instanceMatrix.needsUpdate = true;
  }
}
