// Ғимараттар мен жиһаз үлгілері (префабтар).
import * as THREE from 'three';
import { Builder } from './builder.js';
import { cyl, uvBox, roundedBox } from '../gfx/geom.js';

const WALL_COLORS = [0xf4efe6, 0xf1e3c8, 0xdde8ee, 0xe9d7c7, 0xd8e4cf, 0xf5f0dc, 0xe6d3b3];
const SHUTTERS = [0x3f7fbf, 0x2f6f5f, 0x2e5b9a, 0x7a3b2e, 0x3f8fbf];
const ROOFS = [0x9a3f2a, 0x5a6f7f, 0x3f6f4f, 0x7a2f2f, 0x4f5a8a];

// ---------------- Жиһаз ----------------
export const Furn = {
  table(b, x, y, z, w = 1.2, d = 0.8, col = 0x8b5a2b) {
    b.box(x, y + 0.72, z, w, 0.05, d, 'wood', col, { nc: true });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(x + sx * (w / 2 - 0.06), y, z + sz * (d / 2 - 0.06), 0.06, 0.72, 0.06, 'wood', col, { nc: true, cast: false });
    b.collider(x, y, z, w, 0.77, d, 'wood');
  },
  chair(b, x, y, z, rot = 0, col = 0x6b4a2e) {
    b.box(x, y + 0.45, z, 0.44, 0.05, 0.44, 'wood', col, { nc: true, cast: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(x + sx * 0.18, y, z + sz * 0.18, 0.04, 0.45, 0.04, 'wood', col, { nc: true, cast: false });
    const bx = rot % 2 ? x + (rot === 1 ? 0.2 : -0.2) : x, bz = rot % 2 ? z : z + (rot === 0 ? 0.2 : -0.2);
    b.box(bx, y + 0.5, bz, rot % 2 ? 0.04 : 0.44, 0.45, rot % 2 ? 0.44 : 0.04, 'wood', col, { nc: true, cast: false });
  },
  bed(b, x, y, z, alongX = true, col = 0x7a5230, sheet = 0xe8e2d6) {
    const w = alongX ? 2.0 : 1.0, d = alongX ? 1.0 : 2.0;
    b.box(x, y, z, w, 0.35, d, 'wood', col);
    b.box(x, y + 0.35, z, w - 0.06, 0.18, d - 0.06, 'fabric', sheet, { nc: true });
    b.box(x + (alongX ? 0.3 : 0), y + 0.53, z + (alongX ? 0 : 0.3), alongX ? w * 0.65 : d * 0.9, 0.04, alongX ? d * 0.9 : d * 0.65, 'carpet', 0xffffff, { nc: true, cast: false, tile: 1.2 });
    const px = alongX ? x - w / 2 + 0.3 : x, pz = alongX ? z : z - d / 2 + 0.3;
    b.geo(roundedBox(alongX ? 0.4 : 0.7, 0.14, alongX ? 0.7 : 0.4, 0.06, 2), 'fabric', 0xffffff, px, y + 0.6, pz, 0, 0, 0, { cast: false });
    // Бас жағы
    if (alongX) b.box(x - w / 2 + 0.03, y, z, 0.06, 0.9, d, 'wood', col, { nc: true });
    else b.box(x, y, z - d / 2 + 0.03, w, 0.9, 0.06, 'wood', col, { nc: true });
  },
  wardrobe(b, x, y, z, alongX = true, col = 0x6b4226) {
    const w = alongX ? 1.4 : 0.6, d = alongX ? 0.6 : 1.4;
    b.box(x, y, z, w, 2.0, d, 'wood', col);
    b.box(x, y + 2.0, z, w + 0.06, 0.06, d + 0.06, 'wood', col, { nc: true, cast: false });
  },
  shelf(b, x, y, z, alongX = true, col = 0x7a5a3a, rng) {
    const w = alongX ? 1.6 : 0.45, d = alongX ? 0.45 : 1.6;
    for (let i = 0; i < 4; i++) b.box(x, y + 0.05 + i * 0.5, z, w, 0.04, d, 'wood', col, { nc: true, cast: false });
    for (const s of [-1, 1]) {
      if (alongX) b.box(x + s * (w / 2 - 0.02), y, z, 0.04, 1.8, d, 'wood', col, { nc: true, cast: false });
      else b.box(x, y, z + s * (d / 2 - 0.02), w, 1.8, 0.04, 'wood', col, { nc: true, cast: false });
    }
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
      if (rng.chance(0.35)) continue;
      const o = (k - 1) * 0.45;
      const bw = rng.float(0.15, 0.35), bh = rng.float(0.12, 0.35);
      b.box(x + (alongX ? o : 0), y + 0.09 + i * 0.5, z + (alongX ? 0 : o), alongX ? bw : 0.3, bh, alongX ? 0.3 : bw, rng.chance(0.5) ? 'crate' : 'paint', rng.pick([0xc9a26b, 0x9b3b3b, 0x3b6b9b, 0xdddddd]), { nc: true, cast: false });
    }
    b.collider(x, y, z, w, 1.8, d, 'wood');
  },
  sofa(b, x, y, z, alongX = true, col = 0x6d3b2a) {
    const w = alongX ? 2.0 : 0.85, d = alongX ? 0.85 : 2.0;
    b.geo(roundedBox(w, 0.45, d, 0.08, 2), 'fabric', col, x, y + 0.225, z);
    if (alongX) b.geo(roundedBox(w, 0.5, 0.2, 0.07, 2), 'fabric', col, x, y + 0.6, z - d / 2 + 0.1);
    else b.geo(roundedBox(0.2, 0.5, d, 0.07, 2), 'fabric', col, x - w / 2 + 0.1, y + 0.6, z);
    b.collider(x, y, z, w, 0.8, d, 'cloth');
  },
  fridge(b, x, y, z) {
    b.geo(roundedBox(0.7, 1.8, 0.65, 0.05, 2), 'paint', 0xf2f2f2, x, y + 0.9, z);
    b.collider(x, y, z, 0.7, 1.8, 0.65, 'metal');
  },
  stove(b, x, y, z) {
    b.box(x, y, z, 0.6, 0.85, 0.6, 'paint', 0xe8e8e8);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.geo(cyl(0.09, 0.09, 0.02, 10), 'flatMetal', 0x222222, x + sx * 0.14, y + 0.86, z + sz * 0.14, 0, 0, 0, { cast: false });
  },
  tv(b, x, y, z, alongX = true) {
    b.box(x, y, z, alongX ? 1.2 : 0.45, 0.5, alongX ? 0.45 : 1.2, 'wood', 0x3a2a1e);
    b.box(x, y + 0.5, z, alongX ? 1.0 : 0.06, 0.6, alongX ? 0.06 : 1.0, 'paint', 0x111111, { nc: true });
  },
  // Сандық — ою-өрнекті кебеже
  sandyk(b, x, y, z, alongX = true) {
    const w = alongX ? 1.1 : 0.6, d = alongX ? 0.6 : 1.1;
    b.box(x, y, z, w, 0.6, d, 'ornament', 0xffffff, { tile: 1.1 });
    b.box(x, y + 0.6, z, w + 0.04, 0.06, d + 0.04, 'wood', 0x5a2a1a, { nc: true });
    for (const s of [-0.3, 0.3]) {
      if (alongX) b.box(x + s * w, y - 0.01, z, 0.05, 0.63, d + 0.02, 'paint', 0xc8a24a, { nc: true, cast: false });
      else b.box(x, y - 0.01, z + s * d, w + 0.02, 0.63, 0.05, 'paint', 0xc8a24a, { nc: true, cast: false });
    }
  },
  rug(b, x, y, z, w, d) {
    b.box(x, y + 0.005, z, w, 0.02, d, 'carpet', 0xffffff, { nc: true, cast: false, tile: Math.max(w, d) });
  },
  wallRug(b, axis, a, fixed, y, w, h) {
    if (axis === 'x') b.box(a, y, fixed, w, h, 0.03, 'carpet', 0xffffff, { nc: true, cast: false, tile: Math.max(w, h) });
    else b.box(fixed, y, a, 0.03, h, w, 'carpet', 0xffffff, { nc: true, cast: false, tile: Math.max(w, h) });
  },
  crate(b, x, y, z, s = 1, col = 0xffffff) {
    b.box(x, y, z, s, s, s, 'crate', col, { tile: s });
  },
  barrel(b, x, y, z, col = 0x2f5f8f) {
    b.cyl(x, y, z, 0.32, 0.95, 'paint', col, { seg: 14, tile: 0, pm: 'metal' });
    b.geo(cyl(0.335, 0.335, 0.04, 14), 'flatMetal', 0x333333, x, y + 0.2, z, 0, 0, 0, { cast: false });
    b.geo(cyl(0.335, 0.335, 0.04, 14), 'flatMetal', 0x333333, x, y + 0.75, z, 0, 0, 0, { cast: false });
  },
};

// Бөлме жиһазы
function furnishRoom(b, rng, x0, x1, z0, z1, y, kind) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const w = x1 - x0, d = z1 - z0;
  if (w < 2.2 || d < 2.2) return;
  if (rng.chance(0.75)) Furn.rug(b, cx, y, cz, Math.min(w - 0.8, 3.2), Math.min(d - 0.8, 2.2));
  if (kind === 'living') {
    Furn.sofa(b, cx, y, z0 + 0.6, true, rng.pick([0x6d3b2a, 0x2f4f6f, 0x5a4a3a]));
    Furn.tv(b, cx, y, z1 - 0.35, true);
    if (rng.chance(0.7)) Furn.wallRug(b, 'x', cx, z0 + 0.14, y + 1.0, Math.min(2.2, w - 1), 1.4);
  } else if (kind === 'bed') {
    Furn.bed(b, x0 + 1.15, y, cz, true);
    Furn.wardrobe(b, x1 - 0.4, y, cz, false);
    if (rng.chance(0.6)) Furn.sandyk(b, x0 + 1.0, y, z1 - 0.45, true);
  } else if (kind === 'kitchen') {
    Furn.table(b, cx, y, cz, 1.2, 0.8);
    Furn.chair(b, cx - 0.4, y, cz + 0.65, 0); Furn.chair(b, cx + 0.4, y, cz - 0.65, 2);
    Furn.fridge(b, x0 + 0.45, y, z0 + 0.45);
    Furn.stove(b, x0 + 1.25, y, z0 + 0.4);
  } else if (kind === 'store') {
    Furn.shelf(b, x0 + 0.35, y, cz, false, 0x7a5a3a, rng);
    Furn.shelf(b, x1 - 0.35, y, cz, false, 0x7a5a3a, rng);
    Furn.crate(b, cx, y, cz, 0.8);
  } else {
    Furn.table(b, cx, y, cz, 1.4, 0.8, 0x5a3a24);
    Furn.chair(b, cx, y, cz + 0.6, 0);
    Furn.shelf(b, x1 - 0.35, y, cz, false, 0x7a5a3a, rng);
  }
}

