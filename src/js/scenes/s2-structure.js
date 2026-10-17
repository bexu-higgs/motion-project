// SCENE 2 — THE STRUCTURE OF A GOOD PROMPT
// Five parts slot into a blank prompt in sync with the narration; each one changes
// the preview. The parts merge into one prompt, then vague vs detailed side by side.
(function () {
  const M = window.M, C = M.C, E = M.E;
  const COMPS = [
    { ka: 'КЕЙІПКЕР', en: 'SUBJECT', icon: 'user', snip: 'a young man in a black coat' },
    { ka: 'ОРТА', en: 'ENVIRONMENT', icon: 'place', snip: 'rainy neon city street at night' },
    { ka: 'ӘРЕКЕТ', en: 'ACTION', icon: 'action', snip: 'walks slowly toward the camera' },
    { ka: 'КАМЕРА', en: 'CAMERA', icon: 'camera', snip: 'medium shot, slow dolly-in' },
    { ka: 'ЖАРЫҚ ЖӘНЕ СТИЛЬ', en: 'LIGHTING & STYLE', icon: 'light', snip: 'neon rim light, cinematic, moody' },
  ];
  const MERGED = [
    { text: 'A young man in a black coat', c: 0 },
    { text: ' ' },
    { text: 'walks slowly toward the camera', c: 2 },
    { text: ' on a ' },
    { text: 'rainy neon city street at night', c: 1 },
    { text: '. ' },
    { text: 'Medium shot, slow dolly-in', c: 3 },
    { text: '. ' },
    { text: 'Neon rim light, cinematic, moody', c: 4 },
    { text: '.' },
  ];
  const VAGUE = [{ text: 'a man in a city' }];
  const COL = { x: 110, y: 140, w: 740 };
  const SLOT = { y0: 214, h: 132, gap: 14 };
  const PV0 = { x: 920, y: 196, w: 880, h: 495 };
  const PVL = { x: 100, y: 176, w: 840, h: 472 };
  const PVR = { x: 980, y: 176, w: 840, h: 472 };
  const PROMPT_Y = 682;
  const lerpRect = (a, b, k) => ({ x: M.lerp(a.x, b.x, k), y: M.lerp(a.y, b.y, k), w: M.lerp(a.w, b.w, k), h: M.lerp(a.h, b.h, k) });

  function compCard(ctx, comp, i, x, y, w, h, t, fillT, a) {
    const k = E.outCubic(M.inv(t, fillT, fillT + 0.45));
    if (k <= 0 || a <= 0) return;
    const on = 1 - 0.75 * M.inv(t, fillT + 0.4, fillT + 1.6);
    const ox = (1 - k) * -60;
    ctx.save();
    ctx.globalAlpha *= a * k;
    M.card(ctx, x + ox, y, w, h, { r: 18, accent: C.cyan, accentA: on, glow: 22, shadow: false });
    const cx = x + ox + 62, cy = y + h / 2;
    ctx.strokeStyle = M.rgba(C.cyan, 0.4 + 0.6 * on);
    ctx.lineWidth = 1.5;
    ctx.fillStyle = M.rgba(C.cyan, 0.08 + 0.1 * on);
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    M.icon(ctx, comp.icon, cx, cy, 30, { color: M.mix('#CFE9EE', C.cyan, on), lw: 1.8 });
    M.text(ctx, comp.ka, x + ox + 116, y + 48, { size: 27, weight: 700, fam: M.F.display, ls: 1.5, color: C.ink });
    const kw = M.measure(ctx, comp.ka, { size: 27, weight: 700, fam: M.F.display, ls: 1.5 });
    M.text(ctx, comp.en, x + ox + 116 + kw + 16, y + 47, { size: 14, weight: 600, ls: 2.6, color: C.ink3 });
    const n = M.typed(t, fillT + 0.15, 55, comp.snip.length);
    M.text(ctx, comp.snip.slice(0, n), x + ox + 116, y + 94, { size: 21, weight: 400, fam: M.F.mono, color: M.mix('#C7D1DC', C.cyan, on * 0.8) });
    M.text(ctx, '0' + (i + 1), x + ox + w - 26, y + 34, { size: 14, weight: 600, ls: 2, color: C.ink3, align: 'right' });
    ctx.restore();
  }

  M.scene({
    id: 's2',
    title: 'The structure of a good prompt',
    start: 11.4,
    end: 26.8,
    vo: [0.6, 9.0],
    draw(ctx, t, sc) {
      const marks = sc.lines[0].m; // [sentence, кейіпкер, орта, әрекет, камера, жарық]
      const fillT = marks.slice(1);
      const mergeT = sc.lines[0].end + 0.15;
      const splitT = mergeT + 1.3;
      const mk = E.inOutCubic(M.inv(t, mergeT, mergeT + 1.1));
      const sk = E.inOutCubic(M.inv(t, splitT, splitT + 1.0));

      // ---- blank prompt → column container
      const ck = E.inOutCubic(M.inv(t, 1.5, 2.4));
      const blankA = E.outCubic(M.inv(t, 0.25, 0.8)) * (1 - mk);
      if (blankA > 0) {
        const r0 = { x: 560, y: 450, w: 800, h: 180 }, r1 = { x: COL.x, y: COL.y, w: COL.w, h: 808 };
        const r = lerpRect(r0, r1, ck);
        const sc0 = 0.96 + 0.04 * E.outCubic(M.inv(t, 0.25, 0.8));
        ctx.save();
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
        ctx.scale(sc0, sc0);
        ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
        M.card(ctx, r.x, r.y, r.w, r.h, { alpha: blankA, r: 22, fill: '#141821', fill2: '#10131A' });
        ctx.globalAlpha *= blankA;
        M.icon(ctx, 'edit', r.x + 40, r.y + 34, 20, { color: C.ink2, lw: 2 });
        M.text(ctx, 'Prompt', r.x + 60, r.y + 35, { size: 18, weight: 600, ls: 1.5, color: C.ink2, base: 'middle' });
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(r.x + 1, r.y + 62, r.w - 2, 1);
        if (ck < 0.5 && Math.floor(t * 2.2) % 2 === 0) {
          ctx.fillStyle = C.cyan;
          ctx.globalAlpha *= 1 - ck * 2;
          ctx.fillRect(r.x + 32, r.y + 92, 3, 34);
        }
        ctx.restore();
      }
      // ---- slots + component cards (left column)
      // cards collapse into one prompt inside the column, which later moves right
      const collapsed = { x: COL.x + 20, y: 330, w: COL.w - 40, h: 210 };
      const merged = lerpRect(collapsed, { x: PVR.x, y: PROMPT_Y, w: PVR.w, h: 210 }, sk);
      COMPS.forEach((comp, i) => {
        const sy = SLOT.y0 + i * (SLOT.h + SLOT.gap);
        const slotA = E.outCubic(M.inv(t, 1.9 + i * 0.12, 2.4 + i * 0.12)) * (1 - mk);
        if (slotA > 0 && t < fillT[i] + 0.4) {
          ctx.save();
          ctx.globalAlpha *= slotA;
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          M.rr(ctx, COL.x + 20, sy, COL.w - 40, SLOT.h, 16);
          ctx.stroke();
          ctx.setLineDash([]);
          M.text(ctx, '0' + (i + 1), COL.x + 54, sy + SLOT.h / 2 + 1, { size: 18, weight: 600, ls: 2, color: C.ink3, base: 'middle' });
          ctx.restore();
        }
        const a = 1 - E.inOutSine(M.inv(t, mergeT + 0.35, mergeT + 0.75));
        const ck2 = E.inOutCubic(M.inv(t, mergeT + i * 0.04, mergeT + 0.6 + i * 0.04));
        const r = lerpRect({ x: COL.x + 20, y: sy, w: COL.w - 40, h: SLOT.h }, collapsed, ck2);
        compCard(ctx, comp, i, r.x, r.y, r.w, r.h, t, fillT[i], a);
      });
      // ---- preview viewport
      const pvA = E.outCubic(M.inv(t, 2.2, 2.9));
      if (pvA > 0) {
        const r = lerpRect(PV0, PVR, sk);
        const walk = M.inv(t, fillT[2], 15);
        const z = 8.6 - 2.4 * E.inOutSine(walk);
        const camK = E.inOutCubic(M.inv(t, fillT[3], fillT[3] + 1.4));
        const cam = { zoom: 1 + 0.55 * camK, fx: 800, fy: M.lerp(450, 470, camK) };
        const person = {
          z, phase: walk > 0 ? (t - fillT[2]) * 3.4 : 0, detail: 1,
          alpha: E.outCubic(M.inv(t, fillT[0], fillT[0] + 0.6)),
        };
        const build = E.inOutCubic(M.inv(t, fillT[1], fillT[1] + 1.4));
        const look = E.inOutSine(M.inv(t, fillT[4], fillT[4] + 1.3));
        M.viewport(ctx, r.x, r.y, r.w, r.h, (c, w, h) => {
          if (look < 1) M.drawCity(c, w, h, { t, light: 'day', build, neon: 0, rain: 0, person, cam, grain: 0.03 });
          if (look > 0) {
            const L = M.layer('s2look', w, h);
            M.drawCity(L.getContext('2d'), w, h, { t, light: 'neon', build, neon: look, rain: look, person, cam });
            c.save();
            c.globalAlpha = look;
            c.drawImage(L, 0, 0);
            c.restore();
          }
          // framing guides when CAMERA lands
          const ga = E.outCubic(M.inv(t, fillT[3], fillT[3] + 0.4)) * (1 - E.inOutSine(M.inv(t, fillT[4] + 0.6, fillT[4] + 1.4)));
          if (ga > 0) {
            c.save();
            c.globalAlpha = ga * 0.7;
            c.strokeStyle = 'rgba(255,255,255,0.35)';
            c.lineWidth = 1;
            for (let i = 1; i < 3; i++) {
              c.beginPath();
              c.moveTo((w * i) / 3, 0);
              c.lineTo((w * i) / 3, h);
              c.moveTo(0, (h * i) / 3);
              c.lineTo(w, (h * i) / 3);
              c.stroke();
            }
            c.restore();
            const inset = 28 + 12 * (1 - ga);
            M.brackets(c, inset, inset, w - inset * 2, h - inset * 2, 34, ga, C.cyan, 2.5);
            M.icon(c, 'camera', 62, 58, 30, { color: C.cyan, lw: 2, alpha: ga, glow: 10 });
            c.fillStyle = M.rgba(C.red, ga * (Math.floor(t * 2) % 2 ? 1 : 0.4));
            c.beginPath();
            c.arc(98, 58, 6, 0, Math.PI * 2);
            c.fill();
          }
          // subject pop when SUBJECT lands
          const pa = 1 - M.inv(t, fillT[0], fillT[0] + 1.2);
          if (pa < 1 && pa > 0 && build < 0.2) {
            const p = M.cityPerson(w, h, z, cam);
            M.brackets(c, p.head[0] - 46, p.head[1] - 24, 92, p.feet[1] - p.head[1] + 40, 14, pa, C.cyan, 2);
          }
        }, { alpha: pvA, accent: C.cyan, accentA: 0.25 });
        // palette strip: grey → neon when LIGHTING & STYLE lands
        const stripA = E.outCubic(M.inv(t, fillT[4], fillT[4] + 0.4)) * (1 - sk);
        if (stripA > 0) {
          const grey = ['#8C9198', '#A2A8B0', '#B9BEC5', '#6E747D', '#D1D5DA'];
          const neon = ['#2FE0F2', '#B46BFF', '#FF4FA3', '#1A1236', '#FFB347'];
          for (let i = 0; i < 5; i++) {
            const kk = E.inOutCubic(M.inv(t, fillT[4] + 0.15 + i * 0.08, fillT[4] + 0.9 + i * 0.08));
            ctx.save();
            ctx.globalAlpha = stripA;
            ctx.fillStyle = M.mix(grey[i], neon[i], kk);
            M.rr(ctx, r.x + i * 58, r.y + r.h + 22, 48, 18, 6);
            ctx.fill();
            ctx.restore();
          }
          M.label(ctx, 'PALETTE · MOOD', r.x + 5 * 58 + 12, r.y + r.h + 36, { size: 14, color: C.ink3, alpha: stripA });
        }
      }
      // ---- merged prompt card
      const mA = E.inOutSine(M.inv(t, mergeT + 0.45, mergeT + 0.95));
      if (mA > 0) {
        M.promptField(ctx, merged.x, merged.y, merged.w, {
          title: 'PROMPT', titleColor: C.cyan, segs: MERGED, size: 22, alpha: mA, accent: C.cyan, accentA: 0.55 * (1 - sk * 0.6) * (1 - 0.5 * M.inv(t, mergeT + 1, mergeT + 2)), minH: 210,
          segStyle: (i, s) => (s.c !== undefined ? { color: '#E8F7FA', line: s.c % 2 ? C.violet : C.cyan, lineA: 0.8 } : { color: C.ink2 }),
        });
      }
      // ---- split screen: vague vs detailed
      if (sk > 0) {
        const off = (1 - sk) * -80;
        M.chip(ctx, 'VAGUE', PVL.x + off, PVL.y - 34, { alpha: sk, color: C.amber, border: M.rgba(C.amber, 0.5), bg: M.rgba(C.amber, 0.1), icon: 'cross' });
        M.chip(ctx, 'DETAILED', PVR.x, PVR.y - 34, { alpha: sk, color: C.cyan, border: M.rgba(C.cyan, 0.5), bg: M.rgba(C.cyan, 0.1), icon: 'check' });
        const gp = M.inv(t, splitT + 0.5, splitT + 1.6);
        ctx.save();
        ctx.translate(off, 0);
        M.genReveal(ctx, 's2vague', PVL.x, PVL.y, PVL.w, PVL.h, (c, w, h) =>
          M.drawCity(c, w, h, { t, light: 'day', person: { z: 15, phase: t * 3, detail: 1, look: 'day' }, grain: 0.02 }), gp, t, { alpha: sk });
        M.promptField(ctx, PVL.x, PROMPT_Y, PVL.w, { title: 'PROMPT', segs: VAGUE, size: 22, alpha: sk, minH: 200, reveal: M.typed(t, splitT + 0.1, 30, 15) });
        ctx.restore();
      }
    },
    cues(sc) {
      const m = sc.lines[0].m.slice(1);
      const mergeT = sc.lines[0].end + 0.15, splitT = mergeT + 1.3;
      return [
        { t: 0.25, id: 'pop', gain: 0.4 },
        { t: 1.5, id: 'whoosh', gain: 0.4 },
        ...[0, 1, 2, 3, 4].map((i) => ({ t: 1.9 + i * 0.12, id: 'tick', gain: 0.3 })),
        ...m.map((t) => ({ t, id: 'click', gain: 0.6 })),
        ...m.flatMap((t, i) => M.typeCues(t + 0.15, 55, COMPS[i].snip.length, 0.32)),
        { t: m[1] + 0.1, id: 'whoosh', gain: 0.25 },
        { t: m[3], id: 'shutter', gain: 0.55 },
        { t: m[4] + 0.1, id: 'gen', gain: 0.35 },
        { t: m[4] + 0.3, id: 'rain', gain: 0.16, dur: sc.dur - m[4] },
        { t: mergeT, id: 'whoosh', gain: 0.5 },
        { t: mergeT + 0.9, id: 'pop', gain: 0.4 },
        { t: splitT, id: 'whoosh', gain: 0.45 },
        ...M.typeCues(splitT + 0.1, 30, 15, 0.4),
        { t: splitT + 0.5, id: 'gen', gain: 0.35 },
      ];
    },
  });
})();
