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
//     {"type": {"selector": "textarea", "text": "...", "cps": 22, "noclick": false}},
//     {"at": 6.5}   ← wait until 6.5 s after recording started (sync to narration)
//     {"waitFor": "css"}, {"mark": true}, {"since": 1.2}   ← timing relative to an event
//     (e.g. a page finishing loading; the log gives the mark's time for cutting)
//     {"upload": {"selector": "input[type=file]", "file": "assets/media/start-frame.jpg"}},
//     {"scroll": 400}, {"press": "Escape"}, {"shot": "name.png"},
//     {"dismiss": {"role": "button", "name": "Close promotion"}}, {"record": true} ] }] }
// Steps before {"record": true} are not recorded (if present; otherwise recording
// starts at the first goto/wait).
// Targets: {"text": "..."} | {"selector": "css"} | {"role": "button", "name": "..."} | {"x": 0, "y": 0}
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./server.mjs";
import { launch, newPage } from "./browser.mjs";

const argv = process.argv.slice(2);
const FPS = 30;

function locate(page, t) {
  if (t.selector) return page.locator(t.selector).first();
  if (t.role) return page.getByRole(t.role, { name: t.name, exact: !!t.exact }).first();
  if (t.text) return page.getByText(t.text, { exact: !!t.exact }).first();
  return null;
}

async function pointAt(page, t, state) {
  let x = t.x, y = t.y;
  if (x == null) {
    // no scrollIntoView: it waits for the element to be "stable", which stalls
    // while the page is busy rendering; targets are already on screen
    const b = await locate(page, t).boundingBox({ timeout: 5000 });
    x = b.x + b.width / 2; y = b.y + b.height / 2;
  }
  // eased glide, ~0.35–0.8 s depending on distance (each step is one round trip)
  const d = Math.hypot(x - state.x, y - state.y);
  const steps = Math.max(6, Math.min(16, Math.round(d / 45)));
  const t0 = Date.now(), dur = Math.min(800, 350 + d * 0.6);
  for (let i = 1; i <= steps; i++) {
    const p = i / steps, e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    await page.mouse.move(state.x + (x - state.x) * e, state.y + (y - state.y) * e);
    const wait = t0 + dur * p - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  }
  state.x = x; state.y = y;
}

async function inspect(url) {
  const browser = await launch();
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
  // frames go straight to disk (2× frames are large); only timestamps stay in memory
  const tmp = path.join(ROOT, "out/.cap", shot.id);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const ts = [];
  cdp.on("Page.screencastFrame", (f) => {
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    const i = ts.length;
    ts.push(f.metadata.timestamp);
    fs.writeFile(path.join(tmp, `${String(i).padStart(5, "0")}.jpg`), Buffer.from(f.data, "base64"), () => {});
  });
  const state = { x: cfg.viewport.width / 2, y: cfg.viewport.height / 2 };
  let started = false, recAt = 0, markAt = 0;
  const log = [];
  const start = async () => {
    if (started) return;
    started = true;
    recAt = Date.now();
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, everyNthFrame: 1,
      maxWidth: cfg.viewport.width * cfg.scale, maxHeight: cfg.viewport.height * cfg.scale });
  };
  const explicit = shot.steps.some((s) => s.record);
  for (const s of shot.steps) {
    if (started) log.push({ abs: Date.now() / 1000, step: Object.keys(s)[0], arg: JSON.stringify(Object.values(s)[0]).slice(0, 70) });
    if (s.goto) { await page.goto(s.goto, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {}); if (!explicit) await start(); }
    else if (s.record) await start();
    else if (s.at != null) { const w = recAt + s.at * 1000 - Date.now(); if (w > 0) await page.waitForTimeout(w); }
    else if (s.waitFor) await page.locator(s.waitFor).first().waitFor({ state: "visible", timeout: 60000 });
    else if (s.mark) markAt = Date.now();
    else if (s.since != null) { const w = markAt + s.since * 1000 - Date.now(); if (w > 0) await page.waitForTimeout(w); }
    else if (s.wait) { if (!explicit) await start(); await page.waitForTimeout(s.wait * 1000); }
    else if (s.press) await page.keyboard.press(s.press);
    else if (s.dismiss) { const b = locate(page, s.dismiss); if (await b.count()) await b.click().catch(() => {}); }
    else if (s.move) await pointAt(page, s.move, state);
    else if (s.hover) await pointAt(page, s.hover, state);
    else if (s.click) { await pointAt(page, s.click, state); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); }
    else if (s.type) {
      if (!s.type.noclick) {
        await pointAt(page, s.type, state);
        await page.mouse.click(state.x, state.y);
      }
      // time-driven typing: insert whatever should be visible by now, so the
      // on-screen speed is exactly `cps` regardless of round-trip overhead
      const text = s.type.text, cps = s.type.cps || 22, tStart = Date.now();
      let n = 0;
      while (n < text.length) {
        const want = Math.min(text.length, Math.floor(((Date.now() - tStart) / 1000) * cps) + 1);
        if (want > n) { await page.keyboard.insertText(text.slice(n, want)); n = want; }
        else await page.waitForTimeout(15);
      }
    } else if (s.upload) await locate(page, s.upload).setInputFiles(path.join(ROOT, s.upload.file));
    else if (s.scroll) await page.mouse.wheel(0, s.scroll);
    else if (s.shot) await page.screenshot({ path: path.join(ROOT, "out", s.shot) });
  }
  log.push({ abs: Date.now() / 1000, step: "end", arg: "" });
  await page.waitForTimeout(400);
  await cdp.send("Page.stopScreencast").catch(() => {});
  await new Promise((r) => setTimeout(r, 500)); // let pending frame writes finish
  await page.context().close();
  if (ts.length < 2) throw new Error(`${shot.id}: no frames recorded`);
  // variable-rate screencast → constant 30 fps video
  const lines = [];
  ts.forEach((t, i) => {
    const next = ts[i + 1] ?? t + 1 / FPS;
    lines.push(`file '${path.join(tmp, `${String(i).padStart(5, "0")}.jpg`)}'`, `duration ${Math.max(0.001, next - t).toFixed(4)}`);
  });
  lines.push(`file '${path.join(tmp, `${String(ts.length - 1).padStart(5, "0")}.jpg`)}'`);
  fs.writeFileSync(path.join(tmp, "list.txt"), lines.join("\n"));
  const out = path.join(ROOT, "assets/captures", `${shot.id}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "list.txt"),
    "-vf", `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`, "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  // step times relative to the first video frame, for syncing with the narration
  const steps = log.map(({ abs, step, arg }) => ({ t: Math.round((abs - ts[0]) * 100) / 100, step, arg }));
  fs.writeFileSync(path.join(ROOT, "capture", `${shot.id}.log.json`), JSON.stringify(steps, null, 1) + "\n");
  const gaps = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
  const p90 = gaps[Math.floor(gaps.length * 0.9)] || 0;
  console.log(`${shot.id}: ${ts.length} frames, ${(ts[ts.length - 1] - ts[0]).toFixed(1)}s, median gap ${(gaps[gaps.length >> 1] * 1000).toFixed(0)} ms, p90 ${(p90 * 1000).toFixed(0)} ms → ${path.relative(ROOT, out)}`);
}

if (argv[0] === "--inspect") {
  await inspect(argv[1]);
} else {
  const i = argv.indexOf("--shots");
  const file = i >= 0 ? argv.splice(i, 2)[1] : "capture/shots.json";
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  const browser = await launch(cfg.scale);
  for (const shot of cfg.shots.filter((s) => !argv.length || argv.includes(s.id))) await record(shot, browser, cfg);
  await browser.close();
}
