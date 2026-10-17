// SCENE 3 — CHARACTER, ENVIRONMENT & ACTION
// A neutral figure in empty space becomes the character, the street builds around
// him, rain and neon arrive, and he walks toward camera. Labels track each change.
(function () {
  const M = window.M, C = M.C, E = M.E;
  const V = { x: 360, y: 92, w: 1200, h: 675 };
  const PR = { x: 360, y: 800, w: 1200 };
  const SEGS = [
    { text: 'A young man wearing a black coat', k: 'who' },
    { text: ' ' },
    { text: 'walks slowly', k: 'what' },
    { text: ' ' },
    { text: 'through a rainy futuristic city street at night', k: 'where' },
    { text: '.' },
  ];
  const FULL = SEGS.map((s) => s.text).join('');

  M.scene({
    id: 's3',
    title: 'Character, environment & action',
    start: 26.2,
    end: 40.6,
    vo: [0.7, 6.9],
    draw(ctx, t, sc) {
      const [tWho, tWhere, tWhat] = sc.lines[0].m;
      const l1 = sc.lines[1].t, tSpec = sc.lines[1].m[1];
      const pulse = (t0) => Math.exp(-Math.pow((t - t0 - 0.3) / 0.35, 2));
      const level = (t0, tp) => Math.max(M.inv(t, t0, t0 + 0.3) * (1 - 0.6 * M.inv(t, t0 + 1.6, t0 + 2.2)), tp ? pulse(tp) : 0);
      const on = {
        who: level(tWho, tSpec),
        where: level(tWhere, tSpec + 0.7),
        what: level(tWhat, tSpec + 1.4),
      };
      // ---- the shot
      const detail = E.inOutCubic(M.inv(t, tWho + 0.2, tWho + 1.4));
      const build = E.inOutCubic(M.inv(t, tWhere + 0.1, tWhere + 1.9));
      const neon = M.inv(t, tWhere + 1.0, tWhere + 2.2);
      const rain = E.inOutSine(M.inv(t, tWhere + 1.4, tWhere + 2.6));
      const walk = M.inv(t, tWhat + 0.1, sc.dur);
      const z = 9.2 - 2.6 * E.inOutSine(walk);
      const cam = { zoom: 1.8 + 0.3 * E.inOutSine(M.inv(t, 0, sc.dur)), fx: 800, fy: 440 };
      const person = { z, phase: walk > 0 ? (t - tWhat) * 2.6 : 0, detail };
      const va = E.outCubic(M.inv(t, 0, 0.6));
      M.viewport(ctx, V.x, V.y, V.w, V.h, (c, w, h) => {
        M.drawCity(c, w, h, { t, light: 'neon', build, neon, rain, person, cam });
        // motion cue on the ground
        const ma = M.inv(t, tWhat, tWhat + 0.4) * (1 - M.inv(t, tWhat + 2.4, tWhat + 3.0));
        if (ma > 0) {
          const p = M.cityPerson(w, h, z, cam);
          const f = M.cityPoint(w, h, 0, 0, z - 1.6, cam);
          c.save();
          c.globalAlpha = ma;
          c.strokeStyle = C.cyan;
          c.shadowColor = C.cyan;
          c.shadowBlur = 12;
          c.lineWidth = 3;
          c.setLineDash([10, 8]);
          c.lineDashOffset = -t * 30;
          c.beginPath();
          c.moveTo(p.feet[0], p.feet[1] + 6);
          c.lineTo(f[0], f[1]);
          c.stroke();
          c.setLineDash([]);
          M.arrow(c, f[0], f[1] - 10, f[0], f[1] + 4, 1, { color: C.cyan, lw: 3, hs: 14 });
          c.restore();
        }
      }, { alpha: va });
      // ---- callouts pointing into the shot
      const p = M.cityPerson(V.w, V.h, z, cam);
      const wp = M.cityPoint(V.w, V.h, 7.5, 4.6, 24, cam);
      const head = [V.x + p.head[0] - 6, V.y + p.head[1] + 30];
      const feet = [V.x + p.feet[0] + 4, V.y + p.feet[1] - 8];
      M.callout(ctx, 'WHO?', 320, 300, head[0] - 26, head[1] + 10, t - tWho, { align: 'right', on: on.who });
      M.callout(ctx, 'WHERE?', 1600, 250, V.x + wp[0], V.y + wp[1], t - tWhere, { align: 'left', on: on.where });
      M.callout(ctx, 'WHAT HAPPENS?', 320, 600, feet[0] - 18, feet[1], t - tWhat, { align: 'right', on: on.what });
      // ---- the example prompt
      const pa = E.outCubic(M.inv(t, 0.15, 0.6));
      const reveal = M.typed(t, 0.25, 75, FULL.length);
      M.promptField(ctx, PR.x, PR.y, PR.w, {
        title: 'PROMPT', segs: SEGS, size: 26, alpha: pa, reveal, cursor: reveal < FULL.length, t,
        segStyle: (i, s) => {
          if (!s.k) return { color: C.ink3 };
          const v = on[s.k];
          return { color: M.mix('#7E8796', '#FFFFFF', Math.min(1, v * 1.4)), bg: C.cyan, bgA: 0.16 * v, line: C.cyan, lineA: v };
        },
      });
      // ---- "a person walks" → specific
      const va2 = E.outCubic(M.inv(t, l1, l1 + 0.5));
      if (va2 > 0) {
        const fade = 1 - 0.55 * M.inv(t, tSpec - 0.4, tSpec + 0.2);
        const cx = 70, cy = 862, cw = 250, ch = 78;
        ctx.save();
        ctx.globalAlpha = va2 * fade;
        M.rr(ctx, cx, cy, cw, ch, 14);
        ctx.fillStyle = M.rgba(C.amber, 0.08);
        ctx.fill();
        ctx.strokeStyle = M.rgba(C.amber, 0.6);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        M.text(ctx, '«a person walks»', cx + cw / 2, cy + ch / 2 + 1, { size: 21, fam: M.F.mono, color: C.amber, align: 'center', base: 'middle', alpha: va2 * fade });
        const st = E.inOutCubic(M.inv(t, l1 + 1.6, l1 + 2.1));
        if (st > 0) {
          ctx.save();
          ctx.globalAlpha = va2;
          ctx.fillStyle = C.amber;
          ctx.fillRect(cx + 22, cy + ch / 2, (cw - 44) * st, 2.5);
          ctx.restore();
        }
        M.arrow(ctx, cx + cw + 6, cy + ch / 2, PR.x - 10, cy + ch / 2, E.inOutCubic(M.inv(t, l1 + 2.0, l1 + 2.6)), { color: C.cyan, lw: 2.5 });
      }
    },
    cues(sc) {
      const [tWho, tWhere, tWhat] = sc.lines[0].m;
      const l1 = sc.lines[1].t, tSpec = sc.lines[1].m[1];
      return [
        ...M.typeCues(0.25, 75, FULL.length, 0.35),
        { t: tWho, id: 'pop', gain: 0.5 },
        { t: tWhere, id: 'pop', gain: 0.5 },
        { t: tWhere + 0.1, id: 'whoosh', gain: 0.35 },
        { t: tWhere + 1.4, id: 'rain', gain: 0.24, dur: sc.dur - tWhere - 1.2 },
        { t: tWhat, id: 'pop', gain: 0.5 },
        { t: l1, id: 'pop', gain: 0.35 },
        { t: l1 + 1.6, id: 'tick', gain: 0.5 },
        { t: tSpec, id: 'tick', gain: 0.45 },
        { t: tSpec + 0.7, id: 'tick', gain: 0.45 },
        { t: tSpec + 1.4, id: 'tick', gain: 0.45 },
      ];
    },
  });
})();
