// SCENE 8 — UNDERSTAND THE LOGIC
// Every part returns and snaps into one prompt blueprint; the blueprint becomes the
// finished shot; the camera pulls back to the closing title.
(function () {
  const M = window.M, C = M.C, E = M.E;
  const CARDS = [
    { ka: 'КЕЙІПКЕР', en: 'SUBJECT', icon: 'user' },
    { ka: 'ОРТА', en: 'ENVIRONMENT', icon: 'place' },
    { ka: 'ӘРЕКЕТ', en: 'ACTION', icon: 'action' },
    { ka: 'КАМЕРА', en: 'CAMERA', icon: 'camera' },
    { ka: 'ЖАРЫҚ ЖӘНЕ СТИЛЬ', en: 'LIGHTING & STYLE', icon: 'light' },
    { ka: 'NEGATIVE PROMPT', en: '', icon: 'block', neg: true },
  ];
  const BP = { x: 300, y: 300, w: 1320, h: 640 };
  const CW = 360, CH = 74;
  const slot = (i) => (i < 5 ? { x: 700, y: 352 + i * 92 } : { x: 1100, y: 760 });
  const IDEA = { x: 470, y: 618 };
  const PROMPT = { x: 1280, y: 618 };
  const RESULT = { x: 1400, y: 560, w: 200, h: 112.5 };
  const FRAME = { x: 360, y: 120, w: 1200, h: 675 };
  // where each card drifts in from (x, y, rotation)
  const FROM = [[-260, 160, -0.2], [2000, 220, 0.18], [-200, 820, 0.14], [2050, 900, -0.16], [700, -160, 0.1], [1500, 1200, -0.12]];
  const FLOAT = [[520, 380], [1180, 300], [600, 760], [1260, 820], [880, 270], [1000, 700]];

  function miniCard(ctx, c, x, y, a, glow) {
    if (a <= 0) return;
    const col = c.neg ? C.red : C.cyan;
    ctx.save();
    ctx.globalAlpha *= a;
    M.card(ctx, x, y, CW, CH, { r: 16, accent: col, accentA: glow, glow: 20 });
    ctx.strokeStyle = M.rgba(col, 0.7);
    ctx.fillStyle = M.rgba(col, 0.1);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + 40, y + CH / 2, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    M.icon(ctx, c.icon, x + 40, y + CH / 2, 24, { color: c.neg ? '#FF9AA6' : C.cyan, lw: 1.8 });
    M.text(ctx, c.ka, x + 76, y + CH / 2 - (c.en ? 8 : 0), { size: 21, weight: 700, fam: M.F.display, ls: 1.2, base: 'middle', color: C.ink });
    if (c.en) M.text(ctx, c.en, x + 76, y + CH / 2 + 17, { size: 12, weight: 600, ls: 2.4, base: 'middle', color: C.ink3 });
    ctx.restore();
  }

  function hero(t, zoom) {
    return {
      t, light: 'neon', rain: 1, dof: 0.25,
      person: { z: 6.6, phase: t * 2.4 },
      cam: { zoom, fx: 800, fy: M.lerp(432, 448, M.inv(zoom, 2.1, 1.2)) },
    };
  }

  M.scene({
    id: 's8',
    title: 'Understand the logic',
    start: 102.0,
    end: 120.0,
    fadeOut: 1.0,
    vo: [0.7, 5.8, 13.6],
    draw(ctx, t, sc) {
      const l0 = sc.lines[0];
      const ps = l0.pauses || [];
      const tNo = l0.t + (ps[0] ? ps[0][1] : 1.0);
      const tYes = l0.t + (ps[1] ? ps[1][1] : 3.0);
      const tSnap = 1.7, tLines = 2.6, tMorph = 5.9, tPull = 7.6, tChain = 9.4, tEnd = 12.4, tFinal = 13.0;
      const bpOut = 1 - E.inOutSine(M.inv(t, tMorph - 0.2, tMorph + 0.5));
      // ---- headline
      const hA = 1 - E.inOutSine(M.inv(t, tMorph - 0.3, tMorph + 0.3));
      if (hA > 0) {
        ctx.save();
        ctx.globalAlpha = hA;
        M.headline(ctx, 'ПРОМПТТЫ ЖАТТАМА', M.W / 2, 150, t - tNo + 0.2, { size: 66, align: 'center' });
        M.headline(ctx, 'ОНЫҢ ЛОГИКАСЫН ТҮСІН!', M.W / 2, 236, t - tYes + 0.1, { size: 66, align: 'center', color: C.cyan, glow: 22 });
        ctx.restore();
      }
      // ---- blueprint
      if (bpOut > 0) {
        const ga = E.inOutSine(M.inv(t, tSnap - 0.2, tSnap + 0.6)) * bpOut;
        if (ga > 0) {
          ctx.save();
          ctx.globalAlpha = ga;
          M.rr(ctx, BP.x, BP.y, BP.w, BP.h, 24);
          ctx.fillStyle = 'rgba(8,28,36,0.55)';
          ctx.fill();
          ctx.strokeStyle = M.rgba(C.cyan, 0.35);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.clip();
          ctx.strokeStyle = 'rgba(47,224,242,0.07)';
          ctx.lineWidth = 1;
          for (let x = BP.x; x < BP.x + BP.w; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, BP.y);
            ctx.lineTo(x, BP.y + BP.h);
            ctx.stroke();
          }
          for (let y = BP.y; y < BP.y + BP.h; y += 32) {
            ctx.beginPath();
            ctx.moveTo(BP.x, y);
            ctx.lineTo(BP.x + BP.w, y);
            ctx.stroke();
          }
          ctx.restore();
          M.label(ctx, 'PROMPT BLUEPRINT', BP.x + 28, BP.y + 40, { size: 14, color: M.rgba(C.cyan, 0.8), alpha: ga });
        }
        // connectors
        const lk = E.inOutCubic(M.inv(t, tLines, tLines + 0.9));
        if (lk > 0) {
          ctx.save();
          ctx.globalAlpha = bpOut;
          for (let i = 0; i < 5; i++) {
            const s = slot(i);
            const ya = s.y + CH / 2;
            ctx.strokeStyle = M.rgba(C.cyan, 0.45);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            const k1 = M.clamp(lk * 2);
            ctx.moveTo(IDEA.x + 40, IDEA.y);
            ctx.bezierCurveTo(IDEA.x + 120, IDEA.y, s.x - 90, ya, M.lerp(IDEA.x + 40, s.x, k1), M.lerp(IDEA.y, ya, k1));
            ctx.stroke();
            const k2 = M.clamp(lk * 2 - 1);
            if (k2 > 0) {
              ctx.beginPath();
              ctx.moveTo(s.x + CW, ya);
              ctx.bezierCurveTo(s.x + CW + 90, ya, PROMPT.x - 140, PROMPT.y, M.lerp(s.x + CW, PROMPT.x - 70, k2), M.lerp(ya, PROMPT.y, k2));
              ctx.stroke();
            }
          }
          const k3 = M.inv(lk, 0.6, 1);
          M.arrow(ctx, PROMPT.x + 70, PROMPT.y, RESULT.x - 8, PROMPT.y, k3, { color: C.cyan, lw: 2 });
          const n = slot(5);
          ctx.strokeStyle = M.rgba(C.red, 0.5);
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(n.x + CW / 2, n.y);
          ctx.lineTo(n.x + CW / 2, M.lerp(n.y, PROMPT.y + 26, k3));
          ctx.stroke();
          ctx.restore();
        }
        // nodes
        const na = E.outBack(M.inv(t, tLines - 0.3, tLines + 0.2));
        if (na > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, na) * bpOut;
          ctx.fillStyle = M.rgba(C.cyan, 0.1);
          ctx.strokeStyle = C.cyan;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(IDEA.x, IDEA.y, 40, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          M.rr(ctx, PROMPT.x - 70, PROMPT.y - 26, 140, 52, 26);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          M.icon(ctx, 'bulb', IDEA.x, IDEA.y, 36, { color: C.cyan, alpha: Math.min(1, na) * bpOut, glow: 10 });
          M.label(ctx, 'IDEA', IDEA.x, IDEA.y + 70, { align: 'center', size: 15, color: C.ink2, alpha: Math.min(1, na) * bpOut });
          M.text(ctx, 'PROMPT', PROMPT.x, PROMPT.y + 1, { size: 17, weight: 700, ls: 3, align: 'center', base: 'middle', color: C.ink, alpha: Math.min(1, na) * bpOut });
        }
      }
      // ---- floating cards → blueprint slots
      CARDS.forEach((c, i) => {
        const inK = E.outCubic(M.inv(t, 0.1 + i * 0.1, 1.3 + i * 0.1));
        const snapK = E.inOutCubic(M.inv(t, tSnap + i * 0.09, tSnap + 0.8 + i * 0.09));
        const [fx, fy, fr] = FROM[i], [lx, ly] = FLOAT[i];
        const s = slot(i);
        const bob = Math.sin(t * 1.6 + i * 1.3) * 8 * (1 - snapK);
        const x = M.lerp(M.lerp(fx, lx, inK), s.x, snapK) - CW / 2 * (1 - snapK);
        const y = M.lerp(M.lerp(fy, ly, inK), s.y, snapK) + bob;
        const rot = fr * (1 - inK) * (1 - snapK) + 0.05 * Math.sin(i * 2.1) * (1 - snapK);
        const glow = M.inv(t, tSnap + 0.7 + i * 0.09, tSnap + 0.9 + i * 0.09) * (1 - M.inv(t, tSnap + 1.2 + i * 0.09, tSnap + 2.2));
        ctx.save();
        ctx.translate(x + CW / 2, y + CH / 2);
        ctx.rotate(rot);
        const sc0 = 0.88 + 0.12 * Math.max(inK * 0.6, snapK);
        ctx.scale(sc0, sc0);
        miniCard(ctx, c, -CW / 2, -CH / 2, inK * bpOut, glow);
        ctx.restore();
      });
      // ---- blueprint result frame → finished cinematic image → pull back
      const rA = E.outCubic(M.inv(t, tLines + 0.4, tLines + 0.9));
      if (rA > 0 && t < tFinal + 0.5) {
        const grow = E.inOutCubic(M.inv(t, tMorph, tMorph + 1.4));
        const pull = E.inOutCubic(M.inv(t, tPull, tEnd - 0.6));
        const full = { x: 0, y: 0, w: M.W, h: M.H };
        const r0 = {
          x: M.lerp(RESULT.x, full.x, grow), y: M.lerp(RESULT.y, full.y, grow),
          w: M.lerp(RESULT.w, full.w, grow), h: M.lerp(RESULT.h, full.h, grow),
        };
        const r = { x: M.lerp(r0.x, FRAME.x, pull), y: M.lerp(r0.y, FRAME.y, pull), w: M.lerp(r0.w, FRAME.w, pull), h: M.lerp(r0.h, FRAME.h, pull) };
        const out = 1 - E.inOutSine(M.inv(t, tEnd, tFinal));
        const zoom = M.lerp(2.1, 1.25, E.inOutSine(M.inv(t, tMorph, tEnd)));
        const p = M.inv(t, tMorph + 0.1, tMorph + 1.3);
        ctx.save();
        ctx.globalAlpha = rA * out;
        if (p <= 0) {
          M.brackets(ctx, r.x, r.y, r.w, r.h, 18, 1, C.cyan, 2);
          M.icon(ctx, 'film', r.x + r.w / 2, r.y + r.h / 2, 34, { color: M.rgba(C.cyan, 0.7) });
        } else {
          M.genReveal(ctx, 's8', r.x, r.y, r.w, r.h, (c, w, h) => M.drawCity(c, w, h, hero(t, zoom)), p, t, {
            r: M.lerp(M.lerp(10, 0, grow), 20, pull), empty: false, accent: C.cyan, accentA: pull * 0.35,
          });
        }
        ctx.restore();
        // chain under the frame
        const words = ['IDEA', 'STRUCTURE', 'PROMPT', 'RESULT'];
        const size = 34, gap = 92;
        const widths = words.map((w) => M.measure(ctx, w, { size, weight: 700, ls: 6 }));
        const total = widths.reduce((a, b) => a + b, 0) + gap * 3;
        let x = M.W / 2 - total / 2;
        words.forEach((w, i) => {
          const ti = tChain + i * 0.45;
          const a = E.outCubic(M.inv(t, ti, ti + 0.4)) * out;
          const on = i === 3 ? M.inv(t, ti, ti + 0.3) : M.inv(t, ti, ti + 0.25) * (1 - 0.7 * M.inv(t, ti + 0.45, ti + 0.8));
          M.text(ctx, w, x, 912 + (1 - a) * 14, { size, weight: 700, ls: 6, color: M.mix('#C9D0DB', C.cyan, on), alpha: a, glow: on * 16, glowColor: C.cyan });
          x += widths[i];
          if (i < 3) M.arrow(ctx, x + 18, 900, x + gap - 18, 900, E.inOutCubic(M.inv(t, ti + 0.25, ti + 0.55)), { color: C.ink2, lw: 2.4, hs: 10, alpha: out });
          x += gap;
        });
      }
      // ---- final title card
      const fA = E.inOutSine(M.inv(t, tFinal, tFinal + 0.9));
      if (fA > 0) {
        const cy = M.H / 2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        M.glow(ctx, M.W / 2, cy - 20, 620, C.cyan, 0.12 * fA);
        ctx.restore();
        M.kinetic(ctx, 'PROMPT WRITING', M.W / 2, cy - 4, t - tFinal, {
          size: 128, weight: 700, fam: M.F.display, ls: 10, align: 'center', glow: 30, glowColor: M.rgba(C.cyan, 0.75), stagger: 0.035, dur: 0.9, rise: 24,
        });
        const lw = 420 * E.inOutCubic(M.inv(t, tFinal + 0.5, tFinal + 1.3));
        ctx.save();
        ctx.fillStyle = C.cyan;
        ctx.shadowColor = C.cyan;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = fA;
        ctx.fillRect(M.W / 2 - lw / 2, cy + 46, lw, 2);
        ctx.restore();
        M.kinetic(ctx, 'ОЙЫҢДЫ AI-ҒА ДҰРЫС ЖЕТКІЗ', M.W / 2, cy + 112, t - tFinal - 0.7, {
          size: 34, weight: 600, ls: 8, align: 'center', color: C.ink2, stagger: 0.02, dur: 0.6, rise: 14,
        });
      }
    },
    cues(sc) {
      const l0 = sc.lines[0];
      const ps = l0.pauses || [];
      const tNo = l0.t + (ps[0] ? ps[0][1] : 1.0);
      const tYes = l0.t + (ps[1] ? ps[1][1] : 3.0);
      const tSnap = 1.7, tLines = 2.6, tMorph = 5.9, tChain = 9.4, tEnd = 12.4, tFinal = 13.0;
      return [
        { t: 0.1, id: 'whoosh', gain: 0.45 },
        { t: tNo, id: 'pop', gain: 0.3 },
        { t: tYes, id: 'pop', gain: 0.35 },
        ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: tSnap + 0.75 + i * 0.09, id: 'tick', gain: 0.4 })),
        { t: tLines, id: 'slide', gain: 0.3 },
        { t: tMorph, id: 'gen', gain: 0.5 },
        { t: tMorph + 0.6, id: 'rain', gain: 0.18, dur: tEnd - tMorph },
        { t: tMorph + 1.0, id: 'whoosh', gain: 0.35 },
        ...[0, 1, 2, 3].map((i) => ({ t: tChain + i * 0.45, id: 'tick', gain: 0.5 })),
        { t: tEnd, id: 'whoosh', gain: 0.35 },
        { t: tFinal, id: 'swell', gain: 0.5 },
      ];
    },
  });
})();
