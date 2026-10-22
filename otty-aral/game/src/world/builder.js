// Құрылысшы: жергілікті координатада қорап/геометрия салып, оны әлемге бұрып орналастырады.
// Визуал StaticBatch-қа, соқтығысу CollisionWorld-ке түседі.
import * as THREE from 'three';
import { uvBox, cyl } from '../gfx/geom.js';
import { MAT_TILE } from '../gfx/materials.js';

export const PHYS = {
  plaster: 'concrete', brick: 'concrete', concrete: 'concrete', stone: 'concrete', asphalt: 'concrete',
  wood: 'wood', crate: 'wood', roof: 'wood', hay: 'cloth', bark: 'wood', birch: 'wood',
  metal: 'metal', paint: 'metal', flatMetal: 'metal', gold: 'metal',
  felt: 'cloth', kerege: 'cloth', uyk: 'cloth', fabric: 'cloth', carpet: 'cloth', ornament: 'cloth', camo: 'cloth', burlap: 'sand',
  rock: 'concrete', dirt: 'dirt', flat: 'wood', glass: 'metal', leaves: 'cloth',
};

const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _l = new THREE.Matrix4(), _e = new THREE.Euler(), _q = new THREE.Quaternion();
const _v = new THREE.Vector3(), _s = new THREE.Vector3();

export class Builder {
  constructor(ctx, ox, oy, oz, rot = 0, tier = 0) {
    this.ctx = ctx;
    this.ox = ox; this.oy = oy; this.oz = oz;
    this.rot = ((rot % 4) + 4) % 4;
    this.theta = this.rot * Math.PI / 2;
    this.c = Math.round(Math.cos(this.theta));
    this.s = Math.round(Math.sin(this.theta));
    this.tier = tier;
  }

  wx(lx, lz) { return this.ox + lx * this.c + lz * this.s; }
  wz(lx, lz) { return this.oz - lx * this.s + lz * this.c; }

  matrix(lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _l.compose(_v.set(0, 0, 0), _q, _s.set(sx, sy, sz));
    _r.makeRotationY(this.theta);
    _m.makeTranslation(this.wx(lx, lz), this.oy + ly, this.wz(lx, lz));
    return new THREE.Matrix4().multiplyMatrices(_m, _r).multiply(_l);
  }

  // Жергілікті ортасы (lx, lz), табаны ly болатын қорап
  box(lx, ly, lz, w, h, d, mat, color = 0xffffff, o = {}) {
    const M = this.ctx.mats[mat];
    if (!o.nv) {
      const g = uvBox(w, h, d, o.tile || MAT_TILE[mat] || 2);
      g.translate(0, h / 2, 0);
      this.ctx.batch.add(g, M, this.matrix(lx, ly, lz, 0, o.ry || 0, 0), color, { cast: o.cast !== false });
      g.dispose();
    }
    if (!o.nc) this.collider(lx, ly, lz, w, h, d, o.pm || PHYS[mat] || 'concrete', o.walk !== false);
    return this;
  }

  collider(lx, ly, lz, w, h, d, pm = 'concrete', walk = true) {
    const hw = (this.rot % 2 ? d : w) / 2, hd = (this.rot % 2 ? w : d) / 2;
    const x = this.wx(lx, lz), z = this.wz(lx, lz);
    return this.ctx.col.addBox(x - hw, this.oy + ly, z - hd, x + hw, this.oy + ly + h, z + hd, pm, walk);
  }

  // Еркін визуал геометрия
  geo(g, mat, color, lx, ly, lz, rx = 0, ry = 0, rz = 0, o = {}) {
    this.ctx.batch.add(g, this.ctx.mats[mat], this.matrix(lx, ly, lz, rx, ry, rz, o.sx || 1, o.sy || 1, o.sz || 1), color, { cast: o.cast !== false, keepColor: o.keepColor });
    return this;
  }

