// Визуалды эффектілер: бөлшектер (атлас), оқ іздері, оқ тесіктері, гильзалар, жарқыл.
import * as THREE from 'three';
import { makeParticleAtlas } from '../gfx/textures.js';

const pvert = `
attribute vec3 iPos; attribute vec4 iCol; attribute vec3 iSRF;
varying vec2 vUv; varying vec4 vCol;
#ifdef USE_FOG
varying float vFogDepth;
#endif
void main() {
  float s = iSRF.x, r = iSRF.y, fr = iSRF.z;
  vec2 c = position.xy;
  vec2 rc = vec2(c.x * cos(r) - c.y * sin(r), c.x * sin(r) + c.y * cos(r)) * s;
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  mv.xy += rc;
  gl_Position = projectionMatrix * mv;
  float fx = mod(fr, 4.0), fy = floor(fr / 4.0);
  vUv = (vec2(fx, 1.0 - fy) + uv) * vec2(0.25, 0.5);
  vCol = iCol;
  #ifdef USE_FOG
  vFogDepth = -mv.z;
  #endif
}`;
const pfrag = `
uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
#ifdef USE_FOG
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying float vFogDepth;
#endif
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = t * vCol;
  #ifdef USE_FOG
  float f = smoothstep(fogNear, fogFar, vFogDepth);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * gl_FragColor.a, f * 0.8);
  #endif
  if (gl_FragColor.a < 0.003) discard;
}`;

class Particles {
  constructor(scene, atlas, max, additive) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.srf = new Float32Array(max * 3);
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSrf = new THREE.InstancedBufferAttribute(this.srf, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iCol', this.aCol); g.setAttribute('iSRF', this.aSrf);
    g.instanceCount = 0;
    const fogU = THREE.UniformsLib.fog;
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([fogU, { map: { value: atlas } }]),
      vertexShader: pvert, fragmentShader: pfrag,
      transparent: true, depthWrite: false, fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mat.uniforms.map.value = atlas;
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 5 : 4;
    scene.add(this.mesh);
    this.geo = g;
    this.list = [];
    this.pool = [];
  }
  spawn(o) {
    if (this.list.length >= this.max) return null;
    const p = this.pool.pop() || {};
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = o.life || 1; p.t = 0;
    p.s0 = o.s0 ?? 1; p.s1 = o.s1 ?? p.s0;
    p.c0 = o.c0 || [1, 1, 1, 1]; p.c1 = o.c1 || [p.c0[0], p.c0[1], p.c0[2], 0];
    p.fr = o.fr || 0; p.rot = o.rot ?? Math.random() * 6.28; p.rs = o.rs || 0;
    p.drag = o.drag || 0; p.g = o.g || 0; p.fadeIn = o.fadeIn || 0;
    p.ground = o.ground ?? -1e9;
    this.list.push(p);
    return p;
  }
  update(dt) {
    const L = this.list;
    let n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) { this.pool.push(p); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vz *= k;
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.ground) { p.y = p.ground; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += p.rs * dt;
      const t = p.t / p.life;
      const fi = p.fadeIn > 0 ? Math.min(1, p.t / p.fadeIn) : 1;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      const c0 = p.c0, c1 = p.c1;
      this.col[n * 4] = c0[0] + (c1[0] - c0[0]) * t;
      this.col[n * 4 + 1] = c0[1] + (c1[1] - c0[1]) * t;
      this.col[n * 4 + 2] = c0[2] + (c1[2] - c0[2]) * t;
      this.col[n * 4 + 3] = (c0[3] + (c1[3] - c0[3]) * t) * fi;
      this.srf[n * 3] = p.s0 + (p.s1 - p.s0) * t; this.srf[n * 3 + 1] = p.rot; this.srf[n * 3 + 2] = p.fr;
      L[n++] = p;
    }
    L.length = n;
    this.geo.instanceCount = n;
    if (n) { this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSrf.needsUpdate = true; }
  }
  clear() { for (const p of this.list) this.pool.push(p); this.list.length = 0; this.geo.instanceCount = 0; }
}

