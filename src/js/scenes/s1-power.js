// SCENE 1 — THE POWER OF A PROMPT
// A point of light opens a workspace; IDEA becomes PROMPT; the prompt generates a shot.
(function () {
  const M = window.M, C = M.C, E = M.E;
  const WS = { x: 340, y: 190, w: 1240, h: 700 };
  const FIELD = { w: 820, h: 150 };
  const T = {
    point: 0.3, expandX: 0.9, expandY: 1.25, bulb: 2.0, cursor: 2.6, type: 3.1, morph: 4.3, field: 4.9,
    button: 5.3, click: 5.9, grow: 6.1, grown: 7.4, title: 7.6, chain: 8.7,
  };
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#/<>*';

  function wordAt(t) {
    if (t < T.morph) return 'IDEA'.slice(0, M.typed(t, T.type, 8.3, 4));
    const target = 'PROMPT';
    let s = '';
    for (let i = 0; i < target.length; i++) {
      const settle = T.morph + 0.15 + i * 0.09;
      if (t >= settle) s += target[i];
      else if (i < 4 || t > T.morph + i * 0.05) s += GLYPHS[Math.floor(M.hash(i * 13 + Math.floor(t * 22)) * GLYPHS.length)];
    }
    return s;
  }

  function cityShot(t) {
    return {
      t,
      light: 'neon',
      rain: 1,
      person: { z: 11.5 - 2.6 * M.inv(t, 6.0, 12), phase: t * 3.4, detail: 1 },
      cam: { zoom: 1 + 0.2 * E.inOutSine(M.inv(t, 6.6, 12)), fx: 800, fy: 452 + 10 * M.inv(t, 6.6, 12) },
    };
  }

  M.scene({
    id: 's1',
    title: 'The power of a prompt',
    start: 0,
    end: 12.0,
    fadeIn: 0,
    vo: [1.0, 4.45, 7.25],
    draw(ctx, t) {
      const cx = M.W / 2, cy = M.H / 2;
      // workspace panel (born from a point of light)
      const ex = E.inOutExpo(M.inv(t, T.expandX, T.expandX + 0.45));
      const ey = E.inOutExpo(M.inv(t, T.expandY, T.expandY + 0.6));
      const wsFade = 1 - E.inOutSine(M.inv(t, T.grow, T.grow + 0.6));
      if (t >= T.expandX && wsFade > 0) {
        const w = M.lerp(10, WS.w, ex), h = M.lerp(4, WS.h, ey);
        ctx.save();
        ctx.globalAlpha = wsFade;
        M.card(ctx, cx - w / 2, cy - h / 2, w, h, { r: Math.min(22, h / 2), accent: C.cyan, accentA: 1 - ey * 0.85, glow: 30 });
        if (ey > 0.6) {
          const a = M.inv(ey, 0.6, 1);
          ctx.globalAlpha = wsFade * a;
          [C.red, C.amber, '#3DDC84'].forEach((col, i) => {
            ctx.fillStyle = M.rgba(col, 0.55);
            ctx.beginPath();
            ctx.arc(WS.x + 30 + i * 22, WS.y + 30, 6, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(WS.x + 1, WS.y + 58, WS.w - 2, 1);
          ctx.fillStyle = 'rgba(255,255,255,0.035)';
          for (let y = WS.y + 100; y < WS.y + WS.h - 20; y += 40)
            for (let x = WS.x + 40; x < WS.x + WS.w - 20; x += 40) ctx.fillRect(x, y, 2, 2);
        }
        ctx.restore();
      }
      // the seed of light
      const pa = E.outCubic(M.inv(t, T.point, T.point + 0.5)) * (1 - E.inOutSine(M.inv(t, T.expandX + 0.2, T.expandY + 0.4)));
      if (pa > 0) {
        const pulse = 1 + 0.15 * Math.sin(t * 6);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        M.glow(ctx, cx, cy, 90 * pulse, C.cyan, 0.55 * pa);
        ctx.restore();
        ctx.fillStyle = M.rgba('#E9FDFF', pa);
        ctx.beginPath();
        ctx.arc(cx, cy, 5 * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      // idea icon
      const ba = E.outCubic(M.inv(t, T.bulb, T.bulb + 0.6)) * (1 - E.inOutCubic(M.inv(t, T.morph, T.morph + 0.6)));
      if (ba > 0) {
        const by = 430 - 40 * E.inOutCubic(M.inv(t, T.morph, T.morph + 0.6));
        const lit = E.outCubic(M.inv(t, T.bulb + 0.5, T.bulb + 1.0));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        M.glow(ctx, cx, by - 6, 120, C.cyan, 0.3 * lit * ba);
        ctx.restore();
        M.icon(ctx, 'bulb', cx, by, 96 * (0.85 + 0.15 * ba), { color: M.mix('#A9B1BF', C.cyan, lit), lw: 1.6, glow: 14 * lit, alpha: ba });
      }
      // IDEA → PROMPT
      const wordFade = 1 - E.inOutSine(M.inv(t, T.grow, T.grow + 0.35));
      if (t >= T.cursor && wordFade > 0) {
        const s = wordAt(t);
        const wy = M.lerp(612, cy + 4, E.inOutCubic(M.inv(t, T.morph + 0.2, T.morph + 0.9)));
        const size = M.lerp(120, 96, E.inOutCubic(M.inv(t, T.morph + 0.2, T.morph + 0.9)));
        const opt = { size, weight: 700, fam: M.F.display, ls: 6, base: 'middle' };
        const finalW = M.measure(ctx, t < T.morph ? 'IDEA' : 'PROMPT', opt);
        const curW = M.measure(ctx, s, opt);
        const x0 = t < T.morph ? cx - finalW / 2 : cx - curW / 2;
        const isPrompt = t >= T.morph;
        // prompt field forming around the word
        const fk = E.inOutCubic(M.inv(t, T.field, T.field + 0.6));
        if (fk > 0) {
          const fw = M.lerp(curW + 40, FIELD.w, fk), fh = M.lerp(110, FIELD.h, fk);
          ctx.save();
          ctx.globalAlpha = fk * wordFade;
          M.card(ctx, cx - fw / 2, cy - fh / 2, fw, fh, { r: 26, accent: C.cyan, accentA: 0.65, glow: 26, shadow: false });
          M.label(ctx, 'PROMPT', cx - fw / 2 + 4, cy - fh / 2 - 22, { size: 16, color: C.cyan, alpha: fk });
          ctx.restore();
          const bk = E.outBack(M.inv(t, T.button, T.button + 0.5));
          if (bk > 0) {
            const bx = cx + FIELD.w / 2 - 70, press = M.inv(t, T.click, T.click + 0.3);
            const sc = (1 - 0.12 * Math.sin(Math.PI * press)) * bk;
            ctx.save();
            ctx.globalAlpha = wordFade;
            ctx.translate(bx, cy);
            ctx.scale(sc, sc);
            const g = ctx.createLinearGradient(-36, 0, 36, 0);
            g.addColorStop(0, '#1FC8DC');
            g.addColorStop(1, '#7D63F2');
            ctx.fillStyle = g;
            ctx.shadowColor = C.cyan;
            ctx.shadowBlur = 20 + 40 * Math.sin(Math.PI * press);
            ctx.beginPath();
            ctx.arc(0, 0, 36, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            M.icon(ctx, 'spark', bx, cy, 34 * bk, { color: '#04161A', lw: 2.2, alpha: wordFade });
          }
        }
        const shift = fk * -46;
        M.text(ctx, s, x0 + shift, wy, { ...opt, color: isPrompt ? '#FFFFFF' : C.ink, glow: isPrompt ? 22 : 0, glowColor: C.cyan, alpha: wordFade });
        // caret
        if (t < T.morph + 0.2) {
          const blink = t > T.type && t < T.type + 0.6 ? 1 : Math.floor(t * 2.2) % 2 === 0 ? 1 : 0;
          if (blink) {
            ctx.fillStyle = C.cyan;
            ctx.shadowColor = C.cyan;
            ctx.fillRect(x0 + curW + 10, wy - size * 0.42, 5, size * 0.84);
          }
        }
      }
      // the prompt grows into a generated, cinematic shot
      if (t >= T.grow) {
        const k = E.inOutCubic(M.inv(t, T.grow + 0.05, T.grown));
        const w = M.lerp(FIELD.w, M.W, k), h = M.lerp(FIELD.h, M.H, k);
        const x = cx - w / 2, y = cy - h / 2;
        const p = M.inv(t, T.grow + 0.2, T.grown + 0.3);
        M.genReveal(ctx, 's1', x, y, w, h, (c, vw, vh) => M.drawCity(c, vw, vh, cityShot(t)), p, t, {
          r: M.lerp(26, 0, k), empty: false, border: `rgba(255,255,255,${0.14 * (1 - k)})`,
        });
      }
      // title + chain over the shot
      if (t >= T.title - 0.4) {
        const sa = E.inOutSine(M.inv(t, T.title - 0.4, T.title + 0.6));
        const g = ctx.createLinearGradient(0, 560, 0, M.H);
        g.addColorStop(0, 'rgba(5,6,10,0)');
        g.addColorStop(1, `rgba(5,6,10,${0.85 * sa})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 560, M.W, M.H - 560);
        const tt = t - T.title;
        M.kinetic(ctx, '03', 140, 880, tt, { size: 84, weight: 700, fam: M.F.display, color: C.cyan, glow: 18 });
        const w03 = M.measure(ctx, '03 ', { size: 84, weight: 700, fam: M.F.display });
        M.kinetic(ctx, '— ПРОМПТ ЖАЗУДЫ ҮЙРЕНУ', 140 + w03, 880, tt - 0.12, { size: 84, weight: 700, fam: M.F.display, ls: 1 });
        const words = ['IDEA', 'PROMPT', 'RESULT'];
        let x = 144;
        words.forEach((wd, i) => {
          const ti = T.chain + i * 0.5;
          const a = E.outCubic(M.inv(t, ti, ti + 0.4));
          const on = i === 2 ? M.inv(t, ti, ti + 0.3) : M.inv(t, ti, ti + 0.3) * (1 - M.inv(t, ti + 0.5, ti + 0.8) * 0.6);
          const ww = M.measure(ctx, wd, { size: 30, weight: 600, ls: 6 });
          M.text(ctx, wd, x, 962 + (1 - a) * 12, { size: 30, weight: 600, ls: 6, color: M.mix('#C9D0DB', C.cyan, on), alpha: a, glow: on * 14, glowColor: C.cyan });
          x += ww + 26;
          if (i < 2) {
            const ak = E.inOutCubic(M.inv(t, ti + 0.25, ti + 0.55));
            M.arrow(ctx, x, 951, x + 56, 951, ak, { color: C.ink2, lw: 2.2, hs: 9 });
            x += 82;
          }
        });
      }
    },
    cues(sc) {
      return [
        { t: T.point, id: 'pop', gain: 0.35 },
        { t: T.expandX, id: 'whoosh', gain: 0.55 },
        { t: T.bulb, id: 'pop', gain: 0.45 },
        ...M.typeCues(T.type, 8.3, 4, 0.7),
        ...M.typeCues(T.morph, 30, 10, 0.28).map((c) => ({ ...c, id: 'tick' })),
        { t: T.field, id: 'whoosh', gain: 0.3 },
        { t: T.button, id: 'pop', gain: 0.4 },
        { t: T.click, id: 'click', gain: 0.8 },
        { t: T.grow, id: 'gen', gain: 0.55 },
        { t: T.grow + 0.4, id: 'rain', gain: 0.22, dur: sc.dur - T.grow + 0.4 },
        { t: T.title, id: 'whoosh', gain: 0.3 },
        { t: T.chain, id: 'tick', gain: 0.5 },
        { t: T.chain + 0.5, id: 'tick', gain: 0.5 },
        { t: T.chain + 1.0, id: 'tick', gain: 0.6 },
      ];
    },
  });
})();
