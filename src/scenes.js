import { E, clamp, lerp, prog, life, css, enter, el, place, hexA, fit, ICON, Slot, PromptView, legendChip } from "./engine.js";

// Shared layout (1080×1920, Instagram/TikTok safe areas respected)
const TOP_SLOT = { x: 40, y: 390, w: 1000, h: 563 };
const CONTENT_Y = 985;
const VIOLET = "#A78BFA";
const CYAN = "#22D3EE";

function header(root, sc) {
  const k = el("div", "kicker", root, sc.kicker);
  const h = el("div", "heading", root, sc.heading);
  return (t, out = Infinity) => {
    enter(k, t, 0.05, { y: 18, blur: 4, out });
    enter(h, t, 0.15, { y: 28, out });
  };
}

function card(root, box, cls = "") {
  return place(el("div", `card ${cls}`, root), box);
}

function badge(icon, color, size = 64) {
  return `<div class="badge" style="width:${size}px;height:${size}px;color:${color};background:${hexA(color, 0.12)};border-color:${hexA(color, 0.35)}">${icon}</div>`;
}

// Glow/accent state for an "active" card
function activate(node, color, a) {
  node.style.borderColor = a > 0.01 ? hexA(color, 0.15 + 0.45 * a) : "";
  node.style.boxShadow = `0 30px 80px rgba(0,0,0,.35), 0 0 ${Math.round(70 * a)}px ${hexA(color, 0.28 * a)}, inset 0 1px 0 rgba(255,255,255,.06)`;
}

// Typing helper: chars typed at `cps` from `at`
const typed = (t, at, cps) => Math.max(0, (t - at) * cps);

// Official logo (from assets/brand) or a draft marker. Sized via width/height
// (never via transform) so the vector stays crisp; aspect ratio is always kept.
export function logoBlock(parent, ctx) {
  const m = ctx.manifest.images?.logo;
  const node = el("div", "logo", parent);
  let aspect = 3.2;
  if (m) {
    aspect = m.width / m.height;
    const img = el("img", "", node);
    img.src = "/" + m.src;
    ctx.pending.push(img.decode().catch(() => {}));
  } else {
    node.classList.add("logo-ph");
    el("div", "", node, `<b>Higgsfield ресми логотипі</b><span>${ctx.config.logo}</span>`);
  }
  return {
    node,
    set(cx, cy, box, o) {
      const { w, h } = fit(aspect, box);
      place(node, { x: cx - w / 2, y: cy - h / 2, w, h });
      node.style.opacity = o.toFixed(4);
      node.style.visibility = o > 0.001 ? "visible" : "hidden";
    },
  };
}

// ------------------------------------------------------------------ 01 intro
function intro(root, ctx, sc) {
  const L = ctx.lesson;
  const halo = el("div", "halo", root);
  const ring = el("div", "ring", root);
  const logo = logoBlock(root, ctx);
  const title = place(el("div", "intro-title", root), { x: 40, y: 660, w: 1000 });
  const lines = ["AI видео", "генерациялау"].map((txt) => {
    const mask = el("div", "mask", title);
    return el("div", "line", mask, txt);
  });
  const bar = place(el("div", "gbar", root), { x: 390, y: 948, w: 300, h: 6 });
  const sub = place(el("div", "intro-sub", root, L.subtitle), { x: 40, y: 986, w: 1000 });
  const plan = place(el("div", "plan", root), { x: 40, y: 1140, w: 1000 });
  const planLabel = el("div", "plan-label", plan, "Сабақ жоспары");
  const row = el("div", "plan-row", plan);
  const steps = ctx.lesson.scenes.slice(1).map((s) => s.step);
  const chips = steps.map((s, i) => el("div", "chip plan-chip", row, `<b>${String(i + 2).padStart(2, "0")}</b>${s}`));

  return (t) => {
    // logo: reveal big in the centre, then settle above the title
    const a = E.out3(prog(t, 0.35, 1.1));
    const m = E.inOut3(prog(t, 3.0, 1.1));
    const cy = lerp(820, 520, m);
    const bw = lerp(lerp(600, 640, a), 440, m);
    const bh = lerp(230, 160, m);
    logo.set(540, cy, { w: bw, h: bh }, a);
    logo.node.style.filter = a < 0.99 ? `blur(${(10 * (1 - a)).toFixed(2)}px)` : "none";
    css(halo, { o: 0.9 * a, y: cy - 820, s: lerp(0.7, 1, a) });
    const rp = prog(t, 0.6, 1.6);
    css(ring, { o: Math.sin(Math.PI * rp) * 0.7, y: cy - 820, s: lerp(0.4, 1.6, E.out3(rp)) });
    // title words rise from masks
    lines.forEach((ln, i) => {
      const p = E.out5(prog(t, 3.55 + i * 0.18, 0.9));
      ln.style.transform = `translateY(${(1 - p) * 110}%)`;
    });
    const bp = E.out3(prog(t, 4.4, 0.8));
    bar.style.transform = `scaleX(${bp})`;
    enter(sub, t, 4.6, { y: 24 });
    enter(planLabel, t, 5.6, { y: 16 });
    chips.forEach((c, i) => enter(c, t, 5.8 + i * 0.12, { y: 26, s: 0.94 }));
  };
}