// Оқ іздері (жарқыраған таспа)
class Tracers {
  constructor(scene, max = 48) {
    this.max = max;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 4 * 3);
    this.col = new Float32Array(max * 4 * 4);
    const idx = [];
    for (let i = 0; i < max; i++) { const b = i * 4; idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); }
    g.setIndex(idx);
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('color', this.aCol);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
    this.list = [];
    this.g = g;
  }
  add(a, b, color = 0xffd890, width = 0.035, speed = 420) {
    if (this.list.length >= this.max) this.list.shift();
    const c = new THREE.Color(color);
    const len = a.distanceTo(b);
    this.list.push({ a: a.clone(), b: b.clone(), len, d: 0, c, w: width, speed, seg: Math.min(len, 6 + Math.random() * 4) });
  }
  update(dt, cam) {
    const L = this.list;
    let n = 0;
    const dir = new THREE.Vector3(), side = new THREE.Vector3(), toC = new THREE.Vector3(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
    for (let i = 0; i < L.length; i++) {
      const t = L[i];
      t.d += t.speed * dt;
      if (t.d - t.seg > t.len) continue;
      dir.subVectors(t.b, t.a).normalize();
      const h = Math.min(t.d, t.len), tl = Math.max(0, t.d - t.seg);
      p0.copy(t.a).addScaledVector(dir, tl);
      p1.copy(t.a).addScaledVector(dir, h);
      toC.subVectors(cam.position, p1);
      side.crossVectors(dir, toC).normalize().multiplyScalar(t.w * (1 + toC.length() * 0.004));
      const k = n * 12;
      this.pos[k] = p0.x - side.x; this.pos[k + 1] = p0.y - side.y; this.pos[k + 2] = p0.z - side.z;
      this.pos[k + 3] = p0.x + side.x; this.pos[k + 4] = p0.y + side.y; this.pos[k + 5] = p0.z + side.z;
      this.pos[k + 6] = p1.x - side.x; this.pos[k + 7] = p1.y - side.y; this.pos[k + 8] = p1.z - side.z;
      this.pos[k + 9] = p1.x + side.x; this.pos[k + 10] = p1.y + side.y; this.pos[k + 11] = p1.z + side.z;
      const c = n * 16;
      for (let v = 0; v < 4; v++) {
        const a = v < 2 ? 0.0 : 0.95;
        this.col[c + v * 4] = t.c.r * 1.4; this.col[c + v * 4 + 1] = t.c.g * 1.4; this.col[c + v * 4 + 2] = t.c.b * 1.2; this.col[c + v * 4 + 3] = a;
      }
      L[n++] = t;
    }
    L.length = n;
    this.g.setDrawRange(0, n * 6);
    if (n) { this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; }
  }
}

// Оқ тесіктері
class Decals {
  constructor(scene, max) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.2, 'rgba(15,12,10,0.95)'); g.addColorStop(0.35, 'rgba(50,45,40,0.55)'); g.addColorStop(1, 'rgba(60,55,50,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this.max = max;
    this.i = 0;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3(); this.n = new THREE.Vector3();
  }
  add(x, y, z, nx, ny, nz, scale = 1) {
    this.n.set(nx, ny, nz);
    this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.n);
    const rot = new THREE.Quaternion().setFromAxisAngle(this.n, Math.random() * 6.28);
    this.q.premultiply(rot);
    this.p.set(x + nx * 0.01, y + ny * 0.01, z + nz * 0.01);
    this.s.setScalar(scale * (0.7 + Math.random() * 0.6));
    this.m.compose(this.p, this.q, this.s);
    this.mesh.setMatrixAt(this.i, this.m);
    this.i = (this.i + 1) % this.max;
    this.mesh.count = Math.min(this.max, this.mesh.count + 1);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.mesh.count = 0; this.i = 0; }
}

