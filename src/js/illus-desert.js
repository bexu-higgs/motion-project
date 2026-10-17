// "One idea, two prompts": a robot in a desert, rendered from a short prompt
// (flat, generic) and from a specific prompt (low angle, sunset backlight, wind).
(function () {
  const M = window.M;

  function ridge(ctx, w, h, y0, amp, freq, seed, bottom) {
    ctx.beginPath();
    ctx.moveTo(-10, bottom);
    for (let x = -10; x <= w + 10; x += w / 80) {
      const u = x / w;
      const y = y0 - amp * (0.6 * Math.sin(u * freq * 6.28 + seed) + 0.4 * Math.sin(u * freq * 13.1 + seed * 2.3));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 10, bottom);
    ctx.closePath();
  }
  function ridgeY(w, x, y0, amp, freq, seed) {
    const u = x / w;
    return y0 - amp * (0.6 * Math.sin(u * freq * 6.28 + seed) + 0.4 * Math.sin(u * freq * 13.1 + seed * 2.3));
  }

  // ------------------------------------------------------------ Prompt A: "A robot stands in a desert."
  M.drawDesertSimple = (ctx, w, h, o = {}) => {
    const k = h / 900;
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.58);
    sky.addColorStop(0, '#A9C9E4');
    sky.addColorStop(1, '#DCE9F1');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#D8C29A';
    ctx.fillRect(0, h * 0.58, w, h);
    ctx.fillStyle = '#CDB68C';
    ridge(ctx, w, h, h * 0.66, 10 * k, 1.2, 1, h);
    ctx.fill();
    // small boxy robot, eye level, centred
    const cx = w * 0.5, fy = h * 0.74, s = k * 0.9;
    ctx.fillStyle = 'rgba(120,100,70,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, fy, 70 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const grey = '#9AA0A8', dark = '#7E848D';
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 34 * s, fy - 70 * s, 22 * s, 70 * s);
    ctx.fillRect(cx + 12 * s, fy - 70 * s, 22 * s, 70 * s);
    ctx.fillStyle = grey;
    ctx.fillRect(cx - 50 * s, fy - 190 * s, 100 * s, 125 * s);
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 72 * s, fy - 185 * s, 18 * s, 95 * s);
    ctx.fillRect(cx + 54 * s, fy - 185 * s, 18 * s, 95 * s);
    ctx.fillStyle = grey;
    ctx.fillRect(cx - 36 * s, fy - 262 * s, 72 * s, 62 * s);
    ctx.fillStyle = '#4B5059';
    ctx.beginPath();
    ctx.arc(cx - 15 * s, fy - 232 * s, 7 * s, 0, Math.PI * 2);
    ctx.arc(cx + 15 * s, fy - 232 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 2 * s, fy - 285 * s, 4 * s, 23 * s);
    if (o.grain) M.grain(ctx, w, h, o.t || 0, o.grain);
    return { character: [cx, fy - 160 * s], environment: [w * 0.2, h * 0.8] };
  };

  // ------------------------------------------------------------ Prompt B
  function robotShapes(c) {
    const part = (pts) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fill();
    };
    // legs
    part([-118, 0, -30, 0, -40, -40, -95, -46]);
    part([118, 0, 30, 0, 40, -40, 95, -46]);
    part([-92, -40, -44, -40, -36, -270, -96, -270]);
    part([92, -40, 44, -40, 36, -270, 96, -270]);
    c.beginPath();
    c.arc(-66, -292, 36, 0, Math.PI * 2);
    c.arc(66, -292, 36, 0, Math.PI * 2);
    c.fill();
    part([-104, -310, -30, -310, -40, -520, -100, -530]);
    part([104, -310, 30, -310, 40, -520, 100, -530]);
    part([-96, -560, 96, -560, 74, -500, -74, -500]);
    // waist segments
    part([-46, -650, 46, -650, 40, -556, -40, -556]);
    // chest
    part([-64, -880, 64, -880, 156, -816, 130, -700, 56, -648, -56, -648, -130, -700, -156, -816]);
    // arms
    part([-186, -800, -150, -800, -178, -610, -222, -616]);
    part([186, -800, 150, -800, 178, -610, 222, -616]);
    part([-226, -610, -176, -606, -190, -420, -232, -424]);
    part([226, -610, 176, -606, 190, -420, 232, -424]);
    part([-238, -424, -186, -420, -192, -360, -232, -356]);
    part([238, -424, 186, -420, 192, -360, 232, -356]);
    c.beginPath();
    c.ellipse(-178, -818, 62, 46, -0.35, 0, Math.PI * 2);
    c.ellipse(178, -818, 62, 46, 0.35, 0, Math.PI * 2);
    c.fill();
    // neck + head
    part([-22, -918, 22, -918, 26, -876, -26, -876]);
    M.rr(c, -50, -1010, 100, 96, 30);
    c.fill();
    part([-6, -1052, 6, -1052, 10, -1006, -10, -1006]);
  }

  function drawRobot(ctx, x, y, hp, t) {
    const ds = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
    const s = (hp / 1060) * ds;
    const W = 620 * s, H = 1140 * s;
    const ox = W / 2, oy = H - 40 * s;
    const L = M.layer('robot', W, H);
    const c = L.getContext('2d');
    c.setTransform(s, 0, 0, s, ox, oy);
    c.fillStyle = '#2B2E36';
    robotShapes(c);
    // brushed metal: vertical gradient + fine streaks, clipped to the body
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    const g = c.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(255,170,90,0.18)');
    g.addColorStop(0.3, 'rgba(160,170,190,0.16)');
    g.addColorStop(0.55, 'rgba(40,44,54,0.0)');
    g.addColorStop(0.8, 'rgba(150,160,180,0.14)');
    g.addColorStop(1, 'rgba(255,170,90,0.22)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    c.lineWidth = Math.max(1, s * 2);
    for (let i = 0; i < 160; i++) {
      const xx = M.hash(i * 1.7) * W;
      c.beginPath();
      c.moveTo(xx, 0);
      c.lineTo(xx + 2, H);
      c.stroke();
    }
    // panel lines
    c.setTransform(s, 0, 0, s, ox, oy);
    c.strokeStyle = 'rgba(0,0,0,0.55)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-120, -780);
    c.lineTo(-40, -720);
    c.lineTo(40, -720);
    c.lineTo(120, -780);
    c.moveTo(0, -880);
    c.lineTo(0, -720);
    c.moveTo(-42, -620);
    c.lineTo(42, -620);
    c.moveTo(-40, -590);
    c.lineTo(40, -590);
    c.moveTo(-66, -470);
    c.lineTo(-70, -330);
    c.moveTo(66, -470);
    c.lineTo(70, -330);
    c.moveTo(-64, -230);
    c.lineTo(-68, -60);
    c.moveTo(64, -230);
    c.lineTo(68, -60);
    c.stroke();
    // top-facing surfaces catch the sky
    c.fillStyle = 'rgba(255,150,80,0.2)';
    c.beginPath();
    c.ellipse(-178, -840, 50, 20, -0.35, 0, Math.PI * 2);
    c.ellipse(178, -840, 50, 20, 0.35, 0, Math.PI * 2);
    c.fill();
    // visor + chest core
    c.globalCompositeOperation = 'source-over';
    c.shadowColor = '#2FE0F2';
    c.shadowBlur = 30 * s;
    c.fillStyle = '#8FF4FF';
    M.rr(c, -38, -968, 76, 14, 7);
    c.fill();
    c.beginPath();
    c.arc(0, -775, 13, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    // warm rim light from the sun behind
    c.setTransform(1, 0, 0, 1, 0, 0);
    const R = M.layer('robotRim', W, H);
    const rc = R.getContext('2d');
    [[5, 0.95], [-5, 0.95], [0, 0.8]].forEach(([dx, a], i) => {
      rc.globalCompositeOperation = 'source-over';
      rc.clearRect(0, 0, W, H);
      rc.drawImage(L, 0, 0);
      rc.globalCompositeOperation = 'source-in';
      rc.fillStyle = '#FFC46B';
      rc.fillRect(0, 0, W, H);
      rc.globalCompositeOperation = 'destination-out';
      rc.drawImage(L, dx * s, i === 2 ? 6 * s : 0);
      c.save();
      c.globalAlpha = a;
      c.globalCompositeOperation = 'source-atop';
      c.drawImage(R, 0, 0);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = a * 0.5;
      c.filter = `blur(${Math.max(1, 8 * s)}px)`;
      c.drawImage(R, 0, 0);
      c.restore();
    });
    ctx.drawImage(L, x - ox / ds, y - oy / ds, W / ds, H / ds);
  }

  // o: t, wind (0..1), reveal markers handled by caller. Returns marker anchors.
  M.drawDesertCinematic = (ctx, w, h, o = {}) => {
    const t = o.t || 0, k = h / 900;
    const hz = h * 0.8;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#160F2C');
    sky.addColorStop(0.35, '#4A1F42');
    sky.addColorStop(0.65, '#B9482F');
    sky.addColorStop(0.86, '#F28A3A');
    sky.addColorStop(1, '#FFD27A');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const sx = w * 0.58, sy = hz - h * 0.05;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    M.glow(ctx, sx, sy, h * 0.9, '#FF8A3D', 0.55);
    M.glow(ctx, sx, sy, h * 0.3, '#FFD38A', 0.8);
    ctx.restore();
    ctx.fillStyle = '#FFF2C9';
    ctx.beginPath();
    ctx.arc(sx, sy, h * 0.055, 0, Math.PI * 2);
    ctx.fill();
    // dune layers, far to near
    const layers = [
      [hz + 2 * k, 14 * k, 1.3, 0.4, '#C4642E', '#FFC071'],
      [hz + 26 * k, 26 * k, 0.9, 2.1, '#8E3F22', '#FFB25C'],
      [hz + 70 * k, 40 * k, 0.7, 4.2, '#5A2716', '#FFA24A'],
      [h + 30 * k, 90 * k, 0.55, 5.4, '#2E140C', '#F59240'],
    ];
    layers.forEach(([y0, amp, f, sd, col, rim], i) => {
      ctx.fillStyle = col;
      ridge(ctx, w, h, y0, amp, f, sd, h + 20);
      ctx.fill();
      ctx.save();
      ctx.strokeStyle = rim;
      ctx.globalAlpha = 0.55 - i * 0.08;
      ctx.lineWidth = (1.2 + i * 0.8) * k;
      ctx.shadowColor = rim;
      ctx.shadowBlur = 8 * k;
      ctx.beginPath();
      for (let x = 0; x <= w; x += w / 80) {
        const y = ridgeY(w, x, y0, amp, f, sd);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    });
    // ripples on the near dune
    ctx.save();
    ctx.strokeStyle = 'rgba(255,170,90,0.10)';
    ctx.lineWidth = 2 * k;
    for (let i = 0; i < 14; i++) {
      const y = h * 0.86 + i * 9 * k;
      ctx.beginPath();
      for (let x = 0; x <= w; x += w / 40) {
        const yy = y + Math.sin(x / (60 * k) + i) * 3 * k;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
    // long shadow toward camera
    const rx = w * 0.46, ry = h * 0.865;
    ctx.save();
    const sg = ctx.createLinearGradient(rx, ry, rx - w * 0.12, h);
    sg.addColorStop(0, 'rgba(10,4,2,0.75)');
    sg.addColorStop(1, 'rgba(10,4,2,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(rx - 40 * k, ry);
    ctx.lineTo(rx + 40 * k, ry);
    ctx.lineTo(rx - w * 0.08, h);
    ctx.lineTo(rx - w * 0.2, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // the robot, low angle: towering over the horizon
    drawRobot(ctx, rx, ry, h * 0.8, t);
    // dust haze + wind-blown sand
    const wind = o.wind ?? 1;
    ctx.save();
    const hg = ctx.createLinearGradient(0, h * 0.7, 0, h);
    hg.addColorStop(0, 'rgba(255,170,90,0)');
    hg.addColorStop(0.5, `rgba(255,170,90,${0.18 * wind})`);
    hg.addColorStop(1, 'rgba(255,170,90,0.05)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < 160 * wind; i++) {
      const depth = M.hash(i * 2.1);
      const speed = (300 + 700 * depth) * k;
      const len = (20 + 90 * depth) * k;
      const x = ((M.hash(i * 3.3) * (w + len) + t * speed) % (w + len)) - len;
      const y = h * (0.74 + 0.26 * M.hash(i * 5.9)) + Math.sin(t * 2 + i) * 4 * k;
      ctx.strokeStyle = `rgba(255,${180 + Math.floor(depth * 40)},120,${0.08 + 0.2 * depth})`;
      ctx.lineWidth = (0.6 + depth * 1.6) * k;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y - len * 0.04);
      ctx.stroke();
    }
    ctx.restore();
    const vg = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, h * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    if (o.grain) M.grain(ctx, w, h, t, o.grain);
    return {
      character: [rx + 10 * k, h * 0.3],
      environment: [w * 0.82, h * 0.87],
      camera: [w * 0.12, h * 0.9],
      lighting: [sx + 30 * k, sy - 10 * k],
      atmosphere: [w * 0.25, h * 0.79],
    };
  };
})();
