// Frame-accurate renderer: seeks the composition to every frame, screenshots it
// and pipes the frames into ffmpeg. Usage:
//   node tools/render.mjs                      full video → out/higgsfield-ai-video-kk.mp4
//   node tools/render.mjs --stills 3,27,60     PNG stills → out/stills/
//   node tools/render.mjs --from 25 --to 50    render a range (preview)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { serve, ROOT } from "./server.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") ? true : all[i + 1] ?? true]] : acc), [])
);
const W = 1080, H = 1920;
const outDir = path.join(ROOT, "out");
fs.mkdirSync(outDir, { recursive: true });

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (fs.existsSync(base)) {
    const dir = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
    if (dir) return path.join(base, dir, "chrome-linux", "chrome");
  }
  return undefined; // let playwright find its own
}

const server = await serve(0);
const url = `http://127.0.0.1:${server.address().port}/src/index.html?render=1`;
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--force-color-profile=srgb", "--font-render-hinting=none"] });

async function openPage() {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  const cdp = await page.context().newCDPSession(page);
  const shot = async () => Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true })).data, "base64");
  return { page, shot };
}

const probe = await openPage();
const duration = Number(args.to ?? (await probe.page.evaluate(() => window.DURATION)));
const fps = await probe.page.evaluate(() => window.FPS);

if (args.stills) {
  fs.mkdirSync(path.join(outDir, "stills"), { recursive: true });
  for (const t of String(args.stills).split(",").map(Number)) {
    await probe.page.evaluate((x) => window.seek(x), t);
    const f = path.join(outDir, "stills", `t${t.toFixed(2).padStart(6, "0")}.png`);
    fs.writeFileSync(f, await probe.shot());
    console.log(f);
  }
  await browser.close();
  server.close();
  process.exit(0);
}
await probe.page.close();

const from = Number(args.from ?? 0);
const total = Math.round((duration - from) * fps);
const workers = Number(args.workers ?? Math.max(1, Math.min(4, os.cpus().length)));
const per = Math.ceil(total / workers);
const tmp = path.join(outDir, ".chunks");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
const started = Date.now();
let done = 0;

async function renderChunk(k) {
  const a = k * per, b = Math.min(total, a + per);
  if (a >= b) return null;
  const { page, shot } = await openPage();
  const file = path.join(tmp, `c${String(k).padStart(2, "0")}.mp4`);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", "-r", String(fps), file], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = a; i < b; i++) {
    await page.evaluate((x) => window.seek(x), from + i / fps);
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    done++;
    if (done % 150 === 0) {
      const el = (Date.now() - started) / 1000;
      console.log(`${done}/${total} frames · ${(done / el).toFixed(1)} fps · eta ${Math.round((total - done) / (done / el))}s`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await page.close();
  return file;
}

const chunks = (await Promise.all([...Array(workers).keys()].map(renderChunk))).filter(Boolean);
await browser.close();
server.close();

const list = path.join(tmp, "list.txt");
fs.writeFileSync(list, chunks.map((c) => `file '${c}'`).join("\n"));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "build/manifest.json"), "utf8"));
const out = path.join(outDir, args.out || "higgsfield-ai-video-kk.mp4");
const ff = ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list];
if (manifest.audio && !args.from) {
  // the user's Kazakh voice-over is the only audio track
  ff.push("-i", path.join(ROOT, manifest.audio), "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-af", "apad", "-shortest");
}
ff.push("-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", out);
execFileSync("ffmpeg", ff, { stdio: "inherit" });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`done in ${Math.round((Date.now() - started) / 1000)}s → ${out}`);
