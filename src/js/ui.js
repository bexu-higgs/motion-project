// Shared interface components: background, prompt fields, generate button,
// generation reveal, labels and connectors. One visual language for all scenes.
(function () {
  const M = window.M;
  const C = M.C;

  // ---------------------------------------------------------------- background
  let bgCache = null;
  M.drawBg = (ctx, a = 1) => {
    if (!bgCache) {
      bgCache = document.createElement('canvas');
      bgCache.width = M.W;
      bgCache.height = M.H;
      const c = bgCache.getContext('2d');
      c.fillStyle = C.bg;
      c.fillRect(0, 0, M.W, M.H);
      const g = c.createRadialGradient(M.W * 0.5, M.H * 0.42, 0, M.W * 0.5, M.H * 0.42, M.W * 0.62);
      g.addColorStop(0, '#171C27');
      g.addColorStop(1, 'rgba(11,13,17,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, M.W, M.H);
      c.fillStyle = 'rgba(255,255,255,0.045)';
      for (let y = 36; y < M.H; y += 48) for (let x = 36; x < M.W; x += 48) c.fillRect(x, y, 1.6, 1.6);
      const v = c.createRadialGradient(M.W / 2, M.H / 2, M.H * 0.45, M.W / 2, M.H / 2, M.W * 0.7);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.55)');
      c.fillStyle = v;
      c.fillRect(0, 0, M.W, M.H);
    }
    ctx.save();
    ctx.globalAlpha = a;
    ctx.drawImage(bgCache, 0, 0);
    ctx.restore();
  };

  // ---------------------------------------------------------------- section heading
  // Small cyan kicker with a growing rule, e.g. "CAMERA ANGLE".
  M.kicker = (ctx, str, x, y, t, opt = {}) => {
    if (t <= 0) return;
    const a = (opt.alpha ?? 1) * M.E.outCubic(M.inv(t, 0, 0.5));
    const lw = 44 * M.E.inOutCubic(M.inv(t, 0, 0.6));
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = opt.color || C.cyan;
    ctx.shadowColor = opt.color || C.cyan;
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y - 7, lw, 3);
    ctx.restore();
    M.kinetic(ctx, str, x + 60, y, t - 0.1, {
      size: opt.size || 24, weight: 600, ls: 5, color: opt.textColor || C.ink, alpha: (opt.alpha ?? 1), stagger: 0.018, dur: 0.45, rise: 12, base: 'middle',
    });
  };

  // Big display headline with letter rise.
  M.headline = (ctx, str, x, y, t, opt = {}) =>
    M.kinetic(ctx, str, x, y, t, { size: 76, weight: 700, fam: M.F.display, ls: -0.5, stagger: 0.022, dur: 0.6, rise: 30, ...opt });

  // ---------------------------------------------------------------- generate button
  // state: p (press 0..1), loading (0..1), alpha
  M.genButton = (ctx, x, y, opt = {}) => {
    const a = opt.alpha ?? 1;
    if (a <= 0) return;
    const w = opt.w || 176, h = opt.h || 52;
    const press = opt.press || 0;
    const sc = 1 - 0.06 * Math.sin(Math.PI * press);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(sc, sc);
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, '#1FC8DC');
    g.addColorStop(1, '#7D63F2');
    ctx.shadowColor = M.rgba(C.cyan, 0.45 + 0.4 * Math.sin(Math.PI * press));
    ctx.shadowBlur = 18 + 30 * Math.sin(Math.PI * press);
    M.rr(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (opt.loading > 0 && opt.loading < 1) {
      ctx.save();
      M.rr(ctx, -w / 2, -h / 2, w, h, h / 2);
      ctx.clip();
      const sx = -w / 2 - 60 + (w + 120) * ((opt.loading * 2) % 1);
      const sh = ctx.createLinearGradient(sx - 50, 0, sx + 50, 0);
      sh.addColorStop(0, 'rgba(255,255,255,0)');
      sh.addColorStop(0.5, 'rgba(255,255,255,0.45)');
      sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    M.icon(ctx, 'spark', -w / 2 + 34, 0, 22, { color: '#05141A', lw: 2.2 });
    M.text(ctx, 'Generate', -w / 2 + 54, 1, { size: 21, weight: 600, color: '#05141A', base: 'middle', ls: 0.2 });
    ctx.restore();
  };

  // ---------------------------------------------------------------- prompt field
  // A labelled prompt input. opt: title, titleColor, segs, reveal, segStyle, size,
  // cursor, t, alpha, accent, accentA, button {press, loading, alpha}, minH, icon
  M.promptField = (ctx, x, y, w, opt = {}) => {
    const a = opt.alpha ?? 1;
    const size = opt.size || 26;
    const pad = opt.pad || 30;
    const L = M.layoutPrompt(ctx, opt.segs || [{ text: '' }], w - pad * 2, size);
    const bodyH = Math.max(L.lines.length * L.lh, opt.minLines ? opt.minLines * L.lh : L.lh);
    const headH = opt.title ? 56 : 18;
    const btnH = opt.button ? 76 : 0;
    const h = Math.max(opt.minH || 0, headH + bodyH + pad * 0.8 + btnH);
    if (a <= 0) return { h, L };
    M.card(ctx, x, y, w, h, { alpha: a, accent: opt.accent, accentA: opt.accentA, r: 20 });
    ctx.save();
    ctx.globalAlpha *= a;
    if (opt.title) {
      M.icon(ctx, opt.icon || 'edit', x + pad + 9, y + 32, 20, { color: opt.titleColor || C.ink2, lw: 2 });
      M.text(ctx, opt.title, x + pad + 28, y + 33, { size: 17, weight: 600, ls: 2.4, color: opt.titleColor || C.ink2, base: 'middle' });
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 1, y + headH, w - 2, 1);
    }
    M.drawPrompt(ctx, L, x + pad, y + headH + pad * 0.4, {
      reveal: opt.reveal, segStyle: opt.segStyle, cursor: opt.cursor, cursorT: opt.t, color: opt.color, cursorSolid: opt.cursorSolid,
    });
    if (opt.button) M.genButton(ctx, x + w - pad - 176, y + h - 52 - 20, opt.button);
    ctx.restore();
    return { h, L, bodyX: x + pad, bodyY: y + headH + pad * 0.4 };
  };

  // ---------------------------------------------------------------- generation reveal
  // Paints `draw` into a viewport while "denoising": p 0 → nothing, 1 → final image.
  let noiseTile = null;
  M.genReveal = (ctx, key, x, y, w, h, draw, p, t, opt = {}) => {
    if (p <= 0) {
      if (opt.empty !== false) {
        M.viewport(ctx, x, y, w, h, (c) => {
          c.fillStyle = '#0E1118';
          c.fillRect(0, 0, w, h);
          c.strokeStyle = 'rgba(255,255,255,0.05)';
          c.lineWidth = 1;
          for (let gx = 0; gx < w; gx += 40) {
            c.beginPath();
            c.moveTo(gx, 0);
            c.lineTo(gx, h);
            c.stroke();
          }
          for (let gy = 0; gy < h; gy += 40) {
            c.beginPath();
            c.moveTo(0, gy);
            c.lineTo(w, gy);
            c.stroke();
          }
        }, { alpha: opt.alpha ?? 1, r: opt.r, accent: opt.accent, accentA: opt.accentA });
      }
      return;
    }
    const L = M.layer('gen-' + key, w, h);
    const c = L.getContext('2d');
    draw(c, w, h);
    if (!noiseTile) {
      noiseTile = document.createElement('canvas');
      noiseTile.width = noiseTile.height = 192;
      const nc = noiseTile.getContext('2d');
      const img = nc.createImageData(192, 192);
      const r = M.rng(3);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 40 + r() * 120;
        img.data[i] = v * 0.8;
        img.data[i + 1] = v * 0.95;
        img.data[i + 2] = v * 1.1;
        img.data[i + 3] = 255;
      }
      nc.putImageData(img, 0, 0);
    }
    const k = M.E.inOutCubic(M.clamp(p));
    M.viewport(ctx, x, y, w, h, (vc) => {
      vc.fillStyle = '#0E1118';
      vc.fillRect(0, 0, w, h);
      vc.save();
      vc.globalAlpha *= M.clamp(k * 1.6);
      M.blurBlit(vc, L, 0, 0, w, h, (1 - k) * 26 * (w / 1200), 'gen');
      vc.restore();
      if (k < 1) {
        vc.save();
        vc.globalAlpha *= Math.pow(1 - k, 1.4) * 0.9;
        vc.globalCompositeOperation = 'screen';
        vc.translate(-((t * 300) % 192), 0);
        vc.fillStyle = vc.createPattern(noiseTile, 'repeat');
        vc.fillRect(0, 0, w + 192, h);
        vc.restore();
        // scan line
        const sy = h * M.E.outCubic(M.clamp(p * 1.15));
        const sg = vc.createLinearGradient(0, sy - 60, 0, sy + 4);
        sg.addColorStop(0, 'rgba(47,224,242,0)');
        sg.addColorStop(1, 'rgba(47,224,242,0.35)');
        vc.fillStyle = sg;
        vc.fillRect(0, sy - 60, w, 64);
        vc.fillStyle = 'rgba(160,250,255,0.7)';
        vc.fillRect(0, sy, w, 2);
      }
    }, { alpha: opt.alpha ?? 1, r: opt.r, accent: opt.accent, accentA: opt.accentA, border: opt.border });
  };

  // ---------------------------------------------------------------- labels & connectors
  // Floating label with a connector to a point. on: highlight 0..1
  M.callout = (ctx, str, x, y, tx, ty, t, opt = {}) => {
    if (t <= 0) return;
    const a = (opt.alpha ?? 1) * M.E.outCubic(M.inv(t, 0, 0.45));
    const on = opt.on ?? 1;
    const col = M.mix('#8A93A3', opt.color || C.cyan, on);
    const size = opt.size || 22;
    const tw = M.measure(ctx, str, { size, weight: 700, ls: 3 });
    const padX = 20, h = size + 26;
    const w = tw + padX * 2;
    const bx = opt.align === 'right' ? x - w : opt.align === 'center' ? x - w / 2 : x;
    // connector
    const k = M.E.inOutCubic(M.inv(t, 0.15, 0.75));
    const ax = opt.align === 'right' ? bx + w : opt.align === 'center' ? bx + w / 2 : bx;
    const ay = opt.align === 'center' ? (ty > y ? y + h / 2 : y - h / 2) : y;
    const sx = opt.align === 'center' ? ax : opt.align === 'right' ? ax : ax;
    ctx.save();
    ctx.globalAlpha *= a;
    if (k > 0) {
      ctx.strokeStyle = M.rgba(opt.color || C.cyan, 0.35 + 0.5 * on);
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      const ex = M.lerp(sx, tx, k), ey = M.lerp(ay, ty, k);
      ctx.moveTo(sx, ay);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      if (k >= 1) {
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 14 * on;
        ctx.beginPath();
        ctx.arc(tx, ty, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha *= 0.35 * on;
        ctx.beginPath();
        ctx.arc(tx, ty, 6 + 8 * ((t * 1.2) % 1), 0, Math.PI * 2);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= a;
    M.rr(ctx, bx, y - h / 2, w, h, 12);
    ctx.fillStyle = M.mix('#151922', '#0D2C33', on * 0.9, 0.92);
    ctx.fill();
    ctx.strokeStyle = M.rgba(opt.color || C.cyan, 0.2 + 0.7 * on);
    ctx.lineWidth = 1.5;
    if (on > 0.5) {
      ctx.shadowColor = opt.color || C.cyan;
      ctx.shadowBlur = 18 * on;
    }
    ctx.stroke();
    ctx.restore();
    M.text(ctx, str, bx + padX, y + 1, { size, weight: 700, ls: 3, color: M.mix('#A9B1BF', '#FFFFFF', on), base: 'middle', alpha: a });
  };

  // Numbered marker badge (used to tie prompt words to image regions).
  M.badge = (ctx, n, x, y, a = 1, opt = {}) => {
    if (a <= 0) return;
    const r = opt.r || 15;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = opt.fill || C.cyan;
    ctx.shadowColor = opt.fill || C.cyan;
    ctx.shadowBlur = opt.glow ?? 16;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    M.text(ctx, String(n), x, y + 1, { size: r * 1.1, weight: 700, color: opt.ink || '#04161A', align: 'center', base: 'middle', alpha: a });
  };

  // Corner brackets (framing guides).
  M.brackets = (ctx, x, y, w, h, len, a = 1, col = C.cyan, lw = 2) => {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, sx, sy]) => {
      ctx.moveTo(cx + sx * len, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * len);
    });
    ctx.stroke();
    ctx.restore();
  };

  // Check / cross status pill.
  M.status = (ctx, ok, x, y, a = 1, s = 30) => {
    if (a <= 0) return;
    const col = ok ? C.cyan : C.red;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = M.rgba(col, 0.16);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    M.icon(ctx, ok ? 'check' : 'cross', x, y, s * 0.62, { color: col, lw: 2.6, alpha: a });
  };
})();
