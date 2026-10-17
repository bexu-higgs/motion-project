#!/usr/bin/env node
// Renders src/index.html frame by frame in headless Chromium and encodes with ffmpeg.
//
//   node tools/render.mjs                    full video → build/video.mp4 (+ build/cues.json)
//   node tools/render.mjs --cues             only export the audio cue sheet
//   node tools/render.mjs --from 40 --to 55  render a section
//   node tools/render.mjs --stills 5,30,110  PNG stills into build/stills/
//   node tools/render.mjs --storyboard       captioned beat sheet → docs/storyboard.jpg
//
// Options: --fps 30, --workers 4, --crf 16, --out build/video.mp4
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(p);
    } catch {}
  }
  throw new Error('Playwright not found: npm i -D playwright');
})();

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] ?? true : def;
};
const FPS = +opt('fps', 30);
const WORKERS = +opt('workers', Math.min(4, os.cpus().length));
const CRF = opt('crf', '16');
const OUT = path.resolve(ROOT, opt('out', 'build/video.mp4'));
const BUILD = path.join(ROOT, 'build');
fs.mkdirSync(BUILD, { recursive: true });

const launch = () =>
  chromium.launch({
    args: ['--disable-gpu-vsync', '--force-color-profile=srgb'],
  });

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto('file://' + path.join(ROOT, 'src', 'index.html') + '?render');
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  return page;
}
const grab = (page, t) =>
  page.evaluate((t) => {
    window.renderAt(t);
    return document.getElementById('c').toDataURL('image/png').slice(22);
  }, t);

function ffmpeg(argv) {
  const p = spawn('ffmpeg', argv, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => (err += d));
  p.done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg failed\n' + err.slice(-2000))))));
  return p;
}
const write = (stream, buf) => new Promise((res) => (stream.write(buf) ? res() : stream.once('drain', res)));

(async () => {
  const browser = await launch();
  const first = await openPage(browser);
  const cues = await first.evaluate(() => window.exportCues());
  fs.writeFileSync(path.join(BUILD, 'cues.json'), JSON.stringify(cues, null, 1));
  console.log(`cues: ${cues.vo.length} voice clips, ${cues.sfx.length} effects → build/cues.json`);
  if (args.includes('--cues')) return browser.close();

  if (opt('stills')) {
    const dir = path.join(BUILD, 'stills');
    fs.mkdirSync(dir, { recursive: true });
    for (const t of String(opt('stills')).split(',').map(Number)) {
      fs.writeFileSync(path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`), Buffer.from(await grab(first, t), 'base64'));
    }
    console.log('stills → build/stills/');
    return browser.close();
  }

  if (args.includes('--storyboard')) {
    const beats = [
      [0.6, '01 · Point of light'], [2.6, '01 · Workspace + idea'], [4.7, '01 · IDEA → PROMPT'], [9.6, '01 · Title over the generated shot'],
      [13.2, '02 · Blank prompt → five slots'], [18.4, '02 · Five parts drive the preview'], [20.9, '02 · One cohesive prompt'], [24.5, '02 · Vague vs detailed'],
      [27.6, '03 · Empty space, neutral figure'], [30.0, '03 · WHERE? The street builds'], [32.4, '03 · WHAT HAPPENS? Walks to camera'], [37.0, '03 · Specific instead of «a person walks»'],
      [41.8, '04 · Camera angle'], [46.2, '04 · Close-up'], [48.8, '04 · Dolly in vs tracking'], [52.8, '04 · Lighting: dramatic side light'],
      [58.8, '05 · Unwanted elements flagged'], [63.2, '05 · Negative terms remove them'], [68.4, '05 · Not a guarantee (≠ 100%)'], [77.0, '06 · Vague phrases identified'],
      [84.6, '06 · Improved result beside original'], [99.8, '07 · Compare the results'], [106.4, '08 · Prompt blueprint'], [117.0, '08 · Final frame'],
    ];
    const shots = [];
    for (const [t, cap] of beats) {
      const jpg = await first.evaluate((t) => {
        window.renderAt(t);
        return document.getElementById('c').toDataURL('image/jpeg', 0.9);
      }, t);
      shots.push({ t, cap, jpg });
    }
    const W = 480, H = 270, cols = 4;
    const sheet = await browser.newPage({ viewport: { width: W * cols + 50, height: 100 } });
    await sheet.setContent(`<body style="margin:0;padding:24px 25px;background:#0B0D11;font:600 13px Inter,sans-serif;color:#A9B1BF">
      <div style="font:700 22px Inter,sans-serif;color:#F4F6FA;margin:0 0 16px">Module 03 — Prompt Writing · storyboard</div>
      <div style="display:grid;grid-template-columns:repeat(${cols},${W}px);gap:14px 0">${shots
        .map((s) => `<figure style="margin:0"><img src="${s.jpg}" style="width:${W - 10}px;height:${H - 6}px;display:block;border-radius:6px">
        <figcaption style="padding:6px 2px 0"><span style="color:#2FE0F2">${s.t.toFixed(1)}s</span> &nbsp;${s.cap}</figcaption></figure>`)
        .join('')}</div></body>`);
    const out = path.join(ROOT, 'docs', 'storyboard.jpg');
    await sheet.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 86 });
    console.log('storyboard → docs/storyboard.jpg');
    return browser.close();
  }

  const from = +opt('from', 0), to = +opt('to', cues.duration);
  const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
  const total = f1 - f0;
  const per = Math.ceil(total / WORKERS);
  const pages = [first];
  for (let i = 1; i < WORKERS; i++) pages.push(await openPage(browser));
  let doneFrames = 0;
  const t0 = Date.now();
  const tick = setInterval(() => {
    const el = (Date.now() - t0) / 1000;
    const eta = doneFrames ? (el / doneFrames) * (total - doneFrames) : 0;
    process.stdout.write(`\rframes ${doneFrames}/${total}  ${(doneFrames / el).toFixed(1)} fps  eta ${eta.toFixed(0)}s   `);
  }, 2000);
  const segs = [];
  await Promise.all(
    pages.map(async (page, w) => {
      const a = f0 + w * per, b = Math.min(f1, a + per);
      if (a >= b) return;
      const seg = path.join(BUILD, `seg${w}.mp4`);
      segs[w] = seg;
      const enc = ffmpeg([
        '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF), '-pix_fmt', 'yuv420p',
        '-x264-params', 'aq-mode=3:aq-strength=0.9', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
        seg,
      ]);
      for (let f = a; f < b; f++) {
        await write(enc.stdin, Buffer.from(await grab(page, f / FPS), 'base64'));
        doneFrames++;
      }
      enc.stdin.end();
      await enc.done;
    })
  );
  clearInterval(tick);
  const list = path.join(BUILD, 'segments.txt');
  fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
  await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT]).done;
  segs.filter(Boolean).forEach((s) => fs.unlinkSync(s));
  console.log(`\nvideo → ${path.relative(ROOT, OUT)}  (${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