// Гильзалар
class Shells {
  constructor(scene, terrainFn, max = 40) {
    const g = new THREE.CylinderGeometry(0.006, 0.006, 0.028, 6);
    g.rotateZ(Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.9, roughness: 0.3 }), max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.list = [];
    this.max = max;
    this.ground = terrainFn;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s = new THREE.Vector3(1, 1, 1); this.p = new THREE.Vector3();
  }
  add(pos, vel, groundY) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ p: pos.clone(), v: vel.clone(), r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, 0), rv: Math.random() * 30, t: 0, gy: groundY });
  }
  update(dt) {
    let n = 0;
    for (const s of this.list) {
      s.t += dt;
      if (s.t > 2.5) continue;
      if (s.p.y > s.gy + 0.006) {
        s.v.y -= 9.8 * dt;
        s.p.addScaledVector(s.v, dt);
        s.r.x += s.rv * dt; s.r.y += s.rv * 0.7 * dt;
        if (s.p.y < s.gy + 0.006) { s.p.y = s.gy + 0.006; s.v.multiplyScalar(0.3); s.v.y = Math.abs(s.v.y) * 0.4; s.rv *= 0.5; }
      }
      this.e.set(s.r.x, s.r.y, 0);
      this.q.setFromEuler(this.e);
      this.m.compose(s.p, this.q, this.s);
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.list = this.list.filter((s) => s.t <= 2.5);
    this.mesh.count = n;
    if (n) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene, quality, terrain) {
    this.scene = scene;
    this.q = quality;
    const atlas = makeParticleAtlas();
    const mul = quality.particles;
    this.add = new Particles(scene, atlas, Math.floor(700 * mul) + 100, true);
    this.alpha = new Particles(scene, atlas, Math.floor(900 * mul) + 100, false);
    this.tracers = new Tracers(scene, 60);
    this.decals = new Decals(scene, quality.decals);
    this.shells = new Shells(scene, terrain, 40);
    this.light = new THREE.PointLight(0xffc070, 0, 14, 1.6);
    scene.add(this.light);
    this.lightT = 0;
    this.shake = 0;
    this.emitters = [];
    this.v = new THREE.Vector3();
  }

  flash(pos, intensity = 6, color = 0xffc070) {
    this.light.position.copy(pos);
    this.light.color.set(color);
    this.light.intensity = Math.max(this.light.intensity, intensity);
    this.lightT = 0.06;
  }

  muzzle(pos, dir, big = 1, near = true) {
    const s = 0.42 * big;
    this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, life: 0.055, s0: s, s1: s * 1.35, c0: [1, 0.85, 0.55, 1], c1: [1, 0.5, 0.2, 0], fr: 3 });
    this.add.spawn({ x: pos.x + dir.x * 0.15, y: pos.y + dir.y * 0.15, z: pos.z + dir.z * 0.15, life: 0.045, s0: s * 0.9, s1: s * 0.3, c0: [1, 0.95, 0.8, 1], fr: 0 });
    this.add.spawn({ x: pos.x + dir.x * 0.06, y: pos.y + dir.y * 0.06, z: pos.z + dir.z * 0.06, life: 0.04, s0: s * 1.4, s1: s * 0.6, c0: [1, 0.9, 0.6, 0.8], fr: 7, rot: Math.random() * 3 });
    if (near) {
      this.flash(pos, 30 * big);
      for (let i = 0; i < 2; i++) this.alpha.spawn({ x: pos.x + dir.x * 0.2, y: pos.y, z: pos.z + dir.z * 0.2, vx: dir.x * 1.5 + (Math.random() - 0.5) * 0.4, vy: 0.4 + Math.random() * 0.3, vz: dir.z * 1.5, life: 0.7, s0: 0.12, s1: 0.5, c0: [0.75, 0.75, 0.72, 0.25], c1: [0.8, 0.8, 0.78, 0], fr: 1, drag: 3 });
    }
  }

  impact(h, kind, scale = 1) {
    const { x, y, z, nx, ny, nz } = h;
    const P = this.q.particles;
    if (kind === 'flesh') {
      for (let i = 0; i < 6 * P; i++) this.alpha.spawn({ x, y, z, vx: nx * 1.5 + (Math.random() - 0.5) * 2, vy: (Math.random()) * 1.8, vz: nz * 1.5 + (Math.random() - 0.5) * 2, life: 0.45, s0: 0.08, s1: 0.22, c0: [0.75, 0.05, 0.05, 0.9], c1: [0.5, 0.02, 0.02, 0], fr: 0, g: 6, drag: 2 });
      this.alpha.spawn({ x, y, z, life: 0.35, s0: 0.15, s1: 0.55, c0: [0.7, 0.08, 0.06, 0.5], c1: [0.6, 0.05, 0.05, 0], fr: 1 });
      return;
    }
    if (kind === 'armor') {
      for (let i = 0; i < 6; i++) this.add.spawn({ x, y, z, vx: nx * 3 + (Math.random() - 0.5) * 5, vy: Math.random() * 4, vz: nz * 3 + (Math.random() - 0.5) * 5, life: 0.25, s0: 0.06, s1: 0.02, c0: [0.6, 0.85, 1, 1], fr: 0, g: 9 });
      return;
    }
    if (kind === 'water') {
      for (let i = 0; i < 8 * P; i++) this.alpha.spawn({ x, y, z, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 2, life: 0.6, s0: 0.08, s1: 0.15, c0: [0.9, 0.95, 1, 0.7], fr: 0, g: 9.8 });
      this.alpha.spawn({ x, y: y + 0.05, z, life: 0.6, s0: 0.2, s1: 1.0, c0: [1, 1, 1, 0.5], fr: 5 });
      return;
    }
    const metal = kind === 'metal';
    const dust = kind === 'dirt' || kind === 'grass' || kind === 'sand';
    const col = dust ? [0.55, 0.45, 0.33] : kind === 'wood' ? [0.6, 0.45, 0.3] : kind === 'ice' ? [0.8, 0.92, 1] : [0.65, 0.63, 0.6];
    this.alpha.spawn({ x: x + nx * 0.05, y: y + ny * 0.05, z: z + nz * 0.05, vx: nx * 0.8, vy: ny * 0.8 + 0.3, vz: nz * 0.8, life: 0.8 * scale, s0: 0.15 * scale, s1: 0.8 * scale, c0: [...col, 0.6], c1: [...col, 0], fr: 1, drag: 2.5, rs: 1 });
    for (let i = 0; i < 5 * P * scale; i++) {
      this.alpha.spawn({ x, y, z, vx: nx * 2.5 + (Math.random() - 0.5) * 3, vy: ny * 2.5 + Math.random() * 2.5, vz: nz * 2.5 + (Math.random() - 0.5) * 3, life: 0.5, s0: 0.04, s1: 0.03, c0: [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7, 1], fr: 0, g: 9.8 });
    }
    if (metal || kind === 'concrete' || kind === 'ice') {
      for (let i = 0; i < (metal ? 7 : 3) * P; i++) this.add.spawn({ x, y, z, vx: nx * 4 + (Math.random() - 0.5) * 6, vy: ny * 4 + Math.random() * 4, vz: nz * 4 + (Math.random() - 0.5) * 6, life: 0.2 + Math.random() * 0.15, s0: 0.05, s1: 0.01, c0: [1, 0.8, 0.45, 1], fr: 0, g: 12 });
    }
    if (kind !== 'cloth' && kind !== 'ice' && !dust) this.decals.add(x, y, z, nx, ny, nz, scale);
    else if (dust && ny < 0.6) this.decals.add(x, y, z, nx, ny, nz, scale * 0.8);
  }

  explosion(pos, scale = 1) {
    const { x, y, z } = pos;
    const P = this.q.particles;
    this.flash(pos, 40, 0xffa040);
    this.lightT = 0.3;
    for (let i = 0; i < 18 * P; i++) {
      const a = Math.random() * 6.28, e = Math.random() * 1.2, sp = 2 + Math.random() * 6;
      this.add.spawn({ x, y: y + 0.3, z, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp + 1, vz: Math.sin(a) * Math.cos(e) * sp, life: 0.45 + Math.random() * 0.3, s0: 1.2 * scale, s1: 2.6 * scale, c0: [1, 0.75, 0.35, 1], c1: [0.9, 0.25, 0.05, 0], fr: Math.random() < 0.5 ? 3 : 0, drag: 3, rs: 2 });
    }
    for (let i = 0; i < 16 * P; i++) {
      const a = Math.random() * 6.28, sp = 1 + Math.random() * 3;
      this.alpha.spawn({ x, y: y + 0.5, z, vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 2.5, vz: Math.sin(a) * sp, life: 2.5 + Math.random() * 2, s0: 1.5 * scale, s1: 5 * scale, c0: [0.25, 0.22, 0.2, 0.75], c1: [0.4, 0.38, 0.36, 0], fr: 1, drag: 1.2, rs: 0.5, fadeIn: 0.15 });
    }
    for (let i = 0; i < 24 * P; i++) {
      const a = Math.random() * 6.28, sp = 6 + Math.random() * 14;
      this.add.spawn({ x, y: y + 0.3, z, vx: Math.cos(a) * sp, vy: 3 + Math.random() * 9, vz: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.6, s0: 0.12, s1: 0.04, c0: [1, 0.8, 0.4, 1], fr: 0, g: 14, drag: 0.5 });
    }
    this.alpha.spawn({ x, y: y + 0.2, z, life: 0.5, s0: 1, s1: 12 * scale, c0: [1, 0.95, 0.85, 0.5], c1: [1, 1, 1, 0], fr: 5 });
    this.decals.add(x, y + 0.02, z, 0, 1, 0, 14 * scale);
  }

  iceBurst(pos, n = 30) {
    for (let i = 0; i < n * this.q.particles; i++) {
      const a = Math.random() * 6.28, sp = 2 + Math.random() * 6;
      this.alpha.spawn({ x: pos.x + (Math.random() - 0.5) * 3, y: pos.y + Math.random() * 2.2, z: pos.z + (Math.random() - 0.5) * 3, vx: Math.cos(a) * sp, vy: 2 + Math.random() * 4, vz: Math.sin(a) * sp, life: 0.9 + Math.random() * 0.5, s0: 0.25, s1: 0.1, c0: [0.75, 0.9, 1, 0.95], c1: [0.8, 0.95, 1, 0], fr: 4, g: 12, rs: 8, ground: pos.y });
    }
    for (let i = 0; i < 8; i++) this.alpha.spawn({ x: pos.x + (Math.random() - 0.5) * 3, y: pos.y + Math.random() * 2, z: pos.z + (Math.random() - 0.5) * 3, life: 1.2, s0: 0.6, s1: 2.2, c0: [0.85, 0.95, 1, 0.45], fr: 1, drag: 2 });
  }

  dust(pos, n = 10, size = 1) {
    for (let i = 0; i < n * this.q.particles; i++) {
      const a = Math.random() * 6.28, sp = 1 + Math.random() * 2.5;
      this.alpha.spawn({ x: pos.x, y: pos.y + 0.1, z: pos.z, vx: Math.cos(a) * sp, vy: 0.3 + Math.random() * 0.6, vz: Math.sin(a) * sp, life: 1.0 + Math.random() * 0.5, s0: 0.3 * size, s1: 1.4 * size, c0: [0.62, 0.55, 0.45, 0.5], c1: [0.65, 0.6, 0.52, 0], fr: 1, drag: 2.5, rs: 0.6 });
    }
  }

  // Үздіксіз шығаратын көздер (от, түтін, сигнал)
  addEmitter(e) { this.emitters.push(e); return e; }
  removeEmitter(e) { const i = this.emitters.indexOf(e); if (i >= 0) this.emitters.splice(i, 1); }

  update(dt, camera) {
    for (const e of this.emitters) {
      if (e.camDist && camera.position.distanceTo(e.pos) > e.camDist) continue;
      e.acc = (e.acc || 0) + dt * e.rate * this.q.particles;
      while (e.acc >= 1) {
        e.acc -= 1;
        if (e.type === 'fire') {
          this.add.spawn({ x: e.pos.x + (Math.random() - 0.5) * 0.4, y: e.pos.y, z: e.pos.z + (Math.random() - 0.5) * 0.4, vy: 1.2 + Math.random(), life: 0.5 + Math.random() * 0.3, s0: 0.5, s1: 0.1, c0: [1, 0.6, 0.2, 0.9], c1: [1, 0.2, 0.05, 0], fr: 3, rs: 2 });
          if (Math.random() < 0.3) this.alpha.spawn({ x: e.pos.x, y: e.pos.y + 0.8, z: e.pos.z, vx: 0.3, vy: 1, life: 3, s0: 0.4, s1: 2, c0: [0.3, 0.3, 0.3, 0.3], c1: [0.5, 0.5, 0.5, 0], fr: 1, drag: 0.5 });
        } else if (e.type === 'smoke') {
          this.alpha.spawn({ x: e.pos.x + (Math.random() - 0.5), y: e.pos.y, z: e.pos.z + (Math.random() - 0.5), vx: 1.2 + Math.random() * 0.5, vy: 2 + Math.random(), vz: 0.4, life: 8, s0: 2, s1: 9, c0: [0.55, 0.55, 0.55, 0.35], c1: [0.7, 0.7, 0.72, 0], fr: 1, drag: 0.3, rs: 0.2, fadeIn: 0.5 });
        } else if (e.type === 'flare') {
          this.alpha.spawn({ x: e.pos.x + (Math.random() - 0.5) * 0.3, y: e.pos.y, z: e.pos.z + (Math.random() - 0.5) * 0.3, vx: 0.8 + Math.random() * 0.4, vy: 3 + Math.random() * 1.5, vz: 0.3, life: 6, s0: 0.8, s1: 5, c0: [0.95, 0.15, 0.12, 0.7], c1: [0.9, 0.4, 0.4, 0], fr: 1, drag: 0.4, rs: 0.3, fadeIn: 0.2 });
          if (Math.random() < 0.5) this.add.spawn({ x: e.pos.x, y: e.pos.y, z: e.pos.z, vy: 0.5, life: 0.2, s0: 0.5, s1: 0.2, c0: [1, 0.4, 0.3, 1], fr: 0 });
        }
      }
    }
    this.add.update(dt);
    this.alpha.update(dt);
    this.tracers.update(dt, camera);
    this.shells.update(dt);
    if (this.lightT > 0) { this.lightT -= dt; if (this.lightT <= 0) this.light.intensity = 0; else this.light.intensity *= Math.exp(-dt * 25); }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  clear() {
    this.add.clear(); this.alpha.clear(); this.decals.clear();
    this.tracers.list.length = 0;
    this.shells.list.length = 0;
  }
}
