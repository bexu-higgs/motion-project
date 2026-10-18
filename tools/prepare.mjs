// Turns the real recordings / clips / images listed in project.config.json into
// what the composition reads: JPEG frame sequences + build/manifest.json.
// Also writes build/timing.json + script/captions_kk.srt (estimate, or aligned
// to the voice-over when tools/align.py has produced script/timing.aligned.json).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./server.mjs";
import { estimateTiming, toSrt } from "../src/timing.js";

const FPS = 30;
const rel = (p) => path.join(ROOT, p);
const config = JSON.parse(fs.readFileSync(rel("project.config.json"), "utf8"));
const lesson = JSON.parse(fs.readFileSync(rel("src/lesson.json"), "utf8"));
fs.mkdirSync(rel("build/captures"), { recursive: true });
fs.mkdirSync(rel("build/media"), { recursive: true });

function probe(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", file]);
  const s = JSON.parse(out).streams[0];
  return { width: s.width, height: s.height };
}

function findAudio(p) {
  if (fs.existsSync(rel(p))) return p;
  const dir = path.dirname(p), base = path.basename(p, path.extname(p));
  for (const ext of [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"]) {
    const q = path.join(dir, base + ext);
    if (fs.existsSync(rel(q))) return q;
  }
  return null;
}

const manifest = { captures: {}, images: {}, audio: null, missing: [] };

for (const [id, c] of Object.entries(config.captures)) {
  const src = rel(c.file);
  if (!fs.existsSync(src)) { manifest.missing.push(c.file); continue; }
  const dir = `build/captures/${id}`;
  const stamp = rel(`${dir}/.source`);
  const key = `${c.file}|${fs.statSync(src).mtimeMs}|${c.trimStart || 0}|${c.trimEnd || ""}|${JSON.stringify(c.crop || null)}`;
  if (!fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== key) {
    fs.rmSync(rel(dir), { recursive: true, force: true });
    fs.mkdirSync(rel(dir), { recursive: true });
    const args = ["-v", "error", "-y"];
    if (c.trimStart) args.push("-ss", String(c.trimStart));
    if (c.trimEnd) args.push("-to", String(c.trimEnd));
    // optional crop {x, y, w, h} in source pixels, e.g. to cut an edge watermark
    const crop = c.crop ? `crop=${c.crop.w}:${c.crop.h}:${c.crop.x}:${c.crop.y},` : "";
    args.push("-i", src, "-vf", `${crop}fps=${FPS},scale='min(1920,iw)':-2:flags=lanczos`, "-q:v", "2", rel(`${dir}/%05d.jpg`));
    console.log(`frames: ${id} ← ${c.file}`);
    execFileSync("ffmpeg", args, { stdio: "inherit" });
    fs.writeFileSync(stamp, key);
  }
  const frames = fs.readdirSync(rel(dir)).filter((f) => f.endsWith(".jpg")).length;
  const { width, height } = probe(rel(`${dir}/00001.jpg`));
  manifest.captures[id] = { dir, frames, fps: FPS, width, height };
}

for (const key of ["logo", "startFrame"]) {
  const p = config[key];
  if (!p || !fs.existsSync(rel(p))) { manifest.missing.push(p); continue; }
  const out = `build/media/${key}${path.extname(p).toLowerCase()}`;
  fs.copyFileSync(rel(p), rel(out));
  let size;
  if (out.endsWith(".svg")) {
    const svg = fs.readFileSync(rel(out), "utf8");
    const vb = svg.match(/viewBox="([\d.\s-]+)"/);
    const [, , w, h] = vb ? vb[1].trim().split(/\s+/).map(Number) : [0, 0, Number(svg.match(/width="([\d.]+)/)?.[1]), Number(svg.match(/height="([\d.]+)/)?.[1])];
    size = { width: w, height: h };
  } else {
    size = probe(rel(out));
  }
  manifest.images[key] = { src: out, ...size };
}

const voice = config.audio ? findAudio(config.audio) : null;
if (config.audio && !voice) manifest.missing.push(config.audio);

// timing: aligned to the real voice-over if available, otherwise the estimate
const alignedPath = rel("script/timing.aligned.json");
const timing = fs.existsSync(alignedPath) ? JSON.parse(fs.readFileSync(alignedPath, "utf8")) : estimateTiming(lesson);

// voice-over track: the author's recording, cut and placed per scene as
// tools/align.py decided, loudness-normalised for social platforms
if (voice) {
  const segs = timing.audio?.segments || [{ from: 0, to: 1e6, at: 0 }];
  const parts = segs.map((g, i) => {
    const len = g.to - g.from;
    const ms = Math.round(g.at * 1000);
    return `[0:a]atrim=start=${g.from}:end=${g.to},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, len - 0.03).toFixed(3)}:d=0.03,adelay=${ms}|${ms}[s${i}]`;
  });
  const mix = `${segs.map((_, i) => `[s${i}]`).join("")}amix=inputs=${segs.length}:normalize=0,apad,atrim=0:${timing.duration},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[out]`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", rel(voice), "-filter_complex", [...parts, mix].join(";"), "-map", "[out]", "-ac", "1", rel("build/voiceover.timed.wav")]);
  manifest.audio = "build/voiceover.timed.wav";
}
fs.writeFileSync(rel("build/timing.json"), JSON.stringify(timing, null, 2));
fs.writeFileSync(rel("script/captions_kk.srt"), toSrt(timing));
fs.writeFileSync(rel("build/manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`timing: ${timing.source}, duration ${timing.duration}s`);
console.log(`captures ready: ${Object.keys(manifest.captures).length}/${Object.keys(config.captures).length}`);
if (manifest.missing.length) console.log("missing (draft placeholders will be drawn):\n  " + manifest.missing.join("\n  "));
