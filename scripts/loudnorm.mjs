// Two-pass loudness normalisation of the rendered video for social platforms (-14 LUFS, -1.5 dBTP).
// The picture is copied untouched.   node scripts/loudnorm.mjs out/render-raw.mp4 out/higgsfield-max-tutorial.mp4
import {spawnSync} from 'node:child_process';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: node scripts/loudnorm.mjs <in.mp4> <out.mp4>');
const target = 'I=-14:TP=-1.5:LRA=11';
const pass1 = spawnSync('ffmpeg', ['-hide_banner', '-i', input, '-vn', '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], {encoding: 'utf8'});
const m = JSON.parse(pass1.stderr.slice(pass1.stderr.lastIndexOf('{'), pass1.stderr.lastIndexOf('}') + 1));
const measured = `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
const pass2 = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-c:v', 'copy', '-af', `loudnorm=${target}:${measured}`, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output], {stdio: 'inherit'});
if (pass2.status !== 0) process.exit(pass2.status ?? 1);
console.log(`loudness ${m.input_i} LUFS → -14 LUFS  →  ${output}`);
