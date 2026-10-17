// Procedural "AI result" illustrations built around one recurring shot:
// a young man in a black coat walking down a rainy futuristic street at night.
// The same scene is re-lit and re-framed so every lesson compares like with like.
(function () {
  const M = window.M;
  const LW = 1600, LH = 900; // logical frame, scaled into any 16:9 viewport
  const VPX = 800, VPY = 392, FOC = 700, CAMH = 1.6;
  const WALL = 7.5, CURB = 6;

  const P = (X, Y, Z) => [VPX + (FOC * X) / Z, VPY + (FOC * (CAMH - Y)) / Z];

  // ------------------------------------------------------------ palettes
  const PAL = {
    neon: {
      skyTop: '#04060D', skyLow: '#1A1236', fog: '#2B1F4E', facade: '#0E1220', facadeHi: '#18203A',
      front: '#0A0D18', ground: '#06080E', groundFar: '#1E1838', curb: '#1A2033', win: 0.85, signs: 1,
      store: 1, rimL: '#3BE6FF', rimR: '#B46BFF', fogA: 0.75, rainTint: '#9FD8FF',
    },
    morning: {
      skyTop: '#8FB2D6', skyLow: '#FFE2C2', fog: '#F6E2CC', facade: '#6F7F98', facadeHi: '#D9B99A',
      front: '#62718A', ground: '#6E7078', groundFar: '#E9D4BE', curb: '#8D8F96', win: 0.12, signs: 0,
      store: 0.2, rimL: '#FFE3C2', rimR: '#FFE3C2', fogA: 0.45, rainTint: '#FFFFFF',
    },
    side: {
      skyTop: '#07080C', skyLow: '#2C1B12', fog: '#3A2416', facade: '#0D0D10', facadeHi: '#7A4A2A',
      front: '#09090B', ground: '#08080A', groundFar: '#2A1B12', curb: '#1A1512', win: 0.18, signs: 0,
      store: 0.2, rimL: '#FFB46E', rimR: '#2A1C14', fogA: 0.6, rainTint: '#FFD2A8',
    },
    day: {
      skyTop: '#AFC8DC', skyLow: '#E4ECF1', fog: '#DCE3E8', facade: '#A2A8B0', facadeHi: '#B4B9C0',
      front: '#959CA5', ground: '#8C9198', groundFar: '#C9CED3', curb: '#A3A8AE', win: 0.0, signs: 0,
      store: 0, rimL: '#FFFFFF', rimR: '#FFFFFF', fogA: 0.4, rainTint: '#FFFFFF',
    },
  };
  M.CITY_PAL = PAL;

  // ------------------------------------------------------------ deterministic layout
  const NEON = ['#2FE0F2', '#B46BFF', '#FF4FA3', '#2FE0F2', '#7C9CFF', '#FFB347'];
  const buildings = [];
  (function gen() {
    const r = M.rng(42);
    [-1, 1].forEach((side) => {
      let z = 3 + r() * 1.5;
      let k = 0;
      while (z < 150) {
        const depth = 5 + r() * 9;
        const h = 10 + r() * 22 + Math.min(20, z * 0.15);
        const b = { side, z0: z, z1: z + depth, h, shade: r() * 0.25, seed: Math.floor(r() * 1e6), k: k++ };
        if (r() < 0.62 && z > 4) {
          b.sign = {
            z: z + 0.6 + r() * Math.max(0.5, depth - 2.5),
            y0: 3.4 + r() * 2,
            hgt: 2.6 + r() * 3.2,
            out: 0.9 + r() * 0.5,
            color: NEON[Math.floor(r() * NEON.length)],
            phase: r() * 10,
            glyph: Math.floor(r() * 4),
          };
        }
        buildings.push(b);
        z += depth + (r() < 0.22 ? 2 + r() * 2 : 0);
      }
    });
    buildings.sort((a, b) => b.z0 - a.z0);
  })();
  const skyline = [];
  (function () {
    const r = M.rng(9);
    let x = -60;
    while (x < 60) {
      const w = 4 + r() * 9;
      skyline.push({ x, w, h: 25 + r() * 70, seed: Math.floor(r() * 1e5) });
      x += w + r() * 1.5;
    }
  })();

  const poly = (ctx, pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  const fogK = (z) => 1 - Math.exp(-z / 55);

  // Building rise: 0 = empty plane, 1 = full street. Far blocks arrive first.
  const riseOf = (b, build) => {
    if (build >= 1) return 1;
    const order = 1 - Math.min(1, b.z0 / 120);
    return M.E.outCubic(M.inv(build, order * 0.55, order * 0.55 + 0.45));
  };

  function drawSky(ctx, pal, o) {
    const g = ctx.createLinearGradient(0, 0, 0, VPY + 20);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(1, pal.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(-LW, -LH, LW * 3, VPY + LH + 20);
    if (o.light === 'neon') {
      M.glow(ctx, VPX, VPY - 30, 520, '#5B3BD6', 0.35 * o.build);
      M.glow(ctx, VPX + 40, VPY - 10, 260, '#2FE0F2', 0.16 * o.build);
    } else if (o.light === 'morning') {
      M.glow(ctx, VPX + 40, VPY - 30, 520, '#FFF4E2', 0.95);
      M.glow(ctx, VPX + 40, VPY - 30, 160, '#FFFFFF', 0.8);
    } else if (o.light === 'side') {
      M.glow(ctx, -120, VPY - 80, 700, '#FF9A4D', 0.55);
    }
  }

  function drawSkyline(ctx, pal, o) {
    if (o.build <= 0) return;
    const Z = 150;
    const col = M.mix(pal.facade, pal.fog, 0.75);
    skyline.forEach((s, i) => {
      const rise = riseOf({ z0: 150 }, o.build);
      const [x0, y0] = P(s.x, 0, Z);
      const [x1, y1] = P(s.x + s.w, s.h * rise, Z);
      ctx.fillStyle = col;
      ctx.fillRect(x0, y1, x1 - x0, y0 - y1);
      if (pal.win > 0.3) {
        const r = M.rng(s.seed);
        ctx.fillStyle = M.rgba('#FFC98A', 0.35 * pal.win);
        for (let k = 0; k < 6; k++) {
          const wx = x0 + r() * (x1 - x0 - 2), wy = y1 + r() * (y0 - y1 - 2);
          ctx.fillRect(wx, wy, 1.6, 1.6);
        }
      }
    });
  }

  function drawGround(ctx, pal, o) {
    const g = ctx.createLinearGradient(0, VPY, 0, LH);
    g.addColorStop(0, pal.groundFar);
    g.addColorStop(0.18, M.mix(pal.groundFar, pal.ground, 0.7));
    g.addColorStop(1, pal.ground);
    ctx.fillStyle = g;
    ctx.fillRect(-LW, VPY, LW * 3, LH * 2);
    const b = o.build;
    if (b < 1) {
      // empty-space grid floor, dissolves as the street is built
      ctx.save();
      ctx.globalAlpha *= (1 - b) * 0.5;
      const gridA = ctx.globalAlpha;
      ctx.strokeStyle = '#7F8AA0';
      ctx.lineWidth = 1;
      for (let X = -40; X <= 40; X += 2.5) {
        const a = P(X, 0, 2), c = P(X, 0, 200);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.stroke();
      }
      for (let Z = 2; Z < 200; Z *= 1.22) {
        const a = P(-60, 0, Z), c = P(60, 0, Z);
        ctx.globalAlpha = gridA * (1 - fogK(Z));
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (b <= 0) return;
    ctx.save();
    ctx.globalAlpha *= M.E.inOutSine(M.inv(b, 0.15, 0.7));
    // sidewalks
    [-1, 1].forEach((s) => {
      ctx.fillStyle = M.mix(pal.curb, pal.ground, 0.35);
      poly(ctx, [P(s * CURB, 0, 1.2), P(s * WALL, 0, 1.2), P(s * WALL, 0, 160), P(s * CURB, 0, 160)]);
      ctx.fill();
      ctx.strokeStyle = M.rgba('#FFFFFF', 0.06);
      ctx.lineWidth = 1.5;
      const a = P(s * CURB, 0, 1.2), c = P(s * CURB, 0, 160);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
    });
    // lane dashes
    ctx.fillStyle = M.rgba(o.light === 'neon' ? '#9AA8C8' : '#E8E8E0', o.light === 'neon' ? 0.16 : o.light === 'side' ? 0.08 : 0.32);
    for (let z = 4.5; z < 120; z += 7) {
      poly(ctx, [P(-0.09, 0, z), P(0.09, 0, z), P(0.09, 0, z + 3), P(-0.09, 0, z + 3)]);
      ctx.fill();
    }
    ctx.restore();
  }

  function signGlyph(ctx, s, x0, y0, w, h, col) {
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1, w * 0.09);
    const cx = x0 + w / 2;
    ctx.beginPath();
    if (s.glyph === 0) {
      for (let i = 0; i < 3; i++) {
        const y = y0 + h * (0.25 + i * 0.25);
        ctx.moveTo(x0 + w * 0.25, y);
        ctx.lineTo(x0 + w * 0.75, y);
      }
    } else if (s.glyph === 1) {
      ctx.arc(cx, y0 + h * 0.32, w * 0.24, 0, Math.PI * 2);
      ctx.moveTo(x0 + w * 0.25, y0 + h * 0.66);
      ctx.lineTo(x0 + w * 0.75, y0 + h * 0.66);
    } else if (s.glyph === 2) {
      ctx.moveTo(cx, y0 + h * 0.15);
      ctx.lineTo(cx, y0 + h * 0.85);
      ctx.moveTo(x0 + w * 0.28, y0 + h * 0.4);
      ctx.lineTo(x0 + w * 0.72, y0 + h * 0.4);
    } else {
      ctx.rect(x0 + w * 0.27, y0 + h * 0.2, w * 0.46, h * 0.25);
      ctx.moveTo(x0 + w * 0.27, y0 + h * 0.65);
      ctx.lineTo(x0 + w * 0.73, y0 + h * 0.65);
    }
    ctx.stroke();
  }

  function signOn(s, o) {
    if (o.neon <= 0) return 0;
    if (o.neon >= 1) return 1 - 0.08 * (Math.sin(o.t * 7 + s.phase * 3) > 0.97 ? 1 : 0);
    // staggered flicker-on
    const start = (s.phase / 10) * 0.6;
    const k = M.inv(o.neon, start, start + 0.4);
    if (k <= 0) return 0;
    if (k >= 1) return 1;
    const f = Math.sin(k * 60 + s.phase) > 0.2 ? 1 : 0.15;
    return k * f;
  }

  function drawBuilding(ctx, b, pal, o) {
    const rise = riseOf(b, o.build);
    if (rise <= 0) return;
    const h = b.h * rise, X = b.side * WALL;
    const fk = fogK(b.z0);
    const base = M.mix(pal.facade, pal.fog, fk * pal.fogA);
    // front face (towards camera), visible past nearer blocks
    const outX = b.side * (WALL + 30);
    const f0 = P(X, 0, b.z0), f1 = P(outX, h, b.z0);
    ctx.fillStyle = M.mix(pal.front, pal.fog, fk * pal.fogA);
    ctx.fillRect(Math.min(f0[0], f1[0]), f1[1], Math.abs(f1[0] - f0[0]), f0[1] - f1[1]);
    // street-facing facade
    const q = [P(X, 0, b.z0), P(X, h, b.z0), P(X, h, b.z1), P(X, 0, b.z1)];
    const g = ctx.createLinearGradient(0, q[0][1], 0, q[1][1]);
    const lit = o.light === 'morning' ? (b.side > 0 ? 0.75 : 0.1) : 0;
    const hi = M.mix(pal.facadeHi, pal.fog, fk * pal.fogA);
    g.addColorStop(0, lit ? M.mix(base, hi, lit) : M.mix(base, '#000000', 0.0 - b.shade * 0));
    g.addColorStop(1, lit ? M.mix(base, hi, lit * 0.7) : M.mix(base, '#000000', 0.25 + b.shade));
    ctx.fillStyle = g;
    poly(ctx, q);
    ctx.fill();
    if (o.light === 'neon') {
      // neon spill on lower facade
      const sp = ctx.createLinearGradient(0, q[0][1], 0, P(X, 7, b.z0)[1]);
      const sc = b.sign ? b.sign.color : '#5B4BD6';
      sp.addColorStop(0, M.rgba(sc, 0.22 * (1 - fk) * o.neon));
      sp.addColorStop(1, M.rgba(sc, 0));
      ctx.fillStyle = sp;
      poly(ctx, q);
      ctx.fill();
    }
    // windows
    const r = M.rng(b.seed);
    const ww = 1.25, wh = 1.9;
    for (let y = 4.6; y + wh < h - 0.6; y += 3.4) {
      for (let z = b.z0 + 0.7; z + ww < b.z1 - 0.3; z += 2.2) {
        const on = r(), tint = r();
        const a = P(X, y, z), c = P(X, y + wh, z + ww);
        if (Math.abs(c[0] - a[0]) < 0.7) continue;
        const wq = [a, P(X, y + wh, z), c, P(X, y, z + ww)];
        if (pal.win > 0.3 && on < 0.38) {
          ctx.fillStyle = M.rgba(tint < 0.7 ? '#FFC98A' : '#9FE2FF', (0.3 + 0.45 * on) * pal.win * (1 - fk * 0.6) * (0.55 + 0.45 * Math.min(1, b.z0 / 12)));
        } else {
          ctx.fillStyle = M.rgba(o.light === 'morning' || o.light === 'day' ? '#DDE6F0' : '#2A3350', o.light === 'morning' ? 0.22 : o.light === 'day' ? 0.16 : 0.12);
        }
        poly(ctx, wq);
        ctx.fill();
      }
    }
    // storefront band
    if (pal.store > 0 && h > 4) {
      const sq = [P(X, 0.35, b.z0 + 0.5), P(X, 3.0, b.z0 + 0.5), P(X, 3.0, b.z1 - 0.5), P(X, 0.35, b.z1 - 0.5)];
      const col = b.k % 3 === 0 ? '#9FE2FF' : '#FFC27A';
      const a = pal.store * (1 - fk * 0.7) * Math.min(1, o.build * 1.5);
      const sg = ctx.createLinearGradient(0, sq[1][1], 0, sq[0][1]);
      sg.addColorStop(0, M.rgba(col, 0.42 * a));
      sg.addColorStop(0.2, M.rgba(col, 0.16 * a));
      sg.addColorStop(1, M.rgba(col, 0.06 * a));
      ctx.fillStyle = sg;
      poly(ctx, sq);
      ctx.fill();
    }
  }

  function drawSign(ctx, b, pal, o, reflect) {
    const s = b.sign;
    if (!s || pal.signs <= 0) return;
    const rise = riseOf(b, o.build);
    if (rise < 0.99) return;
    const on = signOn(s, o) * pal.signs;
    const X0 = b.side * WALL, X1 = b.side * (WALL - s.out);
    const y0 = reflect ? -s.y0 : s.y0 + s.hgt, y1 = reflect ? -(s.y0 + s.hgt) : s.y0;
    const a = P(X0, y0, s.z), c = P(X1, y1, s.z);
    const x = Math.min(a[0], c[0]), w = Math.abs(c[0] - a[0]);
    const yTop = Math.min(a[1], c[1]), hh = Math.abs(c[1] - a[1]);
    const fk = fogK(s.z);
    if (reflect) {
      if (on <= 0) return;
      const g = ctx.createLinearGradient(0, yTop, 0, yTop + hh * 2.2);
      g.addColorStop(0, M.rgba(s.color, 0.3 * on * (1 - fk * 0.5)));
      g.addColorStop(0.5, M.rgba(s.color, 0.1 * on * (1 - fk * 0.5)));
      g.addColorStop(1, M.rgba(s.color, 0));
      ctx.fillStyle = g;
      for (let i = 0; i < 3; i++) ctx.fillRect(x + w * (0.15 + i * 0.25), yTop, w * 0.18, hh * 2.2);
      return;
    }
    ctx.fillStyle = M.mix('#05060A', pal.fog, fk * 0.5);
    ctx.fillRect(x, yTop, w, hh);
    if (on > 0) {
      ctx.save();
      ctx.globalAlpha *= on * (1 - fk * 0.45);
      ctx.shadowColor = s.color;
      ctx.shadowBlur = Math.max(6, w * 0.8);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(1, w * 0.07);
      ctx.strokeRect(x + w * 0.08, yTop + w * 0.08, w * 0.84, hh - w * 0.16);
      signGlyph(ctx, s, x, yTop, w, hh, s.color);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      M.glow(ctx, x + w / 2, yTop + hh / 2, Math.max(w, hh) * 1.1, s.color, 0.22 * on * (1 - fk * 0.5));
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ rain
  function drawRain(ctx, w, h, t, amt, tint, seed = 1) {
    if (amt <= 0) return;
    const n = Math.floor(420 * amt);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const hr = M.hash(i * 3.17 + seed), hs = M.hash(i * 7.31 + seed), hl = M.hash(i * 1.93 + seed);
      const depth = 0.35 + hl * 0.65;
      const speed = (1100 + 900 * depth) * (h / 900);
      const len = (18 + 46 * depth) * (h / 900);
      const span = h + len * 2;
      const y = ((hs * span + t * speed) % span) - len;
      const x = (hr * (w + 200) - 100 + y * 0.12) % (w + 100);
      ctx.strokeStyle = M.rgba(tint, (0.08 + 0.22 * depth) * Math.min(1, amt * 1.4));
      ctx.lineWidth = (0.6 + depth * 1.2) * (h / 900);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * 0.12, y + len);
      ctx.stroke();
    }
    ctx.restore();
  }
  M.drawRain = drawRain;

  function drawSplashes(ctx, t, amt) {
    if (amt <= 0) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(190,225,255,0.35)';
    ctx.lineWidth = 1;
    const baseA = ctx.globalAlpha;
    for (let i = 0; i < 70 * amt; i++) {
      const life = 0.45, ph = (t + M.hash(i * 5.1) * life) % life;
      const cycle = Math.floor((t + M.hash(i * 5.1) * life) / life);
      const X = (M.hash(i * 2.7 + cycle * 1.3) - 0.5) * 13, Z = 2.4 + M.hash(i * 4.3 + cycle * 0.7) * 22;
      const [x, y] = P(X, 0, Z);
      const k = ph / life, r = (2 + 10 * k) * (6 / Z);
      ctx.globalAlpha = baseA * (1 - k) * 0.6 * amt;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ person (front view, walking toward camera)
  // Units: 180 = full height, feet at y=0. Two looks: a neutral mannequin and the
  // detailed character, cross-faded by `detail`.
  function personShapes(ph) {
    const s = Math.sin(ph), bob = 1.6 * Math.abs(s), sway = 1.1 * s;
    const lF = s > 0 ? s : 0, rF = s < 0 ? -s : 0;
    return {
      bob, sway,
      footL: [-8 + sway * 0.3, 3 * lF - 4.5 * rF], footR: [8 + sway * 0.3, 3 * rF - 4.5 * lF],
      scaleL: 1 + 0.06 * lF - 0.05 * rF, scaleR: 1 + 0.06 * rF - 0.05 * lF,
      handL: [-25.5 + sway, -84 + bob + 3.5 * rF - 2 * lF], handR: [25.5 + sway, -84 + bob + 3.5 * lF - 2 * rF],
      hemL: 2.5 * lF - 1.5 * rF, hemR: 2.5 * rF - 1.5 * lF,
    };
  }
  function limb(ctx, x1, y1, w1, x2, y2, w2) {
    const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
    const c = Math.cos(a), s = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(x1 + (c * w1) / 2, y1 + (s * w1) / 2);
    ctx.lineTo(x2 + (c * w2) / 2, y2 + (s * w2) / 2);
    ctx.arc(x2, y2, w2 / 2, a, a + Math.PI);
    ctx.lineTo(x1 - (c * w1) / 2, y1 - (s * w1) / 2);
    ctx.arc(x1, y1, w1 / 2, a + Math.PI, a);
    ctx.closePath();
  }
  function drawFigure(ctx, ph, look, col) {
    const k = personShapes(ph);
    const by = k.bob, sx = k.sway;
    ctx.lineJoin = 'round';
    // legs
    ctx.fillStyle = col.legs;
    limb(ctx, -6.5 + sx, -60 + by, 10.5, k.footL[0], k.footL[1] - 5, 7 * k.scaleL);
    ctx.fill();
    limb(ctx, 6.5 + sx, -60 + by, 10.5, k.footR[0], k.footR[1] - 5, 7 * k.scaleR);
    ctx.fill();
    ctx.fillStyle = col.shoe;
    ctx.beginPath();
    ctx.ellipse(k.footL[0] - 0.5, k.footL[1] - 2.5, 6.4 * k.scaleL, 3.6 * k.scaleL, 0, 0, Math.PI * 2);
    ctx.ellipse(k.footR[0] + 0.5, k.footR[1] - 2.5, 6.4 * k.scaleR, 3.6 * k.scaleR, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(sx, by);
    if (look === 'coat') drawCoat(ctx, k, col);
    else drawMannequin(ctx, k, col);
    ctx.restore();
  }

  function drawMannequin(ctx, k, col) {
    const sx = k.sway, by = k.bob;
    ctx.fillStyle = col.sleeve;
    limb(ctx, -21, -142, 12, k.handL[0] - sx + 0.5, k.handL[1] - by - 7, 8.5);
    ctx.fill();
    limb(ctx, 21, -142, 12, k.handR[0] - sx - 0.5, k.handR[1] - by - 7, 8.5);
    ctx.fill();
    ctx.fillStyle = col.hand;
    ctx.beginPath();
    ctx.ellipse(k.handL[0] - sx, k.handL[1] - by, 3.8, 5.6, 0.1, 0, Math.PI * 2);
    ctx.ellipse(k.handR[0] - sx, k.handR[1] - by, 3.8, 5.6, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col.coat;
    ctx.beginPath();
    ctx.moveTo(-8, -151);
    ctx.quadraticCurveTo(-20, -149, -21, -140);
    ctx.quadraticCurveTo(-17, -110, -15, -96);
    ctx.quadraticCurveTo(-16, -72, -13, -58);
    ctx.lineTo(13, -58);
    ctx.quadraticCurveTo(16, -72, 15, -96);
    ctx.quadraticCurveTo(17, -110, 21, -140);
    ctx.quadraticCurveTo(20, -149, 8, -151);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = col.skin;
    ctx.fillRect(-4.5, -160, 9, 12);
    headPath(ctx);
    ctx.fill();
  }

  function headPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-8.8, -171);
    ctx.bezierCurveTo(-9.4, -180, -5, -183.5, 0, -183.5);
    ctx.bezierCurveTo(5, -183.5, 9.4, -180, 8.8, -171);
    ctx.bezierCurveTo(8.6, -165, 7.6, -160.5, 5.2, -157.6);
    ctx.bezierCurveTo(3.6, -155.8, 1.6, -155, 0, -155);
    ctx.bezierCurveTo(-1.6, -155, -3.6, -155.8, -5.2, -157.6);
    ctx.bezierCurveTo(-7.6, -160.5, -8.6, -165, -8.8, -171);
    ctx.closePath();
  }

  function drawCoat(ctx, k, col) {
    // neck, ears, head
    ctx.fillStyle = col.skin;
    ctx.beginPath();
    ctx.moveTo(-4.3, -159);
    ctx.lineTo(-4.8, -149);
    ctx.lineTo(4.8, -149);
    ctx.lineTo(4.3, -159);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-9, -168.5, 1.5, 2.8, 0.15, 0, Math.PI * 2);
    ctx.ellipse(9, -168.5, 1.5, 2.8, -0.15, 0, Math.PI * 2);
    ctx.fill();
    headPath(ctx);
    ctx.fill();
    // jaw shadow on neck
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.moveTo(-4.3, -157.5);
    ctx.quadraticCurveTo(0, -153, 4.3, -157.5);
    ctx.lineTo(4.4, -154);
    ctx.quadraticCurveTo(0, -151.5, -4.4, -154);
    ctx.fill();
    if (col.face) {
      ctx.fillStyle = col.face;
      ctx.strokeStyle = col.face;
      ctx.lineCap = 'round';
      // brows
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      ctx.moveTo(-6.2, -172.3);
      ctx.quadraticCurveTo(-4, -173.6, -1.8, -172.9);
      ctx.moveTo(6.2, -172.3);
      ctx.quadraticCurveTo(4, -173.6, 1.8, -172.9);
      ctx.stroke();
      // eyes
      ctx.beginPath();
      ctx.ellipse(-3.7, -170.1, 1.55, 0.72, 0.05, 0, Math.PI * 2);
      ctx.ellipse(3.7, -170.1, 1.55, 0.72, -0.05, 0, Math.PI * 2);
      ctx.fill();
      // nose shadow + nostrils
      ctx.globalAlpha *= 0.8;
      ctx.beginPath();
      ctx.moveTo(0.5, -170);
      ctx.quadraticCurveTo(1.9, -166, 1.5, -164.2);
      ctx.quadraticCurveTo(0.2, -163.2, -1.4, -164);
      ctx.quadraticCurveTo(0.2, -164.4, 0.5, -170);
      ctx.fill();
      // mouth
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(-2.5, -160.4);
      ctx.quadraticCurveTo(0, -160.9, 2.5, -160.4);
      ctx.stroke();
      ctx.globalAlpha *= 0.6;
      ctx.beginPath();
      ctx.ellipse(0, -159.2, 1.7, 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha /= 0.48;
    }
    // hair with a side-swept fringe
    ctx.fillStyle = col.hair;
    ctx.beginPath();
    ctx.moveTo(-9.6, -167.5);
    ctx.bezierCurveTo(-10.9, -178, -7, -187.2, 1, -186.8);
    ctx.bezierCurveTo(8, -186.4, 11.2, -180, 9.8, -167.5);
    ctx.bezierCurveTo(9.3, -172.5, 8.2, -175.6, 6.2, -176.8);
    ctx.bezierCurveTo(3, -178.6, -1, -176.6, -3.6, -179.4);
    ctx.bezierCurveTo(-5.2, -176.4, -7.6, -175, -8.7, -170);
    ctx.closePath();
    ctx.fill();
    // coat body (hands in pockets)
    const hl = k.hemL, hr = k.hemR;
    ctx.fillStyle = col.coat;
    ctx.beginPath();
    ctx.moveTo(-6.5, -153);
    ctx.lineTo(-10.5, -161.5);
    ctx.quadraticCurveTo(-15.5, -152.5, -22.5, -148.5);
    ctx.quadraticCurveTo(-27, -145, -26.5, -134);
    ctx.lineTo(-26.2, -112);
    ctx.quadraticCurveTo(-26, -99, -23.2, -92);
    ctx.quadraticCurveTo(-21.4, -78, -23.5, -51 + hl);
    ctx.quadraticCurveTo(0, -47, 23.5, -51 + hr);
    ctx.quadraticCurveTo(21.4, -78, 23.2, -92);
    ctx.quadraticCurveTo(26, -99, 26.2, -112);
    ctx.lineTo(26.5, -134);
    ctx.quadraticCurveTo(27, -145, 22.5, -148.5);
    ctx.quadraticCurveTo(15.5, -152.5, 10.5, -161.5);
    ctx.lineTo(6.5, -153);
    ctx.closePath();
    ctx.fill();
    // shoulder sheen
    const sg = ctx.createLinearGradient(0, -152, 0, -120);
    sg.addColorStop(0, 'rgba(255,255,255,0.07)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fill();
    // sweater V
    ctx.fillStyle = col.inner;
    ctx.beginPath();
    ctx.moveTo(-6.3, -152.8);
    ctx.lineTo(0, -123);
    ctx.lineTo(6.3, -152.8);
    ctx.quadraticCurveTo(0, -150, -6.3, -152.8);
    ctx.fill();
    // lapels catch a little light
    ctx.fillStyle = col.lapel || 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(-6.3, -152.8);
    ctx.lineTo(-13, -141);
    ctx.lineTo(-9.5, -137.5);
    ctx.lineTo(-0.6, -123.5);
    ctx.closePath();
    ctx.moveTo(6.3, -152.8);
    ctx.lineTo(13, -141);
    ctx.lineTo(9.5, -137.5);
    ctx.lineTo(0.6, -123.5);
    ctx.closePath();
    ctx.fill();
    // seams: arms against torso, front edge, pockets
    ctx.strokeStyle = col.seam;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-19.5, -134);
    ctx.quadraticCurveTo(-18.6, -112, -19.8, -94);
    ctx.moveTo(19.5, -134);
    ctx.quadraticCurveTo(18.6, -112, 19.8, -94);
    ctx.moveTo(0, -123);
    ctx.lineTo(0.6, -48.5);
    ctx.moveTo(-23, -93);
    ctx.lineTo(-14, -92);
    ctx.moveTo(23, -93);
    ctx.lineTo(14, -92);
    ctx.moveTo(-12, -80);
    ctx.quadraticCurveTo(-13, -66, -15, -54);
    ctx.moveTo(12, -80);
    ctx.quadraticCurveTo(13, -66, 15, -54);
    ctx.stroke();
    ctx.fillStyle = col.seam;
    ctx.beginPath();
    ctx.arc(2.4, -111, 0.8, 0, Math.PI * 2);
    ctx.arc(2.4, -98, 0.8, 0, Math.PI * 2);
    ctx.fill();
    // raised collar inner shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.moveTo(-6.5, -153);
    ctx.lineTo(-10.5, -161.5);
    ctx.lineTo(-8.6, -153.5);
    ctx.closePath();
    ctx.moveTo(6.5, -153);
    ctx.lineTo(10.5, -161.5);
    ctx.lineTo(8.6, -153.5);
    ctx.closePath();
    ctx.fill();
  }

  const LOOKS = {
    neon: { lapel: 'rgba(140,160,255,0.06)', coat: '#0B0C11', inner: '#15161D', seam: 'rgba(120,140,200,0.22)', legs: '#0A0B10', shoe: '#050508', sleeve: '#0D0E14', hand: '#3A2A2A', skin: '#3D2C2B', hair: '#060608', face: 'rgba(10,8,10,0.55)' },
    morning: { lapel: 'rgba(255,240,220,0.08)', coat: '#2A2E36', inner: '#4A4E58', seam: 'rgba(255,255,255,0.12)', legs: '#2B2F38', shoe: '#1C1E24', sleeve: '#2E323B', hand: '#C9997F', skin: '#CFA088', hair: '#2A211D', face: 'rgba(60,35,30,0.7)' },
    side: { coat: '#0C0C0E', inner: '#18171A', seam: 'rgba(255,200,150,0.18)', legs: '#0B0B0D', shoe: '#060607', sleeve: '#0E0E10', hand: '#5A3B2E', skin: '#6A4535', hair: '#09090A', face: 'rgba(20,10,8,0.6)' },
    day: { coat: '#5A6069', inner: '#6E747D', seam: 'rgba(255,255,255,0.1)', legs: '#4E545D', shoe: '#30343A', sleeve: '#5C626B', hand: '#C29A86', skin: '#C9A08A', hair: '#3B3330', face: null },
    mannequin: { coat: '#8E97A6', inner: '#8E97A6', seam: 'transparent', legs: '#7F8898', shoe: '#6C7584', sleeve: '#8A93A2', hand: '#9AA3B2', skin: '#A3ACBA', hair: '#A3ACBA', face: null },
  };

  // Draw the walking character with feet at (x, y), `hp` pixels tall.
  // o: phase, detail (0 mannequin → 1 coat), light, alpha, rim (0..1)
  M.drawPerson = (ctx, x, y, hp, o = {}) => {
    const ds = Math.max(0.05, Math.hypot(ctx.getTransform().a, ctx.getTransform().b));
    const s = (hp / 185) * ds;
    const pad = 30;
    const W = (70 + pad * 2) * s, H = (190 + pad * 2) * s;
    const ox = W / 2, oy = H - pad * s;
    const light = o.light || 'neon';
    const L = M.layer('person', W, H);
    const c = L.getContext('2d');
    c.translate(ox, oy);
    c.scale(s, s);
    const d = o.detail ?? 1;
    if (d < 1) drawFigure(c, o.phase || 0, 'plain', LOOKS.mannequin);
    if (d > 0) {
      c.globalAlpha = d;
      drawFigure(c, o.phase || 0, 'coat', LOOKS[light] || LOOKS.neon);
      c.globalAlpha = 1;
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    // soft vertical shading
    c.globalCompositeOperation = 'source-atop';
    const sh = c.createLinearGradient(0, 0, 0, H);
    sh.addColorStop(0, 'rgba(255,255,255,0.05)');
    sh.addColorStop(1, 'rgba(0,0,0,0.25)');
    c.fillStyle = sh;
    c.fillRect(0, 0, W, H);
    const pal = PAL[light] || PAL.neon;
    if (light === 'neon') {
      const g = c.createLinearGradient(ox - 30 * s, 0, ox + 30 * s, 0);
      g.addColorStop(0, 'rgba(59,230,255,0.16)');
      g.addColorStop(0.5, 'rgba(40,30,80,0.0)');
      g.addColorStop(1, 'rgba(180,107,255,0.14)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
    if (light === 'side') {
      const g = c.createLinearGradient(ox - 26 * s, 0, ox + 6 * s, 0);
      g.addColorStop(0, 'rgba(255,170,100,0.55)');
      g.addColorStop(0.45, 'rgba(255,150,90,0.18)');
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
    c.globalCompositeOperation = 'source-over';
    // rim light: silhouette minus offset silhouette
    const rim = (o.rim ?? 1) * d;
    if (rim > 0 && light !== 'day') {
      const R = M.layer('personRim', W, H);
      const rc = R.getContext('2d');
      const off = Math.max(0.8, 1.25 * s);
      [
        [pal.rimL, off, light === 'morning' ? 0.25 : 0.8],
        [pal.rimR, -off, light === 'side' ? 0 : light === 'morning' ? 0.15 : 0.65],
      ].forEach(([colr, dx, a]) => {
        if (a <= 0) return;
        rc.globalCompositeOperation = 'source-over';
        rc.clearRect(0, 0, W, H);
        rc.drawImage(L, 0, 0);
        rc.globalCompositeOperation = 'source-in';
        rc.fillStyle = colr;
        rc.fillRect(0, 0, W, H);
        rc.globalCompositeOperation = 'destination-out';
        rc.drawImage(L, dx, off * 0.6);
        c.save();
        c.globalAlpha = a * rim;
        c.globalCompositeOperation = 'source-atop';
        c.drawImage(R, 0, 0);
        c.restore();
        c.save();
        c.globalAlpha = a * rim * 0.5;
        c.globalCompositeOperation = 'lighter';
        c.filter = `blur(${Math.max(1, 2.5 * s)}px)`;
        c.drawImage(R, 0, 0);
        c.restore();
      });
    }
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.drawImage(L, x - ox / ds, y - oy / ds, W / ds, H / ds);
    ctx.restore();
    L.ds = ds;
    return L;
  };

  // ------------------------------------------------------------ full street shot
  // o: t, light, build, neon, rain, person{z,x,phase,detail,alpha}, cam{zoom,fx,fy}, dof, grain
  M.drawCity = (ctx, w, h, o = {}) => {
    o = Object.assign({ t: 0, light: 'neon', build: 1, neon: 1, rain: 0, dof: 0, grain: 0.05 }, o);
    const pal = PAL[o.light];
    const k = w / LW;
    const cam = Object.assign({ zoom: 1, fx: LW / 2, fy: LH / 2 }, o.cam || {});
    const toScreen = (c) => {
      c.translate(w / 2, h / 2);
      c.scale(k * cam.zoom, k * cam.zoom);
      c.translate(-cam.fx, -cam.fy);
    };
    const bgLayer = o.dof > 0 ? M.layer('cityBg', w, h) : null;
    const bctx = bgLayer ? bgLayer.getContext('2d') : ctx;
    bctx.save();
    toScreen(bctx);
    drawSky(bctx, pal, o);
    drawSkyline(bctx, pal, o);
    if (o.light === 'neon' && o.build > 0.6) {
      // distant hologram billboard behind the subject
      const [bx, by] = P(-3, 30, 150);
      const [bx2, by2] = P(3, 18, 150);
      bctx.save();
      bctx.globalAlpha *= M.inv(o.build, 0.6, 1) * 0.8;
      bctx.fillStyle = M.rgba('#2FE0F2', 0.18);
      bctx.fillRect(bx, by, bx2 - bx, by2 - by);
      bctx.strokeStyle = M.rgba('#2FE0F2', 0.5);
      bctx.lineWidth = 1;
      bctx.strokeRect(bx, by, bx2 - bx, by2 - by);
      bctx.restore();
    }
    drawGround(bctx, pal, o);
    // horizon fog band
    const fg = bctx.createLinearGradient(0, VPY - 160, 0, VPY + 120);
    fg.addColorStop(0, M.rgba(pal.fog, 0));
    fg.addColorStop(0.55, M.rgba(pal.fog, 0.55 * pal.fogA));
    fg.addColorStop(1, M.rgba(pal.fog, 0));
    bctx.fillStyle = fg;
    bctx.fillRect(-LW, VPY - 160, LW * 3, 280);
    // reflections on wet ground
    if (o.light === 'neon' && o.rain + o.build > 1) {
      const q = 4;
      const R = M.layer('cityRefl', w / q, h / q);
      const rc = R.getContext('2d');
      rc.setTransform(1 / q, 0, 0, 1 / q, 0, 0);
      toScreen(rc);
      buildings.forEach((b) => drawSign(rc, b, pal, o, true));
      bctx.save();
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.globalCompositeOperation = 'lighter';
      M.blurBlit(bctx, R, 0, 0, w, h, 5 * k * cam.zoom, 'refl');
      bctx.restore();
    }
    buildings.forEach((b) => {
      drawBuilding(bctx, b, pal, o);
      drawSign(bctx, b, pal, o, false);
    });
    if (o.light === 'side') {
      // a hard slit of warm light crossing the street from a side alley
      const pz = (o.person && o.person.z) || 9;
      bctx.save();
      bctx.globalCompositeOperation = 'lighter';
      const q = [P(-WALL, 0, pz - 1.2), P(WALL, 0, pz - 0.6), P(WALL, 0, pz + 1.6), P(-WALL, 0, pz + 1.0)];
      const lg = bctx.createLinearGradient(q[0][0], 0, q[1][0], 0);
      lg.addColorStop(0, 'rgba(255,165,95,0.55)');
      lg.addColorStop(1, 'rgba(255,140,80,0.12)');
      bctx.fillStyle = lg;
      poly(bctx, q);
      bctx.fill();
      // the same light landing on the opposite wall
      const wq = [P(WALL, 0, pz - 0.6), P(WALL, 5.5, pz - 0.1), P(WALL, 5.5, pz + 2.1), P(WALL, 0, pz + 1.6)];
      const wg = bctx.createLinearGradient(0, wq[0][1], 0, wq[1][1]);
      wg.addColorStop(0, 'rgba(255,160,90,0.24)');
      wg.addColorStop(1, 'rgba(255,160,90,0)');
      bctx.fillStyle = wg;
      poly(bctx, wq);
      bctx.fill();
      bctx.restore();
    }
    drawSplashes(bctx, o.t, o.light === 'neon' ? o.rain : 0);
    bctx.restore();
    if (bgLayer) M.blurBlit(ctx, bgLayer, 0, 0, w, h, o.dof * 9 * k * cam.zoom, 'dof');
    // subject
    if (o.person && (o.person.alpha ?? 1) > 0) {
      const pz = o.person.z ?? 9, px = o.person.x ?? 0;
      ctx.save();
      toScreen(ctx);
      const [fx, fy] = P(px, 0, pz);
      const hp = (1.8 * FOC) / pz;
      if (o.light === 'side') {
        // long cast shadow toward the right
        ctx.save();
        ctx.globalAlpha *= 0.7 * (o.person.alpha ?? 1);
        const sg = ctx.createLinearGradient(fx, 0, fx + hp * 1.3, 0);
        sg.addColorStop(0, 'rgba(0,0,0,0.9)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(fx - hp * 0.05, fy);
        ctx.lineTo(fx + hp * 1.3, fy - hp * 0.05);
        ctx.lineTo(fx + hp * 1.32, fy + hp * 0.04);
        ctx.lineTo(fx + hp * 0.05, fy + hp * 0.02);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha *= 0.45 * (o.person.alpha ?? 1);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(fx, fy, hp * 0.16, hp * 0.025, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      const L = M.drawPerson(ctx, fx, fy, hp, { ...o.person, light: o.person.look || o.light });
      if (o.light === 'neon' && o.rain > 0) {
        // mirrored reflection on the wet street
        ctx.save();
        ctx.globalAlpha *= 0.22 * (o.person.alpha ?? 1) * Math.min(1, o.rain * 2);
        ctx.translate(fx, fy);
        ctx.scale(1, -0.9);
        ctx.drawImage(L, -L.width / 2 / L.ds, -L.height / L.ds + (30 * hp) / 185, L.width / L.ds, L.height / L.ds);
        ctx.restore();
      }
      ctx.restore();
    }
    // atmosphere + rain in screen space
    drawRain(ctx, w, h, o.t, o.light === 'morning' || o.light === 'day' ? 0 : o.rain, pal.rainTint);
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${o.light === 'day' ? 0.12 : 0.5})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    if (o.grain > 0) M.grain(ctx, w, h, o.t, o.grain);
  };

  // Logical → viewport helper for overlays (labels pointing at things in the shot).
  M.cityPoint = (w, h, X, Y, Z, cam) => {
    cam = Object.assign({ zoom: 1, fx: LW / 2, fy: LH / 2 }, cam || {});
    const [x, y] = P(X, Y, Z);
    const k = w / LW;
    return [w / 2 + (x - cam.fx) * k * cam.zoom, h / 2 + (y - cam.fy) * k * cam.zoom];
  };
  // Screen position of the subject's head/feet for a given camera.
  M.cityPerson = (w, h, z, cam, x = 0) => ({
    head: M.cityPoint(w, h, x, 1.72, z, cam),
    chest: M.cityPoint(w, h, x, 1.3, z, cam),
    feet: M.cityPoint(w, h, x, 0, z, cam),
  });
  M.CITY = { LW, LH, VPX, VPY, FOC, CAMH, P };
})();