// ------------------------------------------------------------------ 02 video section
function video(root, ctx, sc) {
  const hd = header(root, sc);
  const slot = new Slot(root, ctx, {
    id: "video-section", box: TOP_SLOT, tag: "Higgsfield · Video бөлімі",
    note: "Нақты интерфейс: Video бөлімін ашу және екі жолды көрсету",
  });
  const mk = (x, color, title, kk, desc, src) => {
    const c = card(root, { x, y: CONTENT_Y + 10, w: 486, h: 410 }, "wf");
    el("div", "wf-head", c, `${badge(src === "text" ? ICON.text : ICON.image, color)}<div><div class="wf-t">${title}</div><div class="wf-k">${kk}</div></div>`);
    const dia = el("div", "wf-dia", c);
    const srcBox = el("div", "wf-src", dia);
    if (src === "text") {
      srcBox.innerHTML = `<i></i><i></i><i></i>`;
    } else {
      srcBox.innerHTML = `<div class="wf-img">${ICON.image}</div><div class="wf-up">${ICON.upload}</div>`;
    }
    const arrow = el("div", "wf-arrow", dia, `<i></i>`);
    const film = el("div", "wf-film", dia, ICON.film);
    el("div", "wf-desc", c, desc);
    return { c, color, srcBox, arrow, film };
  };
  const A = mk(40, VIOLET, "Text-to-Video", "Мәтіннен видео", "Жазбаша сипаттамадан басталады", "text");
  const B = mk(554, CYAN, "Image-to-Video", "Суреттен видео", "Жүктелген суреттен басталады", "image");

  const runDiagram = (W, t, at) => {
    const k = prog(t, at, 1.6);
    if (W === A) {
      [...W.srcBox.children].forEach((ln, i) => {
        ln.style.transform = `scaleX(${E.out3(prog(t, at + i * 0.25, 0.6)) * [1, 0.85, 0.55][i]})`;
      });
    } else {
      const up = W.srcBox.querySelector(".wf-up");
      const p = E.out3(prog(t, at, 0.7));
      css(up, { o: 1 - prog(t, at + 0.7, 0.3), y: (1 - p) * 40 });
      css(W.srcBox.querySelector(".wf-img"), { o: lerp(0.25, 1, prog(t, at + 0.5, 0.4)) });
    }
    W.arrow.firstChild.style.transform = `scaleX(${E.inOut3(prog(t, at + 0.7, 0.6))})`;
    const f = E.outBack(prog(t, at + 1.1, 0.6));
    W.film.style.transform = `scale(${lerp(0.8, 1, f)})`;
    W.film.style.color = k >= 1 ? W.color : "";
    W.film.style.borderColor = hexA(W.color, 0.2 + 0.5 * f);
  };

  return (t) => {
    hd(t);
    enter(slot.el, t, 0.25, { y: 40, s: 0.97 });
    slot.update(t - 0.6);
    const cIn = ctx.cue(0) + 0.6;
    const aOn = ctx.cue(1), bOn = ctx.cue(2);
    [A, B].forEach((W, i) => {
      const o = enter(W.c, t, cIn + i * 0.15, { y: 40 });
      const act = E.out3(prog(t, i === 0 ? aOn : bOn, 0.5));
      W.c.style.opacity = (o * lerp(0.55, 1, act)).toFixed(3);
      activate(W.c, W.color, act);
      runDiagram(W, t, i === 0 ? aOn : bOn);
    });
  };
}

