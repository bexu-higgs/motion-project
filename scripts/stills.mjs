// Render still frames for review, plus a contact sheet (storyboard overview).
//   npm run stills                 -> one frame every 3 s + docs/storyboard.jpg
//   npm run stills -- 120 480 900  -> just these frames
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'out', 'stills');
mkdirSync(outDir, {recursive: true});

const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public')});
const composition = await selectComposition({serveUrl, id: 'HiggsfieldImageBasicsKK', browserExecutable});

const args = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
const frames = args.length
	? args
	: Array.from({length: Math.floor(composition.durationInFrames / 90)}, (_, i) => 45 + i * 90).filter(
			(f) => f < composition.durationInFrames,
		);

const files = [];
for (const frame of frames) {
	const output = path.join(outDir, `f${String(frame).padStart(5, '0')}.jpg`);
	await renderStill({composition, serveUrl, output, frame, imageFormat: 'jpeg', jpegQuality: 90, browserExecutable});
	files.push(output);
	console.log(`frame ${frame} (${(frame / composition.fps).toFixed(1)}s) -> ${path.relative(root, output)}`);
}

if (!args.length) {
	const cols = 8;
	const sheet = path.join(root, 'docs', 'storyboard.jpg');
	mkdirSync(path.dirname(sheet), {recursive: true});
	execFileSync('ffmpeg', [
		'-y', '-loglevel', 'error',
		'-pattern_type', 'glob', '-i', path.join(outDir, 'f*.jpg'),
		'-vf', `scale=270:-1,tile=${cols}x${Math.ceil(files.length / cols)}:padding=6:color=0x0E0F12`,
		'-frames:v', '1', '-q:v', '3', sheet,
	]);
	console.log(`contact sheet -> ${path.relative(root, sheet)}`);
}
console.log(`duration ${composition.durationInFrames} frames = ${(composition.durationInFrames / composition.fps).toFixed(1)} s`);
