// Reads recorded narration takes from public/vo/<line-id>.(wav|mp3|m4a) and stores their real
// durations in src/vo-timings.json, so every scene re-times itself to the voice.
// npm run sync-vo
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const dir = path.resolve('public/vo');
const out = path.resolve('src/vo-timings.json');
const current = JSON.parse(fs.readFileSync(out, 'utf8'));
const lines = {};
if (fs.existsSync(dir)) {
  for (const file of fs.readdirSync(dir).sort()) {
    const m = file.match(/^(s\d+_\d+)\.(wav|mp3|m4a|aac|ogg)$/i);
    if (!m) continue;
    const seconds = Number(
      execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(dir, file)]).toString().trim(),
    );
    lines[m[1]] = {duration: Math.round(seconds * 1000) / 1000, file: `vo/${file}`};
  }
}
fs.writeFileSync(out, JSON.stringify({...current, lines}, null, 2) + '\n');
console.log(`synced ${Object.keys(lines).length} narration takes → src/vo-timings.json`);