// ---------------- Үй ----------------
// style: 'village' (ойық шатыр) | 'town' (жалпақ шатыр, парапет)
export function house(ctx, x, y, z, rot, o) {
  const rng = ctx.rng;
  const b = new Builder(ctx, x, y, z, rot, o.tier || 0);
  const W = o.w || 9, D = o.d || 7, floors = o.floors || 1, FH = 3.1, T = 0.22;
  const style = o.style || 'village';
  const wallMat = o.wallMat || (style === 'town' ? rng.pick(['plaster', 'brick', 'plaster']) : rng.pick(['plaster', 'plaster', 'brick', 'wood']));
  const wallCol = wallMat === 'plaster' ? (o.wallColor || rng.pick(WALL_COLORS)) : wallMat === 'wood' ? 0xd2b48c : 0xffffff;
  const shutter = style === 'village' ? rng.pick(SHUTTERS) : null;
  const frame = style === 'village' ? 0xf4f4f0 : 0xdedede;
  const hw = W / 2, hd = D / 2;
  ctx.terrain && ctx.terrain.flattenRect(b.wx(0, 0), b.wz(0, 0), b.rot % 2 ? D + 2 : W + 2, b.rot % 2 ? W + 2 : D + 2, y - 0.05, 5);

  // Іргетас
  b.box(0, -1.2, 0, W + 0.3, 1.32, D + 0.3, 'concrete', 0xb0aaa0);
  // Кіреберіс баспалдағы
  const doorX = o.doorX ?? (rng.chance(0.5) ? -hw * 0.35 : hw * 0.3);
  b.box(doorX, -0.15, hd + 0.55, 1.8, 0.27, 0.8, 'concrete', 0xa8a39a);
  b.door(doorX, hd + 2.2, doorX, hd - 1.2);
  if (o.backDoor !== false) b.door(-doorX * 0.5, -hd - 2.2, -doorX * 0.5, -hd + 1.2);

  const stairX = hw - 0.75;
  for (let f = 0; f < floors; f++) {
    const fy = 0.12 + f * FH;
    // Еден
    if (f === 0) b.box(0, 0, 0, W - 0.02, 0.12, D - 0.02, 'wood', 0xb08860);
    const winH = 1.25, winY = 0.95;
    const makeOpen = (len, door, isFront) => {
      const ops = [];
      const n = Math.max(1, Math.floor((len - 1.5) / 2.6));
      for (let i = 0; i < n; i++) {
        const at = (i + 0.5) * len / n;
        if (door && Math.abs(at - (door + len / 2)) < 1.6) continue;
        ops.push({ at, w: 1.1, y: winY, h: winH, kind: 'window', frame, shutter });
      }
      if (door !== null && door !== undefined) ops.push({ at: door + len / 2, w: 1.15, y: 0, h: 2.2, kind: 'door', frame: 0x6b4a2e });
      return ops;
    };
    // Алдыңғы (+z), артқы (-z), сол (-x), оң (+x)
    b.wall('x', -hw, hw, hd - T / 2, fy, FH, T, wallMat, wallCol, makeOpen(W, f === 0 ? doorX : null, true));
    b.wall('x', -hw, hw, -hd + T / 2, fy, FH, T, wallMat, wallCol, makeOpen(W, f === 0 && o.backDoor !== false ? -doorX * 0.5 : null));
    b.wall('z', -hd + T, hd - T, -hw + T / 2, fy, FH, T, wallMat, wallCol, makeOpen(D - 2 * T, null));
    b.wall('z', -hd + T, hd - T, hw - T / 2, fy, FH, T, wallMat, wallCol, makeOpen(D - 2 * T, null));
    // Ішкі қабырға есігімен
    const px = -hw + W * 0.45;
    b.wall('z', -hd + T, hd - T, px, fy, FH - 0.02, 0.12, 'plaster', 0xf0ece4, [{ at: (D - 2 * T) * 0.5, w: 1.0, y: 0, h: 2.1, kind: 'door', frame: 0x8a6a4a, leaf: false }]);
    // Бөлмелер
    const kinds = f === 0 ? ['living', 'kitchen'] : ['bed', 'store'];
    if (o.kind === 'shop' && f === 0) kinds[0] = 'store';
    furnishRoom(b, rng, -hw + T, px - 0.06, -hd + T, hd - T, fy, kinds[0]);
    if (floors > 1) furnishRoom(b, rng, px + 0.06, stairX - 0.7, -hd + T, hd - T, fy, kinds[1]);
    else furnishRoom(b, rng, px + 0.06, hw - T, -hd + T, hd - T, fy, kinds[1]);
    // Олжа
    b.loot(-hw * 0.5, fy, 0); b.loot(hw * 0.4, fy, hd * 0.4);
    if (rng.chance(0.5)) b.loot(-hw * 0.6, fy, -hd * 0.5);

    // Келесі қабат еденінің тақтасы (баспалдақ ойығымен)
    const ny = fy + FH;
    if (f < floors - 1) {
      b.box(-0.75, ny - 0.15, 0, W - 1.5 - 0.02, 0.15, D - 0.02, 'concrete', 0xd8d2c8);
      b.box(stairX, ny - 0.15, -hd + 0.5, 1.5, 0.15, 1.0, 'concrete', 0xd8d2c8);
      // Баспалдақ: +z бағытына көтеріледі, жоғарыда алаң
      const sl = b.stairs(stairX, fy, -hd + 1.0, '+z', FH, 1.2, 'wood', 0x9a7450);
      const zEnd = -hd + 1.0 + sl;
      if (zEnd < hd - 0.1) b.box(stairX, ny - 0.15, (zEnd + hd) / 2, 1.5, 0.15, hd - zEnd, 'concrete', 0xd8d2c8);
      b.box(stairX - 0.62, ny, -hd + 2.2, 0.05, 0.95, 0.05, 'paint', 0x333333, { nc: true });
    }
  }
  const topY = 0.12 + floors * FH;
  if (style === 'town') {
    b.box(0, topY - 0.15, 0, W, 0.2, D, 'concrete', 0xc8c2b8);
    // Парапет
    b.box(0, topY + 0.05, hd - 0.1, W, 0.6, 0.2, wallMat, wallCol);
    b.box(0, topY + 0.05, -hd + 0.1, W, 0.6, 0.2, wallMat, wallCol);
    b.box(-hw + 0.1, topY + 0.05, 0, 0.2, 0.6, D - 0.4, wallMat, wallCol);
    // Оң жақ парапетте баспалдаққа шығатын саңылау бар
    const gz0 = -hd + 0.2, gz1 = -hd + 1.3;
    b.box(hw - 0.1, topY + 0.05, (gz1 + hd - 0.2) / 2, 0.2, 0.6, hd - 0.2 - gz1, wallMat, wallCol);
    void gz0;
    // Шатыр үстіндегі бөлшектер
    b.box(-hw * 0.5, topY + 0.05, -hd * 0.4, 1.0, 0.8, 0.7, 'paint', 0xcfcfcf);
    b.geo(cyl(0.05, 0.05, 2.5, 6), 'flatMetal', 0x777777, -hw * 0.6, topY + 1.3, hd * 0.6);
    b.loot(-hw * 0.3, topY + 0.05, hd * 0.2, 1);
    // Шатырға шығатын сыртқы металл баспалдақ
    const n = Math.max(2, Math.round(topY / 0.25));
    const runLen = n * 0.32;
    b.stairs(hw + 0.6, 0, -hd + 1.2 + runLen, '-z', topY, 0.9, 'concrete', 0x9a9690);
    b.box(hw + 0.6, topY - 0.15, -hd + 0.7, 1.0, 0.15, 0.9, 'concrete', 0x9a9690);
  } else {
    // Ойық шатыр: X бойымен жотасы
    const rise = Math.min(2.4, D * 0.33);
    const ang = Math.atan2(rise, hd + 0.4);
    const slant = Math.sqrt((hd + 0.4) ** 2 + rise * rise);
    const roofCol = o.roofColor || rng.pick(ROOFS);
    const roofMat = rng.chance(0.6) ? 'roof' : 'metal';
    for (const s of [-1, 1]) {
      const g = uvBox(W + 0.7, 0.12, slant, 2.5);
      b.geo(g, roofMat, roofMat === 'roof' ? 0xffffff : roofCol, 0, topY + rise / 2 - 0.06, s * (hd + 0.4) / 2, s * ang, 0, 0);
      g.dispose();
    }
    // Ұшбұрышты қасбеттер
    const tri = new THREE.Shape();
    tri.moveTo(-hd, 0); tri.lineTo(hd, 0); tri.lineTo(0, rise); tri.closePath();
    const tg = new THREE.ExtrudeGeometry(tri, { depth: T, bevelEnabled: false });
    tg.translate(0, 0, -T / 2);
    for (const s of [-1, 1]) b.geo(tg, wallMat === 'brick' ? 'brick' : 'wood', wallMat === 'brick' ? 0xffffff : 0xc9a87a, s * (hw - T / 2), topY, 0, 0, Math.PI / 2, 0);
    tg.dispose();
    b.collider(0, topY, 0, W, rise * 0.7, D, 'wood', false);
    b.box(0, topY - 0.12, 0, W, 0.12, D, 'wood', 0xa08060, { nc: false, cast: false });
    // Мұржа
    b.box(-hw * 0.5, topY + rise * 0.4, -hd * 0.3, 0.6, rise * 0.9, 0.6, 'brick', 0xffffff, { nc: true });
  }
  // Сары газ құбыры — қазақ ауылдарының белгісі
  if (rng.chance(0.75)) {
    const gy = 2.4;
    b.geo(cyl(0.05, 0.05, W + 0.6, 8), 'paint', 0xf2c230, 0, gy, hd + 0.18, 0, 0, Math.PI / 2, { cast: false });
    b.geo(cyl(0.05, 0.05, gy + 1.2, 8), 'paint', 0xf2c230, hw + 0.3, (gy - 1.2) / 2, hd + 0.18, 0, 0, 0, { cast: false });
    b.geo(cyl(0.05, 0.05, 0.7, 8), 'paint', 0xf2c230, hw + 0.3, gy, hd + 0.18 - 0.35 + 0.35, Math.PI / 2, 0, 0, { cast: false });
  }
  // Кондиционер / спутник тақтасы
  if (style === 'town' && rng.chance(0.7)) b.box(-hw - 0.25, 2.3, 0, 0.4, 0.6, 0.9, 'paint', 0xeeeeee, { nc: true });
  if (rng.chance(0.4)) {
    const dish = new THREE.SphereGeometry(0.35, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.35);
    b.geo(dish, 'paint', 0xdddddd, hw - 0.6, topY + (style === 'town' ? 0.7 : 0.3), hd - 0.3, -0.9, 0.5, 0, { cast: false });
    dish.dispose();
  }
  // Есік үстіндегі шам
  b.box(doorX, 2.45, hd + 0.08, 0.18, 0.12, 0.12, 'lamp', 0xffffff, { nc: true, cast: false });
  return b;
}

