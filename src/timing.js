// Caption/scene timing. Shared by the browser composition and the Node tools.
// estimateTiming() is used until a real voice-over is aligned (build/timing.json).

const CHARS_PER_SEC = 14.5; // calm Kazakh narration
const LEAD_IN = { intro: 1.0 };
const TAIL = { practice: 7.2 }; // practice ends with the final clip + end card
const DEFAULT_LEAD = 0.5;
const DEFAULT_TAIL = 0.6;

function pauseAfter(line) {
  const end = line.trim().slice(-1);
  if (",".includes(end)) return 0.25;
  if (";:".includes(end)) return 0.35;
  return 0.45;
}

export function estimateTiming(lesson) {
  const scenes = [];
  const captions = [];
  for (const s of lesson.scenes) {
    scenes.push({ id: s.id, start: s.start, end: s.end });
    const lead = LEAD_IN[s.id] ?? DEFAULT_LEAD;
    const tail = TAIL[s.id] ?? DEFAULT_TAIL;
    const avail = s.end - s.start - lead - tail;
    const lens = s.narration.map((l) => l.length / CHARS_PER_SEC);
    const pauses = s.narration.map((l, i) => (i === s.narration.length - 1 ? 0 : pauseAfter(l)));
    const total = lens.reduce((a, b) => a + b, 0) + pauses.reduce((a, b) => a + b, 0);
    const k = total > avail ? avail / total : 1;
    let t = s.start + lead;
    s.narration.forEach((text, i) => {
      const d = lens[i] * k;
      captions.push({ scene: s.id, index: i, start: round(t), end: round(t + d), text });
      t += d + pauses[i] * k;
    });
  }
  return { source: "estimate", duration: lesson.duration, scenes, captions };
}

function round(x) {
  return Math.round(x * 1000) / 1000;
}

function srtTime(t) {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

export function toSrt(timing) {
  return timing.captions
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`)
    .join("\n");
}
