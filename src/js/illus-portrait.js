// Close-up / portrait of the same character, in profile, plus the artifact
// layers used by the Negative Prompt lesson.
(function () {
  const M = window.M;

  // Profile (facing left) in a 520-unit tall head space; origin near the skull centre.
  function headPath() {
    const p = new Path2D();
    p.moveTo(-150, 60);
    p.bezierCurveTo(-175, 110, -182, 160, -180, 190);
    p.bezierCurveTo(-178, 205, -170, 212, -168, 222);
    p.bezierCurveTo(-180, 260, -205, 300, -214, 322);
    p.bezierCurveTo(-220, 332, -210, 345, -190, 344);
    p.bezierCurveTo(-182, 344, -176, 346, -172, 350);
    p.bezierCurveTo(-176, 362, -182, 372, -180, 380);
    p.bezierCurveTo(-176, 388, -170, 390, -170, 392);
    p.bezierCurveTo(-176, 398, -178, 408, -172, 418);
    p.bezierCurveTo(-166, 428, -162, 432, -162, 438);
    p.bezierCurveTo(-168, 455, -170, 480, -160, 498);
    p.bezierCurveTo(-148, 518, -120, 524, -90, 522);
    p.bezierCurveTo(-60, 520, -40, 532, -34, 560);
    p.bezierCurveTo(-30, 600, -34, 650, -40, 760);
    p.lineTo(160, 760);
    p.bezierCurveTo(140, 640, 150, 560, 170, 470);
    p.bezierCurveTo(210, 400, 230, 300, 215, 200);
    p.bezierCurveTo(200, 90, 110, 10, 10, 5);
    p.bezierCurveTo(-80, 0, -135, 30, -150, 60);
    p.closePath();
    return p;
  }
  function hairPath() {
    const p = new Path2D();
    p.moveTo(-150, 62);
    p.bezierCurveTo(-176, 44, -174, -8, -122, -38);
    p.bezierCurveTo(-60, -72, 100, -64, 190, 8);
    p.bezierCurveTo(252, 70, 264, 200, 236, 300);
    p.bezierCurveTo(222, 360, 202, 404, 178, 444);
    p.bezierCurveTo(152, 424, 132, 382, 112, 332);
    p.bezierCurveTo(102, 292, 86, 252, 52, 242);
    p.bezierCurveTo(30, 246, 26, 290, 22, 322);
    p.lineTo(6, 318);
    p.bezierCurveTo(0, 270, -22, 210, -72, 152);
    p.bezierCurveTo(-102, 112, -128, 84, -150, 62);
    p.closePath();
    return p;
  }
  function earPath() {
    const p = new Path2D();
    p.moveTo(46, 272);
    p.bezierCurveTo(80, 254, 104, 290, 98, 332);
    p.bezierCurveTo(94, 362, 76, 384, 56, 372);
    p.bezierCurveTo(62, 342, 52, 302, 46, 272);
    p.closePath();
    return p;
  }
  function collarPath() {
    const p = new Path2D();
    p.moveTo(-120, 760);
    p.bezierCurveTo(-90, 690, -60, 620, -40, 600);
    p.lineTo(-22, 640);
    p.bezierCurveTo(40, 610, 140, 560, 200, 520);
    p.bezierCurveTo(260, 560, 330, 640, 380, 760);
    p.closePath();
    // shoulder mass
    p.moveTo(-260, 900);
    p.bezierCurveTo(-200, 780, -140, 730, -110, 720);
    p.lineTo(380, 720);
    p.bezierCurveTo(470, 760, 560, 830, 620, 900);
    p.closePath();
    return p;
  }
  const PATHS = {};
  const paths = () => (PATHS.head ? PATHS : Object.assign(PATHS, { head: headPath(), hair: hairPath(), ear: earPath(), collar: collarPath() }));

  const LOOK = {
    neon: { skin: '#3A2629', skinFill: 'rgba(59,230,255,0.26)', hair: '#07070A', coat: '#0A0B10', rimF: '#3BE6FF', rimB: '#B46BFF', rimFA: 0.9, rimBA: 0.6, eye: '#3BE6FF' },
    studio: { skin: '#7A5244', skinFill: 'rgba(255,190,150,0.35)', hair: '#120E0D', coat: '#0B0C10', rimF: '#FFD3A8', rimB: '#57D9F0', rimFA: 0.75, rimBA: 0.8, eye: '#FFFFFF' },
    flat: { skin: '#8C6A5E', skinFill: 'rgba(0,0,0,0)', hair: '#2A2321', coat: '#24272E', rimF: '#FFFFFF', rimB: '#FFFFFF', rimFA: 0, rimBA: 0, eye: '#FFFFFF' },
  };

  // Draw the head at (x, y) = skull origin, `sc` scale. Returns nothing.
  function drawHead(ctx, x, y, sc, look, detail = 1) {
    const P = paths();
    const L = LOOK[look] || LOOK.neon;
    const ds = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
    const S = sc * ds;
    const bx = -320, by = -120, bw = 1000, bh = 1060; // head space bounds
    const W = bw * S, H = bh * S;
    const lay = M.layer('head', W, H);
    const c = lay.getContext('2d');
    c.setTransform(S, 0, 0, S, -bx * S, -by * S);
    c.fillStyle = L.skin;
    c.fill(P.head);
    // face planes: cheek light from the front, shadow toward the ear
    c.save();
    c.clip(P.head);
    const fg = c.createLinearGradient(-220, 0, 120, 0);
    fg.addColorStop(0, L.skinFill);
    fg.addColorStop(0.55, 'rgba(0,0,0,0)');
    fg.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = fg;
    c.fillRect(-320, -100, 700, 900);
    // under-jaw and neck shadow
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.beginPath();
    c.moveTo(-160, 500);
    c.bezierCurveTo(-100, 540, 0, 540, 160, 470);
    c.lineTo(160, 760);
    c.lineTo(-60, 760);
    c.closePath();
    c.fill();
    if (detail > 0) {
      // cheekbone + eye socket modelling
      c.globalAlpha = detail;
      M.glow(c, -120, 300, 90, look === 'studio' ? '#FFB48A' : '#3BE6FF', look === 'flat' ? 0 : 0.16);
      c.fillStyle = 'rgba(0,0,0,0.28)';
      c.beginPath();
      c.ellipse(-140, 232, 34, 22, 0.2, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
    c.restore();
    c.fillStyle = L.skin;
    c.fill(P.ear);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fill(P.ear);
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(62, 286);
    c.bezierCurveTo(84, 290, 88, 330, 70, 350);
    c.stroke();
    // eye, brow, nostril, lips
    c.fillStyle = 'rgba(8,6,8,0.9)';
    c.beginPath();
    c.moveTo(-164, 236);
    c.bezierCurveTo(-150, 224, -134, 224, -124, 232);
    c.bezierCurveTo(-136, 240, -150, 244, -164, 236);
    c.fill();
    if (detail > 0 && look !== 'flat') {
      c.fillStyle = L.eye;
      c.globalAlpha = 0.9 * detail;
      c.beginPath();
      c.arc(-150, 232, 3.2, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
    c.strokeStyle = L.hair;
    c.lineCap = 'round';
    c.lineWidth = 11;
    c.beginPath();
    c.moveTo(-176, 196);
    c.bezierCurveTo(-150, 186, -126, 186, -104, 194);
    c.stroke();
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(0,0,0,0.55)';
    c.beginPath();
    c.moveTo(-196, 334);
    c.bezierCurveTo(-188, 326, -178, 328, -176, 338);
    c.moveTo(-174, 392);
    c.lineTo(-146, 394);
    c.stroke();
    c.fillStyle = L.hair;
    c.fill(P.hair);
    // sweater under the coat, then the raised collar
    c.fillStyle = look === 'flat' ? '#3A3D44' : '#121318';
    c.beginPath();
    c.moveTo(-70, 640);
    c.bezierCurveTo(0, 600, 100, 590, 180, 560);
    c.lineTo(200, 940);
    c.lineTo(-70, 940);
    c.closePath();
    c.fill();
    c.fillStyle = L.coat;
    c.fill(P.collar);
    // hair sheen
    c.save();
    c.clip(P.hair);
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    c.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.moveTo(-120 + i * 34, -30 + i * 4);
      c.bezierCurveTo(-60 + i * 30, -20, 60 + i * 20, 60 + i * 10, 120 + i * 10, 200 + i * 18);
      c.stroke();
    }
    c.restore();
    // rim lights: silhouette minus shifted silhouette
    const rim = M.layer('headRim', W, H);
    const rc = rim.getContext('2d');
    [[L.rimF, 4.5, L.rimFA], [L.rimB, -5, L.rimBA]].forEach(([col, dx, a]) => {
      if (a <= 0 || detail <= 0) return;
      rc.setTransform(1, 0, 0, 1, 0, 0);
      rc.globalCompositeOperation = 'source-over';
      rc.clearRect(0, 0, W, H);
      rc.drawImage(lay, 0, 0);
      rc.globalCompositeOperation = 'source-in';
      rc.fillStyle = col;
      rc.fillRect(0, 0, W, H);
      rc.globalCompositeOperation = 'destination-out';
      rc.drawImage(lay, dx * S, 3 * S);
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = a * detail;
      c.globalCompositeOperation = 'source-atop';
      c.drawImage(rim, 0, 0);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = a * detail * 0.45;
      c.filter = `blur(${Math.max(1, 9 * S)}px)`;
      c.drawImage(rim, 0, 0);
      c.restore();
    });
    ctx.drawImage(lay, x + bx * sc, y + by * sc, bw * sc, bh * sc);
  }

  function bokeh(ctx, w, h, t, look) {
    const cols = look === 'studio' ? ['#2A6F7A', '#7A4A30', '#334055'] : ['#2FE0F2', '#B46BFF', '#FF4FA3', '#FFB347', '#7C9CFF'];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const x = M.hash(i * 3.1) * w, y = M.hash(i * 5.7) * h * 0.85;
      const r = (30 + M.hash(i * 1.3) * 70) * (w / 1600);
      const a = (0.08 + M.hash(i * 9.1) * 0.16) * (look === 'studio' ? 0.6 : 1);
      const dx = Math.sin(t * 0.3 + i) * 6 * (w / 1600);
      M.glow(ctx, x + dx, y, r, cols[i % cols.length], a);
    }
    ctx.restore();
  }

  // Close-up shot. o: t, look ('neon'|'studio'|'flat'), rain, push (0..1 slow push-in), detail
  M.drawCloseup = (ctx, w, h, o = {}) => {
    o = Object.assign({ t: 0, look: 'neon', rain: 1, push: 0, detail: 1, grain: 0.05 }, o);
    const g = ctx.createLinearGradient(0, 0, w, h);
    if (o.look === 'studio') {
      g.addColorStop(0, '#16242A');
      g.addColorStop(1, '#0A0D12');
    } else if (o.look === 'flat') {
      g.addColorStop(0, '#6E7480');
      g.addColorStop(1, '#5D626C');
    } else {
      g.addColorStop(0, '#0B0A1C');
      g.addColorStop(1, '#05060B');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (o.look !== 'flat') bokeh(ctx, w, h, o.t, o.look);
    const sc = (h / 900) * 0.92 * (1 + 0.06 * o.push);
    drawHead(ctx, w * 0.6 - o.push * w * 0.01, h * 0.16 - o.push * h * 0.02, sc, o.look, o.detail);
    if (o.rain > 0) M.drawRain(ctx, w, h, o.t, o.rain * 0.7, o.look === 'neon' ? '#9FD8FF' : '#FFFFFF', 3);
    const vg = ctx.createRadialGradient(w * 0.55, h * 0.45, h * 0.3, w * 0.55, h * 0.45, h);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    if (o.grain > 0) M.grain(ctx, w, h, o.t, o.grain);
  };

  // Portrait with AI artifacts for the Negative Prompt lesson.
  // a: {blur, hand, dup, text, low} each 0 (gone) .. 1 (fully present)
  // Returns artifact boxes in local coordinates: {blur, hand, dup, text}
  M.drawPortrait = (ctx, w, h, t, a) => {
    const k = w / 1600;
    const boxes = {
      text: [70 * k, 70 * k, 420 * k, 120 * k],
      dup: [150 * k, 260 * k, 360 * k, 520 * k],
      hand: [560 * k, 560 * k, 300 * k, 320 * k],
      blur: [700 * k, 210 * k, 380 * k, 330 * k],
    };
    const lay = M.layer('portrait', w, h);
    const c = lay.getContext('2d');
    // the subject, with "low detail" washing out the modelling and rim light
    M.drawCloseup(c, w, h, { t, look: 'studio', rain: 0, detail: 1 - 0.85 * a.low, grain: 0.05 * (1 - a.low) });
    if (a.low > 0) {
      c.save();
      c.globalAlpha = a.low * 0.35;
      c.fillStyle = '#5A6070';
      c.globalCompositeOperation = 'color';
      c.fillRect(0, 0, w, h);
      c.restore();
    }
    // duplicate subject: a faded second head in the background
    if (a.dup > 0) {
      const d = M.layer('portraitDup', w, h);
      const dc = d.getContext('2d');
      drawHead(dc, 360 * k, 330 * k, 0.42 * (h / 900), 'studio', 0.4);
      dc.globalCompositeOperation = 'destination-in';
      const fg = dc.createLinearGradient(0, 560 * k, 0, 740 * k);
      fg.addColorStop(0, 'rgba(0,0,0,1)');
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = fg;
      dc.fillRect(0, 0, w, h);
      c.save();
      c.globalAlpha = a.dup * 0.55;
      c.drawImage(d, 0, 0);
      c.restore();
    }
    // garbled text artifact
    if (a.text > 0) {
      c.save();
      c.globalAlpha = a.text * 0.8;
      c.font = `700 ${64 * k}px "Inter Display", Inter, sans-serif`;
      c.fillStyle = '#C9D2DC';
      c.letterSpacing = `${4 * k}px`;
      c.setTransform(1, 0.04, -0.12, 1, 0, 0);
      c.fillText('ƎLIꟻ MAꓤ', 96 * k, 150 * k);
      c.font = `500 ${26 * k}px Inter, sans-serif`;
      c.fillText('ʇxǝʇ ꞁoʁǝw ſn∀', 110 * k, 186 * k);
      c.restore();
    }
    // distorted hand near the jaw
    if (a.hand > 0) {
      c.save();
      c.globalAlpha = a.hand;
      c.translate(700 * k, 760 * k);
      c.scale(k, k);
      c.rotate(-0.35);
      c.fillStyle = '#7A5244';
      c.beginPath();
      c.ellipse(0, 40, 70, 58, 0, 0, Math.PI * 2);
      c.fill();
      const fingers = [[-70, -10, -1.1, 70], [-48, -40, -0.75, 96], [-18, -52, -0.35, 104], [14, -50, 0.05, 98], [40, -40, 0.4, 92], [62, -22, 0.8, 74], [70, 20, 1.3, 64]];
      fingers.forEach(([fx, fy, ang, len], i) => {
        c.save();
        c.translate(fx, fy);
        c.rotate(ang + Math.sin(i * 2.3) * 0.25);
        c.beginPath();
        c.moveTo(-9, 0);
        c.quadraticCurveTo(-14 + (i % 2) * 10, -len * 0.55, -4, -len);
        c.quadraticCurveTo(4, -len - 8, 9, -len + 4);
        c.quadraticCurveTo(12 - (i % 3) * 8, -len * 0.5, 9, 0);
        c.closePath();
        c.fill();
        c.restore();
      });
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath();
      c.ellipse(10, 60, 60, 30, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    ctx.drawImage(lay, 0, 0);
    // blurry region: re-draw part of the image soft
    if (a.blur > 0) {
      const [bx, by, bw, bh] = boxes.blur;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.filter = `blur(${20 * k * a.blur}px)`;
      ctx.globalAlpha = Math.min(1, a.blur * 1.2);
      ctx.drawImage(lay, 0, 0);
      ctx.restore();
    }
    return boxes;
  };
})();