// Шағын қора/сарай
export function shed(ctx, x, y, z, rot) {
  const b = new Builder(ctx, x, y, z, rot, 0);
  const W = 4, D = 3.4, H = 2.5, T = 0.12;
  ctx.terrain.flattenRect(x, z, W + 2, W + 2, y, 3);
  b.box(0, -0.8, 0, W, 0.9, D, 'concrete', 0xa0a0a0);
  b.wall('x', -W / 2, W / 2, D / 2 - T / 2, 0.1, H, T, 'wood', 0xb89870, [{ at: 1.2, w: 1.1, y: 0, h: 2.0, kind: 'door' }]);
  b.wall('x', -W / 2, W / 2, -D / 2 + T / 2, 0.1, H, T, 'wood', 0xb89870);
  b.wall('z', -D / 2 + T, D / 2 - T, -W / 2 + T / 2, 0.1, H, T, 'wood', 0xb89870, [{ at: 1.5, w: 0.7, y: 1.1, h: 0.6, kind: 'window' }]);
  b.wall('z', -D / 2 + T, D / 2 - T, W / 2 - T / 2, 0.1, H, T, 'wood', 0xb89870);
  const g = uvBox(W + 0.5, 0.08, D + 0.6, 2);
  b.geo(g, 'metal', 0x8a8f94, 0, H + 0.25, 0, 0.12, 0, 0);
  g.dispose();
  b.collider(0, H + 0.1, 0, W, 0.4, D, 'metal', false);
  Furn.crate(b, -1.2, 0.1, -1.0, 0.8);
  Furn.barrel(b, 1.3, 0.1, -1.0, 0x8a3a2a);
  b.loot(0, 0.1, 0);
  b.door(-W / 2 + 1.2, D / 2 + 1.5, -W / 2 + 1.2, D / 2 - 1);
  return b;
}

