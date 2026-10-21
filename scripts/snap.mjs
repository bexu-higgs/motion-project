// Screenshot the composition at given times: node scripts/snap.mjs out_dir t1 t2 ...
import path from 'node:path';
import fs from 'node:fs';
import { serve } from './server.mjs';
import { launch } from './browser.mjs';

const [outDir, ...times] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { server, url } = await serve(root);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url + '/src/index.html');
await page.waitForFunction(() => window.READY || window.INIT_ERROR, null, { timeout: 60000 });
const err = await page.evaluate(() => window.INIT_ERROR);
if (err) { console.error(err); process.exit(1); }
for (const t of times) {
  await page.evaluate((t) => window.renderFrame(t), +t);
  await page.screenshot({ path: path.join(outDir, `t${(+t).toFixed(2).padStart(6, '0')}.png`) });
}
// contact sheet friendly: also print cues count
console.log('cues', await page.evaluate(() => window.CUES.length));
await browser.close(); server.close();