// ------------------------------------------------------------------ 03 text-to-video
function t2v(root, ctx, sc) {
  const hd = header(root, sc);
  const R = ctx.lesson.roles;
  const slot = new Slot(root, ctx, {
    id: "t2v-ui", box: TOP_SLOT, tag: "Higgsfield · Text-to-Video",
    note: "Нақты интерфейс: промпт өрісіне мысалды жазу, промпт толық болған соң генерацияны бастау",
  });
  const c = card(root, { x: 40, y: CONTENT_Y, w: 1000, h: 440 });
  const legend = place(el("div", "legend", c), { x: 28, y: 26 });
  const order = ["subject", "action", "setting", "mood", "camera"];
  const chips = Object.fromEntries(order.map((r) => [r, legendChip(legend, r, R)]));
  const label = place(el("div", "label abs", c, "Промпт мысалы"), { x: 30, y: 102 });
  const pwrap = place(el("div", "abs", c), { x: 30, y: 136, w: 940 });
  const pv = new PromptView(pwrap, ctx.lesson.prompts.t2v, R);
  pv.root.style.fontSize = "33px";
  const ready = place(el("div", "ready abs", c, `<span class="ok">${ICON.check}</span>Промпт толық — енді генерацияны бастаңыз`), { x: 28, y: 362 });
  const caveat = place(el("div", "caveat abs", root, "Нәтиже әр генерацияда өзгеше болуы мүмкін"), { x: 40, y: CONTENT_Y + 452, w: 1000 });
  const pip = new Slot(root, ctx, {
    id: "t2v-result", box: { x: 640, y: 640, w: 380, h: 290 }, tag: "Бір генерация нәтижесі",
    note: "Осы промпттан шыққан клип",
  });
  pip.el.classList.add("pip");
  const hlOrder = ["subject", "action", "setting", "camera", "mood"];

  return (t) => {
    hd(t);
    enter(slot.el, t, 0.25, { y: 40, s: 0.97 });
    slot.update(t - 0.6);
    enter(c, t, ctx.cue(0) + 0.2, { y: 40 });
    // legend chips appear while the narration lists the ingredients
    const l0 = ctx.cue(0) + 0.4, l1 = ctx.cueEnd(1);
    order.forEach((r, i) => enter(chips[r], t, l0 + ((l1 - l0) * i) / order.length, { y: 18, s: 0.9, blur: 4 }));
    // type the example, then highlight its parts one by one
    const typeAt = ctx.cue(2) + 0.2;
    const cps = 40;
    const typeEnd = typeAt + pv.total / cps;
    const hlAt = typeEnd + 0.4;
    const hl = {};
    hlOrder.forEach((r, i) => {
      const p = E.out3(prog(t, hlAt + i * 1.0, 0.45));
      hl[r] = p;
      const pulse = Math.sin(Math.PI * prog(t, hlAt + i * 1.0, 0.7));
      chips[r].style.boxShadow = pulse > 0 ? `0 0 ${30 * pulse}px ${hexA(R[r].color, 0.6 * pulse)}` : "";
      chips[r].style.borderColor = p > 0 ? hexA(R[r].color, 0.25 + 0.4 * p) : "";
    });
    const typing = t >= typeAt && t < typeEnd + 0.1;
    const blink = Math.floor(t * 2.2) % 2 === 0 ? 1 : 0;
    const readyAt = Math.min(hlAt + hlOrder.length * 1.0 + 0.2, ctx.dur - 4.2);
    enter(label, t, typeAt - 0.4, { y: 10, blur: 0 });
    pv.update({ chars: typed(t, typeAt, cps), hl, caret: t < typeAt - 0.2 ? 0 : typing ? 1 : t < readyAt ? blink : 0 });
    enter(ready, t, readyAt, { y: 14, s: 0.95 });
    enter(caveat, t, readyAt + 0.5, { y: 10 });
    enter(pip.el, t, readyAt + 1.0, { y: 30, s: 0.85 });
    pip.update(t - (readyAt + 1.2));
  };
}

