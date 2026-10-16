// Render preview stills: node scripts/stills.mjs <outDir> <frame> [frame...]
import path from 'node:path';
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';

const [outDir, ...frames] = process.argv.slice(2);
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
const browserExecutable = process.env.REMOTION_BROWSER ?? null;
const browser = await openBrowser('chrome', {browserExecutable});
const composition = await selectComposition({serveUrl, id: 'HiggsfieldMaxTutorial', puppeteerInstance: browser, browserExecutable});
for (const fr of frames) {
  const frame = Number(fr);
  await renderStill({composition, serveUrl, frame, output: path.join(outDir, `f${String(frame).padStart(5, '0')}.jpg`), imageFormat: 'jpeg', jpegQuality: 85, puppeteerInstance: browser, browserExecutable});
  process.stdout.write(`${frame} `);
}
await browser.close({silent: true});
console.log('\ndone');
