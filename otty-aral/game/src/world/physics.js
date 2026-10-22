// Соқтығысу әлемі: AABB қораптар, тік цилиндрлер, сақиналы қабырғалар (киіз үй, мұз қабырға).
// Кейіпкерлер — тік капсула; оқтар — сәуле (raycast).

export const BOX = 0, CYL = 1, RING = 2;

const TAU = Math.PI * 2;
function angIn(a, center, half) {
  let d = (a - center) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return Math.abs(d) <= half;
}

export class CollisionWorld {
  constructor(terrain) {
    this.terrain = terrain;
    this.cell = 8;
    this.grid = new Map();
    this.stamp = 1;
    this.solids = [];
    this.hit = { t: 0, nx: 0, ny: 0, nz: 0, solid: null, mat: 'dirt', x: 0, y: 0, z: 0 };
  }

  _key(ix, iz) { return (ix + 512) * 2048 + (iz + 512); }

  _insert(s) {
    const c = this.cell;
    const ix0 = Math.floor(s.minX / c), ix1 = Math.floor(s.maxX / c);
    const iz0 = Math.floor(s.minZ / c), iz1 = Math.floor(s.maxZ / c);
    s.cells = [];
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
      const k = this._key(ix, iz);
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(s);
      s.cells.push(k);
    }
    this.solids.push(s);
    return s;
  }

  remove(s) {
    if (!s || !s.cells) return;
    for (const k of s.cells) {
      const arr = this.grid.get(k);
      if (!arr) continue;
      const i = arr.indexOf(s);
      if (i >= 0) arr.splice(i, 1);
    }
    s.cells = null;
    s.removed = true;
    const i = this.solids.indexOf(s);
    if (i >= 0) this.solids.splice(i, 1);
  }

  addBox(minX, minY, minZ, maxX, maxY, maxZ, mat = 'concrete', walk = true) {
    return this._insert({ type: BOX, minX, minY, minZ, maxX, maxY, maxZ, mat, walk, stamp: 0 });
  }

  addCyl(x, z, r, minY, maxY, mat = 'wood', walk = true) {
    return this._insert({ type: CYL, x, z, r, minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, minY, maxY, mat, walk, stamp: 0 });
  }

  // mode 'gap': ac бұрышындағы саңылаудан басқа барлық жерде қабырға; 'arc': тек доғада
  addRing(x, z, r, thick, minY, maxY, ac, ah, mode = 'gap', mat = 'felt') {
    const R = r + thick;
    return this._insert({ type: RING, x, z, r, thick, minX: x - R, maxX: x + R, minZ: z - R, maxZ: z + R, minY, maxY, ac, ah, mode, mat, walk: false, stamp: 0 });
  }

  query(minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    const st = ++this.stamp;
    const c = this.cell;
    const ix0 = Math.floor(minX / c), ix1 = Math.floor(maxX / c);
    const iz0 = Math.floor(minZ / c), iz1 = Math.floor(maxZ / c);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
      const arr = this.grid.get(this._key(ix, iz));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        if (s.stamp === st) continue;
        s.stamp = st;
        out.push(s);
      }
    }
    return out;
  }

  _ringSolidAt(s, x, z) {
    const a = Math.atan2(z - s.z, x - s.x);
    const inArc = angIn(a, s.ac, s.ah);
    return s.mode === 'gap' ? !inArc : inArc;
  }

  // Аяқ астындағы ең жоғары бет (step — көтеріле алатын биіктік)
  groundAt(x, z, r, feetY, step = 0.55) {
    let g = this.terrain.heightAt(x, z);
    let mat = g < 1.6 ? 'sand' : 'grass';
    const list = this.query(x - r, z - r, x + r, z + r, this._q || (this._q = []));
    const lim = feetY + step;
    const rr = r * 0.7;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s.walk || s.maxY > lim || s.maxY <= g) continue;
      if (s.type === BOX) {
        if (x + rr < s.minX || x - rr > s.maxX || z + rr < s.minZ || z - rr > s.maxZ) continue;
      } else if (s.type === CYL) {
        const dx = x - s.x, dz = z - s.z;
        if (dx * dx + dz * dz > (s.r + rr * 0.5) * (s.r + rr * 0.5)) continue;
      } else continue;
      g = s.maxY; mat = s.mat;
    }
    this.groundMat = mat;
    return g;
  }

  // Бастың үстіндегі төбе
  ceilingAt(x, z, r, fromY, toY) {
    let c = Infinity;
    const list = this.query(x - r, z - r, x + r, z + r, this._q || (this._q = []));
    for (const s of list) {
      if (s.type !== BOX) continue;
      if (s.minY < fromY || s.minY > toY) continue;
      if (x + r * 0.7 < s.minX || x - r * 0.7 > s.maxX || z + r * 0.7 < s.minZ || z - r * 0.7 > s.maxZ) continue;
      if (s.minY < c) c = s.minY;
    }
    return c;
  }

  // Шеңберді (кейіпкерді) қабырғалардан итеріп шығару. p = {x,y,z}
  resolve(p, r, height, step = 0.55) {
    const list = this.query(p.x - r - 0.5, p.z - r - 0.5, p.x + r + 0.5, p.z + r + 0.5, this._q2 || (this._q2 = []));
    let hitWall = false;
    const bottom = p.y + step, top = p.y + height;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (s.maxY <= bottom || s.minY >= top) continue;
        if (s.type === BOX) {
          const cx = p.x < s.minX ? s.minX : p.x > s.maxX ? s.maxX : p.x;
          const cz = p.z < s.minZ ? s.minZ : p.z > s.maxZ ? s.maxZ : p.z;
          let dx = p.x - cx, dz = p.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const push = r - d;
            p.x += dx / d * push; p.z += dz / d * push;
          } else {
            // Ортасы қорап ішінде — ең жақын бетке шығару
            const l = p.x - s.minX, rgt = s.maxX - p.x, f = p.z - s.minZ, b = s.maxZ - p.z;
            const m = Math.min(l, rgt, f, b);
            if (m === l) p.x = s.minX - r; else if (m === rgt) p.x = s.maxX + r; else if (m === f) p.z = s.minZ - r; else p.z = s.maxZ + r;
          }
          moved = hitWall = true;
        } else if (s.type === CYL) {
          const dx = p.x - s.x, dz = p.z - s.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          const R = s.r + r;
          if (d >= R) continue;
          const nx = d > 1e-5 ? dx / d : 1, nz = d > 1e-5 ? dz / d : 0;
          p.x = s.x + nx * R; p.z = s.z + nz * R;
          moved = hitWall = true;
        } else {
          const dx = p.x - s.x, dz = p.z - s.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          const half = s.thick * 0.5 + r;
          const rr = s.r + s.thick * 0.5;
          if (Math.abs(d - rr) >= half || d < 1e-4) continue;
          if (!this._ringSolidAt(s, p.x, p.z)) continue;
          const nx = dx / d, nz = dz / d;
          const target = d < rr ? rr - half : rr + half;
          p.x = s.x + nx * target; p.z = s.z + nz * target;
          moved = hitWall = true;
        }
      }
      if (!moved) break;
    }
    return hitWall;
  }

  // Сәуле: (o + d*t), d — бірлік вектор. ignore — қатты денені елемеу (мысалы, өз мұз қабырғаң емес)
  raycast(ox, oy, oz, dx, dy, dz, maxT, terrain = true) {
    const H = this.hit;
    let best = maxT;
    let bs = null, bnx = 0, bny = 1, bnz = 0;
    // Тор бойымен 2D DDA
    const c = this.cell;
    let ix = Math.floor(ox / c), iz = Math.floor(oz / c);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-9 ? Math.abs(c / dx) : Infinity;
    const tdz = Math.abs(dz) > 1e-9 ? Math.abs(c / dz) : Infinity;
    let tmx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (ix + 1) * c - ox : ox - ix * c) / Math.abs(dx)) : Infinity;
    let tmz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (iz + 1) * c - oz : oz - iz * c) / Math.abs(dz)) : Infinity;
    const st = ++this.stamp;
    let tCell = 0;
    for (let guard = 0; guard < 400; guard++) {
      const arr = this.grid.get(this._key(ix, iz));
      if (arr) {
        for (let i = 0; i < arr.length; i++) {
          const s = arr[i];
          if (s.stamp === st) continue;
          s.stamp = st;
          if (s.type === BOX) {
            let t0 = 0, t1 = best, nAxis = -1, nSign = 0;
            // X
            if (Math.abs(dx) < 1e-9) { if (ox < s.minX || ox > s.maxX) continue; } else {
              let a = (s.minX - ox) / dx, b = (s.maxX - ox) / dx, sg = -1;
              if (a > b) { const tt = a; a = b; b = tt; sg = 1; }
              if (a > t0) { t0 = a; nAxis = 0; nSign = sg; }
              if (b < t1) t1 = b;
              if (t0 > t1) continue;
            }
            if (Math.abs(dy) < 1e-9) { if (oy < s.minY || oy > s.maxY) continue; } else {
              let a = (s.minY - oy) / dy, b = (s.maxY - oy) / dy, sg = -1;
              if (a > b) { const tt = a; a = b; b = tt; sg = 1; }
              if (a > t0) { t0 = a; nAxis = 1; nSign = sg; }
              if (b < t1) t1 = b;
              if (t0 > t1) continue;
            }
            if (Math.abs(dz) < 1e-9) { if (oz < s.minZ || oz > s.maxZ) continue; } else {
              let a = (s.minZ - oz) / dz, b = (s.maxZ - oz) / dz, sg = -1;
              if (a > b) { const tt = a; a = b; b = tt; sg = 1; }
              if (a > t0) { t0 = a; nAxis = 2; nSign = sg; }
              if (b < t1) t1 = b;
              if (t0 > t1) continue;
            }
            if (t0 < best && nAxis >= 0) {
              best = t0; bs = s;
              bnx = nAxis === 0 ? nSign : 0; bny = nAxis === 1 ? nSign : 0; bnz = nAxis === 2 ? nSign : 0;
            }
          } else if (s.type === CYL) {
            const px = ox - s.x, pz = oz - s.z;
            const a = dx * dx + dz * dz;
            if (a < 1e-9) continue;
            const b = px * dx + pz * dz, cc = px * px + pz * pz - s.r * s.r;
            const disc = b * b - a * cc;
            if (disc < 0) continue;
            const t = (-b - Math.sqrt(disc)) / a;
            if (t < 0 || t >= best) continue;
            const y = oy + dy * t;
            if (y < s.minY || y > s.maxY) continue;
            best = t; bs = s;
            bnx = (px + dx * t) / s.r; bny = 0; bnz = (pz + dz * t) / s.r;
          } else {
            const R = s.r + s.thick * 0.5;
            const px = ox - s.x, pz = oz - s.z;
            const a = dx * dx + dz * dz;
            if (a < 1e-9) continue;
            const b = px * dx + pz * dz, cc = px * px + pz * pz - R * R;
            const disc = b * b - a * cc;
            if (disc < 0) continue;
            const sq = Math.sqrt(disc);
            for (const t of [(-b - sq) / a, (-b + sq) / a]) {
              if (t < 0 || t >= best) continue;
              const y = oy + dy * t;
              if (y < s.minY || y > s.maxY) continue;
              const hx = ox + dx * t, hz = oz + dz * t;
              if (!this._ringSolidAt(s, hx, hz)) continue;
              best = t; bs = s;
              const sgn = cc > 0 ? 1 : -1;
              bnx = (hx - s.x) / R * sgn; bny = 0; bnz = (hz - s.z) / R * sgn;
              break;
            }
          }
        }
      }
      // Келесі ұяшық
      if (tmx < tmz) { tCell = tmx; tmx += tdx; ix += stepX; } else { tCell = tmz; tmz += tdz; iz += stepZ; }
      if (tCell > best) break;
    }
    // Жер бедері
    let terrainHit = false;
    if (terrain) {
      const T = this.terrain;
      const stepLen = 1.5;
      let prevT = 0;
      let prevDiff = oy - T.heightAt(ox, oz);
      if (prevDiff < 0) { best = 0; terrainHit = true; }
      else {
        for (let t = stepLen; t < best + stepLen; t += stepLen) {
          const tt = Math.min(t, best);
          const x = ox + dx * tt, y = oy + dy * tt, z = oz + dz * tt;
          const diff = y - T.heightAt(x, z);
          if (diff < 0) {
            // Екіге бөлу әдісімен нақтылау
            let lo = prevT, hi = tt;
            for (let k = 0; k < 6; k++) {
              const m = (lo + hi) * 0.5;
              const dm = oy + dy * m - T.heightAt(ox + dx * m, oz + dz * m);
              if (dm < 0) hi = m; else lo = m;
            }
            if (hi < best) { best = hi; terrainHit = true; }
            break;
          }
          prevT = tt; prevDiff = diff;
          if (tt >= best) break;
        }
      }
    }
    if (!bs && !terrainHit) return null;
    H.t = best;
    H.x = ox + dx * best; H.y = oy + dy * best; H.z = oz + dz * best;
    if (terrainHit) {
      const n = this.terrain.normalAt(H.x, H.z, this._n || (this._n = { set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }, normalize() { const l = Math.hypot(this.x, this.y, this.z); this.x /= l; this.y /= l; this.z /= l; return this; } }));
      H.nx = n.x; H.ny = n.y; H.nz = n.z; H.solid = null;
      H.mat = H.y < 1.6 ? 'sand' : 'dirt';
    } else {
      H.nx = bnx; H.ny = bny; H.nz = bnz; H.solid = bs; H.mat = bs.mat;
    }
    return H;
  }

  // Көру сызығы бар ма
  visible(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.01) return true;
    const h = this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.3, true);
    return !h;
  }
}