// ------------------------------------------------------------------ 04 image-to-video
function i2v(root, ctx, sc) {
  const hd = header(root, sc);
  const R = ctx.lesson.roles;
  const slot = new Slot(root, ctx, {
    id: "i2v-ui", box: TOP_SLOT, tag: "Higgsfield · Image-to-Video",
    note: "Нақты интерфейс: суретті жүктеу, нұсқаулықты жазу, генерацияны бастау",
  });
  const tileBox = { x: 40, y: CONTENT_Y + 46, w: 330, h: 300 };
  const start = new Slot(root, ctx, { id: "startFrame", kind: "image", box: tileBox, tag: "Бастапқы кадр", note: "Адамның бір фотосы", aspect: 3 / 4 });
  const result = new Slot(root, ctx, { id: "i2v-result", box: tileBox, tag: "Нәтиже", note: "Осы суреттен шыққан клип", aspect: 3 / 4 });
  const upl = place(el("div", "upload-badge", root, ICON.upload), { x: tileBox.x + 125, y: tileBox.y + 110, w: 80, h: 80 });
  const scan = el("div", "scan", start.frame);
  const c = card(root, { x: 400, y: CONTENT_Y, w: 640, h: 346 });
  const label = place(el("div", "label abs", c, "Промпт"), { x: 28, y: 24 });
  const pwrap = place(el("div", "abs", c), { x: 28, y: 60, w: 590 });
  const pv = new PromptView(pwrap, ctx.lesson.prompts.i2v, R);
  pv.root.style.fontSize = "28.5px";
  pv.root.style.lineHeight = "1.42";
  const legend = place(el("div", "legend", root), { x: 40, y: CONTENT_Y + 364 });
  const roles = ["action", "camera", "preserve"];
  const chips = Object.fromEntries(roles.map((r) => [r, legendChip(legend, r, R)]));
  const rule = place(el("div", "rule", root,
    `<b>Бір кадр — бір әрекет</b><span class="yes">${ICON.check}1 әрекет</span><span class="no">${ICON.cross}бірнеше әрекет</span>`),
    { x: 40, y: CONTENT_Y + 360, w: 1000, h: 70 });

  return (t) => {
    hd(t);
    enter(slot.el, t, 0.25, { y: 40, s: 0.97 });
    slot.update(t - 0.6);
    // upload the start frame
    const u0 = ctx.cue(0) + 0.3;
    const tile = enter(start.el, t, u0, { y: 30, s: 0.95 });
    const up = E.out3(prog(t, u0, 0.6));
    css(upl, { o: up * (1 - prog(t, u0 + 1.0, 0.35)), y: (1 - up) * -50 });
    start.frame.querySelector(".media").style.opacity = prog(t, u0 + 0.8, 0.5).toFixed(3);
    const sp = prog(t, u0 + 0.8, 0.9);
    css(scan, { o: Math.sin(Math.PI * sp), y: lerp(-40, start.h, sp) });
    // the instruction
    enter(c, t, ctx.cue(0) + 0.6, { y: 40 });
    const typeAt = ctx.cue(1) + 0.2, cps = 42;
    const typeEnd = typeAt + pv.total / cps;
    const hlAt = typeEnd + 0.3;
    const hl = {};
    ["action", "camera", "preserve", "mood"].forEach((r, i) => {
      hl[r] = E.out3(prog(t, hlAt + i * 0.8, 0.4));
    });
    const blink = Math.floor(t * 2.2) % 2 === 0 ? 1 : 0;
    pv.update({ chars: typed(t, typeAt, cps), hl, caret: t < typeAt - 0.3 ? 0 : t < typeEnd ? 1 : blink * (1 - prog(t, hlAt + 3, 0.2)) });
    enter(label, t, typeAt - 0.4, { y: 10, blur: 0 });
    const ruleAt = Math.max(ctx.cue(3), hlAt + 2.6);
    roles.forEach((r, i) => enter(chips[r], t, hlAt + i * 0.8, { y: 16, s: 0.9, blur: 4, out: ruleAt - 0.2 }));
    enter(rule, t, ruleAt, { y: 24 });
    // starting frame → generated clip
    const resAt = Math.max(ctx.cueEnd(4) - 1.0, ruleAt + 1.5);
    const r = E.inOut3(prog(t, resAt, 0.7));
    start.el.style.opacity = (tile * (1 - r)).toFixed(3);
    css(result.el, { o: r * tile, s: lerp(0.96, 1, r) });
    result.update(t - resAt);
  };
}

// ------------------------------------------------------------------ 05 model
function model(root, ctx, sc) {
  const hd = header(root, sc);
  const slot = new Slot(root, ctx, {
    id: "model-picker", box: TOP_SLOT, tag: "Higgsfield · модельдер тізімі",
    note: "Нақты интерфейс: модель тізімін ашу, сипаттаманы қарау, бір модельді таңдау",
  });
  const c = card(root, { x: 40, y: CONTENT_Y, w: 1000, h: 440 });
  place(el("div", "card-title abs", c, `${badge(ICON.target, VIOLET, 48)}Таңдау принципі`), { x: 28, y: 24 });
  const rowsDef = [
    [ICON.target, "Міндет", "Суреттен анимация керек пе?"],
    [ICON.wave, "Қозғалыс", "Табиғи қозғалыс маңызды ма?"],
    [ICON.camera, "Камера", "Бағытты басқару керек пе?"],
    [ICON.input, "Кіріс пен баптау", "Сипаттамада бар ма?"],
  ];
  const rows = rowsDef.map(([ic, k, q], i) => {
    const r = place(el("div", "prow abs", c, `<span class="pi">${ic}</span><b>${k}</b><span class="pq">${q}</span><span class="pc">${ICON.check}</span>`), { x: 28, y: 96 + i * 66, w: 944 });
    return r;
  });
  const name = (ctx.config.model?.name || "").trim();
  const foot = place(el("div", "abs foot", c,
    `<div class="chip">${ICON.sparkle}<span>Бір негізгі модель → бүкіл сабақ</span></div>` +
    (name ? `<div class="chip model-name">${name}</div>` : "")), { x: 28, y: 368 });

  return (t) => {
    hd(t);
    enter(slot.el, t, 0.25, { y: 40, s: 0.97 });
    slot.update(t - 0.6);
    enter(c, t, ctx.cue(0) + 0.1, { y: 40 });
    const times = [ctx.cue(1), lerp(ctx.cue(1), ctx.cue(2), 0.55), ctx.cue(2), ctx.cue(3)];
    rows.forEach((r, i) => {
      enter(r, t, times[i], { x: -30, y: 0, blur: 4 });
      const k = E.outBack(prog(t, ctx.cue(4) + 0.2 + i * 0.35, 0.45));
      const pc = r.querySelector(".pc");
      pc.style.transform = `scale(${k})`;
      pc.style.opacity = clamp(k).toFixed(3);
    });
    enter(foot, t, ctx.cue(5), { y: 16 });
  };
}

