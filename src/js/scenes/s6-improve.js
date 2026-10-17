// SCENE 6 — IMPROVING A BAD RESULT
// Don't rewrite everything: find the vague parts, replace only those, regenerate,
// compare side by side.
(function () {
  const M = window.M, C = M.C, E = M.E;
  const ORIG = { x: 120, y: 170, w: 820, h: 461 };
  const NEW = { x: 980, y: 170, w: 820, h: 461 };
  const CARD0 = { x: 1000, y: 400, w: 800 };
  const CARD1 = { x: 980, y: 690, w: 820 };
  const COPY = { x: 120, y: 690, w: 820 };
  // [vague, specific] pairs interleaved with fixed connectors
  const PARTS = [
    { old: 'a man', neu: 'a young man in a black coat' },
    { fixed: ' ' },
    { old: 'walking somewhere', neu: 'walks slowly toward the camera' },
    { fixed: ' ' },
    { old: 'in a nice city', neu: 'on a rainy neon-lit street at night' },
    { fixed: ', ' },
    { old: 'cool style', neu: 'medium shot, slow dolly-in' },
  ];
  const DEL_CPS = 60, TYPE_CPS = 60;

  function editWindows(t0) {
    let t = t0;
    return PARTS.map((p) => {
      if (p.fixed) return null;
      const w = { a: t, d: p.old.length / DEL_CPS, ty: p.neu.length / TYPE_CPS };
      t += w.d + w.ty + 0.08;
      return w;
    });
  }

  function segsAt(t, wins, flagT) {
    let active = -1;
    const segs = PARTS.map((p, i) => {
      if (p.fixed) return { text: p.fixed };
      const w = wins[i];
      let text = p.old, state = 'old';
      if (t >= w.a) {
        const del = Math.floor((t - w.a) * DEL_CPS);
        if (del < p.old.length) {
          text = p.old.slice(0, p.old.length - del);
          state = 'del';
          active = i;
        } else {
          const n = Math.floor((t - w.a - w.d) * TYPE_CPS);
          text = p.neu.slice(0, Math.min(p.neu.length, n));
          state = n >= p.neu.length ? 'new' : 'typing';
          if (state === 'typing') active = i;
        }
      }
      return { text, state, flag: flagT[i] };
    });
    return { segs, active };
  }

  M.scene({
    id: 's6',
    title: 'Improving a bad result',
    start: 69.8,
    end: 85.6,
    vo: [0.7, 5.6, 8.5],
    draw(ctx, t, sc) {
      const l1 = sc.lines[1].t, l2 = sc.lines[2].t;
      const flagT = PARTS.map((p, i) => (p.fixed ? 0 : l1 + 0.2 + (i / 2) * 0.5));
      const wins = editWindows(l2 + 0.35);
      const editEnd = wins[6].a + wins[6].d + wins[6].ty;
      const tMove = editEnd + 0.15, tGen = tMove + 0.55, tWipe = tGen + 0.25;
      const mv = E.inOutCubic(M.inv(t, tMove, tMove + 0.6));
      const open = E.inOutCubic(M.inv(t, l2, l2 + 0.4));
      // ---- original result (starts centred, rises to make room for the comparison)
      const oy = M.lerp(310, ORIG.y, mv);
      M.genReveal(ctx, 's6orig', ORIG.x, oy, ORIG.w, ORIG.h, (c, w, h) =>
        M.drawCity(c, w, h, { t, light: 'day', person: { z: 17, phase: t * 3, look: 'day' }, cam: { zoom: 1, fx: 800, fy: 450 }, grain: 0.02 }),
        M.inv(t, 0.25, 1.3), t, {});
      // mismatch flag on the original
      const xa = E.outBack(M.inv(t, 1.6, 2.0)) * (1 - E.inOutSine(M.inv(t, tWipe + 1.0, tWipe + 1.5)));
      M.status(ctx, false, ORIG.x + ORIG.w - 34, oy + 34, Math.min(1, xa), 38);
      // ---- prompt / editor card
      const { segs, active } = segsAt(t, wins, flagT);
      const card = { x: M.lerp(CARD0.x, CARD1.x, mv), y: M.lerp(CARD0.y, CARD1.y, mv), w: M.lerp(CARD0.w, CARD1.w, mv) };
      const ca = E.outCubic(M.inv(t, 0.6, 1.1));
      const sel = E.inOutCubic(M.inv(t, 2.5, 3.0)) * (1 - E.inOutCubic(M.inv(t, 3.9, 4.4)));
      const f = M.promptField(ctx, card.x, card.y, card.w, {
        title: 'PROMPT', titleColor: open > 0.5 ? C.cyan : C.ink2, segs, size: 24, alpha: ca, minLines: 3,
        accent: open > 0 ? C.cyan : null, accentA: open * (1 - 0.6 * mv),
        segStyle: (i, s) => {
          if (sel > 0) return { color: '#FFFFFF', bg: '#3D7BFF', bgA: 0.45 * sel, bgW: 1 };
          if (!s.state) return { color: C.ink2 };
          if (s.state === 'new' || s.state === 'typing') return { color: '#E8FAFC', bg: C.cyan, bgA: 0.14, line: C.cyan, lineA: 0.9 };
          const fl = E.outCubic(M.inv(t, s.flag, s.flag + 0.3));
          return { color: M.mix(C.ink, C.amber, fl), bg: C.amber, bgA: 0.14 * fl, box: C.amber, boxA: fl * 0.9 * (s.state === 'del' ? 0.5 : 1) };
        },
      });
      // caret at the active edit
      if (active >= 0 && f.L) {
        const idx = f.L.ranges[active][1];
        const [cx, cy] = M.charPos(f.L, idx);
        ctx.fillStyle = C.cyan;
        ctx.fillRect(f.bodyX + cx + 1, f.bodyY + cy + f.L.lh * 0.18, 3, f.L.lh * 0.64);
      }
      // "?" markers over vague phrases
      if (t > l1 && t < l2 + 0.4 && f.L) {
        PARTS.forEach((p, i) => {
          if (p.fixed) return;
          const k = E.outBack(M.inv(t, flagT[i], flagT[i] + 0.35)) * (1 - M.inv(t, l2, l2 + 0.4));
          if (k <= 0) return;
          const [a, b] = f.L.ranges[i];
          const r = M.rangeRects(f.L, a, b)[0];
          if (!r) return;
          M.badge(ctx, '?', f.bodyX + r[0] + r[2] / 2, f.bodyY + r[1] - 6, Math.min(1, k), { fill: C.amber, r: 13, ink: '#2A1A00' });
        });
      }
      // replace-all reflex, rejected
      const ra = E.outBack(M.inv(t, 3.2, 3.6)) * (1 - E.inOutSine(M.inv(t, 4.4, 4.9)));
      if (ra > 0) M.status(ctx, false, card.x + card.w - 34, card.y + 30, Math.min(1, ra), 34);
      // chips: VAGUE PROMPT → MORE SPECIFIC DETAILS
      const chipY = card.y - 26;
      M.chip(ctx, 'VAGUE PROMPT', card.x, chipY, { alpha: ca * (1 - open), size: 16, color: C.amber, bg: M.rgba(C.amber, 0.1), border: M.rgba(C.amber, 0.55), icon: 'cross' });
      M.chip(ctx, 'MORE SPECIFIC DETAILS', card.x, chipY, { alpha: open, size: 16, color: C.cyan, bg: M.rgba(C.cyan, 0.1), border: M.rgba(C.cyan, 0.55), icon: 'edit' });
      // generate button rides with the editor
      const ba = open * (1 - E.inOutSine(M.inv(t, tWipe + 0.6, tWipe + 1.1)));
      M.genButton(ctx, card.x + card.w - 196, card.y + f.h + 22, { alpha: ba, press: M.inv(t, tGen - 0.2, tGen + 0.15), loading: M.inv(t, tGen, tGen + 1.3) });
      // ---- original prompt kept for comparison
      const cpa = E.outCubic(M.inv(t, tMove + 0.2, tMove + 0.8));
      if (cpa > 0) {
        M.promptField(ctx, COPY.x, COPY.y, COPY.w, {
          title: 'PROMPT', segs: PARTS.map((p) => ({ text: p.fixed || p.old, old: !p.fixed })), size: 24, alpha: cpa * 0.9, minLines: 3,
          segStyle: (i, s) => (s.old ? { color: C.amber, bg: C.amber, bgA: 0.1 } : { color: C.ink3 }),
        });
        M.chip(ctx, 'VAGUE PROMPT', COPY.x, COPY.y - 26, { alpha: cpa, size: 16, color: C.amber, bg: M.rgba(C.amber, 0.1), border: M.rgba(C.amber, 0.55), icon: 'cross' });
      }
      // ---- improved result, revealed with a horizontal wipe
      const wk = E.inOutCubic(M.inv(t, tWipe, tWipe + 1.2));
      if (wk > 0) {
        const L = M.layer('s6new', NEW.w, NEW.h);
        M.drawCity(L.getContext('2d'), NEW.w, NEW.h, {
          t, light: 'neon', rain: 1, dof: 0.3, person: { z: 7.4 - 0.4 * M.inv(t, tWipe, sc.dur), phase: t * 2.6 },
          cam: { zoom: 1.9 + 0.15 * M.inv(t, tWipe, sc.dur), fx: 800, fy: 440 },
        });
        M.viewport(ctx, NEW.x, NEW.y, NEW.w, NEW.h, (c, w, h) => {
          c.fillStyle = '#0E1118';
          c.fillRect(0, 0, w, h);
          c.save();
          c.beginPath();
          c.rect(0, 0, w * wk, h);
          c.clip();
          c.drawImage(L, 0, 0);
          c.restore();
          if (wk < 1) {
            c.fillStyle = 'rgba(220,250,255,0.9)';
            c.shadowColor = C.cyan;
            c.shadowBlur = 20;
            c.fillRect(w * wk - 1.5, 0, 3, h);
          }
        }, { accent: C.cyan, accentA: 0.45 * wk });
        M.chip(ctx, 'IMPROVED RESULT', NEW.x, NEW.y - 26, { alpha: E.outCubic(M.inv(t, tWipe + 0.6, tWipe + 1.0)), size: 16, color: C.cyan, bg: M.rgba(C.cyan, 0.1), border: M.rgba(C.cyan, 0.55), icon: 'check' });
        M.status(ctx, true, NEW.x + NEW.w - 34, NEW.y + 34, E.outBack(M.inv(t, tWipe + 1.0, tWipe + 1.4)), 38);
      }
    },
    cues(sc) {
      const l1 = sc.lines[1].t, l2 = sc.lines[2].t;
      const wins = editWindows(l2 + 0.35);
      const editEnd = wins[6].a + wins[6].d + wins[6].ty;
      const tMove = editEnd + 0.15, tGen = tMove + 0.55, tWipe = tGen + 0.25;
      const out = [
        { t: 0.25, id: 'gen', gain: 0.35 },
        { t: 0.6, id: 'pop', gain: 0.35 },
        { t: 1.6, id: 'error', gain: 0.4 },
        { t: 2.5, id: 'tick', gain: 0.4 },
        { t: 3.2, id: 'error', gain: 0.35 },
        ...[0, 2, 4, 6].map((i) => ({ t: l1 + 0.2 + (i / 2) * 0.5, id: 'tick', gain: 0.5 })),
        { t: l2, id: 'pop', gain: 0.4 },
        { t: tMove, id: 'whoosh', gain: 0.35 },
        { t: tGen, id: 'click', gain: 0.75 },
        { t: tGen + 0.1, id: 'gen', gain: 0.45 },
        { t: tWipe, id: 'swipe', gain: 0.45 },
        { t: tWipe + 0.3, id: 'rain', gain: 0.14, dur: sc.dur - tWipe },
        { t: tWipe + 1.0, id: 'check', gain: 0.5 },
      ];
      [0, 2, 4, 6].forEach((i) => {
        const w = wins[i];
        out.push(...M.typeCues(w.a, DEL_CPS, PARTS[i].old.length, 0.3));
        out.push(...M.typeCues(w.a + w.d, TYPE_CPS, PARTS[i].neu.length, 0.4));
      });
      return out;
    },
  });
})();
