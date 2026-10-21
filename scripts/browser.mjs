// Shared Playwright launcher. Uses the system Chromium when available.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const CANDIDATES = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);

export async function launch() {
  const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
  return pw.chromium.launch({ executablePath, args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
}
