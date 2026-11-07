// Кадрларды headless Chromium-да рендерлеп, ffmpeg-ке жібереді.
//   node render.mjs                     -> output/video_only.mp4 (дыбыссыз)
//   node render.mjs --stills 2,8.4,10   -> output/stills/*.png (тексеруге арналған кадрлар)
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// require() also finds a globally installed Playwright (ESM import does not).
const { chromium } = createRequire(import.meta.url)("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "output");
mkdirSync(out, { recursive: true });

const args = process.argv.slice(2);
const stillsArg = args.includes("--stills") ? args[args.indexOf("--stills") + 1] : null;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", e => { console.error("page error:", e); process.exit(1); });
await page.goto(pathToFileURL(join(here, "intro.html")).href + "?render=1");
await page.waitForFunction(() => window.introReady === true, null, { timeout: 60000 });
const { fps, frames } = await page.evaluate(() => ({ fps: window.TIMELINE.fps, frames: window.frameCount }));

const grab = async (i) => Buffer.from((await page.evaluate(i => window.renderFrame(i), i)).split(",")[1], "base64");

if (stillsArg) {
  const dir = join(out, "stills");
  mkdirSync(dir, { recursive: true });
  for (const s of stillsArg.split(",").map(Number)) {
    const i = Math.round(s * fps);
    writeFileSync(join(dir, `t${s.toFixed(2)}.png`), await grab(i));
    console.log("still", s);
  }
} else {
  const target = join(out, "video_only.mp4");
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-tune", "film",
    "-profile:v", "high", "-level", "4.2",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    target,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", c => c === 0 ? res() : rej(new Error("ffmpeg " + c))));
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const png = await grab(i);
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once("drain", r));
    if (i % 24 === 0) process.stdout.write(`\rframe ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await done;
  console.log(`\nwrote ${target}`);
}
await browser.close();