// ------------------------------------------------------------------ 06 settings
function aspectOf(ratio) {
  const [w, h] = String(ratio).split(":").map(Number);
  if (!w || !h) return null;
  return w > h ? "h" : w < h ? "v" : "s";
}

function settings(root, ctx, sc) {
  const hd = header(root, sc);
  const S = ctx.config.settings || {};
  const slot = new Slot(root, ctx, {
    id: "settings-ui", box: TOP_SLOT, tag: "Higgsfield · баптаулар",
    note: "Нақты интерфейс: таңдалған модельдің ұзақтық, ажыратымдылық, кадр пішімі опциялары",
  });
  const vals = (arr) => (arr && arr.length ? `<div class="vals">${arr.map((v) => `<i>${v}</i>`).join("")}</div>` : "");
  const tiles = [
    [ICON.clock, "Ұзақтық", "Алғашқы сынаққа — қысқа клип", S.durations, VIOLET],
    [ICON.detail, "Ажыратымдылық", "Сурет детальдарына әсер етеді", S.resolutions, "#60A5FA"],
    [ICON.frame, "Кадр пішімі", "Кадрдың формасын анықтайды", S.aspectRatios, CYAN],
  ].map(([ic, t1, d, v, col], i) =>
    card(root, { x: 40 + i * 340, y: CONTENT_Y, w: 320, h: 200 }, "tile").appendChild(
      el("div", "tile-in", null, `<div class="tile-h"><span style="color:${col}">${ic}</span><b>${t1}</b></div><div class="tile-d">${d}</div>${vals(v)}`)
    ).parentNode);
  // phase A: test → like the motion → final quality
  const flow = place(el("div", "flow", root), { x: 40, y: CONTENT_Y + 230, w: 1000, h: 200 });
  const nodes = [
    ["Қысқа сынақ", ICON.clock],
    ["Қозғалыс ұнады ма?", ICON.check],
    ["Финал сапасы ↑", ICON.sparkle],
  ].map(([txt, ic], i) => {
    const n = place(el("div", "fnode abs", flow, `<span>${ic}</span>${txt}`), { x: i * 350, y: 52, w: 300, h: 96 });
    return n;
  });
  const arrows = [0, 1].map((i) => place(el("div", "farrow abs", flow, ICON.arrow), { x: 300 + i * 350 + 4, y: 78, w: 42, h: 42 }));
  // phase B: frame shapes (labels only for ratios the selected model offers)
  const listed = (S.aspectRatios || []).map((r) => [r, aspectOf(r)]).filter((x) => x[1]);
  const shapes = listed.length
    ? listed.map(([r, k]) => ({ k, label: { v: "Тік", h: "Көлденең", s: "Шаршы" }[k], ratio: r }))
    : [{ k: "v", label: "Тік" }, { k: "h", label: "Көлденең" }, { k: "s", label: "Шаршы" }];
  const dia = place(el("div", "aspects", root), { x: 40, y: CONTENT_Y + 222, w: 1000, h: 210 });
  const dims = { v: [86, 152], h: [196, 110], s: [132, 132] };
  const gap = 1000 / shapes.length;
  const shapeEls = shapes.map((s, i) => {
    const [w, h] = dims[s.k];
    const g = place(el("div", "ashape abs", dia), { x: i * gap + gap / 2 - 110, y: 0, w: 220, h: 210 });
    place(el("div", `abox abox-${s.k}`, g), { x: 110 - w / 2, y: 82 - h / 2, w, h });
    el("div", "alabel", g, s.ratio ? `${s.label} · ${s.ratio}` : s.label);
    return g;
  });

  return (t) => {
    hd(t);
    enter(slot.el, t, 0.25, { y: 40, s: 0.97 });
    slot.update(t - 0.6);
    const tAt = [ctx.cue(0) + 0.4, ctx.cue(0) + 1.6, ctx.cue(3)];
    tiles.forEach((n, i) => enter(n, t, tAt[i], { y: 36, s: 0.96 }));
    const bAt = ctx.cue(3) + 0.3;
    const nAt = [ctx.cue(1), ctx.cue(2), ctx.cue(2) + 1.4];
    nodes.forEach((n, i) => enter(n, t, nAt[i], { x: -24, y: 0, out: bAt - 0.3 }));
    arrows.forEach((a, i) => enter(a, t, nAt[i + 1] - 0.25, { x: -14, y: 0, blur: 0, out: bAt - 0.3 }));
    shapeEls.forEach((g, i) => enter(g, t, bAt + 0.2 + i * 0.25, { y: 30, s: 0.9 }));
  };
}

