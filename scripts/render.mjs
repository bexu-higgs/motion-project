// Renders every frame in parallel headless Chromium workers and encodes
// video segments with ffmpeg. Usage: node scripts/render.mjs [--workers 4] [--from s] [--to s] [--out build/video.mp4]
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { serve } from './server.mjs';
import { launch } from './browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((a) => a.trim().split(/\s+/)));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const buildDir = path.join(root, 'build');
fs.mkdirSync(buildDir, { recursive: true });
const WORKERS = +(args.workers || 4);
const out = path.resolve(root, args.out || 'build/video.mp4');

const { server, url } = await serve(root);

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(url + '/src/index.html');
  await page.waitForFunction(() => window.READY || window.INIT_ERROR, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.INIT_ERROR);
  if (err) throw new Error(err);
  return page;
}

// probe duration + cues
const probeBrowser = await launch();
const probe = await openPage(probeBrowser);
const { DURATION, FPS, CUES } = await probe.evaluate(() => ({ DURATION: window.DURATION, FPS: window.FPS, CUES: window.CUES }));
fs.writeFileSync(path.join(buildDir, 'cues.json'), JSON.stringify({ duration: DURATION, fps: FPS, cues: CUES }, null, 1));
await probeBrowser.close();

const f0 = Math.round((+(args.from || 0)) * FPS);
const f1 = Math.round((+(args.to || DURATION)) * FPS);
const total = f1 - f0;
const per = Math.ceil(total / WORKERS);
console.log(`rendering frames ${f0}..${f1} (${total}) with ${WORKERS} workers`);
const t0 = Date.now();
let done = 0;

async function worker(i) {
  const a = f0 + i * per, b = Math.min(f1, a + per);
  if (a >= b) return null;
  const seg = path.join(buildDir, `seg_${String(i).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-threads', '2', '-x264-params', 'keyint=60:min-keyint=60', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const finished = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  const browser = await launch();
  const page = await openPage(browser);
  const cdp = await page.context().newCDPSession(page);
  for (let f = a; f < b; f++) {
    await page.evaluate((t) => window.renderFrame(t), f / FPS);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
    const buf = Buffer.from(data, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
    if (done % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${done}/${total} frames, ${(done / el).toFixed(1)} fps, eta ${((total - done) / (done / el)).toFixed(0)}s`);
    }
  }
  ff.stdin.end();
  await finished;
  await browser.close();
  return seg;
}

const segs = (await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)))).filter(Boolean);
const list = path.join(buildDir, 'segments.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
await new Promise((res, rej) => {
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' });
  p.on('close', (c) => (c === 0 ? res() : rej(new Error('concat failed'))));
});
for (const s of segs) fs.unlinkSync(s);
server.close();
console.log(`video → ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
