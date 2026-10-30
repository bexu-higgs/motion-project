// Graphic map of Kazakhstan → Almaty oblast → Kegen district → Kegen village.
// Lambert conformal conic projection in km; a camera (cx, cy, s px/km) maps
// it to the 1920×1080 frame. Zooms interpolate scale in log space around the
// fixed point of the two views, so the move reads as one continuous dive.
"use strict";

const MapScene = (() => {
  const W = 1920, H = 1080;
  const R = 6371, D = Math.PI / 180;
  const P1 = 45 * D, P2 = 51 * D, P0 = 47 * D, L0 = 68 * D;
  const N = Math.log(Math.cos(P1) / Math.cos(P2)) / Math.log(Math.tan(Math.PI / 4 + P2 / 2) / Math.tan(Math.PI / 4 + P1 / 2));
  const F = (Math.cos(P1) * Math.pow(Math.tan(Math.PI / 4 + P1 / 2), N)) / N;
  const RHO0 = (R * F) / Math.pow(Math.tan(Math.PI / 4 + P0 / 2), N);

  function proj(lon, lat) {
    const rho = (R * F) / Math.pow(Math.tan(Math.PI / 4 + (lat * D) / 2), N);
    const th = N * (lon * D - L0);
    return [rho * Math.sin(th), -(RHO0 - rho * Math.cos(th))];
  }
  function unproj(x, y) {
    y = -y;
    const rho = Math.sign(N) * Math.hypot(x, RHO0 - y);
    const th = Math.atan2(x, RHO0 - y);
    const lat = 2 * Math.atan(Math.pow((R * F) / rho, 1 / N)) - Math.PI / 2;
    return [(L0 + th / N) / D, lat / D];
  }

  // A ring/line projected to km with cumulative length and bbox.
  function shape(lonlat, closed = true) {
    const pts = lonlat.map(([lo, la]) => proj(lo, la));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return { pts, cum, len: cum[cum.length - 1], bbox: [x0, y0, x1, y1], closed };
  }
  const shapes = (rings, closed = true) => rings.filter((r) => r.length > 1).map((r) => shape(r, closed));
  function unionBox(list) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of list) {
      b[0] = Math.min(b[0], s.bbox[0]); b[1] = Math.min(b[1], s.bbox[1]);
      b[2] = Math.max(b[2], s.bbox[2]); b[3] = Math.max(b[3], s.bbox[3]);
    }
    return b;
  }
  function centroid(list) {
    // area-weighted centroid of the largest ring
    const s = list.reduce((a, b) => (b.len > a.len ? b : a));
    let A = 0, cx = 0, cy = 0;
    const p = s.pts;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const f = p[j][0] * p[i][1] - p[i][0] * p[j][1];
      A += f; cx += (p[j][0] + p[i][0]) * f; cy += (p[j][1] + p[i][1]) * f;
    }
    return [cx / (3 * A), cy / (3 * A)];
  }

  let G = null; // projected geodata
  const VIEWS = {};

  // View that fits bbox into a w×h box centred on screen point (sx, sy).
  function fit(b, sx, sy, w, h) {
    const s = Math.min(w / (b[2] - b[0]), h / (b[3] - b[1]));
    const mx = (b[0] + b[2]) / 2, my = (b[1] + b[3]) / 2;
    return { cx: mx - (sx - W / 2) / s, cy: my - (sy - H / 2) / s, s };
  }
  const scaled = (v, k) => ({ cx: v.cx, cy: v.cy, s: v.s * k });

  function init(base, osm) {
    G = {
      kz: shapes(base.kaz),
      lakes: base.lakes.map((l) => shapes(l.rings)),
      rivers: base.rivers.map((r) => shapes(r.lines, false)),
      regions: (osm.regions || []).map((r) => ({ iso: r.iso, rings: shapes(r.outer) })),
      oblast: shapes(osm.almatyOblast.outer),
      oblastHoles: shapes(osm.almatyOblast.inner || []),
      district: shapes(osm.kegenDistrict.outer),
      fadeEast: osm.kegenDistrict.fadeEast || null,
      village: shapes(osm.kegenVillage.outer || []),
      place: proj(...osm.kegenVillage.place),
      placeLonLat: osm.kegenVillage.place,
      districtLines: osm.districtLines.map((l) => ({ k: l.k, s: shape(l.p, false) })),
      villageLines: osm.villageLines.map((l) => ({ k: l.k, s: shape(l.p, l.k === "building") })),
    };
    G.kzBox = unionBox(G.kz);
    G.oblastBox = unionBox(G.oblast);
    G.districtBox = unionBox(G.district);
    const fb = osm.kegenDistrict.focusBox;
    if (fb) {
      const a = proj(fb[0], fb[1]), b = proj(fb[2], fb[3]), c = proj(fb[0], fb[3]), d = proj(fb[2], fb[1]);
      G.districtBox = [Math.min(a[0], c[0]), Math.min(b[1], c[1]), Math.max(b[0], d[0]), Math.max(a[1], d[1])];
    }
    // without a settlement outline, frame ~30 km around the place
    G.villageBox = G.village.length ? unionBox(G.village)
      : [G.place[0] - 20, G.place[1] - 16, G.place[0] + 20, G.place[1] + 16];
    G.oblastC = centroid(G.oblast);
    G.districtC = centroid(G.district);
    if (fb) G.districtC = [(G.districtBox[0] + G.districtBox[2]) / 2, (G.districtBox[1] + G.districtBox[3]) / 2];

    VIEWS.kz = fit(G.kzBox, 960, 575, 1560, 860);
    VIEWS.kzWide = scaled(VIEWS.kz, 0.8);
    VIEWS.oblast = fit(G.oblastBox, 760, 560, 1000, 760);
    VIEWS.district = fit(G.districtBox, 700, 560, 860, 700);
    VIEWS.village = fit(G.villageBox, 720, 560, 560, 520);
    VIEWS.villageClose = scaled(VIEWS.village, 1.12);
  }

  // Camera at time t from the keyframe list in timeline.js.
  function camera(t) {
    const K = TL.CAMERA;
    if (t <= K[0][0]) return VIEWS[K[0][1]];
    for (let i = 1; i < K.length; i++) {
      if (t <= K[i][0]) {
        const a = VIEWS[K[i - 1][1]], b = VIEWS[K[i][1]];
        const u = A.prog(t, K[i - 1][0], K[i][0], A.Ease[K[i][2]] || A.Ease.linear);
        const s = Math.exp(A.lerp(Math.log(a.s), Math.log(b.s), u));
        if (Math.abs(b.s - a.s) < 1e-9) return { cx: A.lerp(a.cx, b.cx, u), cy: A.lerp(a.cy, b.cy, u), s };
        // fixed point P: (P - a.c) * a.s == (P - b.c) * b.s
        const px = (b.cx * b.s - a.cx * a.s) / (b.s - a.s);
        const py = (b.cy * b.s - a.cy * a.s) / (b.s - a.s);
        return { cx: px - ((px - a.cx) * a.s) / s, cy: py - ((py - a.cy) * a.s) / s, s };
      }
    }
    return VIEWS[K[K.length - 1][1]];
  }

  const toScreen = (cam, x, y) => [(x - cam.cx) * cam.s + W / 2, (y - cam.cy) * cam.s + H / 2];

  function visible(cam, bbox, margin = 50) {
    const [x0, y0] = toScreen(cam, bbox[0], bbox[1]);
    const [x1, y1] = toScreen(cam, bbox[2], bbox[3]);
    return x1 > -margin && x0 < W + margin && y1 > -margin && y0 < H + margin;
  }

  // Trace shapes into the current path; `frac` < 1 draws each ring partially.
  function trace(ctx, cam, list, frac = 1) {
    for (const s of list) {
      if (!visible(cam, s.bbox)) continue;
      const lim = s.len * frac;
      const p = s.pts;
      let [x, y] = toScreen(cam, p[0][0], p[0][1]);
      ctx.moveTo(x, y);
      for (let i = 1; i < p.length; i++) {
        if (s.cum[i] > lim) {
          const u = (lim - s.cum[i - 1]) / (s.cum[i] - s.cum[i - 1] || 1);
          const [xa, ya] = toScreen(cam, A.lerp(p[i - 1][0], p[i][0], u), A.lerp(p[i - 1][1], p[i][1], u));
          ctx.lineTo(xa, ya);
          break;
        }
        [x, y] = toScreen(cam, p[i][0], p[i][1]);
        ctx.lineTo(x, y);
      }
      if (s.closed && frac >= 1) ctx.closePath();
    }
  }

  function strokeGlow(ctx, color, width, glow, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.18;
    ctx.strokeStyle = glow;
    ctx.lineWidth = width * 5;
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.35;
    ctx.lineWidth = width * 2.4;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }

  // Latitude/longitude grid with spacing chosen from the zoom level.
  function graticule(ctx, cam, alpha, rgb = "92,58,12", strength = 0.16) {
    if (alpha <= 0) return;
    const corners = [[0, 0], [W, 0], [0, H], [W, H], [W / 2, 0], [W / 2, H]].map(([sx, sy]) =>
      unproj((sx - W / 2) / cam.s + cam.cx, (sy - H / 2) / cam.s + cam.cy));
    const lon0 = Math.min(...corners.map((c) => c[0])) - 1, lon1 = Math.max(...corners.map((c) => c[0])) + 1;
    const lat0 = Math.min(...corners.map((c) => c[1])) - 1, lat1 = Math.max(...corners.map((c) => c[1])) + 1;
    const steps = [10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005];
    ctx.save();
    ctx.lineWidth = 1;
    for (const st of steps) {
      const px = st * 111 * cam.s; // screen spacing in px
      const a = alpha * A.smooth(A.clamp((px - 70) / 140)) * (1 - A.smooth(A.clamp((px - 700) / 900)));
      if (a <= 0.01) continue;
      ctx.strokeStyle = `rgba(${rgb},${(strength * a).toFixed(3)})`;
      ctx.beginPath();
      const segs = 48;
      for (let lo = Math.ceil(lon0 / st) * st; lo <= lon1; lo += st) {
        for (let i = 0; i <= segs; i++) {
          const la = lat0 + ((lat1 - lat0) * i) / segs;
          const [x, y] = toScreen(cam, ...proj(lo, la));
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
      }
      for (let la = Math.ceil(lat0 / st) * st; la <= lat1; la += st) {
        for (let i = 0; i <= segs; i++) {
          const lo = lon0 + ((lon1 - lon0) * i) / segs;
          const [x, y] = toScreen(cam, ...proj(lo, la));
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw into an offscreen layer, then keep it only where `mask` is opaque.
  let off = null;
  function maskedLayer(ctx, draw, mask) {
    if (!off) {
      off = document.createElement("canvas");
      off.width = W; off.height = H;
    }
    const o = off.getContext("2d");
    o.clearRect(0, 0, W, H);
    o.save();
    draw(o);
    o.restore();
    o.globalCompositeOperation = "destination-in";
    o.fillStyle = mask(o);
    o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }
  function radialLayer(ctx, cam, draw, centre, radius) {
    maskedLayer(ctx, draw, (o) => {
      const [cx, cy] = toScreen(cam, centre[0], centre[1]);
      const r = radius * cam.s;
      const g = o.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      return g;
    });
  }
  // Fades a layer out east of longitude `lon` (unknown internal border).
  function eastFadeLayer(ctx, cam, draw, lon) {
    if (!lon) return draw(ctx);
    maskedLayer(ctx, draw, (o) => {
      const [x0] = toScreen(cam, ...proj(lon - 0.16, G.placeLonLat[1]));
      const [x1] = toScreen(cam, ...proj(lon + 0.06, G.placeLonLat[1]));
      const g = o.createLinearGradient(x0, 0, Math.max(x1, x0 + 1), 0);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      return g;
    });
  }

  function pinPath(ctx, x, y, h) {
    // teardrop pin with its tip at (x, y)
    const r = h * 0.36;
    const cy = y - h + r;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - r * 0.35, y - h * 0.32, x - r, cy + r * 0.55, x - r, cy);
    ctx.arc(x, cy, r, Math.PI, 0);
    ctx.bezierCurveTo(x + r, cy + r * 0.55, x + r * 0.35, y - h * 0.32, x, y);
    ctx.closePath();
  }

  // Draw the whole map for time t. `st` carries per-element progress values.
  function draw(ctx, t, st) {
    ctx.clearRect(0, 0, W, H);
    if (st.mapAlpha <= 0) return null;
    const cam = camera(t);
    ctx.save();
    ctx.globalAlpha = st.mapAlpha;

    graticule(ctx, cam, st.gridAlpha);

    // Kazakhstan land with a soft cast shadow
    ctx.save();
    ctx.beginPath();
    trace(ctx, cam, G.kz);
    ctx.shadowColor = "rgba(60,32,0,0.45)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = `rgba(250,234,190,${(0.62 * st.kzFill).toFixed(3)})`;
    ctx.fill();
    ctx.restore();

    // lakes and rivers (Natural Earth): texture only, faded at close zoom
    const ne = st.kzFill * (1 - A.smooth(A.clamp((cam.s - 2.2) / 3)));
    if (ne > 0.01) {
      ctx.save();
      ctx.globalAlpha *= ne;
      ctx.beginPath();
      for (const l of G.lakes) trace(ctx, cam, l);
      ctx.fillStyle = "rgba(88,160,168,0.55)";
      ctx.fill();
      ctx.strokeStyle = "rgba(40,110,120,0.55)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      for (const r of G.rivers) trace(ctx, cam, r);
      ctx.strokeStyle = "rgba(48,128,140,0.45)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }

    // first-level regions: faint context lines
    if (st.regionAlpha > 0 && G.regions.length) {
      ctx.beginPath();
      for (const r of G.regions) trace(ctx, cam, r.rings);
      ctx.strokeStyle = `rgba(110,72,16,${(0.42 * st.regionAlpha).toFixed(3)})`;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    // country outline, drawn on
    if (st.kzLine > 0) {
      ctx.beginPath();
      trace(ctx, cam, G.kz, st.kzLine);
      ctx.strokeStyle = "#3f2606";
      ctx.lineWidth = 2.6;
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // Almaty oblast
    if (st.oblastFill > 0) {
      ctx.beginPath();
      trace(ctx, cam, G.oblast);
      trace(ctx, cam, G.oblastHoles);
      ctx.fillStyle = `rgba(22,160,184,${(0.78 * st.oblastFill).toFixed(3)})`;
      ctx.fill("evenodd");
    }
    if (st.oblastLine > 0) {
      ctx.beginPath();
      trace(ctx, cam, G.oblast, st.oblastLine);
      trace(ctx, cam, G.oblastHoles, st.oblastLine);
      ctx.lineJoin = "round";
      strokeGlow(ctx, "#fffaf0", 2.6, "#ffffff");
    }

    // Kegen district
    const mapAlpha = ctx.globalAlpha;
    eastFadeLayer(ctx, cam, (c) => {
    const ctx = c;
    ctx.globalAlpha = mapAlpha;
    if (st.districtFill > 0) {
      ctx.beginPath();
      trace(ctx, cam, G.district);
      ctx.fillStyle = `rgba(8,112,136,${(0.9 * st.districtFill).toFixed(3)})`;
      ctx.fill();
      // roads and rivers inside the district
      ctx.save();
      ctx.clip();
      ctx.globalAlpha *= st.districtFill;
      for (const [k, color, w] of [["river", "rgba(150,232,240,0.75)", 1.6], ["minor", "rgba(255,244,214,0.38)", 1.1], ["major", "rgba(255,244,214,0.7)", 2]]) {
        ctx.beginPath();
        for (const l of G.districtLines) if (l.k === k) trace(ctx, cam, [l.s]);
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.stroke();
      }
      ctx.restore();
    }
    if (st.districtLine > 0) {
      ctx.beginPath();
      trace(ctx, cam, G.district, st.districtLine);
      ctx.lineJoin = "round";
      strokeGlow(ctx, "#ffffff", 3, "#fff6dd");
    }
    }, (st.districtFill > 0 || st.districtLine > 0) ? G.fadeEast : null);

    // grid again on top of the highlighted regions, in cream
    graticule(ctx, cam, st.gridAlpha * Math.max(st.oblastFill, st.districtFill), "255,248,228", 0.2);

    // Kegen village: streets, buildings, outline
    if (st.streets > 0) {
      const lw = A.clamp(cam.s / 60, 0.6, 3.2);
      radialLayer(ctx, cam, (o) => {
        o.globalAlpha = st.streets;
        o.beginPath();
        for (const l of G.villageLines) if (l.k === "building") trace(o, cam, [l.s]);
        o.fillStyle = "rgba(255,246,222,0.42)";
        o.fill();
        for (const [k, color, w] of [["water", "rgba(150,232,240,0.85)", 1.2], ["street", "rgba(255,246,222,0.62)", 1], ["major", "rgba(255,240,200,0.95)", 2.2]]) {
          o.beginPath();
          for (const l of G.villageLines) if (l.k === k) trace(o, cam, [l.s]);
          o.strokeStyle = color;
          o.lineWidth = w * lw;
          o.lineCap = "round";
          o.lineJoin = "round";
          o.stroke();
        }
      }, G.place, 2.6);
    }
    if (st.villageFill > 0) {
      ctx.beginPath();
      trace(ctx, cam, G.village);
      ctx.fillStyle = `rgba(255,250,236,${(0.2 * st.villageFill).toFixed(3)})`;
      ctx.fill();
    }
    if (st.villageLine > 0) {
      ctx.beginPath();
      trace(ctx, cam, G.village, st.villageLine);
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      strokeGlow(ctx, "#ffffff", 3.4, "#fff3cf");
    }

    // pin with ripples
    const [px, py] = toScreen(cam, G.place[0], G.place[1]);
    if (st.villageRing > 0) {
      // marker ring around the settlement (used when no outline is available)
      const u = A.Ease.outCubic(A.clamp(st.villageRing));
      ctx.save();
      ctx.globalAlpha *= A.clamp(st.villageRing * 2);
      const r = 74 * (0.6 + 0.4 * u);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,250,236,0.16)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u);
      strokeGlow(ctx, "#ffffff", 3, "#fff3cf");
      ctx.setLineDash([4, 10]);
      ctx.lineDashOffset = t * 30;
      ctx.beginPath();
      ctx.arc(px, py, r + 18, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,250,236,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if (st.ripple > 0) {
      for (let i = 0; i < 3; i++) {
        const u = A.clamp(st.ripple * 1.4 - i * 0.22);
        if (u <= 0 || u >= 1) continue;
        ctx.beginPath();
        ctx.ellipse(px, py, 30 + 170 * A.Ease.outCubic(u), (30 + 170 * A.Ease.outCubic(u)) * 0.42, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,252,240,${(0.85 * (1 - u)).toFixed(3)})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
    if (st.pin > 0) {
      const drop = (1 - A.Ease.outBack(A.clamp(st.pin))) * -260;
      const h = 92;
      ctx.save();
      ctx.globalAlpha *= A.clamp(st.pin * 3);
      // shadow on the ground
      ctx.beginPath();
      ctx.ellipse(px, py, 20 * (0.5 + 0.5 * st.pin), 7 * (0.5 + 0.5 * st.pin), 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(20,10,0,0.35)";
      ctx.fill();
      ctx.translate(0, drop);
      pinPath(ctx, px, py, h);
      const g = ctx.createLinearGradient(px - 30, py - h, px + 30, py);
      g.addColorStop(0, "#fff1b8");
      g.addColorStop(0.45, "#e9b440");
      g.addColorStop(1, "#9a6510");
      ctx.fillStyle = g;
      ctx.shadowColor = "rgba(30,15,0,0.45)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "#4a2c05";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py - h + h * 0.36, h * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "#fffaf0";
      ctx.fill();
      ctx.restore();
    }

    // connector from the map to the photo card
    if (st.connector && st.connector.a > 0) {
      const c = st.connector;
      const [ax, ay] = toScreen(cam, c.world[0], c.world[1]);
      const u = A.Ease.outCubic(A.clamp(c.a));
      const bx = A.lerp(ax, c.to[0], u), by = A.lerp(ay, c.to[1], u);
      ctx.save();
      ctx.setLineDash([10, 9]);
      ctx.lineDashOffset = -t * 40;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = `rgba(255,248,230,${(0.9 * c.alpha).toFixed(3)})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(ax, ay, 7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,248,230,${c.alpha.toFixed(3)})`;
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
    return { cam, pin: [px, py] };
  }

  const anchor = (cam, w) => toScreen(cam, w[0], w[1]);

  return {
    init, draw, camera, anchor, proj,
    get geo() { return G; },
    views: VIEWS,
  };
})();

window.MapScene = MapScene;
