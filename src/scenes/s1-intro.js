// SCENE 1 — INTRODUCTION: one reference image spawns new results.
import { el, css, place, prog, ease, clamp, svgEl, attr, splitChars, revealSpans, lerp } from '../engine.js';
import { card, lines, subline } from '../ui.js';
import { bustShot, walkShot } from '../shots.js';
import { cue, V } from '../timeline.js';

export default {
  build(root) {
    const cluster = el('div', 'fill', root);
    css(cluster, { transformOrigin: '540px 760px' });
    const CX = 540, CY = 760;

    // HUD rings
    const hud = svgEl('svg', { class: 'lines', width: 1080, height: 1920 }, cluster);
    const ring1 = svgEl('circle', { cx: CX, cy: CY, r: 430, fill: 'none', stroke: '#3ee6ff', 'stroke-width': 1.5, opacity: 0.35 }, hud);
    const ring2 = svgEl('circle', { cx: CX, cy: CY, r: 470, fill: 'none', stroke: '#8ff3ff', 'stroke-width': 1, 'stroke-dasharray': '3 12', opacity: 0.35 }, hud);
    const ticks = svgEl('g', { opacity: 0.6 }, hud);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, r0 = 446, r1 = i % 6 === 0 ? 462 : 452;
      svgEl('line', { x1: CX + Math.cos(a) * r0, y1: CY + Math.sin(a) * r0, x2: CX + Math.cos(a) * r1, y2: CY + Math.sin(a) * r1, stroke: '#3ee6ff', 'stroke-width': i % 6 === 0 ? 2 : 1, opacity: i % 6 === 0 ? 0.8 : 0.4 }, ticks);
    }
    const arcs = svgEl('g', {}, hud);
    const arcA = svgEl('path', { d: arcPath(CX, CY, 500, -150, -30), fill: 'none', stroke: '#3ee6ff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.7 }, arcs);
    const arcB = svgEl('path', { d: arcPath(CX, CY, 500, 30, 150), fill: 'none', stroke: '#3ee6ff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.7 }, arcs);

    // connection lines (behind cards)
    const L = lines(cluster);
    const SAT = [
      { cx: 168, cy: 455, r: -5, make: (p) => bustShot(p, { w: 210, h: 280, env: 'city', walk: true, seed: 3 }) },
      { cx: 912, cy: 500, r: 4, make: (p) => bustShot(p, { w: 210, h: 280, env: 'forest', seed: 5 }) },
      { cx: 172, cy: 1060, r: 4, make: (p) => bustShot(p, { w: 210, h: 280, env: 'dusk', seed: 7 }) },
      { cx: 908, cy: 1030, r: -4, make: (p) => walkShot(p, { w: 210, h: 280, figH: 0.66, groundY: 0.9 }) },
    ];
    const paths = SAT.map((s) => {
      const sx = s.cx < CX ? CX - 222 : CX + 222;
      const sy = s.cy < CY ? CY - 150 : CY + 150;
      const ex = s.cx < CX ? s.cx + 100 : s.cx - 100;
      const d = `M${sx},${sy} C${lerp(sx, ex, 0.5)},${sy} ${lerp(sx, ex, 0.5)},${s.cy} ${ex},${s.cy}`;
      return L.add(d, { pulses: 2 });
    });

    const sats = SAT.map((s) => {
      const c = card(cluster, { cx: s.cx, cy: s.cy, w: 210, h: 280 });
      const shot = s.make(c.frame);
      css(c.frame, { borderRadius: '20px' });
      return { ...s, c, shot };
    });

    // central reference card
    const main = card(cluster, { cx: CX, cy: CY, w: 440, h: 587, label: 'Референс', labelCls: 'cyan' });
    const mainShot = bustShot(main.frame, { w: 440, h: 587, env: 'studio', seed: 1 });
    const scan = el('div', 'abs', main.root);
    css(scan, { left: '-10px', width: '460px', height: '3px', background: '#8ff3ff', boxShadow: '0 0 24px 6px rgba(62,230,255,0.7)' });

    // titles
    const tbox = el('div', 'heading', root);
    css(tbox, { top: '1230px' });
    const t1 = el('div', 'title-xl', tbox);
    css(t1, { fontSize: '88px' });
    const c1 = splitChars(t1, 'РЕФЕРЕНСТЕРМЕН');
    const t2 = el('div', 'title-xl grad', tbox);
    css(t2, { fontSize: '88px', marginTop: '6px' });
    const c2 = splitChars(t2, 'ЖҰМЫС');
    c2.forEach((c) => c.classList.add('grad'));
    const rule = el('div', 'abs', root);
    css(rule, { left: '480px', top: '1470px', width: '120px', height: '3px', borderRadius: '2px', background: 'linear-gradient(90deg, transparent, #3ee6ff, transparent)' });
    const sub = subline(root, 'Бір суреттен — жаңа нәтиже', { y: 1500, size: 46 });

    // fit the long word inside the safe width
    const fit = () => {
      const wpx = t1.scrollWidth;
      if (wpx > 900) {
        const k = 900 / wpx;
        css(t1, { fontSize: 88 * k + 'px' });
        css(t2, { fontSize: 88 * k + 'px' });
      }
    };
    fit();

    // sound
    cue(0.25, 'boom', { gain: 0.9 });
    cue(0.4, 'scan', { dur: 1.0, gain: 0.5 });
    cue(1.4, 'blip', { pitch: 1.3, gain: 0.5 });
    SAT.forEach((_, i) => cue(1.7 + i * 0.13, 'pop', { pitch: 0.9 + i * 0.12, gain: 0.4 }));
    cue(2.0, 'shimmer', { dur: 1.2, gain: 0.35 });
    cue(2.35, 'hit', { gain: 0.6 });
    cue(3.45, 'blip', { pitch: 1.6, gain: 0.35 });

    return {
      update(lt, t) {
        const push = 1 + 0.06 * ease.inOutSine(clamp(t / 6.6));
        css(cluster, { transform: `scale(${push.toFixed(4)})` });
        const kr = prog(t, 0.05, 1.4, ease.outCubic);
        attr(ring1, { 'stroke-dasharray': `${(2700 * kr).toFixed(1)} 3000`, transform: `rotate(${-90 + t * 4} ${CX} ${CY})` });
        attr(ring2, { opacity: (0.35 * kr).toFixed(3), transform: `rotate(${-t * 6} ${CX} ${CY})` });
        attr(ticks, { opacity: (0.6 * prog(t, 0.4, 1)).toFixed(3), transform: `rotate(${t * 3} ${CX} ${CY})` });
        attr(arcs, { opacity: prog(t, 0.6, 0.8).toFixed(3), transform: `rotate(${t * 14} ${CX} ${CY})` });

        // main card: scan reveal
        const kc = prog(t, 0.35, 1.0, ease.inOutCubic);
        place(main.root, { s: lerp(0.94, 1, prog(t, 0.3, 1.4, ease.outQuint)), o: prog(t, 0.3, 0.35) });
        css(main.frame, { clipPath: `inset(0 0 ${((1 - kc) * 100).toFixed(2)}% 0 round 26px)` });
        css(scan, { top: (kc * 587).toFixed(1) + 'px', opacity: (kc > 0 && kc < 1 ? 1 : 0).toString() });
        place(main.chip, { s: lerp(0.6, 1, prog(t, 1.35, 0.5, ease.outBack)), o: prog(t, 1.35, 0.25), origin: '0 50%' });
        css(main.ring, { opacity: (0.25 + 0.2 * Math.sin(t * 2.2)) * prog(t, 1.2, 0.8) + '' });
        mainShot.update(t);

        // satellites fly out from behind the main card
        sats.forEach((s, i) => {
          const k = prog(t, 1.65 + i * 0.13, 1.0, ease.outQuint);
          const fx = lerp(CX - s.cx, 0, k), fy = lerp(CY - s.cy, 0, k);
          const float = Math.sin(t * 0.9 + i * 1.7) * 6;
          place(s.c.root, { x: fx, y: fy + float, s: lerp(0.4, 1, k), r: s.r * k, o: prog(t, 1.65 + i * 0.13, 0.3), blur: (1 - k) * 8 });
          s.shot.update(t + i * 0.7);
          L.set(paths[i], prog(t, 2.0 + i * 0.1, 0.8, ease.inOutCubic), 1, t + i * 0.3, 0.6);
        });

        revealSpans(c1, t, 2.35, { stagger: 0.035, dur: 0.9, dy: 60, blur: 14 });
        revealSpans(c2, t, 2.75, { stagger: 0.05, dur: 0.9, dy: 60, blur: 14 });
        place(rule, { sx: prog(t, 3.2, 0.8, ease.outQuint), o: prog(t, 3.2, 0.4) });
        sub.update(t, 3.45);
      },
    };
  },
};

function arcPath(cx, cy, r, a0, a1) {
  const p = (a) => [cx + Math.cos((a * Math.PI) / 180) * r, cy + Math.sin((a * Math.PI) / 180) * r];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`;
}