  // Тік цилиндр (соқтығысуымен)
  cyl(lx, ly, lz, r, h, mat, color = 0xffffff, o = {}) {
    const g = cyl(o.rt ?? r, r, h, o.seg || 14, !!o.open);
    if (o.tile !== 0) {
      const uv = g.attributes.uv;
      const su = (Math.PI * 2 * r) / (MAT_TILE[mat] || 2), sv = h / (MAT_TILE[mat] || 2);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    g.translate(0, h / 2, 0);
    this.ctx.batch.add(g, this.ctx.mats[mat], this.matrix(lx, ly, lz), color, { cast: o.cast !== false });
    g.dispose();
    if (!o.nc) this.ctx.col.addCyl(this.wx(lx, lz), this.wz(lx, lz), Math.max(r, o.rt ?? r), this.oy + ly, this.oy + ly + h, o.pm || PHYS[mat] || 'concrete', o.walk !== false);
    return this;
  }

  loot(lx, ly, lz, tierBonus = 0) {
    this.ctx.lootSpots.push({ x: this.wx(lx, lz), y: this.oy + ly + 0.05, z: this.wz(lx, lz), tier: this.tier + tierBonus });
  }

  // Ішкі нүкте (боттар үшін кіру бағыты)
  door(lxOut, lzOut, lxIn, lzIn) {
    this.ctx.doors.push({
      out: { x: this.wx(lxOut, lzOut), z: this.wz(lxOut, lzOut) },
      in: { x: this.wx(lxIn, lzIn), z: this.wz(lxIn, lzIn) },
    });
  }

  // X осі бойымен (z тұрақты) немесе Z осі бойымен (x тұрақты) саңылаулары бар қабырға.
  // openings: [{at, w, y, h, kind}] — at: қабырға басынан қашықтық
  wall(axis, a0, a1, fixed, y0, h, t, mat, color, openings = [], o = {}) {
    const list = openings.slice().sort((p, q) => p.at - q.at);
    let cur = a0;
    const seg = (s0, s1, yb, hh) => {
      const len = s1 - s0;
      if (len < 0.02 || hh < 0.02) return;
      const mid = (s0 + s1) / 2;
      if (axis === 'x') this.box(mid, yb, fixed, len, hh, t, mat, color, o);
      else this.box(fixed, yb, mid, t, hh, len, mat, color, o);
    };
    for (const op of list) {
      const s0 = a0 + op.at - op.w / 2, s1 = a0 + op.at + op.w / 2;
      seg(cur, s0, y0, h);
      if (op.y > 0) seg(s0, s1, y0, op.y);
      const top = op.y + op.h;
      if (top < h) seg(s0, s1, y0 + top, h - top);
      if (op.kind === 'window') this.windowFrame(axis, (s0 + s1) / 2, fixed, y0 + op.y, op.w, op.h, t, op.frame || 0xf2f2ee, op.shutter);
      if (op.kind === 'door') this.doorFrame(axis, (s0 + s1) / 2, fixed, y0, op.w, op.h, t, op.frame || 0x6b4a2e, op.leaf);
      cur = s1;
    }
    seg(cur, a1, y0, h);
  }

  windowFrame(axis, a, fixed, y, w, h, t, color, shutterColor) {
    const fw = 0.08, depth = t + 0.08;
    const B = (lx, ly, lz, ww, hh, dd, col = color) => {
      if (axis === 'x') this.box(lx, ly, lz, ww, hh, dd, 'paint', col, { nc: true, cast: false });
      else this.box(lz, ly, lx, dd, hh, ww, 'paint', col, { nc: true, cast: false });
    };
    // axis === 'x' — a: x бойымен, fixed: z
    B(a, y - 0.06, fixed, w + 0.24, 0.08, depth + 0.1); // табалдырық
    B(a, y + h, fixed, w + 0.2, 0.1, depth);
    B(a - w / 2 + fw / 2, y, fixed, fw, h, depth);
    B(a + w / 2 - fw / 2, y, fixed, fw, h, depth);
    B(a, y + h * 0.55, fixed, w, 0.05, 0.05);
    B(a, y, fixed, 0.05, h, 0.05);
    // Әшекейлі маңдайша (наличник)
    B(a, y + h + 0.1, fixed, w + 0.3, 0.12, depth + 0.04);
    B(a, y + h + 0.22, fixed, w * 0.5, 0.1, depth + 0.02);
    if (shutterColor) {
      for (const sgn of [-1, 1]) {
        const sx = a + sgn * (w / 2 + w * 0.27);
        for (const side of [-1, 1]) {
          const off = side * (t / 2 + 0.03);
          if (axis === 'x') this.box(sx, y, fixed + off, w * 0.5, h, 0.04, 'wood', shutterColor, { nc: true, cast: false });
          else this.box(fixed + off, y, sx, 0.04, h, w * 0.5, 'wood', shutterColor, { nc: true, cast: false });
        }
      }
    }
  }

  doorFrame(axis, a, fixed, y, w, h, t, color, leaf = true) {
    const B = (lx, ly, lz, ww, hh, dd, mat = 'wood', col = color, nc = true) => {
      if (axis === 'x') this.box(lx, ly, lz, ww, hh, dd, mat, col, { nc, cast: false });
      else this.box(lz, ly, lx, dd, hh, ww, mat, col, { nc, cast: false });
    };
    B(a - w / 2 - 0.04, y, fixed, 0.1, h + 0.1, t + 0.08);
    B(a + w / 2 + 0.04, y, fixed, 0.1, h + 0.1, t + 0.08);
    B(a, y + h, fixed, w + 0.18, 0.12, t + 0.08);
    if (leaf) {
      // Ашық тұрған есік жапқышы
      const lx = a - w / 2 + 0.03, lz = fixed + t / 2 + w / 2;
      if (axis === 'x') this.box(lx, y + 0.02, lz, 0.05, h - 0.06, w - 0.05, 'wood', color, { nc: true, cast: false });
      else this.box(lz, y + 0.02, lx, w - 0.05, h - 0.06, 0.05, 'wood', color, { nc: true, cast: false });
    }
  }

  // Баспалдақ: (lx, lz) бастап dir бағытына ('+x','-x','+z','-z'), биіктігі rise, ені w
  stairs(lx, ly, lz, dir, rise, w, mat = 'concrete', color = 0xbdbdbd, stepH = 0.25) {
    const n = Math.max(2, Math.round(rise / stepH));
    const sh = rise / n;
    const run = 0.32;
    for (let i = 0; i < n; i++) {
      const top = sh * (i + 1);
      const off = run * i + run / 2;
      let x = lx, z = lz, ww = w, dd = run;
      if (dir === '+x') { x = lx + off; ww = run; dd = w; }
      if (dir === '-x') { x = lx - off; ww = run; dd = w; }
      if (dir === '+z') { z = lz + off; }
      if (dir === '-z') { z = lz - off; }
      this.box(x, ly + top - Math.min(top, 0.5), z, ww, Math.min(top, 0.5), dd, mat, color);
      // Баспалдақ астын толтыру (тек визуал)
      if (top > 0.5) this.box(x, ly, z, ww, top - 0.5, dd, mat, color, { nc: true, cast: false });
    }
    // Тұтқа
    return n * run;
  }

  railing(axis, a0, a1, fixed, y, color = 0x444444) {
    const len = Math.abs(a1 - a0), mid = (a0 + a1) / 2;
    const n = Math.max(2, Math.round(len / 1.2));
    if (axis === 'x') {
      this.box(mid, y + 0.95, fixed, len, 0.06, 0.06, 'paint', color, { nc: true, cast: false });
      this.box(mid, y + 0.5, fixed, len, 0.04, 0.04, 'paint', color, { nc: true, cast: false });
      for (let i = 0; i <= n; i++) this.box(a0 + (a1 - a0) * i / n, y, fixed, 0.05, 0.95, 0.05, 'paint', color, { nc: true, cast: false });
      this.collider(mid, y, fixed, len, 1.0, 0.1, 'metal', false);
    } else {
      this.box(fixed, y + 0.95, mid, 0.06, 0.06, len, 'paint', color, { nc: true, cast: false });
      this.box(fixed, y + 0.5, mid, 0.04, 0.04, len, 'paint', color, { nc: true, cast: false });
      for (let i = 0; i <= n; i++) this.box(fixed, y, a0 + (a1 - a0) * i / n, 0.05, 0.95, 0.05, 'paint', color, { nc: true, cast: false });
      this.collider(fixed, y, mid, 0.1, 1.0, len, 'metal', false);
    }
  }
}
