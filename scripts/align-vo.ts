// Aligns ONE long narration recording to the 59 script sentences and writes public/vo/<line-id>.mp3.
// Cuts only inside pauses, choosing the set of pauses whose sentence lengths best match the
// expected length of each sentence (syllable count), so it copes with comma pauses that are as
// long as sentence pauses.
//   npm run align-vo -- path/to/narration.mp3 [silence-dB=-40]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {SCRIPT} from '../src/timeline';

const [input, noiseArg] = process.argv.slice(2);
if (!input) throw new Error('usage: npm run align-vo -- <narration file> [silence-dB]');
const noise = noiseArg ?? '-40';

// ---- expected length of each sentence, in syllables
const NUMBER_SYLLABLES: Record<string, number> = {'12': 3, '59': 4, '79': 4, '115': 3, '158': 5, '159': 5, '237': 7, '1800': 4, '3600': 5, '5400': 4};
const syllables = (text: string) => {
  let n = 0;
  for (const num of text.match(/\d+/g) ?? []) n += NUMBER_SYLLABLES[num] ?? num.length * 1.5;
  const words = text.replace(/\d+/g, ' ');
  n += (words.match(/[аәеиоөуұүыіэюяё]/gi) ?? []).length;
  n += (words.match(/[aeiouy]+/gi) ?? []).length;
  n += (text.match(/[,—:]/g) ?? []).length * 0.6; // short breath at commas/dashes
  return n;
};
const lines = SCRIPT.flatMap((s) => s.lines);
const W = lines.map((l) => syllables(l.text));

// ---- speech chunks between silences
const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input]).toString().trim());
const log = spawnSync('ffmpeg', ['-hide_banner', '-i', input, '-af', `silencedetect=noise=${noise}dB:d=0.1`, '-f', 'null', '-'], {encoding: 'utf8'}).stderr;
const sil = [...log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => ({s: Number(m[1]), e: Number(m[2])}));
const chunks: Array<{s: number; e: number}> = [];
let cur = 0;
for (const p of sil) {
  if (p.s - cur > 0.05) chunks.push({s: cur, e: p.s});
  cur = p.e;
}
if (total - cur > 0.05) chunks.push({s: cur, e: total});
const M = chunks.length;
const N = lines.length;
if (M < N) throw new Error(`Only ${M} speech chunks for ${N} sentences — try a lower silence level, e.g. -45.`);
const pauseAfter = (j: number) => (j + 1 < M ? chunks[j + 1].s - chunks[j].e : 1);

// ---- dynamic programming over cut positions
const align = (k: number) => {
  const INF = 1e18;
  const dp = Array.from({length: N}, () => new Float64Array(M).fill(INF));
  const from = Array.from({length: N}, () => new Int32Array(M).fill(-1));
  const cost = (i: number, a: number, b: number) => {
    const dur = chunks[b].e - chunks[a].s;
    const exp = k * W[i];
    return 4 * ((dur - exp) / (exp + 0.6)) ** 2;
  };
  const cut = (j: number) => 1.2 * Math.max(0, 0.45 - pauseAfter(j)) / 0.45;
  for (let b = 0; b < M; b++) dp[0][b] = cost(0, 0, b);
  for (let i = 1; i < N; i++) {
    for (let b = i; b < M; b++) {
      for (let a = i; a <= b; a++) {
        const prev = dp[i - 1][a - 1];
        if (prev >= INF) continue;
        const v = prev + cut(a - 1) + cost(i, a, b);
        if (v < dp[i][b]) {
          dp[i][b] = v;
          from[i][b] = a;
        }
      }
    }
  }
  const groups: Array<[number, number]> = [];
  let b = M - 1;
  for (let i = N - 1; i >= 0; i--) {
    const a = i === 0 ? 0 : from[i][b];
    groups.unshift([a, b]);
    b = a - 1;
  }
  return groups;
};

let k = (chunks[M - 1].e - chunks[0].s) / W.reduce((x, y) => x + y, 0);
let groups = align(k);
for (let iter = 0; iter < 3; iter++) {
  const ratios = groups.map(([a, b], i) => (chunks[b].e - chunks[a].s) / W[i]).sort((x, y) => x - y);
  k = ratios[Math.floor(ratios.length / 2)];
  groups = align(k);
}

// ---- write takes
const out = path.resolve('public/vo');
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
const report: string[] = [];
groups.forEach(([a, b], i) => {
  const prevEnd = a > 0 ? chunks[a - 1].e : 0;
  const nextStart = b + 1 < M ? chunks[b + 1].s : total;
  const from = Math.max(prevEnd, chunks[a].s - 0.06);
  const to = Math.min(nextStart, chunks[b].e + 0.12);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-ss', from.toFixed(3), '-to', to.toFixed(3), '-ac', '1', '-ar', '44100', '-af', 'afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse', '-c:a', 'libmp3lame', '-q:a', '2', path.join(out, `${lines[i].id}.mp3`)]);
  const dur = chunks[b].e - chunks[a].s;
  report.push(`${lines[i].id.padEnd(6)} ${chunks[a].s.toFixed(2).padStart(7)}–${chunks[b].e.toFixed(2).padStart(7)}  ${dur.toFixed(2).padStart(5)}s  exp ${(k * W[i]).toFixed(2).padStart(5)}s  ratio ${(dur / (k * W[i])).toFixed(2)}  cut-pause ${pauseAfter(b).toFixed(2)}  | ${lines[i].text.slice(0, 48)}`);
});
fs.writeFileSync(path.join(out, 'alignment.txt'), report.join('\n') + '\n');
console.log(report.join('\n'));
console.log(`\n${M} speech chunks → ${N} sentences, ${k.toFixed(3)} s/syllable. Wrote public/vo/*.mp3 — next: npm run sync-vo`);
