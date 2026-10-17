// SCENE 5 — WHAT IS A NEGATIVE PROMPT?
// A portrait comes back with artifacts; each negative term removes one of them.
// Closing beat: a negative prompt narrows the odds, it does not guarantee.
(function () {
  const M = window.M, C = M.C, E = M.E;
  const IMG = { x: 120, y: 240, w: 1040, h: 585 };
  const PX = 1220, PW = 580;
  const PROMPT = 'Portrait of a young man, cinematic lighting, realistic skin texture.';
  const NEG = 'blurry, distorted hands, duplicate subjects, unwanted text, low detail.';
  const TERMS = [
    ['blurry', 'blur', 'BLURRY'],
    ['distorted hands', 'hand', 'HANDS'],
    ['duplicate subjects', 'dup', 'DUPLICATE'],
    ['unwanted text', 'text', 'TEXT'],
    ['low detail', 'low', 'LOW DETAIL'],
  ];
  const NEG_CPS = 19;
  const termDone = (t0) => TERMS.map(([w]) => t0 + (NEG.indexOf(w) + w.length) / NEG_CPS);

  M.scene({
    id: 's5',
    title: 'What is a negative prompt?',
    start: 54.6,
    end: 70.4,
    vo: [0.7, 6.0, 12.2],
    draw(ctx, t, sc) {
      const tNeg = sc.lines[1].t, tCave = sc.lines[2].t;
      const done = termDone(tNeg);
      const tGen = 2.1, tMark = 3.4, tField = 5.0, tRegen = done[4] + 0.35;
      // headline
      M.headline(ctx, 'NEGATIVE PROMPT', 120, 172, t - 0.2, { size: 64 });
      // ---- the image
      const amt = {};
      TERMS.forEach(([, key], i) => (amt[key] = 1 - E.inOutCubic(M.inv(t, done[i], done[i] + 0.5))));
      const resid = E.inOutSine(M.inv(t, tCave + 0.3, tCave + 0.9));
      let boxes = null;
      const gp = M.inv(t, tGen + 0.2, tGen + 1.3);
      M.genReveal(ctx, 's5', IMG.x, IMG.y, IMG.w, IMG.h, (c, w, h) => {
        boxes = M.drawPortrait(c, w, h, t, { ...amt, text: Math.max(amt.text, 0.22 * resid) });
        // regenerate shimmer
        const rp = M.inv(t, tRegen, tRegen + 0.9);
        if (rp > 0 && rp < 1) {
          const sx = w * E.inOutCubic(rp);
          const g = c.createLinearGradient(sx - 120, 0, sx + 20, 0);
          g.addColorStop(0, 'rgba(47,224,242,0)');
          g.addColorStop(1, 'rgba(47,224,242,0.25)');
          c.fillStyle = g;
          c.fillRect(sx - 120, 0, 140, h);
        }
      }, gp, t, { accent: C.cyan, accentA: 0.18 });
      // artifact markers: red outline → cyan check
      if (boxes) {
        const order = { blur: 0, hand: 1, dup: 2, text: 3 };
        Object.entries(order).forEach(([key, i]) => {
          const [bx, by, bw, bh] = boxes[key];
          const x = IMG.x + bx, y = IMG.y + by;
          const appear = E.outCubic(M.inv(t, tMark + i * 0.3, tMark + i * 0.3 + 0.4));
          const fixed = E.inOutCubic(M.inv(t, done[i] + 0.1, done[i] + 0.5));
          const fade = 1 - E.inOutSine(M.inv(t, done[i] + 1.4, done[i] + 2.0));
          const a = appear * fade;
          if (a <= 0) return;
          const col = M.mix(C.red, C.cyan, fixed);
          ctx.save();
          ctx.globalAlpha = a;
          ctx.strokeStyle = col;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = col;
          ctx.shadowBlur = 12;
          ctx.setLineDash(fixed > 0.5 ? [] : [10, 6]);
          M.rr(ctx, x, y, bw, bh, 14);
          ctx.stroke();
          ctx.restore();
          M.chip(ctx, TERMS[i][2], x + 8, y - 2, { size: 13, h: 26, padX: 10, alpha: a * (1 - fixed), color: '#FFFFFF', bg: M.rgba(C.red, 0.85), border: M.rgba(C.red, 1) });
          M.status(ctx, fixed > 0.5, x + bw - 2, y + 2, a, 34);
        });
        // global "low detail" flag
        const la = E.outCubic(M.inv(t, tMark + 1.3, tMark + 1.7)) * (1 - E.inOutSine(M.inv(t, done[4] + 1.4, done[4] + 2.0)));
        const lf = E.inOutCubic(M.inv(t, done[4] + 0.1, done[4] + 0.5));
        M.chip(ctx, 'LOW DETAIL', IMG.x + IMG.w - 20, IMG.y + IMG.h - 34, {
          align: 'right', size: 14, alpha: la, color: '#FFFFFF', icon: lf > 0.5 ? 'check' : 'cross',
          bg: M.rgba(lf > 0.5 ? '#0E7C8A' : C.red, 0.85), border: lf > 0.5 ? C.cyan : C.red,
        });
        // residual: not every flaw is guaranteed to disappear
        if (resid > 0) {
          const [bx, by, bw, bh] = boxes.text;
          ctx.save();
          ctx.globalAlpha = resid;
          ctx.strokeStyle = C.amber;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.lineDashOffset = -t * 12;
          M.rr(ctx, IMG.x + bx - 6, IMG.y + by - 6, bw + 12, bh + 12, 16);
          ctx.stroke();
          ctx.restore();
        }
      }
      // ---- right panel: main prompt
      const pa = E.outCubic(M.inv(t, 0.5, 1.0));
      const reveal = M.typed(t, 0.7, 55, PROMPT.length);
      const f1 = M.promptField(ctx, PX, IMG.y, PW, {
        title: 'PROMPT', titleColor: C.cyan, segs: [{ text: PROMPT }], size: 22, alpha: pa, reveal, cursor: t < tField, t,
        accent: C.cyan, accentA: 0.3,
      });
      M.text(ctx, 'НЕГІЗГІ НҰСҚАУ — ҚАЖЕТТІ НӘТИЖЕ', PX + 4, IMG.y + f1.h + 36, { size: 17, weight: 600, ls: 2, color: C.ink2, alpha: E.outCubic(M.inv(t, 1.0, 1.5)) });
      // ---- negative prompt field
      const na = E.outCubic(M.inv(t, tField, tField + 0.6));
      const ny = IMG.y + f1.h + 80 + (1 - na) * 30;
      const nReveal = M.typed(t, tNeg, NEG_CPS, NEG.length);
      const f2 = M.promptField(ctx, PX, ny, PW, {
        title: 'NEGATIVE PROMPT', titleColor: '#FF8A98', icon: 'block', segs: [{ text: NEG }], size: 22, alpha: na, reveal: nReveal,
        cursor: t > tField && t < tRegen + 1, t, accent: C.red, accentA: 0.35 * na, minLines: 2,
        button: { press: M.inv(t, tRegen - 0.25, tRegen + 0.1), loading: M.inv(t, tRegen, tRegen + 0.9), alpha: na },
        segStyle: () => ({ color: '#FFC9D0' }),
      });
      M.text(ctx, 'NEGATIVE PROMPT — ҚАЖЕТСІЗ ЭЛЕМЕНТТЕРДІ ШЕКТЕУ', PX + 4, ny + f2.h + 36, { size: 17, weight: 600, ls: 2, color: C.ink2, alpha: E.outCubic(M.inv(t, tField + 0.4, tField + 0.9)) });
      // main prompt "Generate" press happens on the image's first render
      const ga = E.outCubic(M.inv(t, 1.6, 2.0)) * (1 - E.inOutSine(M.inv(t, tField - 0.4, tField)));
      if (ga > 0) M.genButton(ctx, PX + PW - 176, IMG.y + f1.h + 70, { alpha: ga, press: M.inv(t, tGen - 0.2, tGen + 0.15), loading: M.inv(t, tGen, tGen + 1.2) });
      // caveat chip
      const ca = E.outBack(M.inv(t, tCave, tCave + 0.5));
      if (ca > 0) {
        M.chip(ctx, '≠ 100%', PX + PW - 4, ny - 26, { align: 'right', alpha: Math.min(1, ca), size: 18, color: C.amber, bg: M.rgba(C.amber, 0.12), border: M.rgba(C.amber, 0.6), icon: 'eye' });
      }
    },
    cues(sc) {
      const tNeg = sc.lines[1].t, tCave = sc.lines[2].t;
      const done = termDone(tNeg);
      const tGen = 2.1, tMark = 3.4, tField = 5.0, tRegen = done[4] + 0.35;
      return [
        { t: 0.2, id: 'whoosh', gain: 0.3 },
        ...M.typeCues(0.7, 55, PROMPT.length, 0.35),
        { t: tGen, id: 'click', gain: 0.7 },
        { t: tGen + 0.15, id: 'gen', gain: 0.45 },
        ...[0, 1, 2, 3].map((i) => ({ t: tMark + i * 0.3, id: 'error', gain: 0.4 })),
        { t: tMark + 1.3, id: 'error', gain: 0.35 },
        { t: tField, id: 'whoosh', gain: 0.35 },
        ...M.typeCues(tNeg, NEG_CPS, NEG.length, 0.45),
        ...done.map((d) => ({ t: d + 0.1, id: 'check', gain: 0.45 })),
        { t: tRegen, id: 'click', gain: 0.6 },
        { t: tRegen + 0.1, id: 'gen', gain: 0.3 },
        { t: tCave, id: 'pop', gain: 0.45 },
      ];
    },
  });
})();
