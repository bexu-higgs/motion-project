// Prints scene/line frame numbers (absolute): npx tsx scripts/print-timeline.ts
import {FPS, TIMELINE} from '../src/timeline';

for (const s of TIMELINE) {
  console.log(`${s.id.padEnd(4)} ${String(s.start).padStart(5)}  ${(s.start / FPS).toFixed(1).padStart(6)}s  dur ${s.duration}  ${s.name}`);
  for (const c of Object.values(s.cues)) console.log(`      ${c.id.padEnd(6)} ${String(s.start + c.from).padStart(5)} → ${String(s.start + c.to).padStart(5)}`);
}
