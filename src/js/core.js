// Core motion toolkit: timing, easing, colour, typography and UI primitives.
// Everything is a pure function of time so any frame can be rendered on demand.
(function () {
  const M = (window.M = window.M || {});

  M.W = 1920;
  M.H = 1080;
  M.FPS = 30;

  // ---------------------------------------------------------------- theme
  M.C = {
    bg: '#0B0D11',
    bg2: '#141821',
    panel: '#161A22',
    ink: '#F4F6FA',
    ink2: '#A9B1BF',
    ink3: '#636B79',
    line: 'rgba(255,255,255,0.10)',
    cyan: '#2FE0F2',
    cyanDeep: '#0EA5B7',
    violet: '#9B7BFF',
    violetDeep: '#6D4AE0',
    red: '#FF5468',
    amber: '#F7B955',
  };
  M.F = {
    display: '"Inter Display", "Inter", sans-serif',
    ui: '"Inter", sans-serif',
    mono: '"JetBrains Mono", monospace',
  };

  // ---------------------------------------------------------------- math
  M.clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.inv = (t, a, b) => M.clamp((t - a) / (b - a));
  M.E = {
    linear: (t) => t,
    inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    outSine: (t) => Math.sin((t * Math.PI) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
    outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) =>
      t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    outBack: (t) => {
      const c1 = 1.2, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
  };
  // Eased progress of t through [a, b].
  M.p = (t, a, b, ease = M.E.inOutCubic) => ease(M.inv(t, a, b));
  // Fade in over [a, a+fi], hold, fade out over [b-fo, b].
  M.env = (t, a, b, fi = 0.4, fo = 0.4, ease = M.E.inOutSine) =>
    Math.min(fi > 0 ? ease(M.inv(t, a, a + fi)) : t >= a ? 1 : 0, fo > 0 ? 1 - ease(M.inv(t, b - fo, b)) : t <= b ? 1 : 0);
  // Keyframes: [[t, v], [t, v, ease], ...] — ease on a key shapes the segment that ends there.
  M.kf = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        return M.lerp(v0, v1, (e || M.E.inOutCubic)((t - t0) / (t1 - t0 || 1)));
      }
    }
    return keys[keys.length - 1][1];
  };
  M.hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };
  M.rng = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---------------------------------------------------------------- colour
  const hexCache = {};
  M.rgb = (hex) => {
    if (hexCache[hex]) return hexCache[hex];
    if (hex[0] === 'r') return hex.match(/[\d.]+/g).slice(0, 3).map(Number);
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return (hexCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  };
  M.rgba = (hex, a = 1) => {
    const [r, g, b] = M.rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };
  M.mix = (h1, h2, t, a = 1) => {
    const c1 = M.rgb(h1), c2 = M.rgb(h2);
    return `rgba(${Math.round(M.lerp(c1[0], c2[0], t))},${Math.round(M.lerp(c1[1], c2[1], t))},${Math.round(
      M.lerp(c1[2], c2[2], t)
    )},${a})`;
  };

  // ---------------------------------------------------------------- canvas utils
  const pool = {};
  // Reusable offscreen canvas keyed by name.
  M.layer = (key, w, h) => {
    let c = pool[key];
    if (!c) c = pool[key] = document.createElement('canvas');
    w = Math.max(1, Math.ceil(w));
    h = Math.max(1, Math.ceil(h));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    } else {
      const x = c.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
      x.filter = 'none';
      x.clearRect(0, 0, w, h);
    }
    return c;
  };

  // Cheap large-radius blur: shrink, blur the small copy, scale back up.
  M.blurBlit = (ctx, src, dx, dy, dw, dh, radius, key = 'bb') => {
    if (radius < 0.6) {
      ctx.drawImage(src, dx, dy, dw, dh);
      return;
    }
    const d = M.clamp(radius / 2.5, 1, 10);
    const sw = Math.max(2, Math.round(src.width / d)), sh = Math.max(2, Math.round(src.height / d));
    const a = M.layer(key + 'A', sw, sh);
    a.getContext('2d').drawImage(src, 0, 0, sw, sh);
    const b = M.layer(key + 'B', sw, sh);
    const bc = b.getContext('2d');
    bc.filter = `blur(${(radius / d).toFixed(2)}px)`;
    bc.drawImage(a, 0, 0);
    bc.filter = 'none';
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b, dx, dy, dw, dh);
    ctx.restore();
  };

  M.rr = (ctx, x, y, w, h, r) => {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Glass UI card. opt: r, alpha, fill, border, accent (glow colour), accentA, shadow
  M.card = (ctx, x, y, w, h, opt = {}) => {
    const r = opt.r ?? 18, a = opt.alpha ?? 1;
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    if (opt.shadow !== false) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 18;
    }
    M.rr(ctx, x, y, w, h, r);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, opt.fill || '#1A1F29');
    g.addColorStop(1, opt.fill2 || opt.fill || '#141820');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    if (opt.accent && (opt.accentA ?? 1) > 0) {
      ctx.save();
      ctx.globalAlpha *= opt.accentA ?? 1;
      ctx.shadowColor = opt.accent;
      ctx.shadowBlur = opt.glow ?? 24;
      ctx.strokeStyle = opt.accent;
      ctx.lineWidth = opt.accentW ?? 1.5;
      M.rr(ctx, x, y, w, h, r);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = opt.border || 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1;
    M.rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    // top sheen
    ctx.globalAlpha *= 0.6;
    const s = ctx.createLinearGradient(x, y, x, y + 2);
    s.addColorStop(0, 'rgba(255,255,255,0.10)');
    s.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = s;
    M.rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1);
    ctx.stroke();
    ctx.restore();
  };

  // ---------------------------------------------------------------- text
  M.font = (size, weight = 500, fam = M.F.ui) => `${weight} ${size}px ${fam}`;

  // opt: size, weight, fam, color, align, base, ls (px tracking), alpha, glow, glowColor
  M.text = (ctx, str, x, y, opt = {}) => {
    const a = opt.alpha ?? 1;
    if (a <= 0 || !str) return 0;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.font = M.font(opt.size || 32, opt.weight || 500, opt.fam || M.F.ui);
    ctx.letterSpacing = (opt.ls || 0) + 'px';
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.base || 'alphabetic';
    if (opt.glow) {
      ctx.shadowColor = opt.glowColor || opt.color || M.C.cyan;
      ctx.shadowBlur = opt.glow;
    }
    ctx.fillStyle = opt.color || M.C.ink;
    ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  };
  M.measure = (ctx, str, opt = {}) => {
    ctx.save();
    ctx.font = M.font(opt.size || 32, opt.weight || 500, opt.fam || M.F.ui);
    ctx.letterSpacing = (opt.ls || 0) + 'px';
    const w = ctx.measureText(str).width - (opt.ls || 0);
    ctx.restore();
    return w;
  };

  // Kinetic headline: letters rise and sharpen in sequence.
  // opt: as M.text plus stagger (s per char), dur, rise (px), blur (px)
  M.kinetic = (ctx, str, x, y, t, opt = {}) => {
    if (t <= 0) return;
    const st = opt.stagger ?? 0.025, dur = opt.dur ?? 0.6, rise = opt.rise ?? 26;
    const total = M.measure(ctx, str, opt);
    let cx = opt.align === 'center' ? x - total / 2 : opt.align === 'right' ? x - total : x;
    ctx.save();
    ctx.font = M.font(opt.size || 32, opt.weight || 500, opt.fam || M.F.ui);
    ctx.letterSpacing = (opt.ls || 0) + 'px';
    const chars = [...str];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const w = ctx.measureText(ch).width;
      const k = M.E.outCubic(M.inv(t - i * st, 0, dur));
      if (k > 0 && ch !== ' ') {
        ctx.save();
        ctx.globalAlpha *= k * (opt.alpha ?? 1);
        if (opt.glow) {
          ctx.shadowColor = opt.glowColor || opt.color || M.C.cyan;
          ctx.shadowBlur = opt.glow;
        }
        ctx.fillStyle = opt.color || M.C.ink;
        ctx.textBaseline = opt.base || 'alphabetic';
        ctx.fillText(ch, cx, y + (1 - k) * rise);
        ctx.restore();
      }
      cx += w;
    }
    ctx.restore();
  };

  // Tracked uppercase label with optional leading dot.
  M.label = (ctx, str, x, y, opt = {}) =>
    M.text(ctx, str, x, y, { size: 18, weight: 600, ls: 3.2, color: M.C.ink2, ...opt });

  // ---------------------------------------------------------------- prompt text engine
  // Prompt = list of segments {text, tag?}. Layout uses a monospace grid so any
  // character range maps directly to a rectangle.
  M.layoutPrompt = (ctx, segs, width, size = 26, lh = 1.55) => {
    ctx.save();
    ctx.font = M.font(size, 400, M.F.mono);
    ctx.letterSpacing = '0px';
    const cw = ctx.measureText('M').width;
    ctx.restore();
    let str = '';
    const ranges = segs.map((s) => {
      const a = str.length;
      str += s.text;
      return [a, str.length];
    });
    const cols = Math.max(8, Math.floor(width / cw));
    const lines = [];
    let i = 0;
    while (i < str.length) {
      let end = Math.min(str.length, i + cols);
      if (end < str.length) {
        const sp = str.lastIndexOf(' ', end);
        if (sp > i) end = sp + 1;
      }
      lines.push([i, end]);
      i = end;
    }
    if (!lines.length) lines.push([0, 0]);
    return { str, ranges, lines, cw, lh: size * lh, size, segs };
  };
  M.charPos = (L, idx) => {
    for (let li = 0; li < L.lines.length; li++) {
      const [a, b] = L.lines[li];
      if (idx < b || li === L.lines.length - 1) return [Math.max(0, idx - a) * L.cw, li * L.lh];
    }
    return [0, 0];
  };
  // Rectangles covering char range [a, b).
  M.rangeRects = (L, a, b) => {
    const out = [];
    L.lines.forEach(([la, lb], li) => {
      let s = Math.max(a, la), e = Math.min(b, lb);
      while (e > s && L.str[e - 1] === ' ') e--;
      if (e > s) out.push([(s - la) * L.cw, li * L.lh, (e - s) * L.cw, L.lh]);
    });
    return out;
  };
  // opt: reveal (chars shown), color, segStyle(i) -> {color, bg, bgA, line, lineA, strike}, cursor (bool), cursorT
  M.drawPrompt = (ctx, L, x, y, opt = {}) => {
    const reveal = opt.reveal ?? L.str.length;
    ctx.save();
    ctx.globalAlpha *= opt.alpha ?? 1;
    // backgrounds and underlines
    L.segs.forEach((s, i) => {
      const st = opt.segStyle ? opt.segStyle(i, s) : null;
      if (!st) return;
      const [a, b] = L.ranges[i];
      const rects = M.rangeRects(L, a, Math.min(b, reveal));
      rects.forEach(([rx, ry, rw, rh]) => {
        const pad = 4;
        if (st.bg && (st.bgA ?? 1) > 0) {
          ctx.save();
          ctx.globalAlpha *= st.bgA ?? 1;
          ctx.fillStyle = st.bg;
          M.rr(ctx, x + rx - pad, y + ry + rh * 0.12, (rw + pad * 2) * (st.bgW ?? 1), rh * 0.8, 6);
          ctx.fill();
          ctx.restore();
        }
        if (st.box && (st.boxA ?? 1) > 0) {
          ctx.save();
          ctx.globalAlpha *= st.boxA ?? 1;
          ctx.strokeStyle = st.box;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = st.box;
          ctx.shadowBlur = 10;
          M.rr(ctx, x + rx - pad, y + ry + rh * 0.12, rw + pad * 2, rh * 0.8, 6);
          ctx.stroke();
          ctx.restore();
        }
        if (st.line && (st.lineA ?? 1) > 0) {
          ctx.save();
          ctx.globalAlpha *= st.lineA ?? 1;
          ctx.fillStyle = st.line;
          ctx.fillRect(x + rx, y + ry + rh * 0.86, rw * (st.lineW ?? 1), 2.5);
          ctx.restore();
        }
      });
    });
    // glyphs
    ctx.font = M.font(L.size, opt.weight || 400, M.F.mono);
    ctx.letterSpacing = '0px';
    ctx.textBaseline = 'middle';
    L.segs.forEach((s, i) => {
      const st = (opt.segStyle && opt.segStyle(i, s)) || {};
      const [a, b] = L.ranges[i];
      L.lines.forEach(([la, lb], li) => {
        const s0 = Math.max(a, la), e0 = Math.min(b, lb, reveal);
        if (e0 <= s0) return;
        ctx.save();
        ctx.globalAlpha *= st.alpha ?? 1;
        ctx.fillStyle = st.color || opt.color || M.C.ink;
        const tx = x + (s0 - la) * L.cw, ty = y + li * L.lh + L.lh / 2;
        ctx.fillText(L.str.slice(s0, e0), tx, ty);
        if (st.strike) {
          ctx.fillRect(tx, ty, (e0 - s0) * L.cw * st.strike, 2);
        }
        ctx.restore();
      });
    });
    if (opt.cursor) {
      const blink = opt.cursorSolid || Math.floor((opt.cursorT || 0) * 2.2) % 2 === 0;
      if (blink) {
        const [cx, cy] = M.charPos(L, Math.min(reveal, L.str.length));
        ctx.fillStyle = opt.cursorColor || M.C.cyan;
        ctx.fillRect(x + cx + 1, y + cy + L.lh * 0.18, 3, L.lh * 0.64);
      }
    }
    ctx.restore();
    return L.lines.length * L.lh;
  };
  // Characters revealed by a typist at `cps` chars/second starting at t0.
  M.typed = (t, t0, cps, n) => M.clamp(Math.floor((t - t0) * cps), 0, n);

  // ---------------------------------------------------------------- icons (stroke, 24-unit grid)
  M.icon = (ctx, name, x, y, s, opt = {}) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 24, s / 24);
    ctx.translate(-12, -12);
    ctx.globalAlpha *= opt.alpha ?? 1;
    ctx.strokeStyle = opt.color || M.C.ink;
    ctx.fillStyle = opt.color || M.C.ink;
    ctx.lineWidth = opt.lw || 1.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (opt.glow) {
      ctx.shadowColor = opt.color || M.C.cyan;
      ctx.shadowBlur = opt.glow;
    }
    const P = (d) => ctx.stroke(new Path2D(d));
    const F = (d) => ctx.fill(new Path2D(d));
    switch (name) {
      case 'bulb':
        P('M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z');
        break;
      case 'user':
        P('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5');
        break;
      case 'place':
        P('M3 20.5h18M5 20.5V10l5-3v13.5M10 20.5V4l9 4v12.5M13 10h3M13 13.5h3M13 17h3M7 13h1M7 16.5h1');
        break;
      case 'action':
        P('M13.5 5.5a1.6 1.6 0 1 0 0-.1M10 21l2.5-6 3 2.5V21M8 12.5l2.5-3.5 3.5.5 2 3 2.5.5M12.5 15l-1-5.5M3 10h3M2 14h3');
        break;
      case 'camera':
        P('M3 8.5h12v9H3zM15 11.5l6-3v9l-6-3M6 5.5a2 2 0 1 0 0 .1M11 5.5a2 2 0 1 0 0 .1');
        break;
      case 'light':
        P('M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6');
        break;
      case 'check':
        P('M5 12.5l4.5 4.5L19 7.5');
        break;
      case 'cross':
        P('M6.5 6.5l11 11M17.5 6.5l-11 11');
        break;
      case 'spark':
        P('M12 3l1.8 5.6L19.5 10l-5.7 1.6L12 17.5l-1.8-5.9L4.5 10l5.7-1.4zM18.5 16l.7 2 2 .8-2 .7-.7 2-.7-2-2-.7 2-.8z');
        break;
      case 'minus':
        P('M6 12h12');
        break;
      case 'film':
        P('M3.5 5h17v14h-17zM7.5 5v14M16.5 5v14M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4');
        break;
      case 'edit':
        P('M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4');
        break;
      case 'eye':
        P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z');
        break;
      case 'block':
        P('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8');
        break;
      case 'robot':
        P('M7 8h10v8H7zM12 4.5V8M9.5 11.5h.1M14.5 11.5h.1M10 14h4M4.5 11v3M19.5 11v3');
        break;
      case 'dot':
        F('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z');
        break;
    }
    ctx.restore();
  };

  // Arrow from (x1,y1) to (x2,y2) drawn up to progress k.
  M.arrow = (ctx, x1, y1, x2, y2, k = 1, opt = {}) => {
    if (k <= 0) return;
    const x = M.lerp(x1, x2, k), y = M.lerp(y1, y2, k);
    ctx.save();
    ctx.globalAlpha *= opt.alpha ?? 1;
    ctx.strokeStyle = opt.color || M.C.ink2;
    ctx.lineWidth = opt.lw || 2;
    ctx.lineCap = 'round';
    if (opt.dash) ctx.setLineDash(opt.dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (opt.head !== false) {
      const a = Math.atan2(y2 - y1, x2 - x1), hs = opt.hs || 10;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a - 0.5) * hs, y - Math.sin(a - 0.5) * hs);
      ctx.lineTo(x, y);
      ctx.lineTo(x - Math.cos(a + 0.5) * hs, y - Math.sin(a + 0.5) * hs);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Soft radial glow.
  M.glow = (ctx, x, y, r, color, a = 1) => {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, M.rgba(color, a));
    g.addColorStop(0.4, M.rgba(color, a * 0.35));
    g.addColorStop(1, M.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // Image viewport: rounded, clipped frame that hosts an illustration.
  // draw(ctx, w, h) renders in local coords. opt: r, alpha, border, accent, scale
  M.viewport = (ctx, x, y, w, h, draw, opt = {}) => {
    const a = opt.alpha ?? 1;
    if (a <= 0) return;
    const r = opt.r ?? 16;
    ctx.save();
    ctx.globalAlpha *= a;
    if (opt.shadow !== false) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 24;
      M.rr(ctx, x, y, w, h, r);
      ctx.fillStyle = '#05060A';
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    M.rr(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.translate(x, y);
    draw(ctx, w, h);
    ctx.restore();
    if (opt.accent && (opt.accentA ?? 1) > 0) {
      ctx.save();
      ctx.globalAlpha *= opt.accentA ?? 1;
      ctx.strokeStyle = opt.accent;
      ctx.lineWidth = opt.accentW || 2;
      ctx.shadowColor = opt.accent;
      ctx.shadowBlur = 22;
      M.rr(ctx, x, y, w, h, r);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = opt.border || 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    M.rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    ctx.restore();
  };

  // Small rounded chip with label text.
  M.chip = (ctx, str, x, y, opt = {}) => {
    const a = opt.alpha ?? 1;
    if (a <= 0) return 0;
    const size = opt.size || 16;
    const tw = M.measure(ctx, str, { size, weight: opt.weight || 600, ls: opt.ls ?? 2 });
    const padX = opt.padX ?? 14, h = opt.h || size * 2;
    const iw = opt.icon ? size * 1.5 : 0;
    const w = tw + padX * 2 + iw;
    const x0 = opt.align === 'center' ? x - w / 2 : opt.align === 'right' ? x - w : x;
    ctx.save();
    ctx.globalAlpha *= a;
    M.rr(ctx, x0, y - h / 2, w, h, h / 2);
    ctx.fillStyle = opt.bg || 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = opt.border || 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (opt.icon) M.icon(ctx, opt.icon, x0 + padX + size * 0.55, y, size * 1.15, { color: opt.color || M.C.ink, lw: 2 });
    M.text(ctx, str, x0 + padX + iw, y + 1, { size, weight: opt.weight || 600, ls: opt.ls ?? 2, color: opt.color || M.C.ink, base: 'middle' });
    ctx.restore();
    return w;
  };

  // Static film-grain tiles (deterministic) used on cinematic previews.
  let grainTiles = null;
  M.grain = (ctx, w, h, t, a = 0.06) => {
    if (!grainTiles) {
      grainTiles = [];
      const rnd = M.rng(7);
      for (let k = 0; k < 4; k++) {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const x = c.getContext('2d');
        const img = x.createImageData(256, 256);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.floor(rnd() * 255);
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        x.putImageData(img, 0, 0);
        grainTiles.push(c);
      }
    }
    const tile = grainTiles[Math.floor(t * 24) % 4];
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };
})();
