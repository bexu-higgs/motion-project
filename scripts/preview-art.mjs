// Renders a standalone art module to PNG for review: node scripts/preview-art.mjs <expr> <out.png> [w] [h]
import path from 'node:path';
import { serve } from './server.mjs';
import { launch } from './browser.mjs';

const [expr, out, w = 600, h = 800, bg = '#222'] = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { server, url } = await serve(root);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url + '/src/blank.html');
await page.evaluate(async ({ expr }) => {
  const s = document.createElement('script'); s.type = 'module';
  s.textContent = expr + '\n;document.body.dataset.done=1;';
  document.body.appendChild(s);
}, { expr });
await page.waitForSelector('body[data-done]', { timeout: 20000 });
await page.waitForTimeout(300);
await page.screenshot({ path: out });
await browser.close(); server.close();