// ------------------------------------------------------------------ 07 action vs camera
function split(root, ctx, sc) {
  const hd = header(root, sc);
  const R = ctx.lesson.roles;
  const col = (x, color, title, en, kk) => {
    const c = card(root, { x, y: 400, w: 486, h: 500 }, "col");
    el("div", "col-h", c, `<i class="dot" style="background:${color};box-shadow:0 0 12px ${color}"></i>${title}`);
    const art = el("div", "col-art", c);
    const enEl = el("div", "col-en", c, `“${en}”`);
    const kkEl = el("div", "col-kk", c, kk);
    enEl.style.color = color;
    return { c, art, enEl, kkEl, color };
  };
  const A = col(40, VIOLET, "Кейіпкер әрекеті", "turns their head and smiles", "басын бұрып күлімсірейді");
  const B = col(554, CYAN, "Камера қозғалысы", "slowly pushes in", "баяу жақындайды");
  // subject art: a simple head that turns and smiles
  A.art.innerHTML = `<svg viewBox="0 0 240 200" class="head">
      <path class="shoulders" d="M50 196c6-44 34-62 70-62s64 18 70 62" />
      <g class="face"><circle cx="120" cy="82" r="50"/>
      <g class="feat"><circle class="eye" cx="102" cy="76" r="4.5"/><circle class="eye" cx="138" cy="76" r="4.5"/>
      <path class="mouth" d="M100 102 Q120 102 140 102"/></g></g></svg>`;
  // camera art: frame with corner brackets; the inner shot pushes in
  B.art.innerHTML = `<div class="cam"><div class="shot">${ICON.person}</div>
      <i class="br tl"></i><i class="br tr"></i><i class="br bl"></i><i class="br brr"></i></div>`;
  const comb = card(root, { x: 40, y: 940, w: 1000, h: 250 });
  place(el("div", "label abs", comb, "Бір анық промпт"), { x: 30, y: 26 });
  const pwrap = place(el("div", "abs", comb), { x: 30, y: 70, w: 940 });
  const pv = new PromptView(pwrap, ctx.lesson.prompts.combined, R);
  pv.root.style.fontSize = "40px";
  const note = place(el("div", "note", root, `<span>${ICON.camera}</span>Тек таңдалған модель қолдайтын камера басқаруын не промпт нұсқауын қолданыңыз`), { x: 40, y: 1214, w: 1000 });
  const feat = A.art.querySelector(".feat"), mouth = A.art.querySelector(".mouth"), face = A.art.querySelector(".face");
  const shot = B.art.querySelector(".shot"), brs = [...B.art.querySelectorAll(".br")];

  return (t) => {
    hd(t);
    const aOn = ctx.cue(1), bOn = ctx.cue(2);
    [A, B].forEach((W, i) => {
      const o = enter(W.c, t, ctx.cue(0) + 0.3 + i * 0.15, { y: 40 });
      const act = E.out3(prog(t, i ? bOn : aOn, 0.5));
      W.c.style.opacity = (o * lerp(0.5, 1, act)).toFixed(3);
      activate(W.c, W.color, act);
      enter(W.enEl, t, (i ? bOn : aOn) + 0.2, { y: 14, blur: 4 });
      enter(W.kkEl, t, (i ? bOn : aOn) + 0.45, { y: 14, blur: 4 });
    });
    // head turn (+ settle) then smile
    const turn = E.inOut3(prog(t, aOn + 0.4, 1.2));
    feat.setAttribute("transform", `translate(${lerp(-16, 6, turn)} 0)`);
    face.setAttribute("transform", `rotate(${lerp(-6, 3, turn)} 120 120)`);
    const sm = E.out3(prog(t, aOn + 1.6, 0.8));
    mouth.setAttribute("d", `M100 102 Q120 ${102 + 16 * sm} 140 102`);
    // push-in
    const pi = E.inOut3(prog(t, bOn + 0.4, 2.4));
    shot.style.transform = `scale(${lerp(1, 1.5, pi)})`;
    brs.forEach((b) => (b.style.transform = `scale(${lerp(1, 0.84, pi)})`));
    // combine both instructions into one prompt
    const cAt = Math.max(ctx.cueEnd(2) + 0.3, bOn + 2.2);
    enter(comb, t, cAt - 0.3, { y: 30 });
    const pa = E.out3(prog(t, cAt, 0.8)), pb = E.out3(prog(t, cAt + 0.5, 0.8));
    pv.update({ hl: { action: pa, camera: pb } });
    css(pv.segs[0].span, { o: pa, x: -50 * (1 - pa), y: 30 * (1 - pa), blur: 6 * (1 - pa) });
    css(pv.segs[1].span, { o: pb, x: 50 * (1 - pb), y: 30 * (1 - pb), blur: 6 * (1 - pb) });
    pv.segs.forEach((s) => (s.span.style.display = "inline-block"));
    enter(note, t, cAt + 1.6, { y: 20 });
  };
}

