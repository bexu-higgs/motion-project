#!/usr/bin/env node
// Frame-accurate renderer: drives index.html in headless Chromium, streams raw frames into ffmpeg.
//
//   node render.js --aspect 16x9 --scale 2 --fps 60 --out out/academy_16x9_4k60.mp4
//   node render.js --aspect 9x16 --scale 2 --from 0 --to 1800 --out out/part1.mp4     (frame range)
//   node render.js --stills 2,6.5,15 --scale 1 --outdir previews                       (PNG stills)
//   node render.js --cues out/cues.json                                                (sound cue list)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { const v = process.argv[i + 1]; if (!v || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } }
}
const ROOT = __dirname;
const aspect = args.aspect || '16x9';
const scale = +(args.scale || 1);
const fps = +(args.fps || 60);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.otf': 'font/otf', '.json': 'application/json' };

let sink = null;     // function(buffer) -> Promise
let frames = 0, t0 = Date.now(), total = 0;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      await sink(body, url);
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  // Mesa llvmpipe (through ANGLE's GL backend) is several times faster than SwiftShader on CPU-only hosts.
  // It needs an X display (Xvfb); without one we fall back to SwiftShader.
  const useMesa = !!process.env.DISPLAY && !args.swiftshader;
  const browser = await chromium.launch({
    args: useMesa ? ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?aspect=${aspect}&scale=${scale}`);
  await page.waitForFunction(() => window.ready || window.bootError, null, { timeout: 120000 });
  const bootError = await page.evaluate(() => window.bootError);
  if (bootError) throw new Error(bootError);
  const info = await page.evaluate(() => window.info);
  console.error(`ready: ${info.W}x${info.H} (design ${info.DW}x${info.DH}) on ${info.renderer}`);

  if (args.cues) {
    const cues = await page.evaluate(() => ({ cues: window.cues(), ...window.timeline() }));
    fs.mkdirSync(path.dirname(path.resolve(args.cues)), { recursive: true });
    fs.writeFileSync(args.cues, JSON.stringify(cues, null, 1));
    console.error('wrote', args.cues, cues.cues.length, 'cues');
  } else if (args.stills) {
    const outdir = args.outdir || 'previews';
    fs.mkdirSync(outdir, { recursive: true });
    for (const ts of String(args.stills).split(',')) {
      const t = +ts;
      const t1 = Date.now();
      const data = await page.evaluate(async (t) => {
        renderAt(t, Math.round(t * 60));
        return document.getElementById('c').toDataURL('image/png');
      }, t);
      const name = path.join(outdir, `${aspect}_${t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(name, Buffer.from(data.split(',')[1], 'base64'));
      console.error(name, (Date.now() - t1) + 'ms');
    }
  } else {
    const from = +(args.from || 0);
    const to = +(args.to || Math.round(60 * fps));
    total = to - from;
    const out = args.out || `out/academy_${aspect}.mp4`;
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-s', `${info.W}x${info.H}`, '-r', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', args.preset || 'medium', '-crf', String(args.crf || 16),
      '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((r) => ff.on('close', r));
    // frames may arrive out of order (pipelined uploads): write them to ffmpeg strictly in sequence
    const waiting = new Map();
    let next = from, chain = Promise.resolve();
    const writeOne = (buf) => new Promise((resolve) => { if (ff.stdin.write(buf)) resolve(); else ff.stdin.once('drain', resolve); });
    sink = (buf, url) => {
      const i = +url.searchParams.get('i');
      return new Promise((resolve) => {
        waiting.set(i, { buf, resolve });
        chain = chain.then(async () => {
          while (waiting.has(next)) {
            const w = waiting.get(next); waiting.delete(next); next++;
            await writeOne(w.buf);
            frames++;
            if (frames % 30 === 0 || frames === total) {
              const el = (Date.now() - t0) / 1000;
              console.error(`frame ${from + frames}/${to}  ${(frames / el).toFixed(2)} fps  eta ${((total - frames) / (frames / el) / 60).toFixed(1)} min`);
            }
            w.resolve();
          }
        });
      });
    };
    t0 = Date.now();
    await page.evaluate(async ({ from, to, fps }) => {
      const buf = new Uint8Array(info.W * info.H * 3 / 2);
      const pending = [];
      for (let i = from; i < to; i++) {
        renderAt(i / fps, i, false);
        Engine.readYUV(buf);
        pending.push(fetch('/frame?i=' + i, { method: 'POST', body: buf }));   // body is copied here
        if (pending.length > 2) await pending.shift();
      }
      await Promise.all(pending);
    }, { from, to, fps });
    ff.stdin.end();
    await done;
    console.error('wrote', out);
  }
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
