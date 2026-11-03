'use strict';
// Timeline + all eight scenes. frame(t) returns a frame description for Engine.draw().
// Scene boundaries are snapped to the pauses of the Kazakh voice-over (VO starts at VO_OFFSET).
window.Scenes = (() => {
  const { clamp, lerp, seg, eo, ei, eio, sine, spring, wobble, rng, bezier } = U;
  const D2R = Math.PI / 180;

  const VO_OFFSET = 0.25;
  const TL = { s1: 0, s2: 4.95, s3: 11.95, s4: 17.7, s5: 23.25, s6: 29.95, s7: 41.7, s8: 53.2, end: 60.0 };

  const HEAD = { family: 'Nunito', weight: 900 };
  const LABEL = { family: 'Inter Display', weight: 700 };

  let E, P, DW, DH, D, L, IMG = {}, ICON = {};
  let S = [], CAM = null, UNDER = [];

  // ------------------------------------------------------------ layouts
  const LAND = {
    title: { size: 116, lines: [['HIGGSFIELD ACADEMY', 30]] }, panelH: 520, pillY: -128,
    cardX: -360, cardY: 0, cw: 600, ch: 700, maxSize: 212, maxY: 62, divY: -52, credSize: 60, credY: -128,
    tagX: 205, tagY: -215,
    thX: 470, thY: 95, thW: 600,
    arrow: [[-55, -360], [90, -455], [250, -430], [292, -208]],
    dockY: -250, dockW: 1660, dockH: 300, dockR: 64,
    pitch: 222, tw: 196, th: 246, tr: 30, shotW: 172, shotY: 50, shotR: 14, numSize: 92, numY: -66,
    cntY: 225, cntSize: 190, lesSize: 116, ringR: 96, hSize: 104,
    boxGap: 62, box: 56, barY: -532, barW: 1480, barH: 16, pct: 24,
    zoom4: 0.66, ty4: -362, tyb4: -320, pan4: 540,
    certX: -330, certY: 10, certW: 660, certH: 460, certSize: 84, certTitleY: 55,
    giftX: 400, giftY: -110, dropY: 330, dropSize: 78,
    enX: -170, enY: 0, enR: 150, enSize: 128, kzX: 200, kzY: 0, kzLabelDX: 150,
    c1: [-450, 0], c2: [450, 0], cW: 560, cH: 330, cTitle: 72, tubeLen: 380, tubeRot: 0,
    pollY: 40, pollUpY: 118, pollW: 1000, pollH: 580, optW: 880, optH: 118, yesY: 70, noY: -100, optSize: 64, pct2: 42,
    voteY: -300, voteSize: 74, arrowY: -362,
    finalTitle: { size: 116, lines: [['HIGGSFIELD ACADEMY', 0]] },
    tasksLabel: [['TASKS AFTER EVERY STAGE', 0]], tasksSize: 56,
  };
  const PORT = {
    title: { size: 132, lines: [['HIGGSFIELD', 95], ['ACADEMY', -70]] }, panelH: 640, pillY: -255,
    cardX: 0, cardY: 400, cw: 660, ch: 700, maxSize: 228, maxY: 62, divY: -52, credSize: 64, credY: -130,
    tagX: 240, tagY: -215,
    thX: 0, thY: -470, thW: 860,
    arrow: [[255, -30], [265, -120], [150, -120], [70, -188]],
    dockY: -380, dockW: 1020, dockH: 230, dockR: 52,
    pitch: 138, tw: 124, th: 176, tr: 22, shotW: 110, shotY: 36, shotR: 10, numSize: 62, numY: -46,
    cntY: 380, cntSize: 200, lesSize: 120, ringR: 100, hSize: 116, ringRowY: 60,
    boxGap: 50, box: 44, barY: -612, barW: 960, barH: 14, pct: 22,
    zoom4: 0.47, ty4: -470, tyb4: -420, pan4: 330,
    certX: 0, certY: 420, certW: 820, certH: 540, certSize: 92, certTitleY: 70,
    giftX: 0, giftY: -520, dropY: 300, dropSize: 84,
    enX: 0, enY: 170, enR: 170, enSize: 140, kzX: -45, kzY: -230, kzLabelDX: 160,
    c1: [0, 380], c2: [0, -380], cW: 820, cH: 360, cTitle: 84, tubeLen: 440, tubeRot: -90,
    pollY: 230, pollUpY: 300, pollW: 960, pollH: 700, optW: 840, optH: 130, yesY: 60, noY: -130, optSize: 70, pct2: 46,
    voteY: -440, voteSize: 82, arrowY: -505,
    finalTitle: { size: 140, lines: [['HIGGSFIELD', 85], ['ACADEMY', -95]] },
    tasksLabel: [['TASKS AFTER', 40], ['EVERY STAGE', -40]], tasksSize: 60,
  };

  // ------------------------------------------------------------ sprite helpers
  const add = (layer, o) => { o.layer = layer; S.push(o); return o; };
  const frost = (o) => add('frost', Object.assign({ kind: 'rrect' }, o));
  const glass = (o) => add('glass', Object.assign({ kind: 'rrect' }, o));
  const flat = (o) => add('content', o);
  const light = (o) => add('overlay', Object.assign({ blend: 'add' }, o));
  const under = (o) => add('under', Object.assign({ blend: 'add' }, o));
  const gstyle = (size, st) => Object.assign({}, HEAD, { size }, st || {});
  const fstyle = (size, st) => Object.assign({}, LABEL, { size }, st || {});
  function gtext(text, size, o, st) { return glass(Object.assign({ kind: 'tex', tex: E.glassText(text, gstyle(size, st)) }, o)); }
  function ftext(text, size, o, st) { return flat(Object.assign({ kind: 'tex', tex: E.flatText(text, fstyle(size, st)), color: [1, 1, 1, 0.92] }, o)); }

  // ------------------------------------------------------------ setup
  function setup(engine, opts, images) {
    E = engine; P = opts.portrait; DW = opts.DW; DH = opts.DH;
    D = (DH / 2) / Math.tan(15 * D2R);
    L = P ? PORT : LAND;
    // fit headline sizes to the frame
    for (const key of ['title', 'finalTitle']) {
      const tt = L[key];
      const widest = Math.max(...tt.lines.map(([s]) => E.measure(s, gstyle(1))));
      tt.size = Math.min(tt.size, (DW - (P ? 150 : 260)) / widest);
    }
    IMG.lessons = images.lessons.map((im, i) => E.image('lesson' + i, im));
    IMG.hero = E.image('hero', images.hero);
    ICON.play = E.flatShape('play', 24, 26, (c) => {
      c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineJoin = 'round'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(-12, -17); c.lineTo(18, 0); c.lineTo(-12, 17); c.closePath(); c.fill(); c.stroke();
    });
    ICON.lock = E.flatShape('lock', 16, 20, (c) => {
      c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = 3.4;
      c.beginPath(); c.arc(0, -4, 7.5, Math.PI, 0); c.lineTo(7.5, 2); c.moveTo(-7.5, 2); c.lineTo(-7.5, -4); c.stroke();
      c.beginPath(); c.roundRect(-11, 1, 22, 17, 4); c.fill();
    });
    ICON.poll = E.flatShape('poll', 20, 20, (c) => {
      c.fillStyle = '#fff';
      c.beginPath(); c.roundRect(-15, -3, 7, 17, 3); c.roundRect(-3.5, -14, 7, 28, 3); c.roundRect(8, -8, 7, 22, 3); c.fill();
    });
    // pre-build textures used later so the first frames of each scene don't stall
    for (let n = 0; n <= 7; n++) E.glassText(String(n), gstyle(L.cntSize));
  }

  // ------------------------------------------------------------ camera
  function camState(k, t) {
    const st = { dist: D, yaw: 0, elev: 0, tx: 0, ty: 0 };
    switch (k) {
      case 0: st.dist = D * (1.03 - 0.07 * eio(seg(t, 0, TL.s2 + 0.3))); break;
      case 1: st.dist = D * (1.0 - 0.045 * seg(t, TL.s2, TL.s3)); st.tx = P ? 0 : 20; st.yaw = -2 * seg(t, TL.s2, TL.s3); break;
      case 2: st.dist = D * (1.0 - 0.04 * seg(t, TL.s3, TL.s4)); st.ty = P ? -40 : -10; break;
      case 3: {
        const k1 = eio(seg(t, TL.s4 - 0.15, TL.s4 + 0.85));
        const pan = lerp(-L.pan4, L.pan4, sine(seg(t, TL.s4 + 0.45, TL.s4 + 4.65)));
        const back = eio(seg(t, TL.s4 + 4.5, TL.s5 + 0.1));
        st.dist = D * lerp(lerp(1.0, L.zoom4, k1), 0.92, back);
        st.tx = lerp(pan * k1, 0, back);
        st.ty = lerp(lerp(P ? -40 : -10, L.ty4, k1), L.tyb4, back);
        st.yaw = 3 * Math.sin((t - TL.s4) * 0.9) * k1 * (1 - back);
        break;
      }
      case 4: st.dist = D * 0.97; st.yaw = lerp(-11, 11, sine(seg(t, TL.s5 + 0.2, TL.s6 + 0.3))); st.elev = 30; break;
      case 5: st.dist = D * (1.0 - 0.05 * seg(t, TL.s6, TL.s7)); st.yaw = 2 * Math.sin(t * 0.25); break;
      case 6: st.dist = D * (1.0 - 0.04 * seg(t, TL.s7, TL.s8)); st.ty = P ? 0 : 10; break;
      case 7: st.dist = D * (1.0 - 0.035 * seg(t, TL.s8, TL.end)); break;
    }
    return st;
  }
  const BOUNDS = () => [TL.s1, TL.s2, TL.s3, TL.s4, TL.s5, TL.s6, TL.s7, TL.s8];
  const BLEND = [null, [-0.2, 0.8], [-0.2, 0.9], [0, 0.01], [0.1, 0.95], [-0.1, 0.8], [-0.1, 0.8], [-0.1, 0.8]];
  function camera(t) {
    const b = BOUNDS();
    let st = camState(0, t);
    for (let j = 1; j < 8; j++) {
      const w = eio(seg(t, b[j] + BLEND[j][0], b[j] + BLEND[j][0] + BLEND[j][1]));
      if (w <= 0) break;
      const n = camState(j, t);
      for (const k in st) st[k] = lerp(st[k], n[k], w);
    }
    const dx = 16 * Math.sin(t * 0.21) + 6 * Math.sin(t * 0.53), dy = 10 * Math.sin(t * 0.17 + 1) + 4 * Math.sin(t * 0.41);
    const yaw = st.yaw * D2R;
    const cam = {
      x: st.tx + Math.sin(yaw) * st.dist + dx, y: st.ty + st.elev + dy, z: Math.cos(yaw) * st.dist,
      tx: st.tx + dx * 0.6, ty: st.ty + dy * 0.6, tz: 0, fov: 30, roll: 0.004 * Math.sin(t * 0.3),
    };
    cam.dist = st.dist;
    cam.halfH = st.dist * Math.tan(15 * D2R);
    return cam;
  }

  // ------------------------------------------------------------ shared effects
  function droplets(t, t0, x, y, seed, n = 4, spread = 40, z = 10) {
    const age0 = t - t0;
    if (age0 < 0 || age0 > 1.6) return;
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const life = 0.7 + r() * 0.55, dx = (r() - 0.5) * spread, dy = (r() - 0.5) * spread * 0.6;
      const vx = (r() - 0.5) * 300, vy = 140 + r() * 340, rad = 6 + r() * 11, delay = r() * 0.12;
      const a = age0 - delay;
      if (a < 0 || a > life) continue;
      const rr = rad * (1 - Math.pow(a / life, 2)) * Math.min(1, a * 14);
      if (rr < 0.8) continue;
      const wob = 1 + 0.12 * Math.sin(a * 32);
      glass({ x: x + dx + vx * a, y: y + dy + vy * a - 520 * a * a, z, w: rr * 2 * wob, h: rr * 2 / wob, r: rr, bevel: rr, depth: 0.95 });
    }
  }
  function sparkles(t, t0, t1, cx, cy, w, h, seed, n, z = 20, col = [1, 0.95, 0.9]) {
    if (t < t0 || t > t1 + 1) return;
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const st = lerp(t0, t1, r()), life = 0.5 + r() * 0.6, x = cx + (r() - 0.5) * w, y = cy + (r() - 0.5) * h, sz = 3 + r() * 5;
      const a = (t - st) / life;
      if (a < 0 || a > 1) continue;
      const k = Math.sin(Math.PI * a);
      light({ kind: 'glow', x, y, z, sx3: sz, sy3: sz, color: [col[0], col[1], col[2], 0.95 * k] });
      light({ kind: 'glow', x, y, z, sx3: sz * 5, sy3: sz * 0.45, color: [col[0], col[1], col[2], 0.5 * k] });
      light({ kind: 'glow', x, y, z, sx3: sz * 0.45, sy3: sz * 5, color: [col[0], col[1], col[2], 0.5 * k] });
    }
  }
  // progressive polyline along a list of points (0..1)
  function partial(pts, u) {
    if (u >= 1) return pts.slice();
    let tot = 0; const segs = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); tot += l; }
    let left = tot * clamp(u); const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (left >= segs[i - 1]) { out.push(pts[i]); left -= segs[i - 1]; continue; }
      const f = left / segs[i - 1];
      out.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]);
      break;
    }
    if (out.length === 1) out.push([pts[0][0] + 0.01, pts[0][1]]);
    return out;
  }

  // ------------------------------------------------------------ SCENE 1 — hook
  function hook(t) {
    if (t > TL.s2 + 1.2) return;
    const T1 = L.title;
    const widest = Math.max(...T1.lines.map(([s]) => E.measure(s, gstyle(T1.size))));
    const panelW = Math.min(widest + (P ? 140 : 220), DW - 60), panelH = L.panelH;
    const out = eio(seg(t, TL.s2 - 0.2, TL.s2 + 0.45));
    const mm = spring(t - 1.3, 1.05, 0.72);
    const cm = clamp(mm);
    const node = { y: out * 260, rx: 4 * Math.sin(t * 0.9) * cm, ry: 5 * Math.sin(t * 0.7 + 0.4) * cm, opacity: 1 - out };
    const ts = t - 0.25;
    if (ts > 0) {
      const g = spring(ts, 1.15, 0.5);
      const wob = Math.sin(ts * 11) * Math.exp(-ts * 2.6) * 0.12;
      const R0 = (P ? 175 : 150) * Math.max(0, g);
      const hw = lerp(R0 * (1 + wob), panelW / 2, mm), hh = lerp(R0 * (1 - wob), panelH / 2, mm);
      const rad = lerp(Math.min(hw, hh), 72, cm), bev = lerp(R0 * 0.98, 32, cm);
      const y0 = (1 - clamp(g)) * -90;
      const gA = 1 - seg(t, 1.4, 1.95), fA = seg(t, 1.35, 1.85);
      under({ kind: 'glow', y: y0, sx3: hw * 1.1 + 40, sy3: hh * 1.1 + 40, color: [0.75, 0.55, 1.0, 0.16 * (1 - out) * cm] });
      if (gA > 0) glass({ parent: node, y: y0, w: hw * 2, h: hh * 2, r: rad, bevel: bev, depth: 0.95, opacity: gA, refr: lerp(7.5, 1, cm), tint: [1, 1, 1, 0.0] });
      if (fA > 0) frost({ parent: node, y: y0, w: hw * 2, h: hh * 2, r: rad, bevel: bev, opacity: fA, tint: [1, 1, 1, 0.07] });
    }
    // title, letter by letter
    let k = 0;
    for (const [text, ly] of T1.lines) {
      const gl = E.glassLetters(text, gstyle(T1.size));
      for (const le of gl.letters) {
        const t0 = 1.75 + k * 0.05;
        const p = spring(t - t0, 1.5, 0.5);
        const a = seg(t, t0, t0 + 0.16);
        const tx0 = TL.s2 - 0.25 + k * 0.016;
        const e = ei(seg(t, tx0, tx0 + 0.32));
        if (a > 0 && e < 1) {
          glass({ kind: 'tex', tex: le, parent: node, x: le.cx, y: ly + lerp(-110, 0, p) + e * 90, z: 4, s: lerp(0.5, 1, p) * (1 - 0.5 * e), rx: (1 - p) * 55, opacity: a * (1 - e), depth: 0.8, refr: 1.5 });
        }
        droplets(t, tx0 + 0.1, le.cx, ly + node.y + 60, 1000 + k, 4, T1.size * 0.5);
        k++;
      }
    }
    // OFFICIAL COURSE pill
    const tp = 3.3;
    if (t > tp) {
      const pp = spring(t - tp, 1.9, 0.5);
      const lab = E.flatText('OFFICIAL COURSE', fstyle(P ? 30 : 26, { track: 7 }));
      const h = P ? 78 : 66, w = lab.w + 120;
      const pn = { parent: node, y: L.pillY, z: 6, s: lerp(0.4, 1, pp), opacity: seg(t, tp, tp + 0.15) };
      frost({ parent: pn, w, h, r: h / 2, bevel: 16, tint: [1, 1, 1, 0.12] });
      glass({ parent: pn, x: -w / 2 + h * 0.5, z: 1, w: h * 0.34, h: h * 0.34, r: h * 0.17, bevel: h * 0.17, depth: 0.9, tint: [1.0, 0.6, 0.8, 0.35] });
      under({ kind: 'glow', x: -w / 2 + h * 0.5, y: L.pillY + node.y, sx3: 30, sy3: 30, color: [1, 0.45, 0.75, 0.5 * (1 - out)] });
      flat({ kind: 'tex', tex: lab, parent: pn, x: 14, color: [1, 1, 1, 0.94] });
    }
  }

  // ------------------------------------------------------------ SCENE 2 — requirement (card that becomes the dock)
  function cardDock(t) {
    if (t < TL.s2 + 0.3 || t > TL.s5 + 1.0) return null;
    const t0 = TL.s2 + 0.35;
    const flip = spring(t - t0, 0.95, 0.55);
    const d = spring(t - (TL.s3 - 0.2), 1.05, 0.75);
    const cd = clamp(d);
    const fb = eio(seg(t, TL.s5, TL.s5 + 0.7));
    const tilt = 1 - cd;
    const node = {
      x: lerp(L.cardX, 0, d), y: lerp(L.cardY, L.dockY, d) + (1 - clamp(flip)) * -40,
      z: -fb * 500,
      ry: (lerp(-100, 0, flip) + 4 * Math.sin(t * 0.7)) * tilt,
      rx: (12 * (1 - clamp(flip)) + 3 * Math.sin(t * 0.9 + 1)) * tilt,
      opacity: seg(t, t0, t0 + 0.25) * (1 - fb),
    };
    const w = lerp(L.cw, L.dockW, d), h = lerp(L.ch, L.dockH, d);
    frost({ parent: node, w, h, r: lerp(62, L.dockR, cd), bevel: 30, tint: [1, 1, 1, 0.07] });
    const facing = Math.cos(node.ry * D2R) > 0.06 ? 1 : 0;
    const cA = facing * (1 - seg(t, TL.s3 - 0.35, TL.s3 - 0.08));
    if (cA > 0) {
      const cn = { parent: node, opacity: cA, z: 1 };
      ftext('SUBSCRIPTION', 22, { parent: cn, y: L.ch / 2 - 74, color: [1, 1, 1, 0.7] }, { track: 8 });
      gtext('MAX', L.maxSize, { parent: cn, y: L.maxY, z: 3, depth: 0.8, refr: 1.5 });
      flat({ kind: 'fill', parent: cn, y: L.divY, w: 340, h: 3, r: 1.5, color: [1, 1, 1, 0.22] });
      gtext('1800 CREDITS', L.credSize, { parent: cn, y: L.credY, z: 3, depth: 0.75 });
    }
    return node;
  }

  function requirementExtras(t, card) {
    if (!card || t > TL.s3 + 0.4) return;
    const ex = eio(seg(t, TL.s3 - 0.35, TL.s3 + 0.1));
    // MIN. REQUIRED badge
    const tb = TL.s2 + 2.35;
    if (t > tb) {
      const p = spring(t - tb, 2.1, 0.42);
      const lab = E.flatText('MIN. REQUIRED', fstyle(25, { track: 3 }));
      const bw = lab.w + 64, bh = 70;
      const bn = { parent: card, x: L.cw / 2 - 70, y: L.ch / 2 - 8, z: 14, rz: 8, s: Math.max(0, p) * (1 - ex), opacity: seg(t, tb, tb + 0.08) };
      const pulse = 0.8 + 0.2 * Math.sin(t * 4.2);
      under({ kind: 'glow', parent: bn, sx3: bw * 0.62, sy3: 64, color: [1.0, 0.42, 0.55, 0.85 * pulse] });
      frost({ parent: bn, w: bw, h: bh, r: bh / 2, bevel: 16, tint: [1.0, 0.48, 0.52, 0.36] });
      flat({ kind: 'tex', tex: lab, parent: bn, color: [1, 1, 1, 0.97] });
      light({ kind: 'glow', parent: bn, sx3: bw * 0.7, sy3: 50, color: [1.0, 0.5, 0.6, 0.10 * pulse] });
    }
    // swinging "-%" tag
    const tg = TL.s2 + 3.4;
    if (t > tg) {
      const drop = spring(t - tg, 1.3, 0.6);
      const swing = -6 + 52 * wobble(t - tg, 0.85, 0.15);
      const tn = { parent: card, x: L.tagX, y: L.tagY + (1 - drop) * 260, z: 18, rz: swing, s: 1 - ex, opacity: seg(t, tg, tg + 0.1) };
      glass({ parent: tn, z: 2, w: 18, h: 18, r: 9, bevel: 9, depth: 0.9 });
      flat({ kind: 'fill', parent: tn, y: -22, w: 3, h: 44, r: 1.5, color: [1, 1, 1, 0.6] });
      const body = { parent: tn, y: -123 };
      frost({ parent: body, z: 1, w: 150, h: 190, r: 34, bevel: 20, hole: [0, 70, 13], tint: [1.0, 0.50, 0.66, 0.30] });
      under({ kind: 'glow', parent: body, sx3: 80, sy3: 100, color: [1, 0.45, 0.7, 0.45] });
      gtext('-%', 84, { parent: body, y: -20, z: 3, depth: 0.85, refr: 1.4 });
    }
    // PREVIOUS LESSONS thumbnail
    const th = TL.s2 + 4.4;
    if (t > th) {
      const p = spring(t - th, 1.3, 0.62);
      const fw = L.thW, fh = L.thW * 9 / 16;
      const tn = { x: L.thX + (P ? 0 : (1 - p) * 220), y: L.thY + 6 * Math.sin(t * 1.1) + (P ? (1 - p) * -200 : 0), z: 0,
        ry: (P ? 0 : (1 - p) * -22) + 3 * Math.sin(t * 0.8), rx: 2 * Math.sin(t * 0.9), s: lerp(0.7, 1, p) * (1 - ex), opacity: seg(t, th, th + 0.2) * (1 - ex) };
      frost({ parent: tn, w: fw + 28, h: fh + 28, r: 38, bevel: 22, tint: [1, 1, 1, 0.08] });
      flat({ kind: 'tex', tex: IMG.hero, parent: tn, z: 1, w: fw, h: fh, r: 24, color: [1, 1, 1, 1] });
      const pbn = { parent: tn, x: -fw / 2 + 66, y: -fh / 2 + 66, z: 4 };
      flat({ kind: 'tex', tex: ICON.play, parent: pbn, z: 1, x: 3, s: 0.72, color: [1, 1, 1, 0.95] });
      glass({ parent: pbn, z: 2, w: 84, h: 84, r: 42, bevel: 30, depth: 0.8, tint: [1, 1, 1, 0.16] });
      const lab = E.flatText('PREVIOUS LESSONS', fstyle(24, { track: 5 }));
      const pn = { parent: tn, y: -fh / 2 - 70, z: 3 };
      frost({ parent: pn, w: lab.w + 70, h: 60, r: 30, bevel: 14, tint: [1, 1, 1, 0.10] });
      flat({ kind: 'tex', tex: lab, parent: pn, color: [1, 1, 1, 0.92] });
    }
    // curved glass arrow from the tag to the thumbnail
    const ta = TL.s2 + 4.95;
    if (t > ta) {
      const [A0, A1, A2, A3] = L.arrow;
      const pr = eio(seg(t, ta, ta + 0.6));
      const pts = [];
      for (let i = 0; i <= 30; i++) pts.push(bezier(A0, A1, A2, A3, pr * i / 30));
      const op = 1 - ex;
      glass({ kind: 'poly', pts, th: 8, bevel: 8, depth: 0.8, z: 20, opacity: op });
      const ph = spring(t - (ta + 0.5), 2.2, 0.5);
      if (ph > 0) {
        const tip = A3, q = bezier(A0, A1, A2, A3, 0.96);
        let dx = tip[0] - q[0], dy = tip[1] - q[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
        const len = 34 * ph, a = 32 * D2R;
        const rot = (x, y, s) => [x * Math.cos(s) - y * Math.sin(s), x * Math.sin(s) + y * Math.cos(s)];
        const w1 = rot(-dx, -dy, a), w2 = rot(-dx, -dy, -a);
        glass({ kind: 'poly', pts: [[tip[0] + w1[0] * len, tip[1] + w1[1] * len], tip, [tip[0] + w2[0] * len, tip[1] + w2[1] * len]], th: 8, bevel: 8, depth: 0.8, z: 21, opacity: op });
      }
    }
  }

  // ------------------------------------------------------------ SCENE 3 — course structure
  const tileTime = (i) => TL.s3 + 0.55 + i * 0.17;
  function tiles(t) {
    if (t < TL.s3 + 0.4 || t > TL.s5 + 1.0) return;
    const fb = eio(seg(t, TL.s5, TL.s5 + 0.7));
    for (let i = 0; i < 7; i++) {
      const ti = tileTime(i);
      if (t < ti) continue;
      const p = spring(t - ti, 1.45, 0.55);
      const r = rng(100 + i);
      const tn = { x: (i - 3) * L.pitch, y: L.dockY + (1 - p) * 950, z: 6 - fb * 500, rz: (1 - p) * (r() * 24 - 12), opacity: seg(t, ti, ti + 0.12) * (1 - fb) };
      frost({ parent: tn, w: L.tw, h: L.th, r: L.tr, bevel: 18, tint: [1, 1, 1, 0.10] });
      const im = IMG.lessons[i];
      flat({ kind: 'tex', tex: im, parent: tn, z: 1, y: L.shotY, w: L.shotW, h: L.shotW / im.aspect, r: L.shotR });
      if (i >= 5) flat({ kind: 'tex', tex: ICON.lock, parent: tn, z: 2, x: L.shotW / 2 - 16, y: L.shotY + L.shotW / im.aspect / 2 - 18, s: P ? 0.55 : 0.8, color: [1, 1, 1, 0.85] });
      gtext(String(i + 1), L.numSize, { parent: tn, y: L.numY, z: 3, depth: 0.85 });
    }
  }

  function counter(t) {
    const t0c = tileTime(0) + 0.2;
    if (t < t0c || t > TL.s4 + 0.8) return;
    const ex = eio(seg(t, TL.s4 - 0.05, TL.s4 + 0.5));
    let n = 1, tch = -10;
    for (let i = 0; i < 7; i++) { const ti = tileTime(i) + 0.25; if (t >= ti) { n = i + 1; tch = ti; } }
    const appear = spring(t - t0c, 1.4, 0.6);
    const bump = 1 + 0.16 * Math.exp(-(t - tch) * 9) * Math.cos((t - tch) * 14);
    const numW = E.glassText('7', gstyle(L.cntSize)).w, lesW = E.glassText('LESSONS', gstyle(L.lesSize)).w;
    const hW = E.glassText('2.5 H', gstyle(L.hSize)).w;
    const R = L.ringR;
    let numX, lesX, ringX, hX, row1Y, row2Y;
    if (!P) {
      const total = numW + 34 + lesW + 120 + 2 * (R + 12) + 46 + hW;
      let x = -total / 2;
      numX = x + numW / 2; x += numW + 34;
      lesX = x + lesW / 2; x += lesW + 120;
      ringX = x + R + 12; x += 2 * (R + 12) + 46;
      hX = x + hW / 2;
      row1Y = row2Y = L.cntY;
    } else {
      const t1 = numW + 30 + lesW, t2 = 2 * (R + 12) + 46 + hW;
      numX = -t1 / 2 + numW / 2; lesX = -t1 / 2 + numW + 30 + lesW / 2;
      ringX = -t2 / 2 + R + 12; hX = -t2 / 2 + 2 * (R + 12) + 46 + hW / 2;
      row1Y = L.cntY; row2Y = L.ringRowY;
    }
    const grp = { y: ex * 90, z: -ex * 200, opacity: seg(t, t0c, t0c + 0.25) * (1 - ex), s: lerp(0.85, 1, clamp(appear)) };
    gtext(String(n), L.cntSize, { parent: grp, x: numX, y: row1Y, z: 2, s: bump, depth: 0.85 });
    const lesT = n === 1 ? 'LESSON' : 'LESSONS';
    const lesNow = E.glassText(lesT, gstyle(L.lesSize)).w;
    gtext(lesT, L.lesSize, { parent: grp, x: lesX - lesW / 2 + lesNow / 2, y: row1Y - (L.cntSize - L.lesSize) * 0.355, z: 2, depth: 0.8 });
    // clock + progress ring
    const tr = TL.s3 + 3.2;
    if (t > tr) {
      const p = spring(t - tr, 1.6, 0.55);
      const prog = eio(seg(t, tr + 0.15, tr + 1.5));
      const rn = { parent: grp, x: ringX, y: row2Y, z: 2, s: Math.max(0, p) };
      frost({ kind: 'arc', parent: rn, R, th: 11, a0: 0, a1: 7, bevel: 11, opacity: 0.6, tint: [1, 1, 1, 0.03] });
      if (prog > 0.003) glass({ kind: 'arc', parent: rn, z: 2, R, th: 12, a0: Math.PI / 2 - prog * 2 * Math.PI, a1: Math.PI / 2, bevel: 12, depth: 0.9, tint: [0.75, 0.9, 1.0, 0.12] });
      const hx = Math.cos(Math.PI / 2 - prog * 2 * Math.PI) * R, hy = Math.sin(Math.PI / 2 - prog * 2 * Math.PI) * R;
      if (prog > 0.003 && prog < 0.999) light({ kind: 'glow', parent: rn, x: hx, y: hy, z: 3, sx3: 22, sy3: 22, color: [0.8, 0.9, 1, 0.8] });
      frost({ parent: rn, z: 1, w: R * 1.32, h: R * 1.32, r: R * 0.66, bevel: 22, tint: [1, 1, 1, 0.08] });
      const mn = { parent: rn, z: 3, rz: -prog * 900 };
      flat({ kind: 'fill', parent: mn, y: R * 0.22, w: 7, h: R * 0.5, r: 3.5, color: [1, 1, 1, 0.92] });
      const hn = { parent: rn, z: 3, rz: -prog * 75 - 50 };
      flat({ kind: 'fill', parent: hn, y: R * 0.15, w: 8, h: R * 0.34, r: 4, color: [1, 1, 1, 0.92] });
      flat({ kind: 'fill', parent: rn, z: 4, w: 15, h: 15, r: 7.5, color: [1, 1, 1, 1] });
      const t2 = tr + 0.45;
      if (t > t2) {
        const q = spring(t - t2, 1.6, 0.55);
        gtext('2.5 H', L.hSize, { parent: grp, x: hX - (1 - q) * 60, y: row2Y, z: 2, opacity: seg(t, t2, t2 + 0.15), s: lerp(0.7, 1, q), depth: 0.8 });
      }
    }
  }

  // ------------------------------------------------------------ SCENE 4 — tasks
  const checkTime = (i) => TL.s4 + 0.9 + i * 0.6;
  function barFill(t) { let f = 0; for (let i = 0; i < 7; i++) f += clamp(spring(t - checkTime(i), 1.5, 0.8)) / 7; return f; }
  function tasks(t) {
    if (t < TL.s4 + 0.2 || t > TL.s5 + 2.2) return;
    const fb = eio(seg(t, TL.s5, TL.s5 + 0.7));
    const boxY = L.dockY - L.dockH / 2 - L.boxGap;
    for (let i = 0; i < 7; i++) {
      const ta = TL.s4 + 0.25 + i * 0.05, ci = checkTime(i);
      if (t < ta) continue;
      const pa = spring(t - ta, 1.8, 0.6);
      const checked = t >= ci;
      const kick = checked ? 0.2 * Math.exp(-(t - ci) * 7) * Math.sin((t - ci) * 20) : 0;
      const bn = { x: (i - 3) * L.pitch, y: boxY, z: 6 - fb * 500, s: lerp(0.3, 1, pa) * (1 + kick), opacity: seg(t, ta, ta + 0.15) * (1 - fb) };
      const gA = checked ? clamp((t - ci) * 6) : 0;
      const sc = L.box / 56;
      if (checked) under({ kind: 'glow', parent: bn, sx3: 60 * sc, sy3: 60 * sc, color: [0.2, 0.95, 0.55, 0.7 * gA] });
      frost({ parent: bn, w: L.box, h: L.box, r: L.box * 0.3, bevel: 14 * sc, tint: checked ? [0.2, 0.85, 0.5, 0.06 + 0.4 * gA] : [1, 1, 1, 0.07] });
      if (checked) {
        const pr = eio(seg(t, ci, ci + 0.28));
        const pts = [[-13, 0], [-4, -9], [14, 10]].map(([x, y]) => [x * sc, y * sc]);
        glass({ kind: 'poly', parent: bn, z: 2, pts: partial(pts, pr), th: 4.4 * sc, bevel: 4.4 * sc, depth: 0.9, tint: [1, 1, 1, 0.12] });
      }
    }
    // progress bar
    const tb = TL.s4 + 0.35;
    if (t > tb && t < TL.s5) {
      const bp = spring(t - tb, 1.4, 0.7);
      const fill = barFill(t);
      const bn = { y: L.barY, z: 4, sx: clamp(bp), opacity: seg(t, tb, tb + 0.2) };
      frost({ parent: bn, w: L.barW + 14, h: L.barH + 14, r: (L.barH + 14) / 2, bevel: 9, tint: [1, 1, 1, 0.06] });
      if (fill > 0.002) {
        flat({ kind: 'liquid', parent: bn, z: 1, w: L.barW, h: L.barH, r: L.barH / 2, fill, time: t, wave: 2.2, color: [0.40, 0.80, 1.0, 1], color2: [1.0, 0.48, 0.82, 1] });
        const fx = -L.barW / 2 + L.barW * fill;
        light({ kind: 'glow', parent: bn, x: fx, z: 2, sx3: 50, sy3: 20, color: [1, 0.85, 0.95, 0.6] });
        under({ kind: 'glow', parent: bn, x: fx - L.barW * fill / 2, sx3: L.barW * fill * 0.5 + 20, sy3: 40, color: [0.7, 0.55, 1.0, 0.35] });
      }
      ftext(`${Math.round(fill * 100)}%`, L.pct, { parent: bn, x: clamp(fx_or(fill), -L.barW / 2 + 40, L.barW / 2 - 40), y: L.barH / 2 + 34, z: 2, color: [1, 1, 1, 0.9] });
    }
    // label that rides with the camera
    const tl = TL.s4 + 0.6;
    if (t > tl && t < TL.s5 + 0.6) {
      const out = eio(seg(t, TL.s5 - 0.1, TL.s5 + 0.4));
      const lines = L.tasksLabel;
      let k = 0;
      for (const [text, ly] of lines) {
        const gl = E.glassLetters(text, gstyle(L.tasksSize));
        for (const le of gl.letters) {
          const t0 = tl + k * 0.025;
          const p = spring(t - t0, 1.7, 0.55);
          glass({ kind: 'tex', tex: le, x: CAM.tx + le.cx, y: CAM.ty + CAM.halfH * (P ? 0.66 : 0.86) + ly + lerp(-50, 0, p) + out * 60, z: 0, s: lerp(0.6, 1, p), opacity: seg(t, t0, t0 + 0.12) * (1 - out), depth: 0.8 });
          k++;
        }
      }
    }
    // the bar bursts into light
    burst(t, TL.s5, L.barW * barFill(TL.s5), L.barY);
  }
  function fx_or(fill) { return -L.barW / 2 + L.barW * fill; }
  function burst(t, t0, len, y) {
    const age = t - t0;
    if (age < 0 || age > 2.2) return;
    const r = rng(777);
    for (let i = 0; i < 150; i++) {
      const x = -L.barW / 2 + len * r(), life = 0.7 + r() * 1.0, vx = (r() - 0.5) * 460, vy = 60 + r() * 680, sz = 3 + r() * 7, hue = r(), dl = r() * 0.08;
      const col = hue < 0.33 ? [0.5, 0.85, 1] : hue < 0.66 ? [1, 0.6, 0.86] : [1, 0.93, 0.82];
      const a = age - dl;
      if (a < 0 || a > life) continue;
      const drag = (1 - Math.exp(-2.4 * a)) / 2.4;
      const k = 1 - a / life;
      light({ kind: 'glow', x: x + vx * drag, y: y + vy * drag - 80 * a * a, z: 8, sx3: sz, sy3: sz, color: [col[0], col[1], col[2], 0.95 * k * k] });
    }
    if (age < 0.25) light({ kind: 'glow', y, z: 6, sx3: len * 0.55 + 40, sy3: 60, color: [1, 0.85, 0.95, 0.9 * (1 - age / 0.25)] });
    for (let i = 0; i < 10; i++) droplets(t, t0, -L.barW / 2 + len * (i + 0.5) / 10, y, 900 + i, 2, 30, 12);
  }

  // ------------------------------------------------------------ SCENE 5 — rewards
  function rewards(t) {
    if (t < TL.s5 + 0.3 || t > TL.s6 + 0.8) return;
    const ex = eio(seg(t, TL.s6 - 0.15, TL.s6 + 0.55));
    // certificate
    const tc = TL.s5 + 0.45;
    const pc = spring(t - tc, 1.0, 0.62);
    const cn = { x: L.certX, y: L.certY + (1 - pc) * -560 + 8 * Math.sin(t * 1.0), z: -ex * 600, rx: (1 - clamp(pc)) * 38 + 2 * Math.sin(t * 0.8), ry: 3 * Math.sin(t * 0.6), opacity: seg(t, tc, tc + 0.25) * (1 - ex) };
    frost({ parent: cn, w: L.certW, h: L.certH, r: 40, bevel: 26, tint: [1, 1, 1, 0.08] });
    ftext('HIGGSFIELD ACADEMY', 22, { parent: cn, y: L.certH / 2 - 70, z: 1, color: [1, 1, 1, 0.78] }, { track: 8 });
    gtext('CERTIFICATE', L.certSize, { parent: cn, y: L.certTitleY, z: 3, depth: 0.8 });
    ftext('OF COMPLETION', 20, { parent: cn, y: L.certTitleY - L.certSize * 0.66, z: 1, color: [1, 1, 1, 0.6] }, { track: 9, weight: 600 });
    flat({ kind: 'fill', parent: cn, x: -L.certW / 2 + 190, y: -L.certH / 2 + 95, w: 240, h: 3, r: 1.5, color: [1, 1, 1, 0.28] });
    flat({ kind: 'fill', parent: cn, x: -L.certW / 2 + 150, y: -L.certH / 2 + 70, w: 160, h: 3, r: 1.5, color: [1, 1, 1, 0.16] });
    const ts = TL.s5 + 1.25;
    if (t > ts) {
      const ps = spring(t - ts, 2.0, 0.45);
      const sn = { parent: cn, x: L.certW / 2 - 120, y: -L.certH / 2 + 115, z: 6, s: Math.max(0, ps), rz: (1 - clamp(ps)) * -70 };
      flat({ kind: 'fill', parent: { parent: sn, x: -20, y: -62, rz: 18 }, w: 26, h: 78, r: 4, color: [1.0, 0.55, 0.72, 0.95], color2: [0.85, 0.45, 1.0, 0.95] });
      flat({ kind: 'fill', parent: { parent: sn, x: 20, y: -62, rz: -18 }, w: 26, h: 78, r: 4, color: [0.85, 0.45, 1.0, 0.95], color2: [1.0, 0.55, 0.72, 0.95] });
      under({ kind: 'glow', x: L.certX + L.certW / 2 - 120, y: L.certY - L.certH / 2 + 115, sx3: 90, sy3: 90, color: [1, 0.75, 0.45, 0.5 * (1 - ex) * seg(t, ts, ts + 0.3)] });
      glass({ kind: 'rosette', parent: sn, R: 58, amp: 4.5, petals: 18, bevel: 24, depth: 0.85, tint: [1.0, 0.78, 0.42, 0.30] });
      flat({ kind: 'ring', parent: sn, z: 1, R: 40, wd: 1.6, color: [1, 1, 1, 0.5] });
    }
    // gift box
    const tg = TL.s5 + 1.25;
    if (t > tg) {
      const pg = spring(t - tg, 1.1, 0.6);
      const gn = { x: L.giftX, y: L.giftY + (1 - pg) * -520 + 6 * Math.sin(t * 1.2 + 1), z: -ex * 600, ry: -4 * Math.sin(t * 0.7), opacity: seg(t, tg, tg + 0.25) * (1 - ex) };
      const to = TL.s5 + 2.7;
      const ir = t > to ? eo(seg(t, to, to + 0.6)) * (1 - ex) : 0;
      if (ir > 0) under({ kind: 'glow', x: L.giftX, y: L.giftY + 110, sx3: 240, sy3: 150, color: [1, 0.65, 0.85, 0.55 * ir] });
      flat({ kind: 'fill', parent: gn, w: 46, h: 220, r: 6, color: [1.0, 0.45, 0.70, 0.85], color2: [0.75, 0.40, 1.0, 0.85] });
      glass({ parent: gn, z: 2, w: 270, h: 220, r: 28, bevel: 24, depth: 0.55, tint: [1, 0.75, 0.9, 0.05] });
      const po = spring(t - to, 1.25, 0.5);
      const cpo = clamp(po, 0, 1.1);
      const ln = { parent: gn, x: -280 * po, y: lerp(144, -30, cpo) + 190 * Math.sin(Math.PI * clamp(po)), z: 4, rz: 30 * po };
      flat({ kind: 'fill', parent: ln, w: 48, h: 66, r: 6, color: [1.0, 0.45, 0.70, 0.85], color2: [0.75, 0.40, 1.0, 0.85] });
      glass({ parent: ln, z: 1, w: 300, h: 66, r: 22, bevel: 20, depth: 0.6, tint: [1, 0.75, 0.9, 0.05] });
      glass({ kind: 'blobs', parent: ln, z: 2, y: 56, balls: [[-34, 12, 25], [34, 12, 25], [0, 2, 15]], k: 16, bevel: 22, depth: 0.85, tint: [1, 0.55, 0.78, 0.22] });
      if (ir > 0) {
        light({ kind: 'rays', parent: gn, y: 110, z: 3, size: 780, count: 9, sharp: 4, fall: 300, cone: 1.15, rot: 0.12 * Math.sin(t * 0.6), time: t * 0.8, color: [1.0, 0.88, 0.80, 0.8 * ir] });
        light({ kind: 'glow', parent: gn, y: 118, z: 3, sx3: 170, sy3: 60, color: [1, 0.9, 0.86, 0.28 * ir] });
        sparkles(t, to + 0.1, TL.s6 - 0.3, L.giftX, L.giftY + 260, 520, 360, 55, 26);
        const pt = spring(t - (to + 0.25), 1.15, 0.6);
        if (pt > 0) gtext('CREATOR DROP', L.dropSize, { parent: gn, refr: 1.3, y: lerp(60, L.dropY, pt), z: 8, s: lerp(0.25, 1, clamp(pt, 0, 1.2)), opacity: seg(t, to + 0.25, to + 0.45), depth: 0.85 });
      }
    }
  }

  // ------------------------------------------------------------ SCENE 6 — language
  function language(t) {
    if (t < TL.s6 + 0.2 || t > TL.s7 + 0.8) return;
    const ex1 = eio(seg(t, TL.s6 + 4.4, TL.s6 + 4.95));
    const te = TL.s6 + 0.35;
    if (t < TL.s6 + 5.0) {
      const pe = spring(t - te, 1.5, 0.5);
      const breath = 1 + 0.025 * Math.sin((t - te) * 2 * Math.PI / 1.5);
      const en = { x: L.enX, y: L.enY + 10 * Math.sin(t * 1.6) + ex1 * 160, z: -ex1 * 300, s: Math.max(0, pe) * breath * (1 - 0.3 * ex1), opacity: seg(t, te, te + 0.2) * (1 - ex1), rx: 3 * Math.sin(t * 1.1), ry: 4 * Math.sin(t * 0.9) };
      for (let k = 0; k < 4; k++) {
        const a = t - (te + 0.45 + k * 1.5);
        if (a > 0 && a < 1.4) light({ kind: 'ring', x: L.enX, y: en.y, z: -2, R: L.enR * en.s + a * 210, wd: 5 + a * 9, color: [0.8, 0.85, 1, 0.32 * Math.pow(1 - a / 1.4, 2) * (1 - ex1)] });
      }
      under({ kind: 'glow', x: L.enX, y: en.y, sx3: L.enR * 1.05, sy3: L.enR * 1.05, color: [0.45, 0.55, 1.0, 0.5 * en.opacity * breath] });
      frost({ parent: en, w: 2 * L.enR, h: 2 * L.enR, r: L.enR, bevel: 40, tint: [0.75, 0.85, 1, 0.10] });
      gtext('EN', L.enSize, { parent: en, z: 3, depth: 0.85 });
      const tk = TL.s6 + 1.4;
      if (t > tk) {
        const pk = spring(t - tk, 1.6, 0.6);
        const tryT = TL.s6 + 2.9;
        const nudge = t > tryT ? Math.sin(Math.PI * clamp((t - tryT) / 0.35)) * 18 : 0;
        const sh = t > tryT + 0.3 ? 7 * Math.sin((t - tryT - 0.3) * 40) * Math.exp(-(t - tryT - 0.3) * 7) : 0;
        const kn = { x: L.kzX + sh, y: L.kzY + 8 * Math.sin(t * 1.6 + 0.6) + ex1 * 160, z: -ex1 * 300, s: lerp(0.5, 1, pk) * (1 - 0.3 * ex1), opacity: seg(t, tk, tk + 0.2) * (1 - ex1) * 0.92 };
        frost({ parent: kn, w: 190, h: 108, r: 54, bevel: 22, tint: [0.42, 0.42, 0.48, 0.48] });
        glass({ parent: kn, z: 2, x: -41 + nudge, w: 84, h: 84, r: 42, bevel: 34, depth: 0.85, tint: [0.65, 0.65, 0.7, 0.30] });
        ftext('KZ', 40, { parent: kn, x: L.kzLabelDX, z: 1, color: [1, 1, 1, 0.40] });
        flat({ kind: 'tex', tex: ICON.lock, parent: kn, x: L.kzLabelDX + 58, y: 2, z: 1, s: 0.9, color: [1, 1, 1, 0.38] });
      }
    }
    // MY COURSE -> ACADEMY
    const tl = TL.s6 + 4.75, tr = tl + 0.25;
    const ex2 = eio(seg(t, TL.s7 - 0.2, TL.s7 + 0.4));
    if (t > tl) {
      const tt = tr + 0.3, tf = tt + 0.4;
      const ph = (t - tf) / 1.6, u = ph - Math.floor(ph);
      const flash = t > tf ? Math.exp(-Math.pow((u - 0.97) / 0.07, 2)) + Math.exp(-Math.pow((u + 0.03) / 0.07, 2)) : 0;
      const cards = [
        [L.c1, 'MY COURSE', 'INTRO', tl, -1],
        [L.c2, 'ACADEMY', 'ADVANCED', tr, 1],
      ];
      for (const [pos, title, sub, tc, side] of cards) {
        const pc = spring(t - tc, 1.15, 0.62);
        const n = {
          x: pos[0] + (P ? 0 : side * (1 - pc) * 260), y: pos[1] + (P ? -side * (1 - pc) * 260 : 0) + 7 * Math.sin(t * 1.1 + side),
          z: -ex2 * 500, ry: P ? 3 * Math.sin(t * 0.7) : -side * ((1 - clamp(pc)) * 30 + 7), rx: P ? side * ((1 - clamp(pc)) * 30 + 6) : 2 * Math.sin(t * 0.8),
          opacity: seg(t, tc, tc + 0.25) * (1 - ex2), s: lerp(0.8, 1, clamp(pc)),
        };
        const fl = side > 0 ? flash : 0;
        if (side > 0) under({ kind: 'glow', x: pos[0], y: pos[1], sx3: L.cW * 0.55, sy3: L.cH * 0.6, color: [1.0, 0.45, 0.8, 0.45 * fl * (1 - ex2)] });
        frost({ parent: n, w: L.cW, h: L.cH, r: 48, bevel: 28, tint: side > 0 ? [1.0, 0.6, 0.85, 0.07 + 0.14 * fl] : [0.6, 0.8, 1.0, 0.08] });
        gtext(title, L.cTitle, { parent: n, y: 22, z: 3, depth: 0.8 });
        ftext(sub, 24, { parent: n, y: -L.cTitle * 0.62 - 18, z: 1, color: [1, 1, 1, 0.68] }, { track: 9 });
      }
      if (t > tt) {
        const ptb = spring(t - tt, 1.6, 0.7);
        const tube = { x: (L.c1[0] + L.c2[0]) / 2, y: (L.c1[1] + L.c2[1]) / 2, z: -6 - ex2 * 500, rz: L.tubeRot, sx: clamp(ptb), opacity: seg(t, tt, tt + 0.15) * (1 - ex2) };
        frost({ parent: tube, w: L.tubeLen, h: 56, r: 28, bevel: 16, tint: [1, 1, 1, 0.07] });
        if (t > tf) {
          for (let j = 0; j < 4; j++) {
            const uu = u - j * 0.045;
            if (uu < 0) continue;
            const x = lerp(-L.tubeLen / 2 + 50, L.tubeLen / 2 - 50, eio(uu));
            const a = (1 - j * 0.24) * Math.min(1, uu * 8) * Math.min(1, (1 - uu) * 10);
            flat({ kind: 'fill', parent: tube, z: 1, x, w: 110 - j * 18, h: 28 - j * 4, r: 14, color: [0.45, 0.85, 1, 0.92 * a], color2: [1, 0.5, 0.86, 0.92 * a] });
            if (j === 0) {
              light({ kind: 'glow', parent: tube, x, z: 2, sx3: 80, sy3: 30, color: [0.95, 0.75, 1, 0.55 * a] });
              under({ kind: 'glow', parent: tube, x, sx3: 90, sy3: 50, color: [0.7, 0.6, 1, 0.5 * a] });
            }
          }
        }
        glass({ kind: 'poly', parent: tube, x: L.tubeLen / 2 - 34, z: 3, pts: [[-9, 15], [6, 0], [-9, -15]], th: 4.5, bevel: 4.5, depth: 0.9 });
      }
    }
  }

  // ------------------------------------------------------------ SCENE 7 — poll / CTA
  const YES = 0.92, NO = 0.08;
  function pollFill(t, target, t0) { return target * clamp(spring(t - t0, 0.55, 0.85), 0, 1.02); }
  function poll(t) {
    if (t < TL.s7 + 0.1 || t > TL.s8 + 1.3) return null;
    const melt = eio(seg(t, TL.s8 - 0.1, TL.s8 + 0.55));
    const tw = TL.s7 + 0.2;
    const pw = spring(t - tw, 1.0, 0.62);
    const ta = TL.s7 + 6.2;
    const up = eio(seg(t, ta - 0.25, ta + 0.35));
    const wn = { y: lerp(L.pollY, L.pollUpY, up) + (1 - pw) * -1100 + 6 * Math.sin(t * 1.0), z: 0, rx: (1 - clamp(pw)) * -25 + 2 * Math.sin(t * 0.7), ry: 2.5 * Math.sin(t * 0.55), s: lerp(1, 0.15, melt), opacity: seg(t, tw, tw + 0.2) * (1 - seg(t, TL.s8 + 0.1, TL.s8 + 0.5)) };
    frost({ parent: wn, w: L.pollW, h: L.pollH, r: 56, bevel: 30, tint: [1, 1, 1, 0.07] });
    const hx = -L.optW / 2 + 20, hy = L.pollH / 2 - 62;
    flat({ kind: 'tex', tex: ICON.poll, parent: wn, x: hx + 10, y: hy, z: 1, s: 0.9, color: [1, 1, 1, 0.85] });
    const pl = E.flatText('POLL', fstyle(28, { track: 6 }));
    flat({ kind: 'tex', tex: pl, parent: wn, x: hx + 44 + pl.w / 2, y: hy, z: 1, color: [1, 1, 1, 0.85] });
    const tf = TL.s7 + 1.4;
    const opts = [['YES', L.yesY, YES, [0.38, 0.78, 1.0, 1], [1.0, 0.45, 0.85, 1], tf], ['NO', L.noY, NO, [0.55, 0.55, 0.78, 0.75], [0.68, 0.62, 0.86, 0.75], tf + 0.3]];
    const barW = L.optW - (P ? 140 : 160), bx = -L.optW / 2 + barW / 2;
    for (const [label, oy, target, c1, c2, t0] of opts) {
      const yes = label === 'YES';
      const on = { parent: wn, x: bx, y: oy, z: 1 };
      frost({ parent: on, w: barW, h: L.optH, r: L.optH / 2, bevel: 18, tint: [1, 1, 1, 0.06] });
      const f = t > t0 ? pollFill(t, target, t0) : 0;
      if (f > 0.002) {
        flat({ kind: 'liquid', parent: on, z: 1, w: barW - 12, h: L.optH - 12, r: (L.optH - 12) / 2, fill: f, time: t, wave: yes ? 5 : 2, glint: yes ? 0.55 : 0.12, color: c1, color2: c2 });
        if (yes) {
          light({ kind: 'glow', parent: on, x: -barW / 2 + (barW - 12) * f, z: 2, sx3: 60, sy3: L.optH * 0.4, color: [1, 0.85, 0.95, 0.45] });
          under({ kind: 'glow', parent: on, x: -barW / 2 + (barW - 12) * f / 2, sx3: (barW - 12) * f * 0.5, sy3: L.optH * 0.6, color: [0.75, 0.5, 1.0, 0.4] });
        }
      }
      const gt = E.glassText(label, gstyle(L.optSize));
      glass({ kind: 'tex', tex: gt, parent: on, x: -barW / 2 + 54 + gt.w / 2, z: 3, depth: 0.85, refr: 1.3 });
      const pct = E.flatText(`${Math.round(f * 100)}%`, fstyle(L.pct2));
      flat({ kind: 'tex', tex: pct, parent: wn, x: L.optW / 2 - 8 - pct.w / 2, y: oy, z: 2, color: [1, 1, 1, yes ? 0.96 : 0.7] });
    }
    // VOTE BELOW + bouncing arrow
    if (t > ta) {
      const pa = spring(t - ta, 1.5, 0.55);
      const bounce = -26 * Math.abs(Math.sin(Math.PI * (t - ta - 0.3) / 0.75)) * seg(t, ta + 0.3, ta + 0.5);
      const vn = { y: L.voteY + (1 - pa) * -120, z: 4, s: lerp(1, 0.2, melt), opacity: seg(t, ta, ta + 0.2) * (1 - seg(t, TL.s8 + 0.05, TL.s8 + 0.45)) };
      const gl = E.glassLetters('VOTE BELOW', gstyle(L.voteSize));
      for (const le of gl.letters) glass({ kind: 'tex', tex: le, parent: vn, x: le.cx * lerp(1, 0.3, melt), z: 0, depth: 0.8 });
      const an = { parent: vn, y: L.arrowY - L.voteY + bounce, z: 2 };
      glass({ kind: 'poly', parent: an, pts: [[0, 30], [0, -40]], th: 9, bevel: 9, depth: 0.85 });
      glass({ kind: 'poly', parent: an, pts: [[-30, -12], [0, -44], [30, -12]], th: 9, bevel: 9, depth: 0.85 });
      under({ kind: 'glow', x: 0, y: L.arrowY + bounce, sx3: 70, sy3: 80, color: [1, 0.55, 0.85, 0.5 * vn.opacity] });
    }
    return wn;
  }

  // ------------------------------------------------------------ SCENE 8 — outro
  function outro(t) {
    if (t < TL.s8 - 0.1) return;
    const cy = P ? 120 : 20;
    // melt everything into one drop
    const tm = TL.s8;
    const seeds = P
      ? [[-330, 360, 58], [130, 360, 58], [-330, 170, 52], [130, 170, 52], [400, 360, 40], [400, 170, 36], [0, -440, 50], [0, -505, 40], [0, 300, 112]]
      : [[-300, 188, 55], [150, 188, 55], [-300, 18, 50], [150, 18, 50], [400, 188, 38], [400, 18, 34], [0, -300, 48], [0, -362, 38], [0, 118, 108]];
    const fall0 = TL.s8 + 1.2, hit = TL.s8 + 1.8;
    if (t < hit) {
      const balls = [];
      seeds.forEach(([x, y, r], i) => {
        const m = eio(seg(t, tm - 0.05 + i * 0.03, tm + 0.8 + i * 0.03));
        const g = eo(seg(t, tm - 0.05 + i * 0.02, tm + 0.35 + i * 0.02));
        const rr = (i === 8 ? lerp(40, 108, m) : lerp(r, r * 0.6, m)) * g;
        balls.push([lerp(x, 0, m), lerp(y, cy, m), Math.max(rr, 0.5)]);
      });
      const wob = Math.sin((t - tm) * 13) * Math.exp(-Math.max(0, t - tm - 0.9) * 3) * 0.05 * seg(t, tm + 0.6, tm + 0.9);
      const f = ei(seg(t, fall0, hit));
      const dn = { y: lerp(0, -60, f), z: lerp(0, -1100, f), sx: 1 + wob - 0.12 * f, sy: 1 - wob + 0.18 * f, opacity: 1 - seg(t, hit - 0.06, hit) };
      under({ kind: 'glow', x: 0, y: cy, sx3: 160, sy3: 160, color: [0.7, 0.5, 1.0, 0.35 * seg(t, tm + 0.4, tm + 1.0) * dn.opacity] });
      glass({ kind: 'blobs', parent: dn, balls, k: 70, bevel: 60, depth: 0.9, refr: 2.5, tint: [1, 1, 1, 0.03], opacity: seg(t, tm - 0.05, tm + 0.1) * dn.opacity });
    }
    // impact: glass ripples on the surface
    for (let k = 0; k < 3; k++) {
      const a = t - (hit + k * 0.22);
      if (a < 0 || a > 2.0) continue;
      const u = a / 2.0;
      const R = 20 + (P ? 1100 : 1000) * eo(u);
      const th = lerp(9, 2.2, u) * (1 - k * 0.25);
      glass({ kind: 'arc', y: cy - 60, z: -40, rx: 0, R, th, a0: 0, a1: 7, bevel: th, depth: 0.9, opacity: Math.pow(1 - u, 1.3) * 0.9, sy: 0.9 });
    }
    if (t > hit && t < hit + 0.5) light({ kind: 'glow', y: cy - 60, z: -40, sx3: 160, sy3: 120, color: [1, 0.9, 1, 0.8 * (1 - (t - hit) / 0.5)] });
    // final title
    const FT = L.finalTitle;
    const tt = hit + 0.25;
    if (t > tt) {
      const fade = eio(seg(t, TL.end - 1.6, TL.end - 0.4));
      let order = [];
      for (const [text, ly] of FT.lines) {
        const gl = E.glassLetters(text, gstyle(FT.size));
        for (const le of gl.letters) order.push([le, ly]);
      }
      order = order.map((o, i) => [o[0], o[1], Math.abs(o[0].cx) + Math.abs(o[1]) * 0.6]).sort((a, b) => a[2] - b[2]);
      order.forEach(([le, ly], k) => {
        const tk = tt + k * 0.035;
        if (t < tk) return;
        const p = spring(t - tk, 1.5, 0.55);
        const cp = clamp(p);
        glass({ kind: 'tex', tex: le, x: lerp(0, le.cx, eo(cp)), y: lerp(cy - 60, ly + cy * 0.3, p) + fade * 24, z: lerp(-240, 0, cp), s: lerp(0.2, 1, p) * (1 + 0.04 * fade), rx: (1 - cp) * 40, opacity: seg(t, tk, tk + 0.15) * (1 - fade), depth: 0.85 });
      });
      sparkles(t, tt + 0.9, TL.end - 1.6, 0, cy * 0.3, P ? 900 : 1500, P ? 380 : 180, 909, 34, 20);
    }
  }

  // ------------------------------------------------------------ frame
  const RIPPLES = [[0, 0, 0.25, 1.0], [0, 0, 1.35, 0.45], [0, -0.03, 53.2 + 1.8, 1.7], [0, -0.03, 53.2 + 2.05, 0.8]];
  const SWEEPS = [[2.9, 1.0], [TL.s2 + 1.1, 1.0], [TL.s3 + 2.6, 0.9], [TL.s5 + 1.5, 1.0], [TL.s6 + 0.9, 0.9], [TL.s7 + 1.3, 1.0], [TL.s8 + 3.2, 1.2]];
  function frame(t, index) {
    S = [];
    CAM = camera(t);
    hook(t);
    const card = cardDock(t);
    requirementExtras(t, card);
    tiles(t); counter(t); tasks(t);
    rewards(t); language(t); poll(t); outro(t);
    const ripples = [];
    for (const [x, y, t0, amp] of RIPPLES) {
      const age = t - t0;
      if (age > 0 && age < 4.5) ripples.push([x * DW / DH, P ? y + 0.06 : y, age, amp]);
    }
    let sweep = { dir: [1, 0.35], pos: -9, width: 0.12, amp: 0 };
    for (const [t0, dur] of SWEEPS) {
      const u = (t - t0) / dur;
      if (u > 0 && u < 1) sweep = { dir: [1, 0.35], pos: lerp(-1.4, 1.4, eio(u)), width: 0.13, amp: Math.sin(Math.PI * u) };
    }
    return {
      t, frame: index, cam: CAM, ripples, sweep,
      light: [-0.45 + 0.12 * Math.sin(t * 0.3), 0.75, 0.55],
      fade: eo(seg(t, 0, 0.45)), sprites: S,
    };
  }

  // ------------------------------------------------------------ sound cues (consumed by audio/synth.py)
  function cues() {
    const c = [];
    const q = (t, type, o = {}) => c.push(Object.assign({ t: +t.toFixed(3), type }, o));
    q(0.0, 'swell', { dur: 2.0 }); q(0.25, 'drip', { pitch: 0 }); q(1.3, 'morph');
    for (let k = 0; k < 17; k++) q(1.8 + k * 0.05, 'glint', { pitch: k % 5, gain: 0.35 });
    q(2.9, 'shimmer'); q(3.3, 'pop', { pitch: 2 });
    q(TL.s2 - 0.25, 'whoosh', { dir: 'up' }); for (let k = 0; k < 6; k++) q(TL.s2 - 0.1 + k * 0.07, 'drip', { pitch: k + 2, gain: 0.45 });
    q(TL.s2 + 0.3, 'flip'); q(TL.s2 + 1.1, 'shimmer', { gain: 0.6 }); q(TL.s2 + 2.35, 'pop', { pitch: 4 }); q(TL.s2 + 2.4, 'chime', { note: 76 });
    q(TL.s2 + 3.4, 'swing'); q(TL.s2 + 4.4, 'whoosh', { dir: 'in', gain: 0.6 }); q(TL.s2 + 4.95, 'draw', { dur: 0.6 }); q(TL.s2 + 5.5, 'click');
    q(TL.s3 - 0.3, 'morph', { gain: 0.8 });
    for (let i = 0; i < 7; i++) q(tileTime(i) + 0.22, 'tick', { pitch: i });
    q(TL.s3 + 3.2, 'pop', { pitch: 1 }); q(TL.s3 + 3.35, 'riser', { dur: 1.35 }); q(TL.s3 + 4.7, 'chime', { note: 79 }); q(TL.s3 + 3.65, 'pop', { pitch: 3, gain: 0.6 });
    q(TL.s4 - 0.15, 'whoosh', { dir: 'in' }); q(TL.s4 + 0.6, 'shimmer', { gain: 0.5 });
    const scale = [72, 74, 76, 79, 81, 84, 86];
    for (let i = 0; i < 7; i++) { q(checkTime(i), 'check', { note: scale[i] }); }
    q(checkTime(6) + 0.3, 'chime', { note: 91, gain: 0.7 });
    q(TL.s5, 'burst'); q(TL.s5 + 0.45, 'whoosh', { dir: 'up', gain: 0.7 }); q(TL.s5 + 1.25, 'pop', { pitch: 3 }); q(TL.s5 + 1.3, 'whoosh', { dir: 'up', gain: 0.5 });
    q(TL.s5 + 1.5, 'shimmer', { gain: 0.7 }); q(TL.s5 + 2.7, 'open'); q(TL.s5 + 2.95, 'magic', { dur: 2.5 });
    q(TL.s6 - 0.15, 'whoosh', { dir: 'out' }); q(TL.s6 + 0.35, 'pop', { pitch: 2 });
    for (let k = 0; k < 4; k++) q(TL.s6 + 0.8 + k * 1.5, 'pulse', { gain: 0.5 });
    q(TL.s6 + 1.4, 'click'); q(TL.s6 + 2.9, 'denied');
    q(TL.s6 + 4.4, 'whoosh', { dir: 'up', gain: 0.7 }); q(TL.s6 + 4.75, 'pop', { pitch: 1 }); q(TL.s6 + 5.0, 'pop', { pitch: 3 });
    const tf = TL.s6 + 4.75 + 0.25 + 0.3 + 0.4;
    for (let t = tf; t < TL.s7 - 0.4; t += 1.6) { q(t, 'flow'); q(t + 1.5, 'chime', { note: 84, gain: 0.35 }); }
    q(TL.s7 - 0.2, 'whoosh', { dir: 'out' }); q(TL.s7 + 0.2, 'whoosh', { dir: 'up' }); q(TL.s7 + 1.3, 'shimmer', { gain: 0.6 });
    q(TL.s7 + 1.4, 'fill', { dur: 2.6 });
    for (let k = 0; k < 18; k++) q(TL.s7 + 1.5 + k * 0.13, 'glint', { pitch: k % 7, gain: 0.18 });
    q(TL.s7 + 3.9, 'chime', { note: 88 });
    q(TL.s7 + 6.2, 'pop', { pitch: 2 });
    for (let k = 0; k < 6; k++) q(TL.s7 + 6.2 + 0.3 + k * 0.75, 'bounce', { gain: 0.5 });
    q(TL.s8 - 0.1, 'melt'); q(TL.s8 + 1.2, 'fall'); q(TL.s8 + 1.8, 'impact');
    q(TL.s8 + 2.1, 'shimmer', { gain: 0.8 }); q(TL.s8 + 3.2, 'magic', { dur: 2.2, gain: 0.6 }); q(TL.s8 + 2.4, 'chime', { note: 72 }); q(TL.s8 + 2.55, 'chime', { note: 79 }); q(TL.s8 + 2.7, 'chime', { note: 84 });
    return c.sort((a, b) => a.t - b.t);
  }

  return { setup, frame, cues, TL, VO_OFFSET };
})();
