// Sanity checks before a final render: on-screen narration matches the approved
// Kazakh script word for word, and every asset the final video needs is present.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./server.mjs";

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const norm = (s) => s.replace(/\s+/g, " ").trim();
const lesson = JSON.parse(read("src/lesson.json"));
const config = JSON.parse(read("project.config.json"));
let ok = true;

const captions = norm(lesson.scenes.flatMap((s) => s.narration).join(" "));
const script = norm(read("script/voiceover_kk.txt"));
if (captions === script) console.log("✓ captions match script/voiceover_kk.txt");
else {
  ok = false;
  const i = [...captions].findIndex((c, k) => c !== script[k]);
  console.log(`✗ captions differ from the script at char ${i}: "${captions.slice(i, i + 40)}" vs "${script.slice(i, i + 40)}"`);
}

const need = [config.logo, config.startFrame, ...Object.values(config.captures).map((c) => c.file)];
const audioBase = config.audio.replace(/\.[^.]+$/, "");
const audio = [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"].map((e) => audioBase + e).find((p) => fs.existsSync(path.join(ROOT, p)));
for (const p of need) {
  const has = fs.existsSync(path.join(ROOT, p));
  ok &&= has;
  console.log(`${has ? "✓" : "✗"} ${p}`);
}
console.log(`${audio ? "✓" : "✗"} ${audio || config.audio} (Kazakh voice-over)`);
ok &&= !!audio;
const aligned = fs.existsSync(path.join(ROOT, "script/timing.aligned.json"));
console.log(`${aligned ? "✓" : "✗"} script/timing.aligned.json (captions synced to the voice-over)`);
ok &&= aligned;
console.log(ok ? "\nReady for the final render." : "\nNot final yet: the render would still contain DRAFT placeholders or estimated timing.");
process.exit(ok ? 0 : 1);
