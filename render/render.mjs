// Frame-accurate capture of src/index.html → PNG frames piped into ffmpeg.
//   node render/render.mjs video <w> <h> <fps> <out.mp4>
//   node render/render.mjs stills <w> <h> <outDir> <t1,t2,...>
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.execPath, '../../lib/node_modules/playwright'))); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.wav': 'audio/wav' };

const [mode, w, h, a3, a4] = process.argv.slice(2);
const server = createServer(async (req, res) => {
  try {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) throw new Error('forbidden');
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/src/index.html?render&w=${w}&h=${h}`);
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);
const canvas = page.locator('canvas');
const shot = async t => { await page.evaluate(t => window.renderFrame(t), t); return canvas.screenshot({ type: 'png' }); };

if (mode === 'stills') {
  mkdirSync(a3, { recursive: true });
  for (const t of a4.split(',').map(Number)) {
    const buf = await shot(t);
    await import('node:fs').then(fs => fs.writeFileSync(path.join(a3, `t${t.toFixed(2).padStart(5, '0')}.png`), buf));
    console.log('still', t);
  }
} else {
  const fps = +a3, n = Math.round(duration * fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv444p', '-r', String(fps), a4], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await shot(i / fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
server.close();
