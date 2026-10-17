// SCENE 7 — PRACTICAL EXERCISE: TWO PROMPTS, ONE IDEA
// Same idea, two prompts. Numbered markers tie every specific phrase in Prompt B to
// a visible difference — relevance, not length, is what changes the result.
(function () {
  const M = window.M, C = M.C, E = M.E;
  const A_TEXT = [{ text: 'A ' }, { text: 'robot', n: 1 }, { text: ' stands in ' }, { text: 'a desert', n: 2 }, { text: '.' }];
  const B_TEXT = [
    { text: 'A ' },
    { text: 'tall futuristic robot with a brushed-metal body', n: 1 },
    { text: ' stands alone in ' },
    { text: 'a vast golden desert at sunset', n: 2 },
    { text: '. ' },
    { text: 'Wide cinematic shot, low camera angle', n: 3 },
    { text: ', ' },
    { text: 'wind blowing sand across the ground', n: 5 },
    { text: ', ' },
    { text: 'warm backlighting', n: 4 },
    { text: ', ' },
    { text: 'dramatic atmosphere', n: 5 },
    { text: ', ' },
    { text: 'highly detailed science-fiction aesthetic', n: 1 },
    { text: '.' },
  ];
  const lenOf = (segs) => segs.reduce((n, s) => n + s.text.length, 0);
  const CATS = [
    [1, 'CHARACTER', 'robot', 'character'],
    [2, 'ENVIRONMENT', 'place', 'environment'],
    [3, 'CAMERA ANGLE', 'camera', 'camera'],
    [4, 'LIGHTING', 'light', 'lighting'],
    [5, 'ATMOSPHERE', 'spark', 'atmosphere'],
  ];
  const PANEL = [{ x: 80, w: 860 }, { x: 980, w: 860 }];
  const FIELD_Y = 196, IMG_Y = 512, IMG_H = 472;
  const B_CPS = 64;

  M.scene({
    id: 's7',
    title: 'Two prompts, one idea',
    start: 85.0,
    end: 102.6,
    vo: [0.7, 2.6, 5.7, 11.2],
    draw(ctx, t, sc) {
      const lA = sc.lines[1].t, lB = sc.lines[2].t, lC = sc.lines[3].t;
      const tA = lA + 0.2, genA = tA + lenOf(A_TEXT) / 45 + 0.35;
      const tB = lB + 0.2, genB = tB + lenOf(B_TEXT) / B_CPS + 0.25;
      const markT = (n) => lC + 0.55 + (n - 1) * 0.55;
      // ---- header: ONE IDEA → TWO PROMPTS → COMPARE THE RESULTS
      const hk = E.inOutCubic(M.inv(t, 1.15, 1.8));
      const hOut = 1 - E.inOutSine(M.inv(t, lC - 0.1, lC + 0.3));
      ctx.save();
      ctx.globalAlpha = hOut;
      const hx = M.lerp(M.W / 2, 80, hk), hy = M.lerp(560, 118, hk), hs = M.lerp(96, 40, hk);
      const oneW = M.measure(ctx, 'ONE IDEA', { size: hs, weight: 700, fam: M.F.display, ls: 1 });
      M.kinetic(ctx, 'ONE IDEA', hk < 1 ? M.lerp(hx - oneW / 2, hx, hk) : hx, hy, t - 0.3, { size: hs, weight: 700, fam: M.F.display, ls: 1 });
      if (hk < 0.5) {
        const ia = E.outCubic(M.inv(t, 0.6, 1.0)) * (1 - hk * 2);
        M.chip(ctx, 'A ROBOT IN A DESERT', M.W / 2, 650, { align: 'center', alpha: ia, size: 18, icon: 'robot', color: C.ink2 });
      }
      M.kinetic(ctx, '·  TWO PROMPTS', 80 + M.measure(ctx, 'ONE IDEA', { size: 40, weight: 700, fam: M.F.display, ls: 1 }) + 24, 118, t - 1.6, { size: 40, weight: 700, fam: M.F.display, ls: 1, color: C.cyan });
      ctx.restore();
      M.kinetic(ctx, 'COMPARE THE RESULTS', 80, 118, t - lC, { size: 40, weight: 700, fam: M.F.display, ls: 1, color: C.ink });
      // ---- panels
      const pa = E.outCubic(M.inv(t, 1.6, 2.3));
      if (pa <= 0) return;
      const mk = (n) => E.outBack(M.inv(t, markT(n), markT(n) + 0.4));
      const covA = E.outCubic(M.inv(t, markT(5) + 0.6, markT(5) + 1.0));
      [0, 1].forEach((pi) => {
        const P = PANEL[pi], segs = pi ? B_TEXT : A_TEXT;
        const t0 = pi ? tB : tA, cps = pi ? B_CPS : 45, gen = pi ? genB : genA;
        const yOff = (1 - pa) * 30;
        const f = M.promptField(ctx, P.x, FIELD_Y + yOff, P.w, {
          title: pi ? 'PROMPT B' : 'PROMPT A', titleColor: pi ? C.cyan : C.ink2, segs, size: 20, alpha: pa, minLines: 4,
          reveal: M.typed(t, t0, cps, lenOf(segs)), cursor: t > t0 - 0.3 && t < gen, t,
          accent: C.cyan, accentA: pi ? 0.25 * mk(1) : 0,
          button: { press: M.inv(t, gen - 0.2, gen + 0.15), loading: M.inv(t, gen, gen + 1.2), alpha: pa },
          segStyle: (i, s) => {
            if (!s.n) return { color: pi ? C.ink2 : C.ink };
            const k = Math.min(1, mk(s.n));
            return { color: M.mix(C.ink, pi ? '#FFFFFF' : C.ink, k), bg: C.cyan, bgA: (pi ? 0.16 : 0.07) * k, line: pi ? C.cyan : '#7E8796', lineA: k };
          },
        });
        // number badges above the matching phrases
        if (f.L) {
          const seen = {};
          segs.forEach((s, i) => {
            if (!s.n || seen[s.n + '-' + i]) return;
            const k = mk(s.n);
            if (k <= 0) return;
            const [a] = f.L.ranges[i];
            const [cx, cy] = M.charPos(f.L, a);
            M.badge(ctx, s.n, f.bodyX + cx - 7, f.bodyY + cy + 3, Math.min(1, k), { r: 8.5, fill: pi ? C.cyan : '#7E8796', glow: pi ? 10 : 0 });
          });
        }
        // coverage row: which relevant details does this prompt specify?
        if (covA > 0) {
          CATS.forEach(([n, , icon], i) => {
            const has = pi ? 1 : n <= 2 ? 0.45 : 0;
            const x = P.x + 34 + i * 46, y = FIELD_Y + yOff + f.h - 46;
            ctx.save();
            ctx.globalAlpha = covA * pa;
            ctx.strokeStyle = has ? M.rgba(C.cyan, 0.4 + 0.6 * has) : 'rgba(255,255,255,0.14)';
            ctx.fillStyle = has ? M.rgba(C.cyan, 0.12 * has) : 'rgba(255,255,255,0.02)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y, 17, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            M.icon(ctx, icon, x, y, 18, { color: has ? M.mix('#9AA3B2', C.cyan, has) : '#4A515D', lw: 2, alpha: covA * pa });
          });
        }
        // result
        const gp = M.inv(t, gen + 0.2, gen + 1.3);
        let anchors = null;
        M.genReveal(ctx, 's7' + pi, P.x, IMG_Y + yOff, P.w, IMG_H, (c, w, h) => {
          anchors = pi ? M.drawDesertCinematic(c, w, h, { t, grain: 0.04 }) : M.drawDesertSimple(c, w, h, { t });
        }, gp, t, { alpha: pa, accent: C.cyan, accentA: pi ? 0.4 * mk(1) : 0 });
        // markers on the image
        if (anchors && gp >= 1) {
          CATS.forEach(([n, name, , key]) => {
            if (!anchors[key]) return;
            const k = Math.min(1, mk(n));
            if (k <= 0) return;
            const [ax, ay] = anchors[key];
            const x = P.x + ax, y = IMG_Y + yOff + ay;
            ctx.save();
            ctx.globalAlpha = k * (pi ? 0.6 : 0.35);
            ctx.strokeStyle = pi ? C.cyan : '#9AA3B2';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y, 22 + 10 * (1 - k) + 4 * Math.sin(t * 4 + n), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            M.badge(ctx, n, x, y, k, { r: 14, fill: pi ? C.cyan : '#9AA3B2', glow: pi ? 14 : 0 });
            if (pi) M.chip(ctx, name, x + 24, y, { size: 13, h: 26, padX: 10, alpha: k, color: '#E8FAFC', bg: 'rgba(4,12,16,0.75)', border: M.rgba(C.cyan, 0.5) });
          });
        }
      });
    },
    cues(sc) {
      const lA = sc.lines[1].t, lB = sc.lines[2].t, lC = sc.lines[3].t;
      const tA = lA + 0.2, genA = tA + lenOf(A_TEXT) / 45 + 0.35;
      const tB = lB + 0.2, genB = tB + lenOf(B_TEXT) / B_CPS + 0.25;
      return [
        { t: 0.3, id: 'whoosh', gain: 0.35 },
        { t: 1.15, id: 'whoosh', gain: 0.3 },
        { t: 1.6, id: 'pop', gain: 0.35 },
        ...M.typeCues(tA, 45, lenOf(A_TEXT), 0.5),
        { t: genA, id: 'click', gain: 0.7 },
        { t: genA + 0.15, id: 'gen', gain: 0.4 },
        ...M.typeCues(tB, B_CPS, lenOf(B_TEXT), 0.4),
        { t: genB, id: 'click', gain: 0.7 },
        { t: genB + 0.15, id: 'gen', gain: 0.45 },
        { t: genB + 0.5, id: 'wind', gain: 0.18, dur: sc.dur - genB },
        { t: lC, id: 'whoosh', gain: 0.3 },
        ...[1, 2, 3, 4, 5].map((n) => ({ t: lC + 0.55 + (n - 1) * 0.55, id: 'tick', gain: 0.55 })),
        { t: lC + 0.55 + 4 * 0.55 + 0.6, id: 'pop', gain: 0.4 },
      ];
    },
  });
})();
