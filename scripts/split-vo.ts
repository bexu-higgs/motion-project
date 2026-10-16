// Splits ONE long narration recording (all 46 sentences read in order, with short pauses between them)
// into public/vo/<line-id>.wav, cutting in the middle of the pauses, then you run `npm run sync-vo`.
//   npm run split-vo -- path/to/narration.mp3 [silence-dB=-35] [min-pause-sec=0.22]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {SCRIPT} from '../src/timeline';

const [input, noiseArg, durArg] = process.argv.slice(2);
if (!input) throw new Error('usage: npm run split-vo -- <narration file> [silence-dB] [min-pause-sec]');
const noise = noiseArg ?? '-35';
const minPause = durArg ?? '0.22';
const ids = SCRIPT.flatMap((s) => s.lines.map((l) => l.id));

const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input]).toString().trim());
const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', input, '-af', `silencedetect=noise=${noise}dB:d=${minPause}`, '-f', 'null', '-'], {encoding: 'utf8'});
const log = probe.stderr;
const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
const pauses = starts
  .map((s, i) => ({s, e: ends[i] ?? total}))
  .filter((p) => p.s > 0.05 && p.e < total - 0.05); // ignore leading/trailing silence

const need = ids.length - 1;
if (pauses.length < need) {
  console.error(`Found only ${pauses.length} pauses but need ${need}. Try a higher silence level (e.g. -30) or a shorter min pause (e.g. 0.15).`);
  process.exit(1);
}
// keep the longest pauses (sentence breaks), in time order
const cuts = [...pauses]
  .sort((a, b) => b.e - b.s - (a.e - a.s))
  .slice(0, need)
  .sort((a, b) => a.s - b.s);

const lead = pauses.length && starts[0] <= 0.05 ? ends[0] : 0;
const out = path.resolve('public/vo');
fs.mkdirSync(out, {recursive: true});
let from = Math.max(0, lead - 0.05);
ids.forEach((id, i) => {
  const to = i < need ? cuts[i].s + 0.08 : total;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-ss', from.toFixed(3), '-to', to.toFixed(3), '-ac', '2', '-ar', '48000', path.join(out, `${id}.wav`)]);
  console.log(`${id.padEnd(6)} ${from.toFixed(2).padStart(7)} → ${to.toFixed(2).padStart(7)}  (${(to - from).toFixed(2)} s)`);
  if (i < need) from = Math.max(cuts[i].e - 0.08, to);
});
console.log(`\nWrote ${ids.length} takes to public/vo/. Listen to a few, then run: npm run sync-vo`);
