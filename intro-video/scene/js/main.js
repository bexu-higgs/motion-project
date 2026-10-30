// Composition for 0–10.5 s: everything is set from the time t in update(t),
// so a frame renders identically in preview and in the frame-by-frame render.
"use strict";

(async function () {
  const { clamp, lerp, Ease: E, prog, rng, css } = A;
  const { CUE, DURATION, MAP_IN } = TL;
  const W = 1920, H = 1080;
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------- data
  const getJSON = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(u))));
  const base = await getJSON("data/base-geo.json");
  const regions = await getJSON("data/osm-geo.json").catch(() => getJSON("data/region-geo.json"));
  MapScene.init(base, regions);
  const G = MapScene.geo;

  // ---------------------------------------------------------------- text setup
  function split(el, text, by) {
    el.textContent = "";
    return (by === "word" ? text.split(" ") : [...text]).map((piece, i, arr) => {
      const s = document.createElement("span");
      s.textContent = by === "word" && i < arr.length - 1 ? piece + " " : piece;
      el.appendChild(s);
      return s;
    });
  }
  const surnameChars = split($("surname"), "ОРАЛБЕКҚЫЗЫ");
  const captionWords = split($("caption"), "Кеген ауылында өмірге келдім", "word");

  const YEAR = [2, 0, 0, 4], SPINS = [1, 1, 2, 2];
  const reels = YEAR.map((d, i) => {
    const reel = document.createElement("div");
    reel.className = "reel";
    const strip = document.createElement("div");
    strip.className = "strip";
    const total = SPINS[i] * 10 + d;
    for (let k = 0; k <= total; k++) {
      const c = document.createElement("div");
      c.textContent = k % 10;
      strip.appendChild(c);
    }
    reel.appendChild(strip);
    $("year").appendChild(reel);
    return { reel, strip, total };
  });

  // coordinates of the village in Kazakh notation (с.е. = солтүстік ендік, ш.б. = шығыс бойлық)
  const dms = (v) => `${Math.floor(v)}°${String(Math.round((v % 1) * 60)).padStart(2, "0")}′`;
  $("coords").textContent = `${dms(G.placeLonLat[1])} с.е.  ${dms(G.placeLonLat[0])} ш.б.`;

  // ---------------------------------------------------------------- ornaments
  const ornStyle = { dark: "#5a370a", light: "#fff3c9", width: 2.4, darkOpacity: 0.55, lightOpacity: 0.55 };
  const rosette = Ornament.buildOrnament($("rosetteG"), Ornament.rosetteParts(), ornStyle);

  const frameSvg = $("frame");
  const frameLines = [];
  for (const d of ["M170 46 H1750", "M1874 170 V910", "M1750 1034 H170", "M46 910 V170"]) {
    const p = document.createElementNS(Ornament.SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("stroke", "#5a370a");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("fill", "none");
    p.setAttribute("opacity", "0.6");
    frameSvg.appendChild(p);
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len} ${len}`;
    frameLines.push({ el: p, len });
  }
  const corners = [];
  for (const tr of ["translate(46 46)", "translate(1874 46) scale(-1 1)", "translate(46 1034) scale(1 -1)", "translate(1874 1034) scale(-1 -1)"]) {
    const g = document.createElementNS(Ornament.SVG_NS, "g");
    g.setAttribute("transform", tr);
    frameSvg.appendChild(g);
    corners.push(...Ornament.buildOrnament(g, Ornament.cornerParts(), { ...ornStyle, width: 2.2 }));
  }

  // ---------------------------------------------------------------- canvases
  const bg = $("bg").getContext("2d");
  const mapCtx = $("map").getContext("2d");
  const fx = $("fx").getContext("2d");
  const grainCtx = $("grain").getContext("2d");
  const veil = $("veil").getContext("2d");

  function offscreen(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    return c;
  }
  // brushed-metal streaks for the gold
  const brush = offscreen(W, H, (c) => {
    const r = rng(7);
    for (let i = 0; i < 2600; i++) {
      const y = r() * H, x = r() * W - 200, len = 200 + r() * 900, a = r() * 0.08;
      c.strokeStyle = r() < 0.5 ? `rgba(255,248,220,${a})` : `rgba(90,52,4,${a})`;
      c.lineWidth = 0.6 + r() * 1.6;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + len, y - len * 0.08);
      c.stroke();
    }
  });
  const noise = offscreen(960, 540, (c, w, h) => {
    const img = c.createImageData(w, h);
    const r = rng(11);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (r() - 0.5) * 220;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  });
  const dot = offscreen(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,252,235,1)");
    g.addColorStop(0.25, "rgba(255,240,190,0.75)");
    g.addColorStop(1, "rgba(255,225,150,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });

  const pr = rng(2024);
  const dust = Array.from({ length: 120 }, () => ({
    x: pr() * W, y: pr() * H, vx: (pr() - 0.5) * 18, vy: 12 + pr() * 40,
    size: 0.8 + pr() * 3.2, ph: pr() * 6.28, tw: 1.5 + pr() * 4,
  }));
  const bokeh = Array.from({ length: 16 }, () => ({
    x: pr() * W, y: pr() * H, vx: (pr() - 0.5) * 14, vy: 4 + pr() * 10, r: 30 + pr() * 80, a: 0.05 + pr() * 0.1, ph: pr() * 6.28,
  }));

  // ---------------------------------------------------------------- background
  function sweep(c, x, alpha) {
    if (alpha <= 0) return;
    const g = c.createLinearGradient(x - 380, 0, x + 380, 0);
    g.addColorStop(0, "rgba(255,250,230,0)");
    g.addColorStop(0.5, `rgba(255,250,230,${alpha})`);
    g.addColorStop(1, "rgba(255,250,230,0)");
    c.save();
    c.globalCompositeOperation = "soft-light";
    c.setTransform(1, 0, -0.45, 1, 0, 0);
    c.fillStyle = g;
    c.fillRect(-W, 0, W * 3, H);
    c.restore();
  }

  function drawBackground(t) {
    const shift = Math.sin(t * 0.45) * 120;
    const g = bg.createLinearGradient(-300 + shift, -200, W + 300 + shift, H + 200);
    g.addColorStop(0, "#6e440c");
    g.addColorStop(0.22, "#b98326");
    g.addColorStop(0.42, "#f0cf7c");
    g.addColorStop(0.55, "#e2b453");
    g.addColorStop(0.78, "#a56f1f");
    g.addColorStop(1, "#5e3a09");
    bg.fillStyle = g;
    bg.fillRect(0, 0, W, H);

    const hx = 760 + Math.sin(t * 0.5) * 60, hy = 440 + Math.cos(t * 0.4) * 30;
    const rg = bg.createRadialGradient(hx, hy, 0, hx, hy, 980);
    rg.addColorStop(0, "rgba(255,246,214,0.62)");
    rg.addColorStop(0.5, "rgba(255,236,180,0.18)");
    rg.addColorStop(1, "rgba(255,236,180,0)");
    bg.fillStyle = rg;
    bg.fillRect(0, 0, W, H);

    bg.save();
    bg.globalCompositeOperation = "overlay";
    bg.globalAlpha = 0.55;
    bg.drawImage(brush, -40 + Math.sin(t * 0.3) * 30, 0);
    bg.restore();

    // light sweeps at the big moments
    sweep(bg, lerp(-500, W + 900, prog(t, 0.15, 1.6, E.inOutSine)), 0.75 * A.win(t, 0.15, 1.6, 0.3, 0.3));
    sweep(bg, lerp(-500, W + 900, prog(t, MAP_IN - 0.2, MAP_IN + 0.9, E.inOutSine)), 0.6 * A.win(t, MAP_IN - 0.2, MAP_IN + 0.9, 0.3, 0.3));
    sweep(bg, lerp(-500, W + 900, prog(t, CUE.born - 0.2, CUE.born + 1.2, E.inOutSine)), 0.5 * A.win(t, CUE.born - 0.2, CUE.born + 1.2, 0.3, 0.3));
  }

  // ---------------------------------------------------------------- sparkles
  function star(c, x, y, s, rot, a) {
    if (a <= 0 || s <= 0) return;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.globalAlpha = a;
    c.drawImage(dot, -s * 1.4, -s * 1.4, s * 2.8, s * 2.8);
    c.fillStyle = "#fffdf2";
    for (const [len, wid] of [[s * 2.6, s * 0.11], [s * 1.2, s * 0.08]]) {
      for (let k = 0; k < 2; k++) {
        c.beginPath();
        c.moveTo(-len, 0); c.lineTo(0, -wid); c.lineTo(len, 0); c.lineTo(0, wid);
        c.closePath();
        c.fill();
        c.rotate(Math.PI / 2);
      }
      c.rotate(Math.PI / 4);
    }
    c.restore();
  }
  function sparkleAt(c, t, t0, x, y, size, dur = 0.7) {
    const u = (t - t0) / dur;
    if (u <= 0 || u >= 1) return;
    star(c, x, y, size * Math.sin(Math.PI * u), u * 1.2, 1);
  }

  // ---------------------------------------------------------------- measurements
  await document.fonts.ready;
  await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
  const yearRight = 142 + $("year").getBoundingClientRect().width;
  css($("yearSuffix"), { left: `${yearRight + 14}px` });
  const labelSize = {};
  for (const id of ["labelOblast", "labelDistrict", "labelVillage"]) {
    labelSize[id] = [$(id).offsetWidth, $(id).offsetHeight];
  }
  const twoBox = $("monthLine").querySelector("b");

  function placeLabel(id, x, y, a, dx = 0, dy = -110) {
    const [w, h] = labelSize[id];
    const lx = clamp(x - w / 2 + dx, 40, W - 40 - w), ly = clamp(y + dy - h / 2, 40, H - 40 - h);
    const u = E.outBack(clamp(a));
    css($(id), {
      transform: `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) scale(${(0.7 + 0.3 * u).toFixed(3)})`,
      opacity: clamp(a * 1.6).toFixed(3),
      clipPath: `inset(0 ${((1 - clamp(a * 1.3)) * 100).toFixed(1)}% 0 0 round 40px)`,
    });
  }

  function card(id, tIn, tOut, fromRot, toRot) {
    const el = $(id);
    const u = prog(t_, tIn, tIn + 0.6, E.outBackSoft);
    const x = tOut ? prog(t_, tOut, tOut + 0.45, E.inCubic) : 0;
    const vis = prog(t_, tIn, tIn + 0.18) * (1 - x);
    css(el, {
      opacity: vis.toFixed(3),
      transform: `translate(${((1 - u) * 300 - x * 160).toFixed(1)}px, ${((1 - u) * 140 + x * 560).toFixed(1)}px) ` +
        `rotate(${(lerp(fromRot, toRot, u) - x * 16).toFixed(2)}deg) scale(${lerp(0.72, 1, u).toFixed(3)})`,
      display: vis > 0 ? "block" : "none",
    });
    css(el.querySelector(".flash"), { opacity: (0.85 * (1 - prog(t_, tIn + 0.12, tIn + 0.6, E.outCubic))).toFixed(3) });
    css(el.querySelector("img"), { transform: `scale(${(1.12 - 0.1 * prog(t_, tIn, tIn + 3, E.outSine)).toFixed(4)})` });
  }

  // ---------------------------------------------------------------- update
  let t_ = 0;
  function update(t) {
    t_ = t;
    drawBackground(t);

    // frame + rosette
    const frameIn = prog(t, 0.2, 1.3, E.inOutCubic);
    const frameDim = 1 - 0.55 * prog(t, MAP_IN - 0.2, MAP_IN + 0.5);
    for (const f of frameLines) css(f.el, { strokeDashoffset: (f.len * (1 - frameIn)).toFixed(1) });
    const cornerIn = prog(t, 0.3, 1.4, E.outCubic);
    for (const c of corners) css(c.el, { strokeDashoffset: (c.len * (1 - cornerIn)).toFixed(1), opacity: cornerIn > 0 ? "1" : "0" });
    css(frameSvg, { opacity: frameDim.toFixed(3) });

    for (const r of rosette) {
      const p = r.part;
      let u;
      if (p.group === "ring") u = prog(t, 0.1, 1.0, E.inOutCubic);
      else if (p.group === "horn") u = prog(t, 0.35 + p.k * 0.06, 1.15 + p.k * 0.06, E.outCubic);
      else if (p.group === "petal") u = prog(t, 0.6 + p.k * 0.04, 1.15 + p.k * 0.04, E.outCubic);
      else u = prog(t, 0.9 + p.k * 0.012, 1.1 + p.k * 0.012);
      // round caps would leave a dot on an empty dash, so hide untouched paths
      css(r.el, { strokeDashoffset: (r.len * (1 - u)).toFixed(1), opacity: p.group === "dot" ? u.toFixed(2) : u > 0 ? "1" : "0" });
    }
    const rx = prog(t, MAP_IN - 0.25, MAP_IN + 0.7, E.inCubic);
    css($("rosetteG"), {
      transform: `translate(1415px, 545px) rotate(${(6 + t * 5 + rx * 60).toFixed(2)}deg) scale(${(1.22 * (0.94 + 0.06 * prog(t, 0, 1.5, E.outCubic)) * (1 + rx * 1.8)).toFixed(4)})`,
      opacity: (1 - rx).toFixed(3),
    });

    // portrait
    const gin = prog(t, 0.28, 1.35, E.outExpo);
    const gout = prog(t, MAP_IN - 0.25, MAP_IN + 0.35, E.inCubic);
    const push = 0.025 * prog(t, 1.2, MAP_IN, E.linear);
    css($("girl"), {
      transform: `translate(${(gout * 340).toFixed(1)}px, ${((1 - gin) * 160).toFixed(1)}px) scale(${(1.07 - 0.07 * gin + push).toFixed(4)})`,
      opacity: (prog(t, 0.28, 0.8) * (1 - gout)).toFixed(3),
      filter: `blur(${(gout * 10 + (1 - prog(t, 0.28, 0.75)) * 8).toFixed(2)}px)`,
    });
    css($("girlGlow"), {
      opacity: (prog(t, 0.2, 1.0) * (1 - gout) * (0.85 + 0.15 * Math.sin(t * 2.2))).toFixed(3),
      transform: `scale(${(0.8 + 0.2 * prog(t, 0.2, 1.4, E.outCubic)).toFixed(3)})`,
    });

    // name: "Мен — Оралбекқызы Айназ"
    const nameOut = (d) => prog(t, CUE.year - 0.38 + d, CUE.year - 0.02 + d, E.inCubic);
    const fade = (u, o, dx = 0, dy = 0, blur = 8) => ({
      opacity: (u * (1 - o)).toFixed(3),
      transform: `translate(${(dx * (1 - u)).toFixed(1)}px, ${(dy * (1 - u) - o * 50).toFixed(1)}px)`,
      filter: `blur(${((1 - u) * blur + o * 8).toFixed(2)}px)`,
    });
    css($("men"), fade(prog(t, CUE.men - 0.12, CUE.men + 0.42, E.outCubic), nameOut(0), -50));
    surnameChars.forEach((s, i) => {
      const a = CUE.surname - 0.06 + i * 0.045;
      css(s, fade(prog(t, a, a + 0.5, E.outExpo), nameOut(0.04), 0, 40, 10));
    });
    const fn = prog(t, CUE.firstname - 0.18, CUE.firstname + 0.6, E.outQuart);
    const fnOut = nameOut(0.08);
    css($("firstname"), {
      clipPath: `inset(-20% ${((1 - fn) * 100).toFixed(2)}% -20% 0)`,
      transform: `translate(${(-30 * (1 - fn)).toFixed(1)}px, ${(-fnOut * 50).toFixed(1)}px)`,
      opacity: (1 - fnOut).toFixed(3),
      backgroundPosition: `${lerp(100, 0, prog(t, CUE.firstname + 0.15, CUE.firstname + 1.25, E.inOutSine)).toFixed(1)}% 0`,
    });
    const dv = prog(t, CUE.nameEnd - 0.35, CUE.nameEnd + 0.3, E.outCubic);
    const dvOut = nameOut(0.12);
    css($("divL"), { strokeDasharray: "270 270", strokeDashoffset: (-270 * (1 - dv)).toFixed(1) });
    css($("divR"), { strokeDasharray: "270 270", strokeDashoffset: (270 * (1 - dv)).toFixed(1) });
    css($("divD"), { transform: `scale(${E.outBack(prog(t, CUE.nameEnd - 0.25, CUE.nameEnd + 0.15)).toFixed(3)})`, transformOrigin: "300px 15px" });
    css($("divider"), { opacity: (1 - dvOut).toFixed(3) });

    // date: "2004-ші жылы, қыркүйектің 2-сі"
    const dateOut = prog(t, MAP_IN - 0.22, MAP_IN + 0.22, E.inCubic);
    const dOut = (u, d = 0) => ({ ...fade(u, 0), opacity: (u * (1 - prog(t, MAP_IN - 0.22 + d, MAP_IN + 0.22 + d, E.inCubic))).toFixed(3) });
    const dl = prog(t, CUE.year - 0.2, CUE.year + 0.4, E.outCubic);
    css($("dateLabel"), { ...dOut(dl), letterSpacing: `${lerp(0.9, 0.45, dl).toFixed(3)}em` });
    reels.forEach((r, i) => {
      const a = CUE.year - 0.12 + i * 0.05;
      const b = CUE.yearLand - 0.35 + i * 0.13;
      const pos = (tt) => prog(tt, a, b, E.outCubic) * r.total;
      const speed = Math.abs(pos(t) - pos(t - 1 / 30));
      css(r.strip, { transform: `translateY(${(-pos(t) * 250).toFixed(1)}px)`, filter: `blur(${Math.min(9, speed * 2.2).toFixed(2)}px)` });
      css(r.reel, { opacity: (prog(t, a, a + 0.2) * (1 - prog(t, MAP_IN - 0.22 + i * 0.03, MAP_IN + 0.15 + i * 0.03, E.inCubic))).toFixed(3) });
    });
    const ys = prog(t, CUE.yearLand + 0.02, CUE.yearLand + 0.45, E.outBack);
    css($("yearSuffix"), dOut(clamp(ys), 0.04));
    css($("monthLine"), dOut(prog(t, CUE.month - 0.12, CUE.month + 0.38, E.outCubic), 0.06));
    const two = prog(t, CUE.monthDay - 0.12, CUE.monthDay + 0.3);
    css(twoBox, { transform: `scale(${(0.3 + 0.7 * E.outBack(two)).toFixed(3)}) rotate(${(-18 * (1 - two)).toFixed(1)}deg)`, opacity: clamp(two * 2).toFixed(3) });
    css($("dateRule"), { transform: `scaleX(${prog(t, CUE.month, CUE.month + 0.7, E.outCubic).toFixed(3)})`, opacity: (1 - dateOut).toFixed(3) });

    // map
    const villageOutline = G.village.length > 0;
    const st = {
      mapAlpha: prog(t, MAP_IN - 0.05, MAP_IN + 0.45, E.outCubic),
      gridAlpha: prog(t, MAP_IN, MAP_IN + 0.6),
      kzFill: prog(t, MAP_IN, MAP_IN + 0.75, E.outCubic),
      kzLine: prog(t, MAP_IN - 0.05, MAP_IN + 0.85, E.inOutCubic),
      regionAlpha: prog(t, MAP_IN + 0.4, MAP_IN + 0.9),
      oblastFill: prog(t, CUE.oblast + 0.05, CUE.oblast + 0.45, E.outCubic) * (1 - 0.3 * prog(t, CUE.district, CUE.district + 0.6)),
      oblastLine: prog(t, CUE.oblast, CUE.oblast + 0.75, E.inOutCubic),
      districtFill: prog(t, CUE.district + 0.15, CUE.district + 0.55, E.outCubic),
      districtLine: prog(t, CUE.district + 0.02, CUE.district + 0.85, E.inOutCubic),
      streets: prog(t, CUE.village + 0.2, CUE.village + 0.9),
      villageFill: villageOutline ? prog(t, CUE.village + 0.4, CUE.village + 0.9) : 0,
      villageLine: villageOutline ? prog(t, CUE.village + 0.35, CUE.village + 1.0, E.inOutCubic) : 0,
      villageRing: villageOutline ? 0 : prog(t, CUE.village + 0.5, CUE.village + 1.1),
      pin: prog(t, CUE.village + 0.55, CUE.village + 1.0),
      ripple: prog(t, CUE.village + 0.95, CUE.village + 2.6),
      connector: null,
    };
    const cardTo = [1205, 460];
    if (t < CUE.village + 0.3) {
      st.connector = { world: G.districtC, to: cardTo, a: prog(t, CUE.district + 0.5, CUE.district + 0.9), alpha: 1 - prog(t, CUE.village - 0.1, CUE.village + 0.15) };
    } else {
      st.connector = { world: G.place, to: [1200, 470], a: prog(t, CUE.village + 0.85, CUE.village + 1.25), alpha: 1 };
    }
    const m = MapScene.draw(mapCtx, t, st);

    // labels follow the map
    if (m) {
      const [ox, oy] = MapScene.anchor(m.cam, G.oblastC);
      placeLabel("labelOblast", ox, oy, A.win(t, CUE.oblast + 0.15, CUE.district + 0.2, 0.4, 0.3, E.linear, E.linear), 0, -70);
      const [dx, dy] = MapScene.anchor(m.cam, G.districtC);
      placeLabel("labelDistrict", dx, dy, A.win(t, CUE.district + 0.3, CUE.village + 0.15, 0.4, 0.3, E.linear, E.linear), 0, -80);
      placeLabel("labelVillage", m.pin[0], m.pin[1], prog(t, CUE.village + 0.85, CUE.village + 1.25), 0, 120);
    } else {
      for (const id of ["labelOblast", "labelDistrict", "labelVillage"]) css($(id), { opacity: "0" });
    }

    // photo cards
    card("cardDistrict", CUE.district + 0.4, CUE.village - 0.05, 9, -3);
    card("cardVillage", CUE.village + 0.45, 0, -9, 2.5);

    // caption: "Кеген ауылында өмірге келдім"
    captionWords.forEach((w, i) => {
      const a = CUE.born - 0.3 + i * 0.14;
      css(w, fade(prog(t, a, a + 0.55, E.outCubic), 0, 0, 34, 10));
    });
    css($("captionRule"), { transform: `scaleX(${prog(t, CUE.born, CUE.born + 0.9, E.outCubic).toFixed(3)})` });

    // particles + sparkles
    fx.clearRect(0, 0, W, H);
    const dustA = 1 - 0.45 * prog(t, MAP_IN, MAP_IN + 0.6);
    for (const b of bokeh) {
      const x = ((b.x + b.vx * t + 30 * Math.sin(t * 0.5 + b.ph)) % (W + 200) + W + 200) % (W + 200) - 100;
      const y = ((b.y - b.vy * t) % (H + 200) + H + 200) % (H + 200) - 100;
      fx.globalAlpha = b.a * dustA * prog(t, 0.2, 1.2);
      fx.drawImage(dot, x - b.r, y - b.r, b.r * 2, b.r * 2);
    }
    for (const d of dust) {
      const x = ((d.x + d.vx * t + 24 * Math.sin(t * 0.8 + d.ph)) % (W + 40) + W + 40) % (W + 40) - 20;
      const y = ((d.y - d.vy * t) % (H + 40) + H + 40) % (H + 40) - 20;
      fx.globalAlpha = (0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * d.tw + d.ph))) * dustA * prog(t, 0.1, 0.9);
      const s = d.size * 5;
      fx.drawImage(dot, x - s / 2, y - s / 2, s, s);
    }
    fx.globalAlpha = 1;
    sparkleAt(fx, t, CUE.firstname + 0.35, 640, 470, 46);
    sparkleAt(fx, t, CUE.firstname + 0.55, 250, 600, 30);
    sparkleAt(fx, t, CUE.yearLand + 0.05, 760, 380, 44);
    const tb = twoBox.getBoundingClientRect();
    sparkleAt(fx, t, CUE.monthDay + 0.15, tb.left + tb.width * 0.8 - $("stage").getBoundingClientRect().left, tb.top + 20 - $("stage").getBoundingClientRect().top, 34);
    if (m) sparkleAt(fx, t, CUE.village + 0.95, m.pin[0] + 30, m.pin[1] - 80, 40);
    sparkleAt(fx, t, CUE.born + 0.75, 1080, 915, 40, 0.8);

    // grain
    const gr = rng(Math.floor(t * 30) + 1);
    grainCtx.clearRect(0, 0, W, H);
    grainCtx.drawImage(noise, -gr() * 300, -gr() * 200, 2400, 1350);

    // opening: dark veil opens from the centre with a warm ring of light
    veil.clearRect(0, 0, W, H);
    const open = prog(t, 0, 0.9, E.outCubic);
    if (open < 1) {
      const r = 40 + open * 1500;
      const vg = veil.createRadialGradient(1100, 520, r * 0.55, 1100, 520, r);
      vg.addColorStop(0, "rgba(18,9,1,0)");
      vg.addColorStop(0.82, "rgba(255,226,150,0.45)");
      vg.addColorStop(1, "rgba(18,9,1,1)");
      veil.globalAlpha = 1 - prog(t, 0.6, 0.9);
      veil.fillStyle = vg;
      veil.fillRect(0, 0, W, H);
      veil.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- render / preview hooks
  window.renderFrame = (t) => update(t);
  window.sceneDuration = DURATION;
  window.sceneReady = true;

  if (!/render/.test(location.search)) {
    document.body.classList.add("preview");
    const stage = $("stage");
    const fit = () => (stage.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H)})`);
    addEventListener("resize", fit);
    fit();
    const audio = new Audio("../.cache/build/intro-mix.wav");
    let t0 = null;
    const loop = (now) => {
      if (t0 === null) t0 = now;
      const t = ((now - t0) / 1000) % DURATION;
      update(t);
      requestAnimationFrame(loop);
    };
    addEventListener("click", () => { t0 = null; audio.currentTime = 0; audio.play().catch(() => {}); });
    requestAnimationFrame(loop);
  }
})();