// Қойма (гофр металл)
export function warehouse(ctx, x, y, z, rot, o = {}) {
  const rng = ctx.rng;
  const b = new Builder(ctx, x, y, z, rot, o.tier || 1);
  const W = o.w || 22, D = o.d || 14, H = o.h || 7, T = 0.25;
  const col = o.color || rng.pick([0xc9ccd0, 0x9fb4c4, 0xc4b49f, 0xb8c4a8]);
  ctx.terrain.flattenRect(b.wx(0, 0), b.wz(0, 0), (b.rot % 2 ? D : W) + 3, (b.rot % 2 ? W : D) + 3, y - 0.05, 6);
  b.box(0, -1, 0, W + 0.4, 1.1, D + 0.4, 'concrete', 0xa9a49c);
  b.box(0, 0.1, 0, W - 0.1, 0.02, D - 0.1, 'concrete', 0x8f8f8f, { nc: true, cast: false });
  b.wall('x', -W / 2, W / 2, D / 2 - T / 2, 0.1, H, T, 'metal', col, [{ at: W / 2, w: 6, y: 0, h: 5, kind: 'none' }, { at: W * 0.15, w: 1.2, y: 0, h: 2.2, kind: 'door', leaf: false }]);
  b.wall('x', -W / 2, W / 2, -D / 2 + T / 2, 0.1, H, T, 'metal', col, [{ at: W * 0.8, w: 1.2, y: 0, h: 2.2, kind: 'door', leaf: false }, { at: W * 0.3, w: 2.5, y: 4.5, h: 1.2, kind: 'window', frame: 0x666666 }]);
  b.wall('z', -D / 2 + T, D / 2 - T, -W / 2 + T / 2, 0.1, H, T, 'metal', col, [{ at: D / 2, w: 3, y: 4.5, h: 1.2, kind: 'window', frame: 0x666666 }]);
  b.wall('z', -D / 2 + T, D / 2 - T, W / 2 - T / 2, 0.1, H, T, 'metal', col, [{ at: D / 2, w: 3, y: 4.5, h: 1.2, kind: 'window', frame: 0x666666 }]);
  // Үлкен жылжымалы қақпа (ашық тұр)
  b.box(W / 2 + 3.2 - 6 / 2 + 3, 0.1, D / 2 + 0.25, 6, 5, 0.1, 'metal', 0xb04a32, { cast: true });
  b.box(0, 5.1, D / 2 + 0.05, 6.4, 0.25, 0.4, 'paint', 0x555555, { nc: true });
  // Шатыр
  const rise = 1.6, half = D / 2 + 0.3;
  const ang = Math.atan2(rise, half), slant = Math.hypot(rise, half);
  for (const s of [-1, 1]) {
    const g = uvBox(W + 0.6, 0.1, slant, 3);
    b.geo(g, 'metal', 0x8b9096, 0, H + 0.1 + rise / 2, s * half / 2, s * ang, 0, 0);
    g.dispose();
  }
  const tri = new THREE.Shape();
  tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rise); tri.closePath();
  const tg = new THREE.ExtrudeGeometry(tri, { depth: T, bevelEnabled: false });
  tg.translate(0, 0, -T / 2);
  for (const s of [-1, 1]) b.geo(tg, 'metal', col, s * (W / 2 - T / 2), H + 0.1, 0, 0, Math.PI / 2, 0);
  tg.dispose();
  b.collider(0, H + 0.1, 0, W, rise * 0.8, D, 'metal', false);
  // Бағаналар мен арқалықтар
  for (let i = 1; i < 4; i++) {
    const px = -W / 2 + i * W / 4;
    b.box(px, H - 0.3, 0, 0.25, 0.3, D - 0.5, 'paint', 0x6a6a6a, { nc: true });
  }
  // Ішінде: жәшіктер, тауар сөрелері, асма жол
  const rackCol = 0x2f6fbf;
  for (const rz of [-D / 2 + 1.2, D / 2 - 3.6]) {
    for (let i = 0; i < 3; i++) {
      const rx = -W / 2 + 3 + i * 4.2;
      for (const lv of [0, 1.6, 3.2]) b.box(rx, 0.1 + lv, rz, 3.6, 0.08, 1.1, 'paint', 0xd07a2a, { nc: true, cast: false });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(rx + sx * 1.75, 0.1, rz + sz * 0.5, 0.08, 4.4, 0.08, 'paint', rackCol, { nc: true, cast: false });
      b.collider(rx, 0.1, rz, 3.6, 4.4, 1.1, 'metal', false);
      for (const lv of [0, 1.6, 3.2]) {
        if (rng.chance(0.25)) continue;
        Furn.crate(b, rx - 1 + rng.float(-0.2, 0.2), 0.18 + lv, rz, rng.float(0.8, 1.05));
        if (rng.chance(0.6)) Furn.crate(b, rx + 0.9, 0.18 + lv, rz, 0.9);
      }
      b.loot(rx, 0.1, rz + (rz < 0 ? 1.1 : -1.1));
    }
  }
  // Асма жол (екінші деңгей) баспалдағымен
  const cy = 3.4;
  b.box(W / 2 - 1.4, cy, -1.5, 2.4, 0.15, D - 4, 'paint', 0x555b60);
  b.railing('z', -D / 2 + 1, D / 2 - 4, W / 2 - 2.6, cy + 0.15);
  b.stairs(W / 2 - 1.4, 0.1, D / 2 - 3.2 + 0.32 * 14, '-z', cy + 0.05, 1.1, 'paint', 0x555b60);
  b.loot(W / 2 - 1.4, cy + 0.15, -D / 2 + 2, 1);
  // Тиегіш (погрузчик)
  forklift(b, -W / 2 + 4, 0.1, 1.2);
  b.door(0, D / 2 + 3, 0, D / 2 - 3);
  b.door(-W / 2 + W * 0.8, -D / 2 - 2, -W / 2 + W * 0.8, -D / 2 + 2);
  return b;
}

