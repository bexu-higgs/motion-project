'use strict';
// Timeline + all eight scenes (v2: iOS dark style — black, purple, green; solid typography; site screenshots).
// frame(t) returns a frame description for Engine.draw(). Every event time lives in EV so the whole
// piece can be re-timed against the voice-over from one place.
window.Scenes = (() => {
  const { clamp, lerp, seg, eo, ei, eio, sine, spring, wobble, rng, bezier } = U;
  const D2R = Math.PI / 180;

  const VO_OFFSET = 0.25;
  // event times (seconds, video time)
  const EV = {
    sphere: 0.25, morph: 1.3, title: 1.75, sweep1: 2.9, pill: 3.3,
    s2: 4.95, card: 5.3, badge: 7.3, tag: 8.35, thumb: 9.35, arrow: 9.9,
    s3: 11.95, tiles: 12.5, ring: 15.15,
    s4: 17.7, check0: 18.6, checkStep: 0.6,
    s5: 23.25, cert: 23.7, gift: 24.5, open: 25.95,
    s6: 29.95, en: 30.3, kz: 31.35, kzTry: 32.85, menu: 32.0, cards: 34.7,
    s7: 41.7, poll: 41.9, fill: 43.1, vote: 47.9,
    s8: 53.2, end: 60.0,
  };
  const TL = { s1: 0, s2: EV.s2, s3: EV.s3, s4: EV.s4, s5: EV.s5, s6: EV.s6, s7: EV.s7, s8: EV.s8, end: EV.end };

  // palette
  const GREEN = [0.651, 0.949, 0.239], PURPLE = [0.545, 0.361, 0.965], LAV = [0.769, 0.710, 0.992];
  const rgba = (c, a = 1) => [c[0], c[1], c[2], a];
  const G_WHITE = [[0, '#FFFFFF'], [1, '#D6CEFF']];
  const G_GREEN = [[0, '#DFFF9A'], [1, '#8EDB25']];
  const G_ACCENT = [[0, '#B79CFF'], [0.5, '#D8CCFF'], [1, '#A6F23D']];
  const H1 = { family: 'Inter Display', weight: 800 };
  const LBL = { family: 'Inter Display', weight: 600 };
  const DARK = [0.045, 0.045, 0.075, 0.46];

  let E, P, DW, DH, D, L, IMG = {}, ICON = {};
  let S = [], CAM = null, NOW = 0;

  // ------------------------------------------------------------ layouts
  const LAND = {
    title: { size: 118, lines: [['HIGGSFIELD ACADEMY', 34]] }, panelH: 480, pillY: -110,
    cardX: -360, cardY: 0, cw: 600, ch: 700, maxSize: 236, maxY: 70, divY: -58, credSize: 58, credY: -132,
    tagX: 205, tagY: -215,
    thX: 470, thY: 95, thW: 600,
    arrow: [[-55, -360], [90, -455], [250, -430], [292, -208]],
    dockY: -250, dockW: 1660, dockH: 300, dockR: 64,
    pitch: 222, tw: 196, th: 246, tr: 30, shotW: 172, shotY: 50, shotR: 14, numSize: 88, numY: -66,
    cntY: 225, cntSize: 196, lesSize: 112, ringR: 96, hSize: 104,
    boxGap: 62, box: 56, barY: -532, barW: 1480, barH: 16, pct: 24,
    zoom4: 0.92, ty4: -110, hwY: 92, hwW: 600, hwMaxH: 330, labelY: 318, pan4: 120,
    certX: -360, certY: -10, certW: 640, certTitleY: 300,
    giftX: 420, giftY: -150, dropY: 300,
    enX: -420, enY: 10, enR: 150, enSize: 120, kzX: -70, kzY: 10, kzLabelDX: 150, menuX: 470, menuY: 10, menuW: 380,
    c1: [-450, 0], c2: [450, 0], cW: 560, cH: 380, cTitle: 64, tubeLen: 380, tubeRot: 0,
    pollY: 40, pollUpY: 118, pollW: 1000, pollH: 580, optW: 880, optH: 118, yesY: 70, noY: -100, optSize: 56, pct2: 42,
    voteY: -300, voteSize: 66, arrowY: -372,
    finalTitle: { size: 118, lines: [['HIGGSFIELD ACADEMY', 20]] }, finalPillY: -110,
    tasksLabel: 'TASKS AFTER EVERY STAGE', tasksSize: 54,
  };
  const PORT = {
    title: { size: 132, lines: [['HIGGSFIELD', 105], ['ACADEMY', -45]] }, panelH: 600, pillY: -215,
    cardX: 0, cardY: 400, cw: 660, ch: 700, maxSize: 250, maxY: 70, divY: -58, credSize: 62, credY: -134,
    tagX: 240, tagY: -215,
    thX: 0, thY: -470, thW: 860,
    arrow: [[255, -30], [265, -120], [150, -120], [70, -188]],
    dockY: -380, dockW: 1020, dockH: 230, dockR: 52,
    pitch: 138, tw: 124, th: 176, tr: 22, shotW: 110, shotY: 36, shotR: 10, numSize: 60, numY: -46,
    cntY: 380, cntSize: 210, lesSize: 116, ringR: 100, hSize: 112, ringRowY: 60,
    boxGap: 50, box: 44, barY: -612, barW: 960, barH: 14, pct: 22,
    zoom4: 1.0, ty4: -90, hwY: 240, hwW: 940, hwMaxH: 560, labelY: 650, pan4: 0,
    certX: 0, certY: 430, certW: 860, certTitleY: 330,
    giftX: 0, giftY: -560, dropY: 330,
    enX: 0, enY: 420, enR: 170, enSize: 132, kzX: -60, kzY: 90, kzLabelDX: 160, menuX: 0, menuY: -420, menuW: 560,
    c1: [0, 400], c2: [0, -400], cW: 820, cH: 470, cTitle: 76, tubeLen: 420, tubeRot: -90,
    pollY: 230, pollUpY: 300, pollW: 960, pollH: 700, optW: 840, optH: 130, yesY: 60, noY: -130, optSize: 62, pct2: 46,
    voteY: -440, voteSize: 74, arrowY: -525,
    finalTitle: { size: 140, lines: [['HIGGSFIELD', 95], ['ACADEMY', -85]] }, finalPillY: -300,
    tasksLabel: 'TASKS AFTER EVERY STAGE', tasksSize: 50,
  };

  // ------------------------------------------------------------ sprite helpers
  const add = (layer, o) => { o.layer = layer; S.push(o); return o; };
  const frost = (o) => add('frost', Object.assign({ kind: 'rrect' }, o));
  const glass = (o) => add('glass', Object.assign({ kind: 'rrect' }, o));
  const flat = (o) => add('content', o);
  const light = (o) => add('overlay', Object.assign({ blend: 'add' }, o));
  const under = (o) => add('under', Object.assign({ blend: 'add' }, o));
  const hstyle = (size, st) => Object.assign({}, H1, { size, track: -0.022 * size, grad: G_WHITE }, st || {});
  const fstyle = (size, st) => Object.assign({}, LBL, { size }, st || {});
  const panel = (o) => frost(Object.assign({ bevel: 26, tint: DARK }, o));

  // flat text sprite (no animation)
  function text(str, size, o, st) {
    return flat(Object.assign({ kind: 'tex', tex: E.flatText(str, st || fstyle(size)), color: [1, 1, 1, 1] }, o));
  }
  // per-letter textures of a line, with x centres relative to the line centre
  function letters(str, st) {
    const total = E.measure(str, st);
    const out = [];
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === ' ') continue;
      const pre = E.measure(str.slice(0, i), st) + (i ? st.track || 0 : 0);
      out.push({ tex: E.flatText(ch, st), cx: pre + E.measure(ch, st) / 2 - total / 2, i });
    }
    return { letters: out, w: total };
  }
  // iOS-style text reveal: each letter rises, sharpens out of a blur and settles on a spring.
  // o: {t0, te (exit start), stagger, x, y, z, parent, color, st (style overrides)}
  function headline(str, size, o) {
    const st = hstyle(size, o.st);
    const { letters: ls, w } = letters(str, st);
    const ex = o.te != null ? eio(seg(NOW, o.te, o.te + (o.td || 0.45))) : 0;
    const stg = o.stagger == null ? 0.028 : o.stagger;
    for (const le of ls) {
      const tk = o.t0 + le.i * stg;
      if (NOW < tk) continue;
      const p = spring(NOW - tk, 1.55, 0.66);
      const a = seg(NOW, tk, tk + 0.22) * (1 - ex);
      if (a <= 0.001) continue;
      flat({ kind: 'tex', tex: le.tex, parent: o.parent, x: (o.x || 0) + le.cx, y: (o.y || 0) - (1 - p) * size * 0.38 + ex * size * 0.3,
        z: o.z || 2, s: lerp(0.9, 1, clamp(p)), blur: (1 - clamp(p)) * 3.2 + ex * 3, opacity: a, color: o.color || [1, 1, 1, 1] });
    }
    return w;
  }
  // a whole block that blurs in (for gradients that must span the full word)
  function block(str, size, o) {
    const st = Object.assign(hstyle(size), o.st || {});
    const tex = E.flatText(str, st);
    const p = spring(NOW - o.t0, 1.4, 0.68);
    const ex = o.te != null ? eio(seg(NOW, o.te, o.te + (o.td || 0.45))) : 0;
    const a = seg(NOW, o.t0, o.t0 + 0.3) * (1 - ex);
    if (NOW >= o.t0 && a > 0.001) {
      flat({ kind: 'tex', tex, parent: o.parent, x: o.x || 0, y: (o.y || 0) - (1 - p) * size * 0.3 + ex * size * 0.25, z: o.z || 2,
        s: lerp(0.94, 1, clamp(p)) * (o.s || 1), blur: (1 - clamp(p)) * 3 + ex * 3, opacity: a, color: o.color || [1, 1, 1, 1] });
    }
    return tex.w;
  }
  // pill: solid green (fill) or dark glass
  function chip(str, o) {
    const size = o.size || 24;
    const tex = E.flatText(str, fstyle(size, { weight: 700, track: o.track == null ? 5 : o.track }));
    const h = o.h || size * 2.6;
    const icon = o.icon ? h * 0.55 : 0;
    const w = tex.w + h * 1.15 + icon;
    const n = { parent: o.parent, x: o.x || 0, y: o.y || 0, z: o.z || 6, rz: o.rz || 0, s: o.s == null ? 1 : o.s, opacity: o.opacity == null ? 1 : o.opacity };
    if (o.green) {
      under({ kind: 'glow', parent: n, sx3: w * 0.55, sy3: h * 0.9, color: rgba(GREEN, 0.55) });
      frost({ parent: n, w, h, r: h / 2, bevel: h * 0.22, tint: [GREEN[0], GREEN[1], GREEN[2], 0.93] });
      flat({ kind: 'tex', tex, parent: n, x: icon / 2, z: 1, color: [0.03, 0.04, 0.02, 1] });
    } else if (o.purple) {
      under({ kind: 'glow', parent: n, sx3: w * 0.55, sy3: h * 0.9, color: rgba(PURPLE, 0.6) });
      frost({ parent: n, w, h, r: h / 2, bevel: h * 0.22, tint: [PURPLE[0], PURPLE[1], PURPLE[2], 0.86] });
      flat({ kind: 'tex', tex, parent: n, x: icon / 2, z: 1, color: [1, 1, 1, 1] });
    } else {
      frost({ parent: n, w, h, r: h / 2, bevel: h * 0.22, tint: [0.08, 0.08, 0.11, 0.55] });
      flat({ kind: 'tex', tex, parent: n, x: icon / 2, z: 1, color: [1, 1, 1, 0.94] });
    }
    if (o.icon) flat({ kind: 'tex', tex: o.icon, parent: n, x: -w / 2 + h * 0.5 + icon * 0.2, z: 1, s: o.iconS || 0.8, color: o.green ? [0.03, 0.04, 0.02, 1] : [1, 1, 1, 0.9] });
    return { n, w, h };
  }
  // a Safari-like glass window that frames a site screenshot
  function windowCard(img, o) {
    const w = o.w, ih = w / img.aspect, bar = o.bar == null ? Math.max(36, w * 0.07) : o.bar;
    const W = w + 24, Hh = ih + bar + 24;
    const n = { parent: o.parent, x: o.x || 0, y: o.y || 0, z: o.z || 0, rx: o.rx || 0, ry: o.ry || 0, rz: o.rz || 0, s: o.s == null ? 1 : o.s, opacity: o.opacity == null ? 1 : o.opacity };
    if (o.glow) under({ kind: 'glow', parent: n, sx3: W * 0.6, sy3: Hh * 0.6, color: o.glow });
    panel({ parent: n, w: W, h: Hh, r: o.r || 30, bevel: 22 });
    const by = Hh / 2 - 12 - bar / 2;
    if (bar > 0) {
      for (let k = 0; k < 3; k++) flat({ kind: 'fill', parent: n, x: -W / 2 + 30 + k * 18, y: by, z: 1, w: 10, h: 10, r: 5, color: [1, 1, 1, 0.22] });
      const url = E.flatText(o.url || 'higgsfield.ai/academy', fstyle(Math.max(14, bar * 0.36), { weight: 500 }));
      const uw = Math.min(w * 0.62, url.w + bar * 1.4);
      flat({ kind: 'fill', parent: n, y: by, z: 1, w: uw, h: bar * 0.62, r: bar * 0.31, color: [1, 1, 1, 0.07] });
      flat({ kind: 'tex', tex: ICON.lock, parent: n, x: -url.w / 2 - bar * 0.28, y: by, z: 2, s: bar * 0.013, color: [1, 1, 1, 0.45] });
      flat({ kind: 'tex', tex: url, parent: n, x: bar * 0.12, y: by, z: 2, color: [1, 1, 1, 0.55] });
    }
    flat({ kind: 'tex', tex: img, parent: n, y: -Hh / 2 + 12 + ih / 2, z: 1, w, h: ih, r: o.ir || 16, color: [1, 1, 1, 1] });
    return { n, W, H: Hh, imgY: -Hh / 2 + 12 + ih / 2, ih };
  }

  // ------------------------------------------------------------ setup
  function setup(engine, opts, images) {
    E = engine; P = opts.portrait; DW = opts.DW; DH = opts.DH;
    D = (DH / 2) / Math.tan(15 * D2R);
    L = P ? PORT : LAND;
    for (const key of ['title', 'finalTitle']) {
      const tt = L[key];
      const widest = Math.max(...tt.lines.map(([s]) => E.measure(s, hstyle(1, { track: -0.022 }))));
      tt.size = Math.min(tt.size, (DW - (P ? 150 : 280)) / widest);
    }
    for (const k in images) IMG[k] = Array.isArray(images[k]) ? images[k].map((im, i) => E.image(k + i, im)) : E.image(k, images[k]);
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
    ICON.seal = E.flatShape('seal', 18, 18, (c) => {
      c.fillStyle = '#fff';
      c.beginPath();
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, r = k % 2 ? 13 : 16; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill();
      c.globalCompositeOperation = 'destination-out'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(-6, 0); c.lineTo(-1.5, 4.5); c.lineTo(6.5, -4); c.stroke();
    });
    ICON.globe = E.flatShape('globe', 20, 20, (c) => {
      c.strokeStyle = '#fff'; c.lineWidth = 2.6;
      c.beginPath(); c.arc(0, 0, 15, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(0, 0, 6.5, 15, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(-15, 0); c.lineTo(15, 0); c.stroke();
    });
    for (let n = 0; n <= 7; n++) E.flatText(String(n), hstyle(L.cntSize, { grad: G_GREEN }));
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
        const pan = lerp(-L.pan4, L.pan4, sine(seg(t, TL.s4 + 0.45, TL.s4 + 4.9)));
        st.dist = D * lerp(1.0, L.zoom4, k1) * (1 - 0.03 * seg(t, TL.s4, TL.s5));
        st.tx = pan * k1;
        st.ty = lerp(P ? -40 : -10, L.ty4, k1);
        st.yaw = 2.5 * Math.sin((t - TL.s4) * 0.8) * k1;
        break;
      }
      case 4: st.dist = D * 0.97; st.yaw = lerp(-9, 9, sine(seg(t, TL.s5 + 0.2, TL.s6 + 0.3))); st.elev = 25; break;
      case 5: st.dist = D * (1.0 - 0.05 * seg(t, TL.s6, TL.s7)); st.yaw = 2 * Math.sin(t * 0.25); break;
      case 6: st.dist = D * (1.0 - 0.04 * seg(t, TL.s7, TL.s8)); st.ty = P ? 0 : 10; break;
      case 7: st.dist = D * (1.0 - 0.035 * seg(t, TL.s8, TL.end)); break;
    }
    return st;
  }
  const BLEND = [null, [-0.2, 0.8], [-0.2, 0.9], [0, 0.01], [-0.1, 0.95], [-0.1, 0.8], [-0.1, 0.8], [-0.1, 0.8]];
  function camera(t) {
    const b = [TL.s1, TL.s2, TL.s3, TL.s4, TL.s5, TL.s6, TL.s7, TL.s8];
    let st = camState(0, t);
    for (let j = 1; j < 8; j++) {
      const w = eio(seg(t, b[j] + BLEND[j][0], b[j] + BLEND[j][0] + BLEND[j][1]));
      if (w <= 0) break;
      const n = camState(j, t);
      for (const k in st) st[k] = lerp(st[k], n[k], w);
    }
    const dx = 14 * Math.sin(t * 0.21) + 5 * Math.sin(t * 0.53), dy = 9 * Math.sin(t * 0.17 + 1) + 4 * Math.sin(t * 0.41);
    const yaw = st.yaw * D2R;
    const cam = { x: st.tx + Math.sin(yaw) * st.dist + dx, y: st.ty + st.elev + dy, z: Math.cos(yaw) * st.dist, tx: st.tx + dx * 0.6, ty: st.ty + dy * 0.6, tz: 0, fov: 30, roll: 0.004 * Math.sin(t * 0.3) };
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
      const vx = (r() - 0.5) * 300, vy = 140 + r() * 340, rad = 6 + r() * 10, delay = r() * 0.12;
      const a = age0 - delay;
      if (a < 0 || a > life) continue;
      const rr = rad * (1 - Math.pow(a / life, 2)) * Math.min(1, a * 14);
      if (rr < 0.8) continue;
      const wob = 1 + 0.12 * Math.sin(a * 32);
      glass({ x: x + dx + vx * a, y: y + dy + vy * a - 520 * a * a, z, w: rr * 2 * wob, h: rr * 2 / wob, r: rr, bevel: rr, depth: 0.95, tint: [0.8, 0.7, 1, 0.05] });
    }
  }
  function sparkles(t, t0, t1, cx, cy, w, h, seed, n, z = 20) {
    if (t < t0 || t > t1 + 1) return;
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const st = lerp(t0, t1, r()), life = 0.5 + r() * 0.6, x = cx + (r() - 0.5) * w, y = cy + (r() - 0.5) * h, sz = 3 + r() * 5;
      const col = r() < 0.5 ? [0.85, 1, 0.6] : [0.85, 0.75, 1];
      const a = (t - st) / life;
      if (a < 0 || a > 1) continue;
      const k = Math.sin(Math.PI * a);
      light({ kind: 'glow', x, y, z, sx3: sz, sy3: sz, color: [col[0], col[1], col[2], 0.95 * k] });
      light({ kind: 'glow', x, y, z, sx3: sz * 5, sy3: sz * 0.45, color: [col[0], col[1], col[2], 0.5 * k] });
      light({ kind: 'glow', x, y, z, sx3: sz * 0.45, sy3: sz * 5, color: [col[0], col[1], col[2], 0.5 * k] });
    }
  }
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
    const widest = Math.max(...T1.lines.map(([s]) => E.measure(s, hstyle(T1.size))));
    const panelW = Math.min(widest + (P ? 140 : 240), DW - 60), panelH = L.panelH;
    const out = eio(seg(t, TL.s2 - 0.2, TL.s2 + 0.45));
    const mm = spring(t - EV.morph, 1.05, 0.72);
    const cm = clamp(mm);
    const node = { y: out * 260, rx: 4 * Math.sin(t * 0.9) * cm, ry: 5 * Math.sin(t * 0.7 + 0.4) * cm, opacity: 1 - out };
    const ts = t - EV.sphere;
    if (ts > 0) {
      const g = spring(ts, 1.15, 0.5);
      const wob = Math.sin(ts * 11) * Math.exp(-ts * 2.6) * 0.12;
      const R0 = (P ? 175 : 150) * Math.max(0, g);
      const hw = lerp(R0 * (1 + wob), panelW / 2, mm), hh = lerp(R0 * (1 - wob), panelH / 2, mm);
      const rad = lerp(Math.min(hw, hh), 72, cm), bev = lerp(R0 * 0.98, 30, cm);
      const y0 = (1 - clamp(g)) * -90;
      const gA = 1 - seg(t, EV.morph + 0.1, EV.morph + 0.65), fA = seg(t, EV.morph + 0.05, EV.morph + 0.55);
      under({ kind: 'glow', y: y0, sx3: R0 * 0.9 + 1, sy3: R0 * 0.9 + 1, color: rgba(PURPLE, 0.9 * (1 - cm) * (1 - out)) });
      under({ kind: 'glow', x: -hw * 0.5, y: y0 + hh * 0.3, sx3: hw * 0.7 + 1, sy3: hh * 0.8 + 1, color: rgba(PURPLE, 0.45 * cm * (1 - out)) });
      under({ kind: 'glow', x: hw * 0.55, y: y0 - hh * 0.35, sx3: hw * 0.55 + 1, sy3: hh * 0.7 + 1, color: rgba(GREEN, 0.25 * cm * (1 - out)) });
      if (gA > 0) glass({ parent: node, y: y0, w: hw * 2, h: hh * 2, r: rad, bevel: bev, depth: 0.95, opacity: gA, refr: lerp(6, 1, cm), tint: [0.06, 0.05, 0.1, 0.18] });
      if (fA > 0) panel({ parent: node, y: y0, w: hw * 2, h: hh * 2, r: rad, bevel: bev, opacity: fA });
    }
    let k = 0;
    for (const [str, ly] of T1.lines) {
      const st = hstyle(T1.size);
      const { letters: ls } = letters(str, st);
      for (const le of ls) {
        const t0 = EV.title + k * 0.045;
        const p = spring(t - t0, 1.5, 0.6);
        const a = seg(t, t0, t0 + 0.2);
        const tx0 = TL.s2 - 0.25 + k * 0.016;
        const e = ei(seg(t, tx0, tx0 + 0.32));
        if (a > 0 && e < 1) flat({ kind: 'tex', tex: le.tex, parent: node, x: le.cx, y: ly - (1 - p) * 70 + e * 90, z: 4, s: lerp(0.86, 1, clamp(p)) * (1 - 0.4 * e), blur: (1 - clamp(p)) * 3.5 + e * 2, opacity: a * (1 - e) });
        droplets(t, tx0 + 0.1, le.cx, ly + node.y + 40, 1000 + k, 3, T1.size * 0.5);
        k++;
      }
    }
    if (t > EV.pill) {
      const pp = spring(t - EV.pill, 1.9, 0.5);
      chip('OFFICIAL COURSE', { parent: node, y: L.pillY, z: 6, s: lerp(0.4, 1, pp), opacity: seg(t, EV.pill, EV.pill + 0.15), green: true, size: P ? 28 : 24, icon: ICON.seal, iconS: 0.9 });
    }
  }

  // ------------------------------------------------------------ SCENE 2 — requirement (card that becomes the dock)
  function cardDock(t) {
    if (t < EV.card - 0.05 || t > TL.s5 + 1.0) return null;
    const flip = spring(t - EV.card, 0.95, 0.55);
    const d = spring(t - (TL.s3 - 0.2), 1.05, 0.75);
    const cd = clamp(d);
    const fb = eio(seg(t, TL.s5, TL.s5 + 0.7));
    const tilt = 1 - cd;
    const node = {
      x: lerp(L.cardX, 0, d), y: lerp(L.cardY, L.dockY, d) + (1 - clamp(flip)) * -40, z: -fb * 500,
      ry: (lerp(-100, 0, flip) + 4 * Math.sin(t * 0.7)) * tilt,
      rx: (12 * (1 - clamp(flip)) + 3 * Math.sin(t * 0.9 + 1)) * tilt,
      opacity: seg(t, EV.card, EV.card + 0.25) * (1 - fb),
    };
    const w = lerp(L.cw, L.dockW, d), h = lerp(L.ch, L.dockH, d);
    if (tilt > 0.01) {
      under({ kind: 'glow', x: node.x - w * 0.2, y: node.y + h * 0.25, sx3: w * 0.5, sy3: h * 0.45, color: rgba(PURPLE, 0.55 * node.opacity * tilt) });
      under({ kind: 'glow', x: node.x + w * 0.25, y: node.y - h * 0.3, sx3: w * 0.4, sy3: h * 0.35, color: rgba(GREEN, 0.28 * node.opacity * tilt) });
    }
    panel({ parent: node, w, h, r: lerp(62, L.dockR, cd), bevel: 30 });
    const facing = Math.cos(node.ry * D2R) > 0.06 ? 1 : 0;
    const cA = facing * (1 - seg(t, TL.s3 - 0.35, TL.s3 - 0.08));
    if (cA > 0) {
      const cn = { parent: node, opacity: cA, z: 1 };
      text('SUBSCRIPTION', 22, { parent: cn, y: L.ch / 2 - 74, color: [1, 1, 1, 0.55] }, fstyle(22, { track: 8 }));
      block('MAX', L.maxSize, { parent: cn, y: L.maxY, z: 3, t0: EV.card + 0.35, st: { weight: 900, grad: G_ACCENT, gradH: true, track: -0.03 * L.maxSize } });
      flat({ kind: 'fill', parent: cn, y: L.divY, w: 340, h: 2, r: 1, color: [1, 1, 1, 0.16] });
      const ct = E.flatText('1800 CREDITS', hstyle(L.credSize, { weight: 700, grad: null, track: 0 }));
      const dotX = -ct.w / 2 - 26;
      if (t > EV.card + 0.6) {
        const q = spring(t - (EV.card + 0.6), 1.6, 0.6);
        flat({ kind: 'fill', parent: cn, x: dotX + 4, y: L.credY, z: 2, w: 18, h: 18, r: 9, s: clamp(q), color: rgba(GREEN) });
        under({ kind: 'glow', x: node.x + dotX + 4, y: node.y + L.credY, sx3: 30, sy3: 30, color: rgba(GREEN, 0.6 * cA * node.opacity) });
      }
      block('1800 CREDITS', L.credSize, { parent: cn, x: 12, y: L.credY, z: 3, t0: EV.card + 0.55, st: { weight: 700, grad: null, track: 0 } });
    }
    return node;
  }

  function requirementExtras(t, card) {
    if (!card || t > TL.s3 + 0.4) return;
    const ex = eio(seg(t, TL.s3 - 0.35, TL.s3 + 0.1));
    if (t > EV.badge) {
      const p = spring(t - EV.badge, 2.1, 0.42);
      chip('MIN. REQUIRED', { parent: card, x: L.cw / 2 - 70, y: L.ch / 2 - 8, z: 14, rz: 8, s: Math.max(0, p) * (1 - ex), opacity: seg(t, EV.badge, EV.badge + 0.08), green: true, size: 23, track: 3 });
    }
    if (t > EV.tag) {
      const drop = spring(t - EV.tag, 1.3, 0.6);
      const swing = -6 + 52 * wobble(t - EV.tag, 0.85, 0.15);
      const tn = { parent: card, x: L.tagX, y: L.tagY + (1 - drop) * 260, z: 18, rz: swing, s: 1 - ex, opacity: seg(t, EV.tag, EV.tag + 0.1) };
      glass({ parent: tn, z: 2, w: 18, h: 18, r: 9, bevel: 9, depth: 0.9 });
      flat({ kind: 'fill', parent: tn, y: -22, w: 3, h: 44, r: 1.5, color: [1, 1, 1, 0.5] });
      const body = { parent: tn, y: -123 };
      under({ kind: 'glow', x: card.x + L.tagX, y: card.y + L.tagY - 140, sx3: 110, sy3: 130, color: rgba(PURPLE, 0.75 * (1 - ex)) });
      frost({ parent: body, z: 1, w: 150, h: 190, r: 34, bevel: 20, hole: [0, 70, 13], tint: [PURPLE[0], PURPLE[1], PURPLE[2], 0.72] });
      text('-%', 70, { parent: body, y: -22, z: 3 }, hstyle(70, { weight: 800, grad: null }));
    }
    if (t > EV.thumb) {
      const p = spring(t - EV.thumb, 1.3, 0.62);
      const op = seg(t, EV.thumb, EV.thumb + 0.2) * (1 - ex);
      const wc = windowCard(IMG.hero, { x: L.thX + (P ? 0 : (1 - p) * 220), y: L.thY + 6 * Math.sin(t * 1.1) + (P ? (1 - p) * -200 : 0), ry: (P ? 0 : (1 - p) * -22) + 3 * Math.sin(t * 0.8), rx: 2 * Math.sin(t * 0.9), s: lerp(0.7, 1, p) * (1 - ex), opacity: op, w: L.thW, glow: rgba(PURPLE, 0.35 * op) });
      const pbn = { parent: wc.n, x: -L.thW / 2 + 60, y: wc.imgY - wc.ih / 2 + 60, z: 4 };
      flat({ kind: 'tex', tex: ICON.play, parent: pbn, z: 1, x: 3, s: 0.62, color: [1, 1, 1, 0.95] });
      glass({ parent: pbn, z: 2, w: 76, h: 76, r: 38, bevel: 26, depth: 0.8, tint: [0.1, 0.1, 0.14, 0.35] });
      chip('PREVIOUS LESSONS', { parent: wc.n, y: -wc.H / 2 - 52, z: 3, size: 22, track: 5 });
    }
    if (t > EV.arrow) {
      const [A0, A1, A2, A3] = L.arrow;
      const pr = eio(seg(t, EV.arrow, EV.arrow + 0.6));
      const pts = [];
      for (let i = 0; i <= 30; i++) pts.push(bezier(A0, A1, A2, A3, pr * i / 30));
      const op = 1 - ex;
      flat({ kind: 'stroke', pts, th: 4.5, glowR: 10, glowK: 0.8, z: 20, opacity: op, color: rgba(GREEN) });
      const ph = spring(t - (EV.arrow + 0.5), 2.2, 0.5);
      if (ph > 0) {
        const tip = A3, q = bezier(A0, A1, A2, A3, 0.96);
        let dx = tip[0] - q[0], dy = tip[1] - q[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
        const len = 30 * ph, a = 34 * D2R;
        const rot = (x, y, s) => [x * Math.cos(s) - y * Math.sin(s), x * Math.sin(s) + y * Math.cos(s)];
        const w1 = rot(-dx, -dy, a), w2 = rot(-dx, -dy, -a);
        flat({ kind: 'stroke', pts: [[tip[0] + w1[0] * len, tip[1] + w1[1] * len], tip, [tip[0] + w2[0] * len, tip[1] + w2[1] * len]], th: 4.5, glowR: 10, glowK: 0.8, z: 21, opacity: op, color: rgba(GREEN) });
      }
    }
  }

  // ------------------------------------------------------------ SCENE 3 — course structure
  const tileTime = (i) => EV.tiles + i * 0.17;
  function tiles(t) {
    if (t < EV.tiles - 0.1 || t > TL.s5 + 1.0) return;
    const fb = eio(seg(t, TL.s5, TL.s5 + 0.7));
    for (let i = 0; i < 7; i++) {
      const ti = tileTime(i);
      if (t < ti) continue;
      const p = spring(t - ti, 1.45, 0.55);
      const r = rng(100 + i);
      const done = t >= checkTime(i);
      const tn = { x: (i - 3) * L.pitch, y: L.dockY + (1 - p) * 950, z: 6 - fb * 500, rz: (1 - p) * (r() * 24 - 12), opacity: seg(t, ti, ti + 0.12) * (1 - fb) };
      panel({ parent: tn, w: L.tw, h: L.th, r: L.tr, bevel: 18, tint: done ? [0.12, 0.2, 0.06, 0.5] : [0.07, 0.07, 0.1, 0.5] });
      const im = IMG.lessons[i];
      flat({ kind: 'tex', tex: im, parent: tn, z: 1, y: L.shotY, w: L.shotW, h: L.shotW / im.aspect, r: L.shotR });
      if (i >= 5) flat({ kind: 'tex', tex: ICON.lock, parent: tn, z: 2, x: L.shotW / 2 - 16, y: L.shotY + L.shotW / im.aspect / 2 - 18, s: P ? 0.55 : 0.8, color: [1, 1, 1, 0.85] });
      text(String(i + 1), L.numSize, { parent: tn, y: L.numY, z: 3, color: done ? rgba(GREEN) : [1, 1, 1, 1] }, hstyle(L.numSize, { grad: null, weight: 800 }));
    }
  }

  function counter(t) {
    const t0c = tileTime(0) + 0.2;
    if (t < t0c || t > TL.s4 + 0.8) return;
    const ex = eio(seg(t, TL.s4 - 0.05, TL.s4 + 0.5));
    let n = 1, tch = -10;
    for (let i = 0; i < 7; i++) { const ti = tileTime(i) + 0.25; if (t >= ti) { n = i + 1; tch = ti; } }
    const appear = spring(t - t0c, 1.4, 0.6);
    const bump = 1 + 0.14 * Math.exp(-(t - tch) * 9) * Math.cos((t - tch) * 14);
    const numSt = hstyle(L.cntSize, { grad: G_GREEN, weight: 800 });
    const numW = E.flatText('7', numSt).w;
    const lesSt = hstyle(L.lesSize, { weight: 800 });
    const lesW = E.flatText('LESSONS', lesSt).w;
    const hSt = hstyle(L.hSize, { weight: 800 });
    const hW = E.flatText('2.5 H', hSt).w;
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
    under({ kind: 'glow', x: numX, y: row1Y, sx3: numW * 0.9, sy3: L.cntSize * 0.5, color: rgba(GREEN, 0.32 * grp.opacity) });
    flat({ kind: 'tex', tex: E.flatText(String(n), numSt), parent: grp, x: numX, y: row1Y, z: 2, s: bump, blur: (1 - clamp(appear)) * 3 });
    const lesT = n === 1 ? 'LESSON' : 'LESSONS';
    const lesNow = E.flatText(lesT, lesSt).w;
    flat({ kind: 'tex', tex: E.flatText(lesT, lesSt), parent: grp, x: lesX - lesW / 2 + lesNow / 2, y: row1Y - (L.cntSize - L.lesSize) * 0.36, z: 2, blur: (1 - clamp(appear)) * 3 });
    if (t > EV.ring) {
      const p = spring(t - EV.ring, 1.6, 0.55);
      const prog = eio(seg(t, EV.ring + 0.15, EV.ring + 1.5));
      const rn = { parent: grp, x: ringX, y: row2Y, z: 2, s: Math.max(0, p) };
      flat({ kind: 'arc', parent: rn, R, th: 8, a0: 0, a1: 7, color: [1, 1, 1, 0.12] });
      if (prog > 0.003) flat({ kind: 'arc', parent: rn, z: 1, R, th: 8, a0: Math.PI / 2 - prog * 2 * Math.PI, a1: Math.PI / 2, glowR: 12, glowK: 0.9, color: rgba(GREEN) });
      under({ kind: 'glow', x: ringX, y: row2Y, sx3: R * 1.1, sy3: R * 1.1, color: rgba(GREEN, 0.22 * grp.opacity * clamp(p)) });
      panel({ parent: rn, z: 1, w: R * 1.36, h: R * 1.36, r: R * 0.68, bevel: 20 });
      const mn = { parent: rn, z: 3, rz: -prog * 900 };
      flat({ kind: 'fill', parent: mn, y: R * 0.22, w: 6, h: R * 0.5, r: 3, color: [1, 1, 1, 0.95] });
      const hn = { parent: rn, z: 3, rz: -prog * 75 - 50 };
      flat({ kind: 'fill', parent: hn, y: R * 0.15, w: 7, h: R * 0.34, r: 3.5, color: rgba(GREEN) });
      flat({ kind: 'fill', parent: rn, z: 4, w: 13, h: 13, r: 6.5, color: [1, 1, 1, 1] });
      block('2.5 H', L.hSize, { parent: grp, x: hX, y: row2Y, z: 2, t0: EV.ring + 0.45, st: { weight: 800 } });
    }
  }

  // ------------------------------------------------------------ SCENE 4 — tasks
  const checkTime = (i) => EV.check0 + i * EV.checkStep;
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
      if (checked) under({ kind: 'glow', parent: bn, sx3: 60 * sc, sy3: 60 * sc, color: rgba(GREEN, 0.6 * gA) });
      frost({ parent: bn, w: L.box, h: L.box, r: L.box * 0.3, bevel: 12 * sc, tint: checked ? [GREEN[0], GREEN[1], GREEN[2], 0.1 + 0.82 * gA] : [0.1, 0.1, 0.13, 0.55] });
      if (checked) {
        const pr = eio(seg(t, ci, ci + 0.28));
        const pts = [[-12, 0], [-4, -8], [12, 9]].map(([x, y]) => [x * sc, y * sc]);
        flat({ kind: 'stroke', parent: bn, z: 2, pts: partial(pts, pr), th: 3.6 * sc, color: [0.03, 0.05, 0.02, 1] });
      }
    }
    // progress bar
    const tb = TL.s4 + 0.35;
    if (t > tb && t < TL.s5) {
      const bp = spring(t - tb, 1.4, 0.7);
      const fill = barFill(t);
      const bn = { y: L.barY, z: 4, sx: clamp(bp), opacity: seg(t, tb, tb + 0.2) };
      panel({ parent: bn, w: L.barW + 14, h: L.barH + 14, r: (L.barH + 14) / 2, bevel: 9 });
      const fx = -L.barW / 2 + L.barW * fill;
      if (fill > 0.002) {
        flat({ kind: 'liquid', parent: bn, z: 1, w: L.barW, h: L.barH, r: L.barH / 2, fill, time: t, wave: 2.0, glint: 0.4, color: rgba(PURPLE), color2: rgba(GREEN) });
        light({ kind: 'glow', parent: bn, x: fx, z: 2, sx3: 46, sy3: 18, color: [0.85, 1, 0.7, 0.55] });
        under({ kind: 'glow', parent: bn, x: fx - L.barW * fill / 2, sx3: L.barW * fill * 0.5 + 20, sy3: 40, color: rgba(GREEN, 0.3) });
      }
      text(`${Math.round(fill * 100)}%`, L.pct, { parent: bn, x: clamp(fx, -L.barW / 2 + 40, L.barW / 2 - 40), y: L.barH / 2 + 34, z: 2, color: [1, 1, 1, 0.92] }, fstyle(L.pct, { weight: 700 }));
    }
    // homework card from the real lesson page, riding above the lesson being checked
    const out = eio(seg(t, TL.s5 - 0.25, TL.s5 + 0.25));
    if (t > TL.s4 + 0.5 && out < 1) {
      let cur = 0;
      for (let i = 0; i < 7; i++) if (t >= checkTime(i) - 0.35) cur = i;
      const sw = clamp((t - (checkTime(cur) - 0.35)) / 0.35);
      const xPrev = (Math.max(cur - 1, 0) - 3) * L.pitch, xCur = (cur - 3) * L.pitch;
      const lim = P ? 0 : 560;
      const hx = clamp(lerp(xPrev, xCur, eio(sw)), -lim, lim);
      const img = cur < 5 ? IMG.homework[cur] : IMG.lessons[cur];
      const app = spring(t - (TL.s4 + 0.5), 1.3, 0.65);
      const pop = cur > 0 ? spring(t - (checkTime(cur) - 0.35), 2.0, 0.6) : 1;
      const hwW = Math.min(L.hwW, (L.hwMaxH - 64) * img.aspect);
      const wc = windowCard(img, { x: hx, y: L.hwY + (1 - clamp(app)) * -80, z: 10, w: hwW, bar: 40, s: lerp(0.94, 1, clamp(pop)) * lerp(0.85, 1, clamp(app)), opacity: clamp(app * 3) * (1 - out),
        url: 'higgsfield.ai/academy · lesson ' + (cur + 1), glow: rgba(cur < 5 ? GREEN : PURPLE, 0.18) });
      // pointer from the card to its lesson
      const tipY = L.dockY + L.th / 2 + 10;
      flat({ kind: 'stroke', pts: [[xCur, L.hwY - wc.H / 2 - 6], [xCur, tipY]], th: 2, glowR: 6, glowK: 0.6, z: 9, opacity: 0.6 * clamp(app * 3) * (1 - out), color: rgba(GREEN) });
    }
    // headline (rides with the camera)
    const tl = TL.s4 + 0.6;
    if (t > tl && t < TL.s5 + 0.6) {
      headline(L.tasksLabel, L.tasksSize, { t0: tl, te: TL.s5 - 0.15, x: CAM.tx, y: L.labelY, z: 0, stagger: 0.022 });
    }
    burst(t, TL.s5, L.barW * barFill(TL.s5), L.barY);
  }
  function burst(t, t0, len, y) {
    const age = t - t0;
    if (age < 0 || age > 2.2) return;
    const r = rng(777);
    for (let i = 0; i < 150; i++) {
      const x = -L.barW / 2 + len * r(), life = 0.7 + r() * 1.0, vx = (r() - 0.5) * 460, vy = 60 + r() * 680, sz = 3 + r() * 7, hue = r(), dl = r() * 0.08;
      const col = hue < 0.45 ? [0.75, 1, 0.45] : hue < 0.8 ? [0.75, 0.6, 1] : [1, 1, 1];
      const a = age - dl;
      if (a < 0 || a > life) continue;
      const drag = (1 - Math.exp(-2.4 * a)) / 2.4;
      const k = 1 - a / life;
      light({ kind: 'glow', x: x + vx * drag, y: y + vy * drag - 80 * a * a, z: 8, sx3: sz, sy3: sz, color: [col[0], col[1], col[2], 0.95 * k * k] });
    }
    if (age < 0.25) light({ kind: 'glow', y, z: 6, sx3: len * 0.55 + 40, sy3: 60, color: [0.85, 1, 0.75, 0.8 * (1 - age / 0.25)] });
    for (let i = 0; i < 10; i++) droplets(t, t0, -L.barW / 2 + len * (i + 0.5) / 10, y, 900 + i, 2, 30, 12);
  }

  // ------------------------------------------------------------ SCENE 5 — rewards
  function rewards(t) {
    if (t < EV.cert - 0.1 || t > TL.s6 + 0.8) return;
    const ex = eio(seg(t, TL.s6 - 0.15, TL.s6 + 0.55));
    // the real certificate, framed in glass
    const pc = spring(t - EV.cert, 1.0, 0.62);
    const cimg = IMG.certificate, cw = L.certW, ch = cw / cimg.aspect;
    const cn = { x: L.certX, y: L.certY + (1 - pc) * -560 + 8 * Math.sin(t * 1.0), z: -ex * 600, rx: (1 - clamp(pc)) * 38 + 2 * Math.sin(t * 0.8), ry: 4 * Math.sin(t * 0.6), opacity: seg(t, EV.cert, EV.cert + 0.25) * (1 - ex) };
    under({ kind: 'glow', x: L.certX, y: L.certY, sx3: cw * 0.6, sy3: ch * 0.6, color: rgba(GREEN, 0.38 * cn.opacity) });
    panel({ parent: cn, w: cw + 36, h: ch + 36, r: 40, bevel: 26 });
    flat({ kind: 'tex', tex: cimg, parent: cn, z: 1, w: cw, h: ch, r: 24 });
    headline('CERTIFICATE', P ? 76 : 64, { t0: EV.cert + 0.35, te: TL.s6 - 0.2, x: L.certX, y: L.certY + L.certTitleY + (P ? 40 : 0), z: 2 });
    // gift box: glass, opens, the real Creator Drop pack rises out
    if (t > EV.gift) {
      const pg = spring(t - EV.gift, 1.1, 0.6);
      const gn = { x: L.giftX, y: L.giftY + (1 - pg) * -520 + 6 * Math.sin(t * 1.2 + 1), z: -ex * 600, ry: -4 * Math.sin(t * 0.7), opacity: seg(t, EV.gift, EV.gift + 0.25) * (1 - ex) };
      const ir = t > EV.open ? eo(seg(t, EV.open, EV.open + 0.6)) * (1 - ex) : 0;
      under({ kind: 'glow', x: L.giftX, y: L.giftY, sx3: 220, sy3: 200, color: rgba(PURPLE, 0.5 * gn.opacity) });
      if (ir > 0) under({ kind: 'glow', x: L.giftX, y: L.giftY + 110, sx3: 240, sy3: 150, color: rgba(GREEN, 0.5 * ir) });
      flat({ kind: 'fill', parent: gn, w: 46, h: 220, r: 6, color: rgba(PURPLE, 0.9), color2: rgba(LAV, 0.9) });
      glass({ parent: gn, z: 2, w: 270, h: 220, r: 28, bevel: 24, depth: 0.55, tint: [0.06, 0.05, 0.1, 0.25] });
      const po = spring(t - EV.open, 1.25, 0.5);
      const cpo = clamp(po, 0, 1.1);
      const ln = { parent: gn, x: -280 * po, y: lerp(144, -30, cpo) + 190 * Math.sin(Math.PI * clamp(po)), z: 4, rz: 30 * po };
      flat({ kind: 'fill', parent: ln, w: 48, h: 66, r: 6, color: rgba(PURPLE, 0.9), color2: rgba(LAV, 0.9) });
      glass({ parent: ln, z: 1, w: 300, h: 66, r: 22, bevel: 20, depth: 0.6, tint: [0.06, 0.05, 0.1, 0.25] });
      glass({ kind: 'blobs', parent: ln, z: 2, y: 56, balls: [[-34, 12, 25], [34, 12, 25], [0, 2, 15]], k: 16, bevel: 22, depth: 0.85, tint: [PURPLE[0], PURPLE[1], PURPLE[2], 0.4] });
      if (ir > 0) {
        light({ kind: 'rays', parent: gn, y: 110, z: 3, size: 760, count: 9, sharp: 4, fall: 280, cone: 1.15, rot: 0.12 * Math.sin(t * 0.6), time: t * 0.8, color: [0.85, 1.0, 0.7, 0.55 * ir] });
        sparkles(t, EV.open + 0.1, TL.s6 - 0.3, L.giftX, L.giftY + 260, 520, 360, 55, 22);
        const pt = spring(t - (EV.open + 0.2), 1.1, 0.62);
        const dimg = IMG.drop, dh = P ? 330 : 300, dw = dh * dimg.aspect;
        const dy = lerp(40, 110 + dh / 2 + 10, clamp(pt, 0, 1.15));
        if (pt > 0) {
          const dn = { parent: gn, y: dy, z: 3.5, s: lerp(0.3, 1, clamp(pt, 0, 1.2)), rz: (1 - clamp(pt)) * -12 + 2 * Math.sin(t * 1.3), opacity: seg(t, EV.open + 0.2, EV.open + 0.4) };
          flat({ kind: 'tex', tex: dimg, parent: dn, w: dw, h: dh, r: 12 });
        }
        headline('CREATOR DROP', P ? 76 : 64, { t0: EV.open + 0.55, te: TL.s6 - 0.2, x: L.giftX + (P ? 0 : 0), y: L.giftY + L.dropY + dh * 0.62, z: 6 });
      }
    }
  }

  // ------------------------------------------------------------ SCENE 6 — language
  function language(t) {
    if (t < EV.en - 0.1 || t > TL.s7 + 0.8) return;
    const ex1 = eio(seg(t, EV.cards - 0.35, EV.cards + 0.2));
    if (t < EV.cards + 0.3) {
      const pe = spring(t - EV.en, 1.5, 0.5);
      const breath = 1 + 0.025 * Math.sin((t - EV.en) * 2 * Math.PI / 1.5);
      const en = { x: L.enX, y: L.enY + 10 * Math.sin(t * 1.6) + ex1 * 160, z: -ex1 * 300, s: Math.max(0, pe) * breath * (1 - 0.3 * ex1), opacity: seg(t, EV.en, EV.en + 0.2) * (1 - ex1), rx: 3 * Math.sin(t * 1.1), ry: 4 * Math.sin(t * 0.9) };
      for (let k = 0; k < 4; k++) {
        const a = t - (EV.en + 0.45 + k * 1.5);
        if (a > 0 && a < 1.4) light({ kind: 'ring', x: L.enX, y: en.y, z: -2, R: L.enR * en.s + a * 200, wd: 4 + a * 8, color: [0.7, 0.6, 1, 0.3 * Math.pow(1 - a / 1.4, 2) * (1 - ex1)] });
      }
      under({ kind: 'glow', x: L.enX, y: en.y, sx3: L.enR * 1.1, sy3: L.enR * 1.1, color: rgba(PURPLE, 0.75 * en.opacity * breath) });
      panel({ parent: en, w: 2 * L.enR, h: 2 * L.enR, r: L.enR, bevel: 40, tint: [0.1, 0.06, 0.2, 0.45] });
      text('EN', L.enSize, { parent: en, z: 3, y: 6 }, hstyle(L.enSize, { weight: 800 }));
      flat({ kind: 'tex', tex: ICON.globe, parent: en, z: 3, y: -L.enR * 0.58, s: 0.9, color: rgba(GREEN) });
      if (t > EV.kz) {
        const pk = spring(t - EV.kz, 1.6, 0.6);
        const nudge = t > EV.kzTry ? Math.sin(Math.PI * clamp((t - EV.kzTry) / 0.35)) * 18 : 0;
        const sh = t > EV.kzTry + 0.3 ? 7 * Math.sin((t - EV.kzTry - 0.3) * 40) * Math.exp(-(t - EV.kzTry - 0.3) * 7) : 0;
        const kn = { x: L.kzX + sh, y: L.kzY + 8 * Math.sin(t * 1.6 + 0.6) + ex1 * 160, z: -ex1 * 300, s: lerp(0.5, 1, pk) * (1 - 0.3 * ex1), opacity: seg(t, EV.kz, EV.kz + 0.2) * (1 - ex1) };
        frost({ parent: kn, w: 190, h: 108, r: 54, bevel: 22, tint: [0.2, 0.2, 0.23, 0.7] });
        glass({ parent: kn, z: 2, x: -41 + nudge, w: 84, h: 84, r: 42, bevel: 34, depth: 0.85, tint: [0.45, 0.45, 0.5, 0.5] });
        text('KZ', 40, { parent: kn, x: L.kzLabelDX, z: 1, color: [1, 1, 1, 0.38] }, fstyle(40, { weight: 700 }));
        flat({ kind: 'tex', tex: ICON.lock, parent: kn, x: L.kzLabelDX + 56, y: 2, z: 1, s: 0.9, color: [1, 1, 1, 0.36] });
      }
      if (t > EV.menu) {
        const pm = spring(t - EV.menu, 1.3, 0.62);
        windowCard(IMG.langMenu, { x: L.menuX + (P ? 0 : (1 - pm) * 160), y: L.menuY + (P ? (1 - pm) * -160 : 0) + 6 * Math.sin(t * 1.2), z: 0, w: L.menuW, bar: P ? 52 : 40, ry: P ? 0 : -6, s: lerp(0.8, 1, clamp(pm)) * (1 - 0.3 * ex1), opacity: seg(t, EV.menu, EV.menu + 0.25) * (1 - ex1), glow: rgba(PURPLE, 0.3) });
      }
    }
    // MY COURSE -> ACADEMY
    const tl = EV.cards, tr = tl + 0.25;
    const ex2 = eio(seg(t, TL.s7 - 0.2, TL.s7 + 0.4));
    if (t > tl) {
      const tt = tr + 0.3, tf = tt + 0.4;
      const ph = (t - tf) / 1.6, u = ph - Math.floor(ph);
      const flash = t > tf ? Math.exp(-Math.pow((u - 0.97) / 0.07, 2)) + Math.exp(-Math.pow((u + 0.03) / 0.07, 2)) : 0;
      const cards = [[L.c1, 'MY COURSE', 'INTRO', tl, -1], [L.c2, 'ACADEMY', 'ADVANCED', tr, 1]];
      for (const [pos, title, sub, tc, side] of cards) {
        const pc = spring(t - tc, 1.15, 0.62);
        const n = {
          x: pos[0] + (P ? 0 : side * (1 - pc) * 260), y: pos[1] + (P ? -side * (1 - pc) * 260 : 0) + 7 * Math.sin(t * 1.1 + side),
          z: -ex2 * 500, ry: P ? 3 * Math.sin(t * 0.7) : -side * ((1 - clamp(pc)) * 30 + 7), rx: P ? side * ((1 - clamp(pc)) * 30 + 6) : 2 * Math.sin(t * 0.8),
          opacity: seg(t, tc, tc + 0.25) * (1 - ex2), s: lerp(0.8, 1, clamp(pc)),
        };
        const fl = side > 0 ? flash : 0;
        const accent = side > 0 ? GREEN : PURPLE;
        under({ kind: 'glow', x: pos[0], y: pos[1], sx3: L.cW * 0.55, sy3: L.cH * 0.55, color: rgba(accent, (0.32 + 0.4 * fl) * n.opacity) });
        panel({ parent: n, w: L.cW, h: L.cH, r: 48, bevel: 28, tint: side > 0 ? [0.08, 0.12, 0.04, 0.5] : [0.09, 0.06, 0.16, 0.5] });
        const tyy = side > 0 ? L.cH / 2 - 78 : 30;
        text(title, L.cTitle, { parent: n, y: tyy, z: 3 }, hstyle(L.cTitle, { weight: 800, grad: side > 0 ? G_GREEN : G_WHITE }));
        text(sub, 22, { parent: n, y: tyy - L.cTitle * 0.62 - 12, z: 1, color: side > 0 ? rgba(GREEN, 0.9) : rgba(LAV, 0.9) }, fstyle(22, { track: 9, weight: 700 }));
        if (side > 0) {
          const im = IMG.syllabus, sw = L.cW - 60, sh = sw / im.aspect;
          flat({ kind: 'tex', tex: im, parent: n, z: 1, y: -L.cH / 2 + 30 + sh / 2, w: sw, h: sh, r: 14 });
        } else {
          flat({ kind: 'tex', tex: ICON.play, parent: n, z: 2, y: -L.cH * 0.24, s: 1.1, color: rgba(LAV) });
        }
      }
      if (t > tt) {
        const ptb = spring(t - tt, 1.6, 0.7);
        const tube = { x: (L.c1[0] + L.c2[0]) / 2, y: (L.c1[1] + L.c2[1]) / 2, z: -6 - ex2 * 500, rz: L.tubeRot, sx: clamp(ptb), opacity: seg(t, tt, tt + 0.15) * (1 - ex2) };
        panel({ parent: tube, w: L.tubeLen, h: 56, r: 28, bevel: 16 });
        if (t > tf) {
          for (let j = 0; j < 4; j++) {
            const uu = u - j * 0.045;
            if (uu < 0) continue;
            const x = lerp(-L.tubeLen / 2 + 50, L.tubeLen / 2 - 50, eio(uu));
            const a = (1 - j * 0.24) * Math.min(1, uu * 8) * Math.min(1, (1 - uu) * 10);
            flat({ kind: 'fill', parent: tube, z: 1, x, w: 110 - j * 18, h: 26 - j * 4, r: 13, color: rgba(PURPLE, 0.95 * a), color2: rgba(GREEN, 0.95 * a) });
            if (j === 0) {
              light({ kind: 'glow', parent: tube, x, z: 2, sx3: 80, sy3: 28, color: [0.8, 1, 0.7, 0.5 * a] });
              under({ kind: 'glow', parent: tube, x, sx3: 90, sy3: 50, color: rgba(GREEN, 0.45 * a) });
            }
          }
        }
        flat({ kind: 'stroke', parent: tube, x: L.tubeLen / 2 - 34, z: 3, pts: [[-8, 13], [5, 0], [-8, -13]], th: 3.5, color: rgba(GREEN) });
      }
    }
  }

  // ------------------------------------------------------------ SCENE 7 — poll / CTA
  const YES = 0.92, NO = 0.08;
  function pollFill(t, target, t0) { return target * clamp(spring(t - t0, 0.55, 0.85), 0, 1.02); }
  function poll(t) {
    if (t < EV.poll - 0.1 || t > TL.s8 + 1.3) return null;
    const melt = eio(seg(t, TL.s8 - 0.1, TL.s8 + 0.55));
    const pw = spring(t - EV.poll, 1.0, 0.62);
    const up = eio(seg(t, EV.vote - 0.25, EV.vote + 0.35));
    const wn = { y: lerp(L.pollY, L.pollUpY, up) + (1 - pw) * -1100 + 6 * Math.sin(t * 1.0), z: 0, rx: (1 - clamp(pw)) * -25 + 2 * Math.sin(t * 0.7), ry: 2.5 * Math.sin(t * 0.55), s: lerp(1, 0.15, melt), opacity: seg(t, EV.poll, EV.poll + 0.2) * (1 - seg(t, TL.s8 + 0.1, TL.s8 + 0.5)) };
    under({ kind: 'glow', x: -L.pollW * 0.25, y: wn.y + L.pollH * 0.2, sx3: L.pollW * 0.4, sy3: L.pollH * 0.5, color: rgba(PURPLE, 0.5 * wn.opacity) });
    under({ kind: 'glow', x: L.pollW * 0.25, y: wn.y - L.pollH * 0.2, sx3: L.pollW * 0.35, sy3: L.pollH * 0.4, color: rgba(GREEN, 0.25 * wn.opacity) });
    panel({ parent: wn, w: L.pollW, h: L.pollH, r: 56, bevel: 30 });
    const hx = -L.optW / 2 + 20, hy = L.pollH / 2 - 62;
    flat({ kind: 'tex', tex: ICON.poll, parent: wn, x: hx + 10, y: hy, z: 1, s: 0.9, color: rgba(GREEN) });
    const pl = E.flatText('POLL', fstyle(26, { track: 6, weight: 700 }));
    flat({ kind: 'tex', tex: pl, parent: wn, x: hx + 44 + pl.w / 2, y: hy, z: 1, color: [1, 1, 1, 0.8] });
    const opts = [['YES', L.yesY, YES, rgba([0.45, 0.85, 0.2]), rgba(GREEN), EV.fill], ['NO', L.noY, NO, rgba(PURPLE, 0.85), rgba(LAV, 0.85), EV.fill + 0.3]];
    const barW = L.optW - (P ? 140 : 160), bx = -L.optW / 2 + barW / 2;
    for (const [label, oy, target, c1, c2, t0] of opts) {
      const yes = label === 'YES';
      const on = { parent: wn, x: bx, y: oy, z: 1 };
      panel({ parent: on, w: barW, h: L.optH, r: L.optH / 2, bevel: 18, tint: [0.1, 0.1, 0.13, 0.5] });
      const f = t > t0 ? pollFill(t, target, t0) : 0;
      if (f > 0.002) {
        flat({ kind: 'liquid', parent: on, z: 1, w: barW - 12, h: L.optH - 12, r: (L.optH - 12) / 2, fill: f, time: t, wave: yes ? 5 : 2, glint: yes ? 0.45 : 0.12, color: c1, color2: c2 });
        if (yes) {
          light({ kind: 'glow', parent: on, x: -barW / 2 + (barW - 12) * f, z: 2, sx3: 60, sy3: L.optH * 0.4, color: [0.85, 1, 0.75, 0.4] });
          under({ kind: 'glow', parent: on, x: -barW / 2 + (barW - 12) * f / 2, sx3: (barW - 12) * f * 0.5, sy3: L.optH * 0.6, color: rgba(GREEN, 0.4) });
        }
      }
      const lt = E.flatText(label, hstyle(L.optSize, { weight: 800, grad: null }));
      flat({ kind: 'tex', tex: lt, parent: on, x: -barW / 2 + 50 + lt.w / 2, z: 3, color: yes && f > 0.15 ? [0.03, 0.05, 0.02, 1] : [1, 1, 1, 1] });
      const pct = E.flatText(`${Math.round(f * 100)}%`, fstyle(L.pct2, { weight: 700 }));
      flat({ kind: 'tex', tex: pct, parent: wn, x: L.optW / 2 - 8 - pct.w / 2, y: oy, z: 2, color: yes ? rgba(GREEN) : [1, 1, 1, 0.7] });
    }
    if (t > EV.vote) {
      const vo = (1 - seg(t, TL.s8 + 0.05, TL.s8 + 0.45));
      const bounce = -24 * Math.abs(Math.sin(Math.PI * (t - EV.vote - 0.3) / 0.75)) * seg(t, EV.vote + 0.3, EV.vote + 0.5);
      headline('VOTE BELOW', L.voteSize, { t0: EV.vote, te: TL.s8 - 0.1, td: 0.4, x: 0, y: L.voteY, z: 4, stagger: 0.03 });
      const ay = L.arrowY + bounce;
      const pa = spring(t - (EV.vote + 0.25), 1.8, 0.6);
      flat({ kind: 'stroke', pts: [[0, ay + 34], [0, ay - 36]], th: 4.5, glowR: 12, glowK: 0.8, z: 5, s: clamp(pa), opacity: vo, color: rgba(GREEN) });
      flat({ kind: 'stroke', pts: [[-26, ay - 12], [0, ay - 38], [26, ay - 12]], th: 4.5, glowR: 12, glowK: 0.8, z: 5, s: clamp(pa), opacity: vo, color: rgba(GREEN) });
      under({ kind: 'glow', x: 0, y: ay, sx3: 70, sy3: 80, color: rgba(GREEN, 0.4 * vo) });
    }
    return wn;
  }

  // ------------------------------------------------------------ SCENE 8 — outro
  function outro(t) {
    if (t < TL.s8 - 0.1) return;
    const cy = P ? 120 : 20;
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
      under({ kind: 'glow', x: 0, y: cy, sx3: 170, sy3: 170, color: rgba(PURPLE, 0.7 * seg(t, tm + 0.3, tm + 0.9) * dn.opacity) });
      under({ kind: 'glow', x: 40, y: cy - 60, sx3: 90, sy3: 90, color: rgba(GREEN, 0.4 * seg(t, tm + 0.5, tm + 1.0) * dn.opacity) });
      glass({ kind: 'blobs', parent: dn, balls, k: 70, bevel: 60, depth: 0.9, refr: 2.5, tint: [0.1, 0.08, 0.16, 0.12], opacity: seg(t, tm - 0.05, tm + 0.1) * dn.opacity });
    }
    for (let k = 0; k < 3; k++) {
      const a = t - (hit + k * 0.22);
      if (a < 0 || a > 2.0) continue;
      const u = a / 2.0;
      const R = 20 + (P ? 1100 : 1000) * eo(u);
      const th = lerp(9, 2.2, u) * (1 - k * 0.25);
      glass({ kind: 'arc', y: cy - 60, z: -40, R, th, a0: 0, a1: 7, bevel: th, depth: 0.9, opacity: Math.pow(1 - u, 1.3) * 0.9, sy: 0.9, tint: [0.7, 0.6, 1, 0.08] });
      light({ kind: 'ring', y: cy - 60, z: -40, R, wd: 6 + 20 * u, sy: 0.9, color: k % 2 ? [0.7, 1, 0.4, 0.22 * (1 - u)] : [0.7, 0.55, 1, 0.3 * (1 - u)] });
    }
    if (t > hit && t < hit + 0.5) light({ kind: 'glow', y: cy - 60, z: -40, sx3: 160, sy3: 120, color: [0.85, 0.8, 1, 0.7 * (1 - (t - hit) / 0.5)] });
    const FT = L.finalTitle;
    const tt = hit + 0.25;
    if (t > tt) {
      const fade = eio(seg(t, TL.end - 1.6, TL.end - 0.4));
      let order = [];
      for (const [str, ly] of FT.lines) {
        const { letters: ls } = letters(str, hstyle(FT.size));
        for (const le of ls) order.push([le, ly]);
      }
      order = order.map((o) => [o[0], o[1], Math.abs(o[0].cx) + Math.abs(o[1]) * 0.6]).sort((a, b) => a[2] - b[2]);
      under({ kind: 'glow', x: -300, y: cy * 0.3 + 40, sx3: 520, sy3: 200, color: rgba(PURPLE, 0.45 * seg(t, tt, tt + 1) * (1 - fade)) });
      under({ kind: 'glow', x: 380, y: cy * 0.3 - 60, sx3: 380, sy3: 160, color: rgba(GREEN, 0.22 * seg(t, tt, tt + 1) * (1 - fade)) });
      order.forEach(([le, ly], k) => {
        const tk = tt + k * 0.035;
        if (t < tk) return;
        const p = spring(t - tk, 1.5, 0.6);
        const cp = clamp(p);
        flat({ kind: 'tex', tex: le.tex, x: lerp(0, le.cx, eo(cp)), y: lerp(cy - 60, ly + cy * 0.3, p) + fade * 24, z: lerp(-240, 0, cp), s: lerp(0.2, 1, p) * (1 + 0.04 * fade), blur: (1 - cp) * 3 + fade * 3, opacity: seg(t, tk, tk + 0.15) * (1 - fade) });
      });
      if (t > tt + 1.0) {
        const pp = spring(t - (tt + 1.0), 1.8, 0.55);
        chip('OFFICIAL COURSE', { y: L.finalPillY + cy * 0.3, z: 6, s: lerp(0.4, 1, pp) * (1 + 0.03 * fade), opacity: seg(t, tt + 1.0, tt + 1.15) * (1 - fade), green: true, size: P ? 28 : 24, icon: ICON.seal, iconS: 0.9 });
      }
      sparkles(t, tt + 0.9, TL.end - 1.6, 0, cy * 0.3, P ? 900 : 1500, P ? 380 : 180, 909, 30, 20);
    }
  }

  // ------------------------------------------------------------ frame
  const RIPPLES = [[0, 0, EV.sphere, 1.0], [0, 0, EV.morph + 0.05, 0.45], [0, -0.03, EV.s8 + 1.8, 1.7], [0, -0.03, EV.s8 + 2.05, 0.8]];
  const SWEEPS = [[EV.sweep1, 1.0], [EV.card + 0.8, 1.0], [EV.ring - 0.5, 0.9], [EV.cert + 1.0, 1.0], [EV.en + 0.6, 0.9], [EV.fill + 0.2, 1.0], [EV.s8 + 3.2, 1.2]];
  function frame(t, index) {
    S = []; NOW = t;
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
      if (u > 0 && u < 1) sweep = { dir: [1, 0.35], pos: lerp(-1.4, 1.4, eio(u)), width: 0.13, amp: 0.8 * Math.sin(Math.PI * u) };
    }
    return { t, frame: index, cam: CAM, ripples, sweep, light: [-0.45 + 0.12 * Math.sin(t * 0.3), 0.75, 0.55], fade: eo(seg(t, 0, 0.45)), sprites: S };
  }

  // ------------------------------------------------------------ sound cues (consumed by audio/synth.py)
  function cues() {
    const c = [];
    const q = (t, type, o = {}) => c.push(Object.assign({ t: +t.toFixed(3), type }, o));
    q(0.0, 'swell', { dur: 2.0 }); q(EV.sphere, 'drip', { pitch: 0 }); q(EV.morph, 'morph');
    for (let k = 0; k < 17; k++) q(EV.title + 0.05 + k * 0.045, 'glint', { pitch: k % 5, gain: 0.3 });
    q(EV.sweep1, 'shimmer'); q(EV.pill, 'pop', { pitch: 2 });
    q(TL.s2 - 0.25, 'whoosh', { dir: 'up' }); for (let k = 0; k < 6; k++) q(TL.s2 - 0.1 + k * 0.07, 'drip', { pitch: k + 2, gain: 0.45 });
    q(EV.card - 0.05, 'flip'); q(EV.card + 0.8, 'shimmer', { gain: 0.6 }); q(EV.badge, 'pop', { pitch: 4 }); q(EV.badge + 0.05, 'chime', { note: 76 });
    q(EV.tag, 'swing'); q(EV.thumb, 'whoosh', { dir: 'in', gain: 0.6 }); q(EV.arrow, 'draw', { dur: 0.6 }); q(EV.arrow + 0.6, 'click');
    q(TL.s3 - 0.3, 'morph', { gain: 0.8 });
    for (let i = 0; i < 7; i++) q(tileTime(i) + 0.22, 'tick', { pitch: i });
    q(EV.ring, 'pop', { pitch: 1 }); q(EV.ring + 0.15, 'riser', { dur: 1.35 }); q(EV.ring + 1.5, 'chime', { note: 79 }); q(EV.ring + 0.45, 'pop', { pitch: 3, gain: 0.6 });
    q(TL.s4 - 0.15, 'whoosh', { dir: 'in' }); q(TL.s4 + 0.5, 'whoosh', { dir: 'up', gain: 0.45 }); q(TL.s4 + 0.6, 'shimmer', { gain: 0.5 });
    const scale = [72, 74, 76, 79, 81, 84, 86];
    for (let i = 0; i < 7; i++) { q(checkTime(i), 'check', { note: scale[i] }); if (i) q(checkTime(i) - 0.35, 'click', { gain: 0.5 }); }
    q(checkTime(6) + 0.3, 'chime', { note: 91, gain: 0.7 });
    q(TL.s5, 'burst'); q(EV.cert, 'whoosh', { dir: 'up', gain: 0.7 }); q(EV.cert + 1.0, 'shimmer', { gain: 0.7 }); q(EV.gift, 'whoosh', { dir: 'up', gain: 0.5 });
    q(EV.open, 'open'); q(EV.open + 0.25, 'magic', { dur: 2.5 });
    q(TL.s6 - 0.15, 'whoosh', { dir: 'out' }); q(EV.en, 'pop', { pitch: 2 });
    for (let k = 0; k < 4; k++) q(EV.en + 0.45 + k * 1.5, 'pulse', { gain: 0.5 });
    q(EV.kz, 'click'); q(EV.menu, 'whoosh', { dir: 'in', gain: 0.55 }); q(EV.kzTry, 'denied');
    q(EV.cards - 0.35, 'whoosh', { dir: 'up', gain: 0.7 }); q(EV.cards, 'pop', { pitch: 1 }); q(EV.cards + 0.25, 'pop', { pitch: 3 });
    const tf = EV.cards + 0.25 + 0.3 + 0.4;
    for (let t = tf; t < TL.s7 - 0.4; t += 1.6) { q(t, 'flow'); q(t + 1.5, 'chime', { note: 84, gain: 0.35 }); }
    q(TL.s7 - 0.2, 'whoosh', { dir: 'out' }); q(EV.poll, 'whoosh', { dir: 'up' }); q(EV.fill + 0.2, 'shimmer', { gain: 0.6 });
    q(EV.fill, 'fill', { dur: 2.6 });
    for (let k = 0; k < 18; k++) q(EV.fill + 0.1 + k * 0.13, 'glint', { pitch: k % 7, gain: 0.18 });
    q(EV.fill + 2.8, 'chime', { note: 88 });
    q(EV.vote, 'pop', { pitch: 2 });
    for (let k = 0; k < 6; k++) q(EV.vote + 0.3 + k * 0.75, 'bounce', { gain: 0.5 });
    q(TL.s8 - 0.1, 'melt'); q(TL.s8 + 1.2, 'fall'); q(TL.s8 + 1.8, 'impact');
    q(TL.s8 + 2.1, 'shimmer', { gain: 0.8 }); q(TL.s8 + 3.2, 'magic', { dur: 2.2, gain: 0.6 }); q(TL.s8 + 2.4, 'chime', { note: 72 }); q(TL.s8 + 2.55, 'chime', { note: 79 }); q(TL.s8 + 2.7, 'chime', { note: 84 });
    q(TL.s8 + 3.05, 'pop', { pitch: 2, gain: 0.6 });
    return c.filter((x) => x.t < TL.end).sort((a, b) => a.t - b.t);
  }

  return { setup, frame, cues, TL, EV, VO_OFFSET };
})();