// ------------------------------------------------------------------ 08 review & regenerate
function review(root, ctx, sc) {
  const hd = header(root, sc);
  const v1 = new Slot(root, ctx, { id: "review-v1", box: TOP_SLOT, tag: "1-нұсқа · генерация нәтижесі", note: "Image-to-Video нәтижесі (1-нұсқа)" });
  const v2 = new Slot(root, ctx, { id: "review-v2", box: TOP_SLOT, tag: "2-нұсқа · бір өзгерістен кейін", note: "Бір өзгерістен кейінгі қайта генерация (2-нұсқа)" });
  const c = card(root, { x: 40, y: CONTENT_Y, w: 1000, h: 250 });
  const items = ["Кейіпкер пішіні сақталды ма?", "Қозғалыс үздіксіз бе?", "Камера командасы орындалды ма?"].map((txt, i) =>
    place(el("div", "crow abs", c, `<span class="cb">${ICON.check}</span>${txt}`), { x: 30, y: 26 + i * 70, w: 940 }));
  const d = card(root, { x: 40, y: CONTENT_Y + 270, w: 1000, h: 160 });
  place(el("div", "label abs", d, "Мысал · тек бір бөлікті өзгертіңіз"), { x: 30, y: 22 });
  const oldL = place(el("div", "diff old abs", d, "The camera makes a gentle push-in."), { x: 30, y: 62 });
  const newL = place(el("div", "diff new abs", d, "The camera slowly pushes in toward the face."), { x: 30, y: 104 });
  const same = place(el("div", "same abs", d, "Қалғаны — өзгеріссіз"), { x: 690, y: 22, w: 280 });
  const regen = place(el("div", "regen abs", root, `${ICON.refresh}`), { x: 960, y: 410, w: 60, h: 60 });

  return (t) => {
    hd(t);
    const regenAt = Math.min(ctx.cue(2) + 2.2, ctx.dur - 3.0);
    const sw = E.inOut3(prog(t, regenAt + 0.6, 0.6));
    const o1 = enter(v1.el, t, 0.25, { y: 40, s: 0.97 });
    v1.el.style.opacity = (o1 * (1 - sw)).toFixed(3);
    css(v2.el, { o: sw, s: lerp(0.97, 1, sw) });
    v1.update(t - 0.6);
    v2.update(t - (regenAt + 0.6));
    enter(c, t, ctx.cue(0) + 0.2, { y: 36 });
    const at = [ctx.cue(0) + 0.5, lerp(ctx.cue(0), ctx.cueEnd(0), 0.6), ctx.cue(1) + 0.4];
    items.forEach((n, i) => {
      enter(n, t, at[i], { x: -24, y: 0, blur: 4 });
      const k = E.outBack(prog(t, at[i] + 0.6, 0.45));
      const cb = n.querySelector(".cb");
      cb.style.background = hexA(CYAN, 0.18 * clamp(k));
      cb.style.borderColor = hexA(CYAN, 0.3 + 0.6 * clamp(k));
      cb.firstChild.style.transform = `scale(${k})`;
    });
    enter(d, t, ctx.cue(2), { y: 30 });
    const st = E.out3(prog(t, ctx.cue(2) + 0.7, 0.5));
    oldL.style.setProperty("--strike", st.toFixed(3));
    oldL.style.opacity = lerp(1, 0.5, st).toFixed(3);
    enter(newL, t, ctx.cue(2) + 1.1, { x: -20, y: 0, blur: 4 });
    enter(same, t, ctx.cue(2) + 1.5, { y: 0, blur: 0 });
    const rg = life(t, regenAt, regenAt + 1.6, 0.3, 0.4);
    css(regen, { o: rg, rot: 360 * E.inOut3(prog(t, regenAt, 1.2)), s: lerp(0.6, 1, rg) });
  };
}