function forklift(b, x, y, z) {
  b.box(x, y + 0.3, z, 1.2, 0.9, 2.0, 'paint', 0xf2b01e);
  b.box(x, y + 1.2, z + 0.2, 1.1, 1.0, 1.0, 'paint', 0x222222, { nc: true });
  b.box(x, y + 2.2, z + 0.2, 1.2, 0.06, 1.1, 'paint', 0xf2b01e, { nc: true });
  b.box(x, y, z - 1.4, 0.9, 2.5, 0.12, 'flatMetal', 0x333333, { nc: true });
  for (const s of [-0.3, 0.3]) b.box(x + s, y, z - 1.9, 0.12, 0.08, 1.0, 'flatMetal', 0x333333, { nc: true });
  for (const sx of [-0.62, 0.62]) for (const sz of [-0.6, 0.6]) b.geo(cyl(0.3, 0.3, 0.25, 12), 'flat', 0x1a1a1a, x + sx, y + 0.3, z + sz, 0, 0, Math.PI / 2);
}

// Жүк контейнері; open — бір ұшы ашық
export function container(ctx, x, y, z, rot, color, open = false, tier = 1) {
  const b = new Builder(ctx, x, y, z, rot, tier);
  const L = 6.0, W = 2.44, H = 2.6, T = 0.08;
  if (!open) {
    b.box(0, 0, 0, L, H, W, 'metal', color, { tile: 2.4 });
  } else {
    b.box(0, 0, 0, L, 0.12, W, 'metal', 0x555555, { tile: 2.4 });
    b.box(0, H - 0.1, 0, L, 0.1, W, 'metal', color, { tile: 2.4 });
    b.box(0, 0, W / 2 - T / 2, L, H, T, 'metal', color, { tile: 2.4 });
    b.box(0, 0, -W / 2 + T / 2, L, H, T, 'metal', color, { tile: 2.4 });
    b.box(-L / 2 + T / 2, 0, 0, T, H, W - 2 * T, 'metal', color, { tile: 2.4 });
    // Ашық есіктер
    b.box(L / 2 + 0.6, 0.05, W / 2 + 0.05, 1.2, H - 0.1, 0.05, 'metal', color, { nc: true, tile: 2.4, ry: 0 });
    b.box(L / 2 + 0.6, 0.05, -W / 2 - 0.05, 1.2, H - 0.1, 0.05, 'metal', color, { nc: true, tile: 2.4 });
    b.loot(-1, 0.12, 0);
    Furn.crate(b, -2.2, 0.12, 0.5, 0.8);
  }
  // Бұрыш құймалары
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [0, H - 0.18]) b.box(sx * (L / 2 - 0.09), sy, sz * (W / 2 - 0.09), 0.18, 0.18, 0.18, 'paint', 0x3a3a3a, { nc: true, cast: false });
  return b;
}

// Күзет мұнарасы
export function watchtower(ctx, x, y, z, rot, h = 7) {
  const b = new Builder(ctx, x, y, z, rot, 2);
  const S = 3.2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (S / 2 - 0.12), 0, sz * (S / 2 - 0.12), 0.22, h + 2.6, 0.22, 'wood', 0x7a5a3a, { pm: 'wood' });
  // Қиғаш тіректер (визуал)
  for (const s of [-1, 1]) {
    b.geo(uvBox(0.1, Math.hypot(S, h * 0.5), 0.1, 1), 'wood', 0x6a4a2a, 0, h * 0.25 + 0.5, s * (S / 2 - 0.12), Math.atan2(S, h * 0.5) * 0, 0, Math.atan2(S, h * 0.5) * s);
  }
  b.box(0, h, 0, S + 0.4, 0.2, S + 0.4, 'wood', 0x8a6a4a);
  for (const [ax, f] of [['x', S / 2 + 0.15], ['x', -S / 2 - 0.15], ['z', S / 2 + 0.15], ['z', -S / 2 - 0.15]]) {
    if (ax === 'x') b.box(0, h + 0.2, f, S + 0.4, 1.0, 0.1, 'wood', 0x8a6a4a, { walk: false });
    else b.box(f, h + 0.2, 0, 0.1, 1.0, S + 0.4, 'wood', 0x8a6a4a, { walk: false });
  }
  const g = uvBox(S + 1.2, 0.1, S + 1.2, 2);
  b.geo(g, 'metal', 0x6a7a6a, 0, h + 2.6, 0, 0.08, 0, 0);
  g.dispose();
  b.collider(0, h + 2.5, 0, S + 1.0, 0.25, S + 1.0, 'metal', false);
  // Прожектор
  b.box(S / 2 - 0.3, h + 1.2, S / 2 - 0.3, 0.3, 0.3, 0.4, 'paint', 0x333333, { nc: true });
  // Сыртқы баспалдақ
  const run = b.stairs(-S / 2 - 0.65, 0, S / 2 + h / 0.25 * 0.32 - 0.1, '-z', h, 0.9, 'wood', 0x8a6a4a);
  b.box(-S / 2 - 0.65, h - 0.2, S / 2 - 0.3, 0.9, 0.2, 1.2, 'wood', 0x8a6a4a);
  b.loot(0, h + 0.2, 0, 1);
  return b;
}

