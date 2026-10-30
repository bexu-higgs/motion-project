// Frame-by-frame render of scene/index.html with headless Chromium, then
// encode with ffmpeg and mux the audio mix.
//
//   node tools/render.mjs [--out out/intro-0-10s.mp4] [--from 0] [--to 10.5]
//                         [--workers 3] [--audio .cache/build/intro-mix.wav]
//   node tools/render.mjs --still 2.0,5.9   # PNG stills for review
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const FPS = 30;
const OUT = path.resolve(ROOT, args.out || "out/intro-0-10s.mp4");
const AUDIO = path.resolve(ROOT, args.audio || ".cache/build/intro-mix.wav");
const WORKERS = +(args.workers || 3);
const FRAMES_DIR = path.resolve(ROOT, "out/frames");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".ttf": "font/ttf", ".wav": "audio/wav", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const URL = `http://127.0.0.1:${server.address().port}/scene/index.html?render`;

const browser = await chromium.launch({ args: ["--disable-gpu", "--font-render-hinting=none"] });
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 60000 });
  return page;
}

if (args.still) {
  fs.mkdirSync(path.resolve(ROOT, "out/stills"), { recursive: true });
  const page = await openPage();
  for (const t of args.still.split(",").map(Number)) {
    await page.evaluate((tt) => window.renderFrame(tt), t);
    const f = path.resolve(ROOT, `out/stills/t${t.toFixed(2)}.png`);
    await page.screenshot({ path: f });
    console.log(f);
  }
} else {
  const dur = await (await openPage()).evaluate(() => window.sceneDuration);
  const from = +(args.from || 0), to = +(args.to || dur);
  const first = Math.round(from * FPS), last = Math.round(to * FPS);
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const t0 = Date.now();
  let done = 0;
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const page = await openPage();
    for (let f = first + w; f < last; f += WORKERS) {
      await page.evaluate((tt) => window.renderFrame(tt), f / FPS);
      await page.screenshot({ path: path.join(FRAMES_DIR, `f${String(f - first).padStart(5, "0")}.jpg`), type: "jpeg", quality: 95 });
      if (++done % 30 === 0) console.log(`${done}/${last - first} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const ff = ["-y", "-framerate", String(FPS), "-i", path.join(FRAMES_DIR, "f%05d.jpg")];
  if (fs.existsSync(AUDIO)) ff.push("-ss", String(from), "-t", String(to - from), "-i", AUDIO);
  ff.push("-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
  if (fs.existsSync(AUDIO)) ff.push("-c:a", "aac", "-b:a", "256k", "-shortest");
  ff.push(OUT);
  const r = spawnSync("ffmpeg", ff, { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) process.exitCode = 1;
  else console.log(`wrote ${OUT} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
server.close();
