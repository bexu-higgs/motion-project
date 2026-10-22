// Геометрия көмекшілері және статикалық біріктіру (draw call санын азайту үшін).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();

// Текстура әлемдік масштабта (метрмен) қайталанатын қорап
export function uvBox(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const su = dims[f][0] / tile, sv = dims[f][1] / tile;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
  }
  return g;
}

export function ensureIndexed(g) {
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return g;
}

export function colorize(g, color) {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Төменнен жоғары қарай түс градиенті (ағаш жапырағы, тастар үшін)
export function gradientColor(g, bottom, top, jitter = 0, rng = Math.random) {
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const p = g.attributes.position;
  const n = p.count;
  const arr = new Float32Array(n * 3);
  const a = new THREE.Color(bottom), b = new THREE.Color(top);
  for (let i = 0; i < n; i++) {
    const t = (p.getY(i) - bb.min.y) / Math.max(1e-4, bb.max.y - bb.min.y);
    const j = 1 + (rng() - 0.5) * jitter;
    _c.copy(a).lerp(b, t);
    arr[i * 3] = _c.r * j; arr[i * 3 + 1] = _c.g * j; arr[i * 3 + 2] = _c.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function keepAttrs(g, names = ['position', 'normal', 'uv', 'color']) {
  for (const k of Object.keys(g.attributes)) if (!names.includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

// Жиектері дөңгеленген қорап
export function roundedBox(w, h, d, r, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  const v = new THREE.Vector3(), inner = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    inner.set(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
    v.sub(inner);
    if (v.lengthSq() > 0) v.normalize().multiplyScalar(r);
    v.add(inner);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Капсула (аяқ-қол үшін)
export function capsule(r, len, radial = 8, cap = 3) {
  const g = new THREE.CapsuleGeometry(r, len, cap, radial);
  return g;
}

export function cyl(rt, rb, h, seg = 12, open = false) {
  return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export function mat4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

// Бірнеше геометрияны бір торға біріктіру (бір түсті атрибутпен)
export function mergeParts(parts) {
  const list = parts.map(({ g, m, color }) => {
    const c = g.clone();
    if (m) c.applyMatrix4(m);
    ensureIndexed(c);
    if (color !== undefined) colorize(c, color);
    else if (!c.attributes.color) colorize(c, 0xffffff);
    keepAttrs(c);
    return c;
  });
  const out = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  return out;
}

// Статикалық әлемдік геометрияны материал + аймақ (chunk) бойынша біріктіреді
export class StaticBatch {
  constructor(chunk = 140) {
    this.chunk = chunk;
    this.buckets = new Map();
    this.count = 0;
  }
  add(geo, material, matrix, color = 0xffffff, opts = {}) {
    const g = geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    ensureIndexed(g);
    if (!opts.keepColor || !g.attributes.color) colorize(g, color);
    keepAttrs(g);
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const cx = Math.floor((bb.min.x + bb.max.x) * 0.5 / this.chunk);
    const cz = Math.floor((bb.min.z + bb.max.z) * 0.5 / this.chunk);
    const shadow = opts.cast === false ? 0 : 1;
    const key = material.uuid + '|' + cx + '|' + cz + '|' + shadow;
    let b = this.buckets.get(key);
    if (!b) { b = { material, list: [], cast: shadow }; this.buckets.set(key, b); }
    b.list.push(g);
    this.count++;
  }
  build(parent) {
    const meshes = [];
    for (const b of this.buckets.values()) {
      // Индекс өлшемі шектен асып кетпеуі үшін бөліктерге бөлеміз
      let cur = [], verts = 0;
      const flush = () => {
        if (!cur.length) return;
        const merged = mergeGeometries(cur, false);
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, b.material);
        mesh.castShadow = !!b.cast;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        parent.add(mesh);
        meshes.push(mesh);
        cur.forEach((g) => g.dispose());
        cur = []; verts = 0;
      };
      for (const g of b.list) {
        const n = g.attributes.position.count;
        if (verts + n > 400000) flush();
        cur.push(g); verts += n;
      }
      flush();
    }
    this.buckets.clear();
    return meshes;
  }
}