// Киіз үй
export function yurt(ctx, x, y, z, doorAngle, rich = false) {
  const b = new Builder(ctx, x, y, z, 0, rich ? 1 : 0);
  const R = rich ? 3.6 : 3.1, WH = 1.75, TOP = rich ? 3.9 : 3.5;
  ctx.terrain.flattenRect(x, z, R * 2 + 1, R * 2 + 1, y, 3);
  // Еден: текемет/кілем
  const floor = new THREE.CircleGeometry(R - 0.1, 24);
  floor.rotateX(-Math.PI / 2);
  b.geo(floor, 'carpet', 0xffffff, 0, 0.04, 0, 0, 0, 0, { cast: false });
  floor.dispose();
  b.ctx.col.addCyl(x, z, R - 0.05, y - 1, y + 0.03, 'cloth', true);
  // Кереге (қабырға) — сырты киіз, есікке саңылау
  const gap = 0.55 / R * 1.6;
  const wallG = new THREE.CylinderGeometry(R, R, WH, 36, 1, true, doorAngle + gap + Math.PI / 2, Math.PI * 2 - gap * 2);
  // three.js цилиндр бұрышы: theta=0 → +z. atan2 бұрышымен сәйкестендіру
  b.geo(wallG, 'felt', 0xffffff, 0, WH / 2, 0, 0, 0, 0);
  // Ішкі кереге торы (қызыл ағаш)
  const inner = new THREE.CylinderGeometry(R - 0.06, R - 0.06, WH, 36, 1, true, doorAngle + gap + Math.PI / 2, Math.PI * 2 - gap * 2);
  const iu = inner.attributes.uv;
  for (let i = 0; i < iu.count; i++) iu.setXY(i, iu.getX(i) * (Math.PI * 2 * R) / 1.6, iu.getY(i) * WH / 1.6);
  b.geo(inner, 'kerege', 0xffffff, 0, WH / 2, 0, 0, 0, 0, { cast: false });
  wallG.dispose(); inner.dispose();
  // Өрнекті белдеу
  const band = new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.35, 36, 1, true, doorAngle + gap + Math.PI / 2, Math.PI * 2 - gap * 2);
  const uv = band.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * R * 5);
  b.geo(band, 'ornament', 0xffffff, 0, WH - 0.2, 0, 0, 0, 0, { cast: false });
  band.dispose();
  // Күмбез (уық + туырлық)
  const dome = new THREE.CylinderGeometry(0.75, R + 0.08, TOP - WH, 36, 3, true);
  const dp = dome.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const yy = dp.getY(i) / (TOP - WH) + 0.5;
    const bulge = Math.sin(yy * Math.PI) * 0.15;
    const xx = dp.getX(i), zz = dp.getZ(i), l = Math.hypot(xx, zz);
    if (l > 0) { dp.setX(i, xx * (1 + bulge / l)); dp.setZ(i, zz * (1 + bulge / l)); }
  }
  dome.computeVertexNormals();
  b.geo(dome, 'felt', 0xf6f0e2, 0, WH + (TOP - WH) / 2, 0);
  const domeIn = dome.clone(); domeIn.scale(0.97, 0.98, 0.97);
  const du = domeIn.attributes.uv;
  for (let i = 0; i < du.count; i++) du.setX(i, du.getX(i) * 9);
  b.geo(domeIn, 'uyk', 0xffffff, 0, WH + (TOP - WH) / 2 - 0.03, 0, 0, 0, 0, { cast: false });
  dome.dispose(); domeIn.dispose();
  // Шаңырақ
  const ring = new THREE.TorusGeometry(0.75, 0.08, 6, 24);
  ring.rotateX(Math.PI / 2);
  b.geo(ring, 'wood', 0x8b4513, 0, TOP, 0);
  ring.dispose();
  for (const a of [0, Math.PI / 2]) {
    for (const o of [-0.18, 0.18]) {
      const bar = uvBox(1.5, 0.06, 0.06, 1);
      b.geo(bar, 'wood', 0x8b4513, Math.cos(a + Math.PI / 2) * o, TOP + 0.1, Math.sin(a + Math.PI / 2) * o, 0, a, 0, { cast: false });
      bar.dispose();
    }
  }
  // Есік (сырлы, өрнекті)
  const dx = Math.cos(doorAngle) * (R + 0.02), dz = Math.sin(doorAngle) * (R + 0.02);
  const ry = -doorAngle + Math.PI / 2;
  b.geo(uvBox(1.15, 1.6, 0.12, 1), 'ornament', 0xffffff, dx, 0, dz, 0, ry, 0, { cast: false });
  b.geo(uvBox(1.35, 0.12, 0.2, 1), 'wood', 0x7a2a1a, dx, 1.6, dz, 0, ry, 0);
  for (const s of [-1, 1]) {
    const px = dx + Math.cos(doorAngle + Math.PI / 2) * 0.62 * s, pz = dz + Math.sin(doorAngle + Math.PI / 2) * 0.62 * s;
    b.geo(uvBox(0.12, 1.7, 0.2, 1), 'wood', 0x7a2a1a, px, 0, pz, 0, ry, 0);
  }
  // Есік ашық — ішке қарай қайырылған
  b.ctx.col.addRing(x, z, R - 0.05, 0.15, y, y + WH + 0.5, doorAngle, gap * 1.0, 'gap', 'cloth');
  // Ішкі жабдық: сандық, дастарқан, көрпелер
  const ix = -Math.cos(doorAngle) * (R - 0.9), iz = -Math.sin(doorAngle) * (R - 0.9);
  b.geo(uvBox(1.2, 0.6, 0.6, 1.1), 'ornament', 0xffffff, ix, 0.04, iz, 0, ry, 0);
  for (let k = 0; k < 4; k++) b.geo(roundedBox(1.3, 0.12, 0.6, 0.05, 1), 'fabric', [0xb22222, 0x1e5aa8, 0x2e8b57, 0xdaa520][k], ix, 0.68 + k * 0.13, iz, 0, ry, 0, { cast: false });
  const tbl = new THREE.CylinderGeometry(0.6, 0.6, 0.06, 18);
  b.geo(tbl, 'wood', 0x6b3a1e, 0, 0.32, 0);
  b.geo(cyl(0.05, 0.05, 0.28, 6), 'wood', 0x6b3a1e, 0, 0.04, 0);
  tbl.dispose();
  for (let k = 0; k < 4; k++) {
    const a = doorAngle + Math.PI / 2 + k * Math.PI / 2 + 0.4;
    b.geo(roundedBox(0.5, 0.12, 0.5, 0.05, 1), 'fabric', [0xb22222, 0x1e5aa8, 0x6a0dad, 0xdaa520][k], Math.cos(a) * 1.3, 0.1, Math.sin(a) * 1.3, 0, a, 0, { cast: false });
  }
  b.loot(Math.cos(doorAngle + 2.2) * 1.6, 0.04, Math.sin(doorAngle + 2.2) * 1.6);
  if (rich) b.loot(Math.cos(doorAngle - 2.2) * 1.6, 0.04, Math.sin(doorAngle - 2.2) * 1.6, 1);
  b.door(Math.cos(doorAngle) * (R + 2), Math.sin(doorAngle) * (R + 2), Math.cos(doorAngle) * (R - 1.2), Math.sin(doorAngle) * (R - 1.2));
  return b;
}

// Қызыл ағаш амбар (орақ қоймасы)
export function barn(ctx, x, y, z, rot) {
  const rng = ctx.rng;
  const b = new Builder(ctx, x, y, z, rot, 0);
  const W = 12, D = 9, H = 4.5, T = 0.2;
  ctx.terrain.flattenRect(b.wx(0, 0), b.wz(0, 0), W + 3, W + 3, y - 0.05, 5);
  b.box(0, -0.8, 0, W + 0.2, 0.9, D + 0.2, 'concrete', 0x9a9a9a);
  b.box(0, 0.1, 0, W, 0.05, D, 'hay', 0xd8c080, { nc: true, cast: false });
  const col = 0xa8382a;
  b.wall('x', -W / 2, W / 2, D / 2 - T / 2, 0.1, H, T, 'wood', col, [{ at: W / 2, w: 3.6, y: 0, h: 3.6, kind: 'none' }]);
  b.wall('x', -W / 2, W / 2, -D / 2 + T / 2, 0.1, H, T, 'wood', col, [{ at: W / 2, w: 1.2, y: 0, h: 2.2, kind: 'door', leaf: false }]);
  b.wall('z', -D / 2 + T, D / 2 - T, -W / 2 + T / 2, 0.1, H, T, 'wood', col, [{ at: D / 2, w: 1.0, y: 2.0, h: 1.0, kind: 'window' }]);
  b.wall('z', -D / 2 + T, D / 2 - T, W / 2 - T / 2, 0.1, H, T, 'wood', col, [{ at: D / 2, w: 1.0, y: 2.0, h: 1.0, kind: 'window' }]);
  // Ақ жиектер (Х тәрізді қақпа)
  for (const s of [-1, 1]) b.box(s * 2.6, 0.1, D / 2 + 0.05, 1.8, 3.4, 0.08, 'wood', col, { nc: true });
  for (const s of [-1, 1]) b.geo(uvBox(0.12, 3.7, 0.04, 1), 'paint', 0xf4f4f4, s * 2.6, 1.8, D / 2 + 0.1, 0, 0, 0.5);
  // Шатыр
  const rise = 3.0, half = D / 2 + 0.4;
  const ang = Math.atan2(rise, half), slant = Math.hypot(rise, half);
  for (const s of [-1, 1]) b.geo(uvBox(W + 0.6, 0.12, slant, 2.5), 'metal', 0x5a5f66, 0, H + 0.1 + rise / 2, s * half / 2, s * ang, 0, 0);
  const tri = new THREE.Shape();
  tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rise); tri.closePath();
  const tg = new THREE.ExtrudeGeometry(tri, { depth: T, bevelEnabled: false });
  tg.translate(0, 0, -T / 2);
  for (const s of [-1, 1]) b.geo(tg, 'wood', col, s * (W / 2 - T / 2), H + 0.1, 0, 0, Math.PI / 2, 0);
  tg.dispose();
  b.collider(0, H + 0.1, 0, W, rise * 0.7, D, 'wood', false);
  // Пішен шөмелелері ішінде
  for (let i = 0; i < 4; i++) b.box(-W / 2 + 1.2 + i * 1.3, 0.1, -D / 2 + 1.0, 1.2, 0.9, 1.4, 'hay', 0xffffff, { tile: 1.2 });
  b.box(-W / 2 + 1.8, 1.0, -D / 2 + 1.0, 1.2, 0.9, 1.4, 'hay', 0xffffff, { tile: 1.2 });
  // Асма еден (шөп қоймасы)
  b.box(W / 2 - 2.2, 2.6, 0, 4.2, 0.15, D - 0.6, 'wood', 0x8a6a4a);
  b.stairs(W / 2 - 4.7, 0.1, D / 2 - 1.2, '-z', 2.6, 0.9, 'wood', 0x8a6a4a);
  b.loot(W / 2 - 2.2, 2.75, 0, 1);
  b.loot(-2, 0.1, 1); b.loot(2, 0.1, -2);
  b.door(0, D / 2 + 3, 0, D / 2 - 2);
  return b;
}