// ------------------------------------------------------------------ 09 practice + outro
function practice(root, ctx, sc) {
  const hd = header(root, sc);
  const L = ctx.lesson;
  const list = card(root, { x: 40, y: 400, w: 1000, h: 540 });
  place(el("div", "label abs", list, "Тапсырма"), { x: 34, y: 28 });
  const rows = L.checklist.map((txt, i) =>
    place(el("div", "task abs", list, `<span class="num"><b>${i + 1}</b><i>${ICON.check}</i></span>${txt}`), { x: 34, y: 76 + i * 112, w: 932 }));
  const cmp = place(el("div", "cmp", root), { x: 40, y: 990, w: 1000, h: 440 });
  const cmpLabel = place(el("div", "label abs", cmp, "Нұсқаларды салыстырыңыз"), { x: 0, y: 0 });
  const ids = [["review-v1", "1"], ["review-v2", "2"], ["final-clip", "3"]];
  const tiles = ids.map(([id, n], i) => {
    const s = new Slot(cmp, ctx, { id, box: { x: i * 345, y: 70, w: 310, h: 310 }, align: "top", tag: `${n}-нұсқа`, note: "Генерация нұсқасы" });
    return s;
  });
  const best = place(el("div", "best abs", cmp, `${ICON.check}Ең сәттісі`), { x: 2 * 345, y: 394, w: 310 });
  const finalSlot = new Slot(root, ctx, { id: "final-clip", box: { x: 40, y: 400, w: 1000, h: 1040 }, tag: "Дайын кинематографиялық видео", note: "Практика нәтижесі: дайын клип" });
  const endLogo = logoBlock(root, ctx);
  const endCap = place(el("div", "end-cap", root, L.endCaption), { x: 40, y: 1010, w: 1000 });
  const endBar = place(el("div", "gbar", root), { x: 420, y: 1120, w: 240, h: 6 });

  return (t) => {
    const finalAt = Math.max(ctx.cueEnd(2) + 0.4, 11.5);
    const endAt = ctx.dur - 3.8;
    // header + checklist
    hd(t, endAt - 0.3);
    enter(list, t, 0.3, { y: 40, out: finalAt - 0.2 });
    const tick = [ctx.cue(0) + 1.2, ctx.cue(1) + 0.2, ctx.cue(1) + 1.6, ctx.cue(1) + 3.0];
    rows.forEach((r, i) => {
      enter(r, t, 0.5 + i * 0.15, { x: -24, y: 0, blur: 4 });
      const k = E.outBack(prog(t, tick[i], 0.5));
      const num = r.querySelector(".num");
      num.querySelector("b").style.opacity = (1 - clamp(k)).toFixed(3);
      num.querySelector("i").style.transform = `scale(${k})`;
      num.classList.toggle("done", k > 0.5);
      r.style.color = k > 0.5 ? "#fff" : "";
    });
    // compare variants
    const cAt = ctx.cue(2);
    enter(cmpLabel, t, cAt - 0.2, { y: 14, out: finalAt - 0.2 });
    tiles.forEach((s, i) => {
      enter(s.el, t, cAt + i * 0.15, { y: 30, s: 0.94, out: finalAt - 0.2 });
      s.update(t - cAt);
    });
    const bp = E.out3(prog(t, cAt + 1.6, 0.4));
    tiles[2].frame.style.boxShadow = bp > 0 ? `0 0 0 ${4 * bp}px ${CYAN}, 0 0 ${50 * bp}px ${hexA(CYAN, 0.5 * bp)}` : "";
    enter(best, t, cAt + 1.8, { y: 10, out: finalAt - 0.2 });
    // the finished clip
    enter(finalSlot.el, t, finalAt, { y: 40, s: 0.96, out: endAt - 0.2, outDur: 0.5 });
    finalSlot.update(t - finalAt);
    // end card
    const e = E.out3(prog(t, endAt + 0.2, 1.0));
    endLogo.set(540, 820, { w: lerp(500, 560, e), h: 200 }, e);
    endLogo.node.style.filter = e < 0.99 ? `blur(${(8 * (1 - e)).toFixed(2)}px)` : "none";
    enter(endCap, t, endAt + 0.8, { y: 26 });
    endBar.style.transform = `scaleX(${E.out3(prog(t, endAt + 1.2, 0.8))})`;
  };
}

export const SCENES = { intro, video, t2v, i2v, model, settings, split, review, practice };
