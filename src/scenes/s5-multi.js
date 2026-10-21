// SCENE 5 — WORKING WITH MULTIPLE REFERENCES: character + environment + style → one result.
import { el, css, place, prog, ease, lerp } from '../engine.js';
import { heading, card, lines, ICON } from '../ui.js';
import { bustShot, plateShot } from '../shots.js';
import { cue } from '../timeline.js';

const CW = 270, CH = 360, CY = 400 + CH / 2;
const OW = 860, OH = 600, OCY = 980 + OH / 2;
const IN = [41.1, 43.8, 45.35];
const HL = [49.2, 49.85, 50.5];

export default {
  build(root) {
    const head = heading(root, '3. Бірнеше референсті қолдану', { y: 176, size: 64, width: 900 });
    const L = lines(root);
    const DEF = [
      { cx: 225, label: 'Кейіпкер', icon: 'person', make: (p) => bustShot(p, { w: CW, h: CH, env: 'studio', seed: 40 }) },
      { cx: 540, label: 'Орта', icon: 'mountain', make: (p) => plateShot(p, { w: CW, h: CH, key: 'lab', s: 1.1 }) },
      { cx: 855, label: 'Стиль', icon: 'light', make: (p) => plateShot(p, { w: CW, h: CH, key: 'style', s: 1.02, thirds: true }) },
    ];
    const paths = DEF.map((d) => L.add(`M${d.cx},${CY + CH / 2 + 46} C${d.cx},${CY + CH / 2 + 130} 540,${OCY - OH / 2 - 90} 540,${OCY - OH / 2 - 6}`, { pulses: 2 }));
    const cards = DEF.map((d, i) => {
      const c = card(root, { cx: d.cx, cy: CY, w: CW, h: CH, label: d.label, labelCls: 'out', icon: d.icon, chipPos: 'bottom' });
      css(c.chip, { fontSize: '27px', letterSpacing: '0.02em', height: '56px', bottom: '-28px' });
      const num = el('div', 'icon-badge', c.root);
      num.textContent = String(i + 1);
      css(num, { width: '52px', height: '52px', left: '14px', top: '14px', font: '700 26px Inter', color: '#8ff3ff' });
      return { ...d, c, shot: d.make(c.frame), num };
    });

    // output, assembled in three passes (environment → character → lighting)
    const out = card(root, { cx: 540, cy: OCY, w: OW, h: OH, label: 'Нәтиже', labelCls: 'cyan' });
    const layers = [
      plateShot(el('div', 'fill', out.frame), { w: OW, h: OH, key: 'labSoft', s: 1.12 }),
      bustShot(el('div', 'fill', out.frame), { w: OW, h: OH, env: 'lab', look: 'studio', s: 1.3, fy: 0.42, seed: 41 }),
      bustShot(el('div', 'fill', out.frame), { w: OW, h: OH, env: 'labStyled', look: 'lab', s: 1.3, fy: 0.42, seed: 42 }),
    ];
    const scanOut = el('div', 'abs', out.root);
    css(scanOut, { left: '-10px', width: OW + 20 + 'px', height: '3px', background: '#8ff3ff', boxShadow: '0 0 24px 6px rgba(62,230,255,0.7)' });
    out.root.appendChild(out.chip);
    // markers showing what each reference contributed
    const MK = [
      { x: 540 - OW / 2 + 620, y: OCY - OH / 2 + 330, icon: 'person' },
      { x: 540 - OW / 2 + 110, y: OCY - OH / 2 + 150, icon: 'mountain' },
      { x: 540 - OW / 2 + 760, y: OCY - OH / 2 + 120, icon: 'light' },
    ].map((m, i) => {
      const b = el('div', 'icon-badge', root);
      b.innerHTML = `<span style="font:700 24px Inter;color:#021216">${i + 1}</span>`;
      css(b, { width: '50px', height: '50px', left: m.x - 25 + 'px', top: m.y - 25 + 'px', background: '#3ee6ff', borderColor: '#fff' });
      return b;
    });

    cue(38.2, 'swish', { gain: 0.4 });
    IN.forEach((t0, i) => { cue(t0 - 0.05, 'whooshSoft', { gain: 0.45 }); cue(t0 + 0.45, 'pop', { pitch: 0.9 + i * 0.15, gain: 0.5 }); });
    cue(46.6, 'shimmer', { dur: 1.6, gain: 0.35 });
    cue(46.9, 'process', { dur: 1.2, gain: 0.35 });
    cue(48.15, 'success', { gain: 0.55 });
    HL.forEach((t0, i) => cue(t0, 'blip', { pitch: 1.2 + i * 0.2, gain: 0.45 }));

    return {
      update(lt, t) {
        head.update(t, 38.15);
        cards.forEach((c, i) => {
          const k = prog(t, IN[i], 0.9, ease.outQuint);
          place(c.c.root, { x: (1 - k) * 420, r: (1 - k) * 12, s: lerp(0.85, 1, k), o: prog(t, IN[i], 0.3), blur: (1 - k) * 8, y: Math.sin(t * 0.9 + i * 2) * 4 });
          const hl = Math.max(0, 1 - Math.abs(t - HL[i] - 0.2) / 0.45);
          place(c.c.chip, { s: 1 + 0.12 * hl, o: prog(t, IN[i] + 0.3, 0.3), extra: 'translateX(-50%)' });
          css(c.c.chip, { background: hl > 0.3 ? 'rgba(62,230,255,0.25)' : 'rgba(10,16,22,0.72)' });
          css(c.c.ring, { opacity: (hl * 0.9 + Math.max(0, 1 - Math.abs(t - IN[i] - 0.6) / 0.5) * 0.7).toFixed(3) });
          c.shot.update(t);
          L.set(paths[i], prog(t, IN[i] + 0.5, 0.8, ease.inOutCubic), 1, t + i * 0.4, t > 46.5 && t < 48.2 ? 1.6 : 0.5);
        });
        const ko = prog(t, 46.6, 0.8, ease.outQuint);
        place(out.root, { o: prog(t, 46.6, 0.3), s: lerp(0.94, 1, ko), y: (1 - ko) * 40 });
        place(layers[0].root, { o: prog(t, 46.8, 0.4) });
        const kc = prog(t, 47.3, 0.7, ease.inOutCubic);
        css(layers[1].root, { clipPath: `inset(0 0 ${((1 - kc) * 100).toFixed(2)}% 0)` });
        css(scanOut, { top: kc * OH + 'px', opacity: kc > 0 && kc < 1 ? '1' : '0' });
        place(layers[2].root, { o: prog(t, 47.9, 0.6, ease.inOutSine) });
        layers.forEach((l) => l.update(t));
        place(out.chip, { o: prog(t, 48.2, 0.3), s: lerp(0.7, 1, prog(t, 48.2, 0.5, ease.outBack)), origin: '0 50%' });
        css(out.ring, { opacity: (Math.max(0, 1 - Math.abs(t - 48.4) / 0.6) * 0.9 + 0.2 * prog(t, 48.3, 0.5)).toFixed(3) });
        MK.forEach((b, i) => {
          const k = prog(t, HL[i], 0.45, ease.outBack);
          const pulse = Math.max(0, 1 - Math.abs(t - HL[i] - 0.25) / 0.4);
          place(b, { s: lerp(0.3, 1, k) * (1 + 0.15 * pulse), o: prog(t, HL[i], 0.2) });
        });
      },
    };
  },
};
