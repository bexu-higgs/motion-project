// Writes the narration cue sheet (Markdown) and an SRT guide for recording the Kazakh voiceover.
// npm run cues
import fs from 'node:fs';
import path from 'node:path';
import {FPS, TIMELINE, TOTAL_FRAMES} from '../src/timeline';

const tc = (frame: number) => {
  const s = frame / FPS;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
};
const srtTc = (frame: number) => {
  const ms = Math.round((frame / FPS) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};

const md: string[] = [
  '# Voiceover cue sheet — Higgsfield MAX discount tutorial',
  '',
  `Total length: **${tc(TOTAL_FRAMES)}** (${FPS} fps). Each line is one recording take; start it at the timecode shown.`,
  'The Kazakh text is the exact narration from the brief — read it as written.',
  '',
  'After recording, save each take as `public/vo/<id>.wav` (or .mp3) and run `npm run sync-vo` — the video re-times itself to your real takes.',
  '',
];
const srt: string[] = [];
let n = 1;
for (const s of TIMELINE) {
  md.push(`## ${s.id.toUpperCase()} · ${s.name}  \`${tc(s.start)} – ${tc(s.start + s.duration)}\``, '', '| ID | Start | End | Narration (KK) |', '|---|---|---|---|');
  for (const c of Object.values(s.cues)) {
    md.push(`| ${c.id} | ${tc(s.start + c.from)} | ${tc(s.start + c.to)} | ${c.text} |`);
    srt.push(String(n++), `${srtTc(s.start + c.from)} --> ${srtTc(s.start + c.to)}`, c.text, '');
  }
  md.push('');
}
fs.mkdirSync('docs', {recursive: true});
fs.writeFileSync(path.join('docs', 'voiceover-cue-sheet.md'), md.join('\n'));
fs.writeFileSync(path.join('docs', 'voiceover-guide.srt'), srt.join('\n'));
console.log('wrote docs/voiceover-cue-sheet.md and docs/voiceover-guide.srt');
