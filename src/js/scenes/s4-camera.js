// SCENE 4 — CAMERA, LIGHTING & ATMOSPHERE
// Same character, same street: only framing, camera movement and light change.
(function () {
  const M = window.M, C = M.C, E = M.E;
  const MAIN = { x: 360, y: 150, w: 1200, h: 675 };
  const THUMBS = [0, 1, 2].map((i) => ({ x: 120 + i * 580, y: 372, w: 520, h: 292.5 }));
  const STRIP = [0, 1, 2].map((i) => ({ x: 580 + i * 260, y: 862, w: 240, h: 135 }));
  const SHOTS = ['WIDE', 'MEDIUM', 'CLOSE-UP'];
  const lerpRect = (a, b, k) => ({ x: M.lerp(a.x, b.x, k), y: M.lerp(a.y, b.y, k), w: M.lerp(a.w, b.w, k), h: M.lerp(a.h, b.h, k) });

  function shot(c, w, h, i, t, extra = {}) {
    if (i === 2) return M.drawCloseup(c, w, h, { t, push: extra.push || 0 });
    const cam = i === 0 ? { zoom: 1.05, fx: 800, fy: 450 } : { zoom: 6.2, fx: 800, fy: 412 };
    M.drawCity(c, w, h, { t, light: 'neon', rain: 1, dof: i === 1 ? 0.9 : 0, person: { z: 8, phase: t * 2.6 }, cam });
  }

  // top-down camera diagram
  function diagram(ctx, x, y, w, h, t, tDolly, tTrack) {
    M.card(ctx, x, y, w, h, { r: 20, shadow: false, fill: '#10141B', fill2: '#0E1117' });
    ctx.save();
    M.rr(ctx, x, y, w, h, 20);
    ctx.clip();
    ctx.strokeStyle = 'rgba(47,224,242,0.07)';
    ctx.lineWidth = 1;
    for (let gx = x + 20; gx < x + w; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    for (let gy = y + 20; gy < y + h; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
    ctx.restore();
    M.label(ctx, 'TOP VIEW', x + 28, y + 40, { size: 14, color: C.ink3 });
    const sx = x + w - 170, sy = y + h / 2;
    const dk = E.inOutCubic(M.inv(t, tDolly + 0.1, tDolly + 1.3));
    const tk = E.inOutSine(M.inv(t, tTrack + 0.1, tTrack + 1.6));
    const camX = M.lerp(x + 150, x + 420, dk) + 0 * tk;
    const camY = sy + M.lerp(0, -150, tk) * (tk > 0 ? 1 : 0);
    // subject
    ctx.save();
    ctx.fillStyle = M.rgba(C.cyan, 0.12);
    ctx.strokeStyle = M.rgba(C.cyan, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    M.icon(ctx, 'user', sx, sy, 42, { color: C.cyan, lw: 1.8 });
    // dolly track
    const trackA = E.outCubic(M.inv(t, tDolly - 0.2, tDolly + 0.2));
    ctx.save();
    ctx.globalAlpha = trackA;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x + 110, sy);
    ctx.lineTo(x + 470, sy);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    for (let tx = x + 120; tx < x + 470; tx += 24) {
      ctx.beginPath();
      ctx.moveTo(tx, sy - 9);
      ctx.lineTo(tx, sy + 9);
      ctx.stroke();
    }
    ctx.restore();
    M.arrow(ctx, x + 150, sy - 50, x + 440, sy - 50, dk, { color: C.cyan, lw: 3, hs: 12 });
    M.chip(ctx, 'DOLLY IN', x + 295, sy - 88, { align: 'center', alpha: trackA, color: C.cyan, border: M.rgba(C.cyan, 0.5), bg: M.rgba(C.cyan, 0.1), size: 15 });
    // alternative: tracking alongside
    const ta = E.outCubic(M.inv(t, tTrack - 0.1, tTrack + 0.3));
    if (ta > 0) {
      M.arrow(ctx, x + 470, sy + 100, x + 470, sy - 170, M.inv(t, tTrack, tTrack + 1.2), { color: C.violet, lw: 3, hs: 12, dash: [10, 8], alpha: ta });
      M.chip(ctx, 'TRACKING', x + 500, sy + 100, { alpha: ta, color: C.violet, border: M.rgba(C.violet, 0.5), bg: M.rgba(C.violet, 0.1), size: 15 });
    }
    // camera with field of view
    const camXX = tk > 0 ? x + 470 : camX;
    const ang = Math.atan2(sy - camY, sx - camXX);
    ctx.save();
    ctx.translate(camXX, camY);
    ctx.rotate(ang);
    const fov = ctx.createLinearGradient(0, 0, 300, 0);
    fov.addColorStop(0, 'rgba(47,224,242,0.28)');
    fov.addColorStop(1, 'rgba(47,224,242,0)');
    ctx.fillStyle = fov;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(320, -120);
    ctx.lineTo(320, 120);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#E8F9FB';
    M.rr(ctx, -34, -22, 50, 44, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -12);
    ctx.lineTo(34, -22);
    ctx.lineTo(34, 22);
    ctx.lineTo(14, 12);
    ctx.fill();
    ctx.restore();
    return { dk, tk };
  }

  M.scene({
    id: 's4',
    title: 'Camera, lighting & atmosphere',
    start: 40.0,
    end: 55.2,
    vo: [0.6, 3.3, 7.2, 10.5],
    draw(ctx, t, sc) {
      const tWide = sc.lines[1].m[0], tClose = sc.lines[1].m[1];
      const tDolly = sc.lines[2].m[0], tTrack = sc.lines[2].m[1];
      const tLight = sc.lines[3].t;
      const phaseB = tWide - 0.3, phaseC = tDolly - 0.35, phaseD = tLight - 0.3;
      // ---------------- A + B: camera angle
      if (t < phaseC + 0.6) {
        const out = 1 - E.inOutSine(M.inv(t, phaseC - 0.1, phaseC + 0.4));
        M.kicker(ctx, 'CAMERA ANGLE', 120, 96, t - 0.1, { alpha: out });
        const bk = E.inOutCubic(M.inv(t, phaseB, phaseB + 0.7));
        const active = t < tClose - 0.2 ? 0 : t < tClose + 0.75 ? 1 : 2;
        // main stage
        if (bk > 0) {
          ctx.save();
          ctx.globalAlpha = out;
          const seq = [
            [0, phaseB, tClose - 0.2],
            [1, tClose - 0.2, tClose + 0.75],
            [2, tClose + 0.75, 99],
          ];
          M.viewport(ctx, MAIN.x, MAIN.y, MAIN.w, MAIN.h, (c, w, h) => {
            seq.forEach(([i, a, b]) => {
              const k = E.inOutCubic(M.inv(t, a, a + 0.3)) * (1 - (i < 2 ? E.inOutCubic(M.inv(t, b, b + 0.3)) : 0));
              if (k <= 0) return;
              const L = M.layer('s4main' + i, w, h);
              shot(L.getContext('2d'), w, h, i, t, { push: M.inv(t, tClose + 0.75, phaseC) });
              c.save();
              c.globalAlpha = k;
              const s = 1.04 - 0.04 * k;
              c.translate(w / 2, h / 2);
              c.scale(s, s);
              c.drawImage(L, -w / 2, -h / 2);
              c.restore();
            });
          }, { alpha: bk, accent: C.cyan, accentA: 0.25 });
          M.chip(ctx, SHOTS[active], MAIN.x + 24, MAIN.y + 40, { alpha: bk, color: C.cyan, border: M.rgba(C.cyan, 0.5), bg: 'rgba(5,10,14,0.7)', size: 16, icon: 'camera' });
          ctx.restore();
        }
        // thumbnails → filmstrip
        THUMBS.forEach((r0, i) => {
          const a = E.outCubic(M.inv(t, 0.3 + i * 0.25, 0.8 + i * 0.25)) * out;
          if (a <= 0) return;
          const r = lerpRect(r0, STRIP[i], bk);
          const yOff = (1 - E.outCubic(M.inv(t, 0.3 + i * 0.25, 0.9 + i * 0.25))) * 40;
          const on = bk > 0.5 ? (active === i ? 1 : 0) : 0;
          M.viewport(ctx, r.x, r.y + yOff, r.w, r.h, (c, w, h) => shot(c, w, h, i, t), {
            alpha: a * (bk > 0.5 ? 0.55 + 0.45 * on : 1), r: M.lerp(16, 10, bk), accent: C.cyan, accentA: on,
          });
          M.text(ctx, SHOTS[i], r.x + r.w / 2, r.y + yOff + r.h + M.lerp(40, 28, bk), {
            size: M.lerp(20, 14, bk), weight: 600, ls: 3, align: 'center', color: on ? C.cyan : C.ink2, alpha: a,
          });
        });
      }
      // ---------------- C: camera movement
      if (t >= phaseC - 0.2 && t < phaseD + 0.6) {
        const a = E.inOutSine(M.inv(t, phaseC, phaseC + 0.5)) * (1 - E.inOutSine(M.inv(t, phaseD - 0.1, phaseD + 0.4)));
        ctx.save();
        ctx.globalAlpha = a;
        M.kicker(ctx, 'CAMERA MOVEMENT', 120, 96, t - phaseC);
        const { dk, tk } = diagram(ctx, 120, 190, 800, 600, t, tDolly, tTrack);
        const zoom = M.lerp(1.4, 3.4, dk);
        M.viewport(ctx, 980, 260, 820, 461, (c, w, h) =>
          M.drawCity(c, w, h, {
            t, light: 'neon', rain: 1, dof: 0.35 * dk,
            person: { z: 8, phase: t * 2.6, x: 0 },
            cam: { zoom, fx: 800 + 70 * Math.sin(tk * Math.PI * 0.5), fy: M.lerp(450, 425, dk) },
          }), { accent: C.cyan, accentA: 0.25 });
        M.chip(ctx, tk > 0.05 ? 'TRACKING' : 'DOLLY IN', 1004, 300, {
          color: tk > 0.05 ? C.violet : C.cyan, border: 'rgba(255,255,255,0.2)', bg: 'rgba(5,10,14,0.7)', size: 15, icon: 'camera',
        });
        ctx.restore();
      }
      // ---------------- D: lighting, style, atmosphere
      if (t >= phaseD) {
        const a = E.inOutSine(M.inv(t, phaseD, phaseD + 0.5));
        ctx.save();
        ctx.globalAlpha = a;
        const words = [['LIGHTING', tLight], ['STYLE', tLight + 0.75], ['ATMOSPHERE', tLight + 1.3]];
        let x = 120;
        words.forEach(([wd, tw], i) => {
          if (i === 0) {
            M.kicker(ctx, wd, x, 96, t - tw + 0.1);
            x += 60 + M.measure(ctx, wd, { size: 24, weight: 600, ls: 5 }) + 36;
          } else {
            const k = E.outCubic(M.inv(t, tw, tw + 0.4));
            M.text(ctx, '·', x - 20, 97, { size: 24, color: C.ink3, alpha: k, base: 'middle' });
            M.kinetic(ctx, wd, x, 96, t - tw, { size: 24, weight: 600, ls: 5, color: C.ink, base: 'middle', rise: 12, dur: 0.45, stagger: 0.018 });
            x += M.measure(ctx, wd, { size: 24, weight: 600, ls: 5 }) + 40;
          }
        });
        const states = [
          ['morning', 'SOFT MORNING LIGHT', tLight - 0.2],
          ['side', 'DRAMATIC SIDE LIGHT', tLight + 1.45],
          ['neon', 'NEON · DARK ATMOSPHERE', tLight + 3.0],
        ];
        const person = { z: 7.2, phase: t * 2.4 };
        const cam = { zoom: 1.75, fx: 800, fy: 438 };
        M.viewport(ctx, MAIN.x, MAIN.y, MAIN.w, MAIN.h, (c, w, h) => {
          states.forEach(([light, , ts], i) => {
            const wk = i === 0 ? 1 : E.inOutCubic(M.inv(t, ts, ts + 0.7));
            if (wk <= 0) return;
            const next = states[i + 1];
            if (next && t > next[2] + 0.7) return;
            const L = M.layer('s4light' + i, w, h);
            M.drawCity(L.getContext('2d'), w, h, { t, light, rain: light === 'neon' ? 1 : 0, person, cam, dof: 0.25 });
            c.save();
            c.beginPath();
            c.rect(0, 0, w * wk, h);
            c.clip();
            c.drawImage(L, 0, 0);
            c.restore();
            if (wk > 0 && wk < 1) {
              c.save();
              c.fillStyle = 'rgba(220,250,255,0.9)';
              c.shadowColor = C.cyan;
              c.shadowBlur = 20;
              c.fillRect(w * wk - 1.5, 0, 3, h);
              c.restore();
            }
          });
        }, { accent: C.cyan, accentA: 0.2 });
        let idx = 0;
        states.forEach(([, , ts], i) => {
          if (t >= ts + 0.35) idx = i;
        });
        states.forEach(([, name, ts], i) => {
          const k = E.outCubic(M.inv(t, ts + 0.2, ts + 0.6));
          const on = idx === i ? 1 : 0;
          const tabW = 360, tx = MAIN.x + i * (tabW + 60) + 20;
          ctx.save();
          ctx.globalAlpha = a * k;
          ctx.fillStyle = on ? C.cyan : 'rgba(255,255,255,0.15)';
          if (on) {
            ctx.shadowColor = C.cyan;
            ctx.shadowBlur = 12;
          }
          ctx.fillRect(tx, MAIN.y + MAIN.h + 34, tabW, 3);
          ctx.restore();
          M.text(ctx, name, tx, MAIN.y + MAIN.h + 72, { size: 17, weight: 600, ls: 2.6, color: on ? C.ink : C.ink3, alpha: a * k });
        });
        ctx.restore();
      }
    },
    cues(sc) {
      const tWide = sc.lines[1].m[0], tClose = sc.lines[1].m[1];
      const tDolly = sc.lines[2].m[0], tTrack = sc.lines[2].m[1];
      const tLight = sc.lines[3].t;
      return [
        { t: 0.3, id: 'pop', gain: 0.35 },
        { t: 0.55, id: 'pop', gain: 0.35 },
        { t: 0.8, id: 'pop', gain: 0.35 },
        { t: tWide - 0.3, id: 'whoosh', gain: 0.4 },
        { t: tClose - 0.2, id: 'shutter', gain: 0.45 },
        { t: tClose + 0.75, id: 'shutter', gain: 0.45 },
        { t: tDolly - 0.35, id: 'whoosh', gain: 0.4 },
        { t: tDolly + 0.1, id: 'slide', gain: 0.45 },
        { t: tTrack + 0.1, id: 'slide', gain: 0.4 },
        { t: tLight - 0.3, id: 'whoosh', gain: 0.4 },
        { t: tLight + 1.45, id: 'swipe', gain: 0.4 },
        { t: tLight + 3.0, id: 'swipe', gain: 0.4 },
        { t: tLight + 3.2, id: 'rain', gain: 0.2, dur: sc.dur - tLight - 3.2 },
        { t: 0.2, id: 'rain', gain: 0.12, dur: tLight - 0.6 },
      ];
    },
  });
})();