// Ангар (жарты цилиндр)
export function hangar(ctx, x, y, z, rot) {
  const b = new Builder(ctx, x, y, z, rot, 2);
  const L = 24, R = 7;
  ctx.terrain.flattenRect(b.wx(0, 0), b.wz(0, 0), L + 4, L + 4, y - 0.05, 6);
  b.box(0, -1, 0, R * 2 + 1, 1.1, L + 1, 'concrete', 0x9a9a92);
  const shell = new THREE.CylinderGeometry(R, R, L, 28, 1, true, -Math.PI / 2, Math.PI);
  const uv = shell.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * R / 3 * 4, uv.getY(i) * L / 3);
  shell.rotateX(-Math.PI / 2);
  b.geo(shell, 'metal', 0x7f8a72, 0, 0.1, 0);
  const shellIn = shell.clone(); shellIn.scale(0.985, 0.985, 1);
  const ix = shellIn.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; }
  shellIn.computeVertexNormals();
  b.geo(shellIn, 'metal', 0x5a6252, 0, 0.1, 0, 0, 0, 0, { cast: false });
  shell.dispose(); shellIn.dispose();
  // Соқтығысу: қабырғаларды сатылы қораптармен жуықтау
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const a0 = i / steps * Math.PI / 2, a1 = (i + 1) / steps * Math.PI / 2;
    const xo = R * Math.cos(a0), y0 = R * Math.sin(a0), y1 = R * Math.sin(a1);
    for (const s of [-1, 1]) b.collider(s * (xo - 0.15), 0.1 + y0, 0, 0.35, y1 - y0 + 0.05, L, 'metal', false);
  }
  b.collider(0, R - 0.2, 0, R * 0.9, 0.4, L, 'metal', false);
  // Артқы қабырға
  b.box(0, 0.1, -L / 2 + 0.15, R * 2, R - 0.3, 0.3, 'metal', 0x6f7a62);
  // Ішінде: ұшақ қанаты емес — әскери жүк көлігі мен жәшіктер
  vehicle(b, 'truck', -2.5, 0.1, 2, 0);
  for (let i = 0; i < 5; i++) Furn.crate(b, 3.5, 0.1, -L / 2 + 2 + i * 1.2, 1.0, 0x9aa67a);
  Furn.crate(b, 3.5, 1.1, -L / 2 + 2.6, 1.0, 0x9aa67a);
  Furn.barrel(b, -5, 0.1, -L / 2 + 1.5, 0x3a5a2a); Furn.barrel(b, -4.2, 0.1, -L / 2 + 1.3, 0x3a5a2a);
  b.loot(0, 0.1, -3, 1); b.loot(3, 0.1, 6, 1); b.loot(-4, 0.1, -8, 0);
  b.door(0, L / 2 + 3, 0, L / 2 - 3);
  return b;
}

// Құмды қаптар қабырғасы
export function sandbags(ctx, b, x, y, z, len, alongX = true, rows = 3) {
  const n = Math.round(len / 0.62);
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
    const o = -len / 2 + (i + 0.5 + (r % 2) * 0.5) * (len / n);
    if (r % 2 && i === n - 1) continue;
    const g = roundedBox(0.6, 0.24, 0.38, 0.1, 1);
    b.geo(g, 'burlap', 0xd8c8a0, alongX ? x + o : x, y + 0.12 + r * 0.23, alongX ? z : z + o, 0, alongX ? 0 : Math.PI / 2, 0, { cast: true });
    g.dispose();
  }
  b.collider(x, y, z, alongX ? len : 0.45, rows * 0.23 + 0.05, alongX ? 0.45 : len, 'sand', true);
}

// Көліктер (статикалық)
export function vehicle(b, kind, x, y, z, ry = 0) {
  const geoBox = (w, h, d, lx, ly, lz, mat, col) => {
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const g = roundedBox(w, h, d, Math.min(0.08, h / 3), 2);
    b.geo(g, mat, col, x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs, 0, ry, 0);
    g.dispose();
  };
  const wheel = (lx, lz, r, wdt) => {
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const g = new THREE.CylinderGeometry(r, r, wdt, 14);
    g.rotateZ(Math.PI / 2);
    b.geo(g, 'flat', 0x161616, x + lx * cs + lz * sn, y + r, z - lx * sn + lz * cs, 0, ry, 0);
    const hub = new THREE.CylinderGeometry(r * 0.5, r * 0.5, wdt + 0.02, 10);
    hub.rotateZ(Math.PI / 2);
    b.geo(hub, 'flatMetal', 0x9a9a9a, x + lx * cs + lz * sn, y + r, z - lx * sn + lz * cs, 0, ry, 0, { cast: false });
    g.dispose(); hub.dispose();
  };
  const colAxis = Math.abs(Math.sin(ry)) > 0.7;
  if (kind === 'car') {
    const col = b.ctx.rng.pick([0xe8e8e8, 0x2a2a2a, 0x9a1a1a, 0x1a4a8a, 0xc0c0c0, 0x3a5a3a]);
    geoBox(1.8, 0.7, 4.2, 0, 0.45, 0, 'paint', col);
    geoBox(1.6, 0.6, 2.2, 0, 1.1, -0.2, 'paint', col);
    geoBox(1.62, 0.45, 2.0, 0, 1.15, -0.2, 'glass', 0x9fb6c8);
    for (const sx of [-0.85, 0.85]) for (const sz of [-1.35, 1.35]) wheel(sx, sz, 0.34, 0.24);
    geoBox(1.5, 0.12, 0.1, 0, 0.55, 2.12, 'lamp', 0xffffff);
    geoBox(1.5, 0.12, 0.1, 0, 0.6, -2.12, 'emissiveRed', 0xffffff);
    b.ctx.col.addBox(b.wx(x, z) - (colAxis ? 2.1 : 0.9), b.oy + y, b.wz(x, z) - (colAxis ? 0.9 : 2.1), b.wx(x, z) + (colAxis ? 2.1 : 0.9), b.oy + y + 1.4, b.wz(x, z) + (colAxis ? 0.9 : 2.1), 'metal', true);
  } else if (kind === 'jeep') {
    const col = 0x56603e;
    geoBox(2.0, 0.9, 4.4, 0, 0.55, 0, 'camo', 0xffffff);
    geoBox(1.9, 0.8, 1.8, 0, 1.4, -0.3, 'camo', 0xffffff);
    geoBox(1.92, 0.5, 1.6, 0, 1.5, -0.3, 'glass', 0x8a9a8a);
    geoBox(0.9, 0.9, 0.3, 0, 0.9, -2.3, 'flat', 0x222222);
    for (const sx of [-0.95, 0.95]) for (const sz of [-1.4, 1.4]) wheel(sx, sz, 0.45, 0.32);
    b.ctx.col.addBox(b.wx(x, z) - (colAxis ? 2.2 : 1.0), b.oy + y, b.wz(x, z) - (colAxis ? 1.0 : 2.2), b.wx(x, z) + (colAxis ? 2.2 : 1.0), b.oy + y + 1.9, b.wz(x, z) + (colAxis ? 1.0 : 2.2), 'metal', true);
    void col;
  } else if (kind === 'truck') {
    geoBox(2.4, 1.6, 2.2, 0, 0.8, 2.6, 'camo', 0xffffff);
    geoBox(2.3, 0.7, 1.0, 0, 1.6, 2.0, 'glass', 0x8a9a8a);
    geoBox(2.4, 0.3, 5.0, 0, 0.8, -1.2, 'paint', 0x3a4030);
    const tarp = new THREE.CylinderGeometry(1.2, 1.2, 4.8, 12, 1, true, -Math.PI / 2, Math.PI);
    tarp.rotateX(Math.PI / 2); tarp.rotateZ(Math.PI / 2);
    b.geo(tarp, 'fabric', 0x5a6040, x, y + 1.6, z - 1.2, 0, ry, 0);
    tarp.dispose();
    geoBox(2.4, 0.9, 4.8, 0, 1.1, -1.2, 'camo', 0xffffff);
    for (const sx of [-1.05, 1.05]) for (const sz of [2.4, -0.6, -2.6]) wheel(sx, sz, 0.55, 0.4);
    b.ctx.col.addBox(b.wx(x, z) - (colAxis ? 4 : 1.2), b.oy + y, b.wz(x, z) - (colAxis ? 1.2 : 4), b.wx(x, z) + (colAxis ? 4 : 1.2), b.oy + y + 2.6, b.wz(x, z) + (colAxis ? 1.2 : 4), 'metal', true);
  } else if (kind === 'tractor') {
    geoBox(1.4, 1.0, 2.4, 0, 0.9, 0.5, 'paint', 0x2f8a3a);
    geoBox(1.3, 1.3, 1.2, 0, 1.6, -0.6, 'glass', 0x9fb6c8);
    geoBox(1.4, 0.08, 1.4, 0, 2.3, -0.6, 'paint', 0x2f8a3a);
    const cs = Math.cos(ry), sn = Math.sin(ry);
    for (const sx of [-0.85, 0.85]) {
      const g = new THREE.CylinderGeometry(0.75, 0.75, 0.45, 16); g.rotateZ(Math.PI / 2);
      b.geo(g, 'flat', 0x161616, x + sx * cs + -0.7 * sn, y + 0.75, z - sx * sn + -0.7 * cs, 0, ry, 0); g.dispose();
    }
    for (const sx of [-0.7, 0.7]) wheel(sx, 1.3, 0.4, 0.3);
    b.ctx.col.addBox(b.wx(x, z) - 1.5, b.oy + y, b.wz(x, z) - 1.5, b.wx(x, z) + 1.5, b.oy + y + 2.3, b.wz(x, z) + 1.5, 'metal', true);
  }
}

