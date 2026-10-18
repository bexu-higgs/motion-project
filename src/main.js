import { E, clamp, lerp, prog, life, css, el } from "./engine.js";
import { estimateTiming } from "./timing.js";
import { SCENES } from "./scenes.js";

const RENDER = new URLSearchParams(location.search).has("render");
if (RENDER) document.body.classList.add("render");

async function json(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

const lesson = await json("/src/lesson.json");
const config = await json("/project.config.json");
const manifest = (await json("/build/manifest.json")) || { captures: {}, images: {} };
const timing = (await json("/build/timing.json")) || estimateTiming(lesson);
const DURATION = timing.duration;
await document.fonts.load('600 40px "InterK"');
await document.fonts.load('700 60px "InterKDisplay"');
await document.fonts.ready;

const stage = document.getElementById("stage");
const ctxBase = { lesson, config, manifest, timing, pending: [] };

// ---------------------------------------------------------------- background
const bg = el("div", "layer", stage);
bg.id = "bg";
const glowP = el("div", "glow p", bg);
const glowC = el("div", "glow c", bg);
el("div", "grid", bg);
el("div", "vignette", bg);
const grain = el("canvas", "grain", bg);
grain.width = 540; grain.height = 960;
{
  const g = grain.getContext("2d");
  const img = g.createImageData(540, 960);
  let seed = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = seed % 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grain.style.width = "1080px"; grain.style.height = "1920px";
}

// ---------------------------------------------------------------- scenes
const scenesRoot = el("div", "layer", stage);
const sceneDefs = lesson.scenes.map((s) => {
  const w = timing.scenes.find((x) => x.id === s.id);
  return { ...s, start: w.start, end: w.end };
});
const scenes = sceneDefs.map((sc, idx) => {
  const root = el("div", `layer scene scene-${sc.id}`, scenesRoot);
  const caps = timing.captions.filter((c) => c.scene === sc.id);
  const ctx = {
    ...ctxBase,
    dur: sc.end - sc.start,
    cue: (i) => (caps[i] ? caps[i].start - sc.start : 0),
    cueEnd: (i) => (caps[i] ? caps[i].end - sc.start : 0),
    // sound cues in scene time: {t, type, gain}
    sfx: [],
    slotSounds(slot, playAt) {
      for (const snd of slot.sounds()) {
        const tm = slot.playTime(snd.tc);
        if (tm == null) continue;
        const t = playAt + tm;
        if (t >= 0 && t <= sc.end - sc.start) this.sfx.push({ t, type: snd.type });
      }
    },
  };
  Object.defineProperty(ctx, "pending", { get: () => ctxBase.pending });
  const update = SCENES[sc.id](root, ctx, sc);
  return { sc, idx, root, update, ctx };
});

// every sound cue on the video timeline (read by tools/render.mjs --sfx)
window.SFX = [
  ...scenes.flatMap((s) => s.ctx.sfx.map((e) => ({ ...e, t: +(s.sc.start + e.t).toFixed(3) }))),
  ...sceneDefs.slice(1).map((s) => ({ t: +(s.start - 0.35).toFixed(3), type: "sweep" })),
].sort((a, b) => a.t - b.t);

// ---------------------------------------------------------------- HUD
const hud = el("div", "layer", stage);
hud.id = "hud";
const meta = el("div", "meta", hud, `<span class="step"></span><span class="num"></span>`);
const stepEl = meta.querySelector(".step"), numEl = meta.querySelector(".num");
const bars = el("div", "bars", hud);
const barFills = sceneDefs.map(() => el("i", "", el("div", "bar", bars)));

// ---------------------------------------------------------------- transitions + subtitles
const wipe = el("div", "wipe", stage);
const subs = el("div", "", stage);
subs.id = "subs";
const subLine = el("div", "line", subs);

const END_CARD_AT = DURATION - 3.8;

function update(t) {
  // background drift
  glowP.style.transform = `translate(${(-330 + 70 * Math.sin(t * 0.13)).toFixed(1)}px, ${(-360 + 50 * Math.cos(t * 0.11)).toFixed(1)}px)`;
  glowC.style.transform = `translate(${(420 + 60 * Math.sin(t * 0.09 + 1)).toFixed(1)}px, ${(1180 + 70 * Math.cos(t * 0.12)).toFixed(1)}px)`;
  bg.style.opacity = E.out3(prog(t, 0, 0.6)).toFixed(3);

  for (const s of scenes) {
    const { start, end } = s.sc;
    const first = s.idx === 0, last = s.idx === scenes.length - 1;
    if (t < start - 0.1 || t > end + 0.05) {
      s.root.style.display = "none";
      continue;
    }
    s.root.style.display = "";
    const a = first ? 1 : E.out3(prog(t, start - 0.05, 0.55));
    const b = last ? 0 : E.inOut3(prog(t, end - 0.45, 0.45));
    css(s.root, { o: a * (1 - b), y: 30 * (1 - a) - 30 * b, blur: 6 * (1 - a) + 6 * b });
    s.update(t - start);
  }

  // HUD: from scene 2 until the end card
  const cur = scenes.findLast((s) => t >= s.sc.start) || scenes[0];
  const hudO = life(t, sceneDefs[1].start - 0.2, END_CARD_AT - 0.4, 0.6, 0.5);
  hud.style.opacity = hudO.toFixed(3);
  hud.style.visibility = hudO > 0.001 ? "visible" : "hidden";
  stepEl.textContent = lesson.title;
  numEl.innerHTML = `<b>${String(cur.idx + 1).padStart(2, "0")}</b> / ${String(scenes.length).padStart(2, "0")}`;
  barFills.forEach((f, i) => {
    const sd = sceneDefs[i];
    f.style.width = `${(100 * clamp((t - sd.start) / (sd.end - sd.start))).toFixed(2)}%`;
  });

  // light sweep on scene changes
  let wo = 0, wy = -400;
  for (const s of sceneDefs.slice(1)) {
    const p = prog(t, s.start - 0.35, 0.8);
    if (p > 0 && p < 1) { wo = Math.sin(Math.PI * p) * 0.5; wy = lerp(-300, 2200, E.inOut3(p)); }
  }
  css(wipe, { o: wo, y: wy });

  // subtitles (latest caption whose window covers t)
  let cap = null, co = 0;
  for (const c of timing.captions) {
    const o = life(t, c.start - 0.1, c.end + 0.12, 0.18, 0.18);
    if (o > 0.001) { cap = c; co = o; }
  }
  if (cap && subLine.textContent !== cap.text) subLine.textContent = cap.text;
  css(subLine, { o: co, y: 10 * (1 - Math.min(1, co * 1.5)) });
}

window.seek = async (t) => {
  ctxBase.pending = [];
  update(t);
  await Promise.all(ctxBase.pending);
};
window.DURATION = DURATION;
window.FPS = lesson.fps;

// ---------------------------------------------------------------- preview player
if (!RENDER) {
  const fitStage = () => {
    const s = Math.min(innerWidth / 1080, (innerHeight - 52) / 1920);
    stage.style.transform = `scale(${s})`;
    stage.parentElement.style.width = `${1080 * s}px`;
    stage.parentElement.style.height = `${1920 * s}px`;
  };
  const wrap = document.createElement("div");
  stage.parentNode.insertBefore(wrap, stage);
  wrap.appendChild(stage);
  wrap.style.position = "relative";
  wrap.style.margin = "0 auto";
  fitStage();
  addEventListener("resize", fitStage);
  const bar = document.getElementById("controls");
  bar.innerHTML = `<button id="pp">▶</button><input id="sc" type="range" min="0" max="${DURATION}" step="0.0333" value="0"><span id="tc">0.00</span>`;
  const pp = bar.querySelector("#pp"), sc = bar.querySelector("#sc"), tc = bar.querySelector("#tc");
  const audio = manifest.audio ? new Audio("/" + manifest.audio) : null;
  let playing = false, t0 = 0, base = 0, t = Number(new URLSearchParams(location.search).get("t") || 0);
  const show = (x) => { t = clamp(x, 0, DURATION); sc.value = t; tc.textContent = t.toFixed(2); update(t); };
  sc.oninput = () => { show(Number(sc.value)); if (audio) audio.currentTime = t; };
  pp.onclick = () => {
    playing = !playing; pp.textContent = playing ? "❚❚" : "▶";
    base = t; t0 = performance.now();
    if (audio) { audio.currentTime = t; playing ? audio.play() : audio.pause(); }
  };
  const loop = () => {
    if (playing) show(base + (performance.now() - t0) / 1000);
    requestAnimationFrame(loop);
  };
  show(t);
  loop();
}
window.READY = true;
