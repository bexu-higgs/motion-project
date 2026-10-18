// Records the real Higgsfield web interface for the lesson (needs network access
// to higgsfield.ai). Two modes:
//   node tools/capture.mjs --inspect <url>     screenshot + list of visible controls
//                                              (out/inspect/) to write steps from
//   node tools/capture.mjs [shot-id ...]       run capture/shots.json → assets/captures/<id>.mp4
//
// shots.json: { "viewport": {"width":1280,"height":720}, "scale": 1.5,
//   "shots": [{ "id": "02-video-section", "steps": [
//     {"goto": "https://higgsfield.ai/..."}, {"wait": 1.5},
//     {"move": {"text": "Video"}}, {"click": {"text": "Video"}},
//     {"type": {"selector": "textarea", "text": "...", "cps": 22}},
//     {"upload": {"selector": "input[type=file]", "file": "assets/media/start-frame.jpg"}},
//     {"scroll": 400}, {"shot": "name.png"} ] }] }
// Targets: {"text": "..."} | {"selector": "css"} | {"role": "button", "name": "..."} | {"x": 0, "y": 0}
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { ROOT } from "./server.mjs";

const argv = process.argv.slice(2);
const FPS = 30;

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!fs.existsSync(base)) return undefined;
  const dir = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  return dir ? path.join(base, dir, "chrome-linux", "chrome") : undefined;
}

// Visible pointer + click ripple (headless Chromium draws no cursor).
const CURSOR = () => {
  const install = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div");
    c.id = "__cur";
    c.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2l15 10-7 1.5L8.5 21z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: 2147483647, pointerEvents: "none", transform: "translate(-200px,-200px)", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))" });
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => (c.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 2}px)`), true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      Object.assign(r.style, { position: "fixed", left: `${e.clientX - 22}px`, top: `${e.clientY - 22}px`, width: "44px", height: "44px", borderRadius: "50%",
        border: "3px solid #22d3ee", zIndex: 2147483646, pointerEvents: "none", transition: "transform .45s ease-out, opacity .45s ease-out", transform: "scale(.3)", opacity: "1" });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.4)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
};

async function newPage(browser, vp, scale) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: scale, locale: "en-US" });
  await ctx.addInitScript(CURSOR);
  return ctx.newPage();
}

function locate(page, t) {
  if (t.selector) return page.locator(t.selector).first();
  if (t.role) return page.getByRole(t.role, { name: t.name, exact: !!t.exact }).first();
  if (t.text) return page.getByText(t.text, { exact: !!t.exact }).first();
  return null;
}

async function pointAt(page, t, state) {
  let x = t.x, y = t.y;
  if (x == null) {
    const loc = locate(page, t);
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    x = b.x + b.width / 2; y = b.y + b.height / 2;
  }
  const d = Math.hypot(x - state.x, y - state.y);
  await page.mouse.move(x, y, { steps: Math.max(12, Math.round(d / 18)) });
  state.x = x; state.y = y;
}

async function inspect(url) {
  const browser = await chromium.launch({ executablePath: chromePath() });
  const page = await newPage(browser, { width: 1280, height: 720 }, 1);
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => console.error(e.message));
  const dir = path.join(ROOT, "out/inspect");
  fs.mkdirSync(dir, { recursive: true });
  const name = new URL(url).pathname.replace(/[^\w]+/g, "_") || "root";
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
  const items = await page.evaluate(() =>
    [...document.querySelectorAll("a,button,input,textarea,select,[role=button],[role=tab],[role=option],[contenteditable=true]")]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { tag: e.tagName.toLowerCase(), role: e.getAttribute("role"), text: (e.innerText || e.value || e.placeholder || e.getAttribute("aria-label") || "").trim().slice(0, 80),
          href: e.getAttribute("href"), type: e.getAttribute("type"), box: [r.x, r.y, r.width, r.height].map(Math.round) };
      }));
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ url: page.url(), title: await page.title(), items }, null, 2));
  console.log(`saved out/inspect/${name}.png and .json (${items.length} controls)`);
  await browser.close();
}

async function record(shot, browser, cfg) {
  const page = await newPage(browser, cfg.viewport, cfg.scale);
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ data: f.data, ts: f.metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  const state = { x: cfg.viewport.width / 2, y: cfg.viewport.height / 2 };
  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
  };
  for (const s of shot.steps) {
    if (s.goto) { await page.goto(s.goto, { waitUntil: "networkidle", timeout: 60000 }); await start(); }
    else if (s.wait) { await start(); await page.waitForTimeout(s.wait * 1000); }
    else if (s.move) await pointAt(page, s.move, state);
    else if (s.hover) await pointAt(page, s.hover, state);
    else if (s.click) { await pointAt(page, s.click, state); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); }
    else if (s.type) {
      await pointAt(page, s.type, state);
      await page.mouse.click(state.x, state.y);
      await page.keyboard.type(s.type.text, { delay: 1000 / (s.type.cps || 22) });
    } else if (s.upload) await locate(page, s.upload).setInputFiles(path.join(ROOT, s.upload.file));
    else if (s.scroll) await page.mouse.wheel(0, s.scroll);
    else if (s.shot) await page.screenshot({ path: path.join(ROOT, "out", s.shot) });
  }
  await page.waitForTimeout(400);
  await cdp.send("Page.stopScreencast").catch(() => {});
  await page.context().close();
  if (frames.length < 2) throw new Error(`${shot.id}: no frames recorded`);
  // variable-rate screencast → constant 30 fps video
  const tmp = path.join(ROOT, "out/.cap", shot.id);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const lines = [];
  frames.forEach((f, i) => {
    const file = path.join(tmp, `${String(i).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    const next = frames[i + 1]?.ts ?? f.ts + 1 / FPS;
    lines.push(`file '${file}'`, `duration ${Math.max(0.001, next - f.ts).toFixed(4)}`);
  });
  lines.push(`file '${path.join(tmp, `${String(frames.length - 1).padStart(5, "0")}.jpg`)}'`);
  fs.writeFileSync(path.join(tmp, "list.txt"), lines.join("\n"));
  const out = path.join(ROOT, "assets/captures", `${shot.id}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "list.txt"),
    "-vf", `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`, "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${shot.id}: ${frames.length} frames → ${path.relative(ROOT, out)}`);
}

if (argv[0] === "--inspect") {
  await inspect(argv[1]);
} else {
  const i = argv.indexOf("--shots");
  const file = i >= 0 ? argv.splice(i, 2)[1] : "capture/shots.json";
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  const browser = await chromium.launch({ executablePath: chromePath() });
  for (const shot of cfg.shots.filter((s) => !argv.length || argv.includes(s.id))) await record(shot, browser, cfg);
  await browser.close();
}