export function fence(b, x0, z0, x1, z1, y, col = 0x8a6a4a, gapAt = -1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 2));
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    b.box(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, 0.1, 1.1, 0.1, 'wood', col, { nc: true });
  }
  for (let i = 0; i < n; i++) {
    if (i === gapAt) continue;
    const t = (i + 0.5) / n;
    const cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t;
    for (const h of [0.35, 0.8]) b.box(cx, y + h, cz, alongX ? len / n : 0.05, 0.1, alongX ? 0.05 : len / n, 'wood', col, { nc: true, cast: false });
    b.collider(cx, y, cz, alongX ? len / n : 0.12, 1.0, alongX ? 0.12 : len / n, 'wood', false);
  }
}

export function lampPost(b, x, y, z) {
  b.cyl(x, y, z, 0.08, 4.5, 'paint', 0x3a3a3a, { seg: 8, tile: 0, rt: 0.06 });
  b.box(x + 0.5, y + 4.4, z, 1.1, 0.08, 0.08, 'paint', 0x3a3a3a, { nc: true, cast: false });
  b.box(x + 1.0, y + 4.25, z, 0.35, 0.15, 0.22, 'lamp', 0xffffff, { nc: true, cast: false });
}

export function bench(b, x, y, z, alongX = true) {
  b.box(x, y + 0.42, z, alongX ? 1.8 : 0.45, 0.06, alongX ? 0.45 : 1.8, 'wood', 0x8a5a32, { nc: true });
  b.box(x + (alongX ? 0 : -0.2), y + 0.5, z + (alongX ? -0.2 : 0), alongX ? 1.8 : 0.06, 0.4, alongX ? 0.06 : 1.8, 'wood', 0x8a5a32, { nc: true, cast: false });
  for (const s of [-0.75, 0.75]) b.box(x + (alongX ? s : 0), y, z + (alongX ? 0 : s), alongX ? 0.08 : 0.4, 0.42, alongX ? 0.4 : 0.08, 'paint', 0x2a2a2a, { nc: true, cast: false });
  b.collider(x, y, z, alongX ? 1.8 : 0.5, 0.5, alongX ? 0.5 : 1.8, 'wood');
}

export function haystack(b, x, y, z, r = 1.3) {
  const g = new THREE.CylinderGeometry(r * 0.9, r, r * 1.3, 14, 2);
  b.geo(g, 'hay', 0xffffff, x, y + r * 0.65, z);
  const top = new THREE.SphereGeometry(r * 0.9, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  b.geo(top, 'hay', 0xffffff, x, y + r * 1.3, z);
  g.dispose(); top.dispose();
  b.ctx.col.addCyl(b.wx(x, z), b.wz(x, z), r, b.oy + y, b.oy + y + r * 2.1, 'cloth', true);
}

export function electricPole(b, x, y, z) {
  b.cyl(x, y, z, 0.14, 8, 'wood', 0x6a5440, { seg: 8, tile: 0, rt: 0.11, pm: 'wood' });
  b.box(x, y + 7.4, z, 2.2, 0.12, 0.12, 'wood', 0x6a5440, { nc: true, cast: false });
  for (const s of [-0.9, 0, 0.9]) b.geo(cyl(0.05, 0.05, 0.16, 6), 'paint', 0xdedede, x + s, y + 7.55, z, 0, 0, 0, { cast: false });
}

export function campfire(b, x, y, z) {
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    b.geo(new THREE.DodecahedronGeometry(0.18, 0), 'rock', 0x9a9a9a, x + Math.cos(a) * 0.55, y + 0.08, z + Math.sin(a) * 0.55, a, a, 0, { cast: false });
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + 0.3;
    const g = cyl(0.06, 0.07, 0.9, 6);
    b.geo(g, 'bark', 0xffffff, x + Math.cos(a) * 0.15, y + 0.3, z + Math.sin(a) * 0.15, 0, -a, 0.9);
    g.dispose();
  }
  // Қазан
  const kazan = new THREE.SphereGeometry(0.4, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  b.geo(kazan, 'flatMetal', 0x2a2a2a, x, y + 0.75, z);
  kazan.dispose();
  b.geo(new THREE.TorusGeometry(0.4, 0.03, 6, 18), 'flatMetal', 0x2a2a2a, x, y + 0.75, z, Math.PI / 2, 0, 0, { cast: false });
  for (const s of [-1, 1]) b.geo(cyl(0.03, 0.03, 1.1, 5), 'wood', 0x4a3a2a, x + s * 0.55, y + 0.55, z, 0, 0, s * 0.2, { cast: false });
}
