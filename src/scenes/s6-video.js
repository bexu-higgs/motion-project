// SCENE 6 — USING A VIDEO REFERENCE: source movement → frames → new character, same timing.
import { el, css, place, prog, ease, lerp, svgEl, attr } from '../engine.js';
import { heading, card, lines, ICON } from '../ui.js';
import { jumpShot } from '../shots.js';
import { JUMP_PERIOD } from '../art/rig.js';
import { cue } from '../timeline.js';

const PW = 900, PH = 460;
const SRC_CY = 432 + PH / 2, RES_CY = 1196 + PH / 2;
const ST = { x: 90, y: 978, w: 900, h: 140 };
const T0 = 52.0; // source clip starts playing
const CHIP_T = [52.9, 54.2, 55.1];
const FRAMES = [0.2, 0.5, 0.74, 1.0, 1.35];

export default {
  build(root) {
    const head = heading(root, '4. Видео референсімен жұмыс', { y: 176, size: 64, width: 900 });
    const row = el('div', 'abs', root);
    css(row, { left: '0', top: '328px', width: '1080px', height: '64px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px' });
    const seps = [];
    const chips = [['run', 'Қозғалыс'], ['wand', 'Әрекет'], ['film', 'Уақыт']].map(([ic, txt], i) => {
      if (i > 0) {
        const d = el('div', '', row);
        d.textContent = '•';
        css(d, { color: '#3ee6ff', font: '700 30px Inter', position: 'relative' });
        seps.push(d);
      }
      const c = el('div', 'chip out', row);
      c.innerHTML = ICON[ic] + `<span>${txt}</span>`;
      css(c, { position: 'relative', height: '58px', fontSize: '27px', letterSpacing: '0.02em', padding: '0 22px' });
      return c;
    });

    const L = lines(root);
    const link = L.add(`M540,${ST.y + ST.h} L540,${RES_CY - PH / 2 - 4}`, { pulses: 2 });

    // source clip
    const src = card(root, { cx: 540, cy: SRC_CY, w: PW, h: PH, label: 'Түпнұсқа', icon: 'video' });
    const srcShot = jumpShot(src.frame, { w: PW, h: PH, skin: 'silhouette', env: 'studio' });
    const tc = el('div', 'abs mono', src.root);
    css(tc, { left: 'auto', top: 'auto', right: '22px', bottom: '16px', font: '600 24px Inter', color: '#8ff3ff', letterSpacing: '0.05em' });
    const scrub = el('div', 'bar', src.root);
    css(scrub, { left: '22px', right: '120px', bottom: '28px', height: '6px' });
    const scrubFill = el('i', '', scrub);

    // reference strip of extracted frames
    const strip = el('div', 'glass dark', root);
    css(strip, { left: ST.x + 'px', top: ST.y + 'px', width: ST.w + 'px', height: ST.h + 'px', borderRadius: '24px' });
    const stripRing = el('div', 'ring', strip);
    css(stripRing, { borderRadius: '30px' });
    const stripChip = el('div', 'chip cyan', root);
    stripChip.innerHTML = ICON.film + '<span>Референс</span>';
    css(stripChip, { left: ST.x + 24 + 'px', top: ST.y - 26 + 'px', height: '46px', fontSize: '21px' });
    const FW = 156, FH = 88, gap = (ST.w - 40 - FW * FRAMES.length) / (FRAMES.length - 1);
    const frames = FRAMES.map((ft, i) => {
      const f = el('div', 'card', root);
      const x = ST.x + 20 + i * (FW + gap), y = ST.y + (ST.h - FH) / 2 + 6;
      css(f, { left: x + 'px', top: y + 'px', width: FW + 'px', height: FH + 'px' });
      const fr = el('div', 'frame', f);
      css(fr, { borderRadius: '12px' });
      const s = jumpShot(fr, { w: FW, h: FH, skin: 'silhouette', env: 'studio', arrows: false });
      s.update(ft);
      return { f, x, y, ft };
    });
    const head2 = el('div', 'abs', root);
    css(head2, { top: ST.y + 14 + 'px', width: '3px', height: ST.h - 28 + 'px', background: '#3ee6ff', boxShadow: '0 0 14px #3ee6ff', borderRadius: '2px' });

    // ≈ badge: similar movement, not a perfect copy
    const badge = el('div', 'icon-badge', root);
    css(badge, { width: '74px', height: '74px', left: 540 - 37 + 'px', top: (ST.y + ST.h + RES_CY - PH / 2) / 2 - 37 + 'px', zIndex: 3 });
    const arrowIc = el('div', 'abs', badge);
    arrowIc.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#8ff3ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
    css(arrowIc, { left: '18px', top: '18px', width: '38px', height: '38px' });
    const approx = el('div', 'abs', badge);
    approx.textContent = '≈';
    css(approx, { left: '0', top: '6px', width: '74px', textAlign: 'center', font: '600 46px Inter', color: '#8ff3ff' });

    // result
    const res = card(root, { cx: 540, cy: RES_CY, w: PW, h: PH, label: 'Нәтиже', labelCls: 'cyan' });
    const resShot = jumpShot(res.frame, { w: PW, h: PH, skin: 'hero', env: 'steppe' });

    cue(51.95, 'swish', { gain: 0.4 });
    cue(52.1, 'play', { gain: 0.5 });
    CHIP_T.forEach((t0, i) => cue(t0, 'blip', { pitch: 1.1 + i * 0.2, gain: 0.45 }));
    FRAMES.forEach((_, i) => cue(53.2 + i * 0.16, 'tick', { gain: 0.35, pitch: 1 + i * 0.1 }));
    cue(54.9, 'shimmer', { dur: 0.9, gain: 0.3 });
    cue(55.35, 'whooshSoft', { gain: 0.4 });
    cue(55.6, 'success', { gain: 0.45 });
    // jump landings in the clips
    for (let k = 0; k < 4; k++) cue(T0 + k * JUMP_PERIOD + 1.42, 'thud', { gain: k === 0 ? 0.25 : 0.35 });
    cue(58.1, 'morph', { gain: 0.4 });

    return {
      update(lt, t) {
        head.update(t, 51.9);
        chips.forEach((c, i) => {
          const k = prog(t, CHIP_T[i], 0.5, ease.outBack);
          place(c, { s: lerp(0.6, 1, k), o: prog(t, CHIP_T[i], 0.2), y: (1 - k) * 18 });
          if (i > 0) place(seps[i - 1], { o: prog(t, CHIP_T[i] - 0.1, 0.3) });
        });
        const ct = Math.max(0, t - T0);
        const ks = prog(t, 52.0, 0.9, ease.outQuint);
        place(src.root, { o: prog(t, 52.0, 0.35), s: lerp(0.94, 1, ks), y: (1 - ks) * 40 });
        css(src.ring, { opacity: (0.6 * prog(t, 53.0, 0.4) * (1 - prog(t, 55.2, 0.5) * 0.6)).toFixed(3) });
        srcShot.update(ct, { arrowsK: prog(t, 54.2, 0.5) });
        const s = ct % JUMP_PERIOD;
        tc.textContent = '00:0' + Math.floor(s) + ':' + String(Math.floor((s % 1) * 30)).padStart(2, '0');
        css(scrubFill, { transform: `scaleX(${(s / JUMP_PERIOD).toFixed(4)})` });

        const kst = prog(t, 52.9, 0.6, ease.outQuint);
        place(strip, { o: prog(t, 52.9, 0.3), y: (1 - kst) * 30 });
        place(stripChip, { o: prog(t, 54.6, 0.3), s: lerp(0.7, 1, prog(t, 54.6, 0.5, ease.outBack)), origin: '0 50%' });
        css(stripRing, { opacity: (Math.max(0, 1 - Math.abs(t - 54.9) / 0.5) * 0.9 + 0.2 * prog(t, 54.8, 0.4)).toFixed(3) });
        frames.forEach((f, i) => {
          const t0 = 53.2 + i * 0.16;
          const k = prog(t, t0, 0.75, ease.inOutCubic);
          // fly from the source clip down into the strip
          const sx = 540 - FW / 2 - f.x + (i - 2) * 60, sy = SRC_CY - FH / 2 - f.y - 40;
          place(f.f, { x: lerp(sx, 0, k), y: lerp(sy, 0, k), s: lerp(2.4, 1, k), o: prog(t, t0, 0.2) });
        });
        const ph = s / JUMP_PERIOD;
        place(head2, { x: ST.x + 20 + ph * (ST.w - 40), o: prog(t, 54.2, 0.3) });

        L.set(link, prog(t, 55.0, 0.5, ease.inOutCubic), 1, t, 1);
        const kb = prog(t, 55.1, 0.5, ease.outBack);
        place(badge, { s: lerp(0.3, 1, kb) * (1 + 0.12 * Math.max(0, 1 - Math.abs(t - 58.2) / 0.35)), o: prog(t, 55.1, 0.2) });
        const ka = prog(t, 58.05, 0.35, ease.inOutCubic);
        place(arrowIc, { o: 1 - ka, s: 1 - 0.4 * ka });
        place(approx, { o: ka, s: lerp(0.5, 1, ka) });

        const kr = prog(t, 55.35, 0.9, ease.outQuint);
        place(res.root, { o: prog(t, 55.35, 0.35), s: lerp(0.94, 1, kr), y: (1 - kr) * 50 });
        css(res.ring, { opacity: (Math.max(0, 1 - Math.abs(t - 55.9) / 0.6) * 0.8 + 0.2 * prog(t, 55.8, 0.4)).toFixed(3) });
        resShot.update(ct, { arrowsK: prog(t, 55.8, 0.5) });
      },
    };
  },
};
