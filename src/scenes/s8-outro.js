// SCENE 8 — CONCLUSION: reference and result side by side.
import { el, css, place, prog, ease, lerp } from '../engine.js';
import { heading, subline, card, ICON } from '../ui.js';
import { bustShot } from '../shots.js';
import { cue } from '../timeline.js';

const FW = 430, FH = 764, FCY = 290 + FH / 2;
const PROMPT_SNIPPET = 'Осы кейіпкердің сыртқы келбетін сақта…';

export default {
  build(root) {
    const left = card(root, { cx: 300, cy: FCY, w: FW, h: FH, label: 'Референс', labelCls: 'cyan' });
    const right = card(root, { cx: 780, cy: FCY, w: FW, h: FH, label: 'Нәтиже', labelCls: 'out' });
    const lShot = bustShot(left.frame, { w: FW, h: FH, env: 'studio', s: 0.98, fy: 0.37, seed: 70 });
    const rShot = bustShot(right.frame, { w: FW, h: FH, env: 'city', walk: true, s: 0.98, fy: 0.37, seed: 71 });
    left.root.appendChild(left.chip);
    right.root.appendChild(right.chip);

    const mid = el('div', 'icon-badge', root);
    mid.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#8ff3ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    css(mid, { width: '84px', height: '84px', left: 540 - 42 + 'px', top: FCY - 42 + 'px', zIndex: 4 });

    // prompt bar
    const bar = el('div', 'glass dark', root);
    css(bar, { left: '85px', top: '1090px', width: '910px', height: '84px', borderRadius: '42px', display: 'flex', alignItems: 'center', gap: '18px', padding: '0 30px' });
    const bi = el('div', '', bar);
    bi.innerHTML = ICON.text;
    css(bi, { width: '36px', height: '36px', color: '#3ee6ff', flex: '0 0 36px' });
    const bl = el('div', 'label', bar);
    bl.textContent = 'Промпт';
    css(bl, { color: '#8ff3ff', flex: '0 0 auto' });
    const bt = el('div', '', bar);
    bt.textContent = PROMPT_SNIPPET;
    css(bt, { font: '500 28px Inter', color: '#d9e4ee', whiteSpace: 'nowrap', overflow: 'hidden' });
    const barGlow = el('div', 'ring', bar);
    css(barGlow, { borderRadius: '48px' });

    const main = heading(root, 'Ең маңыздысы — дұрыс референс пен нақты промпт', { y: 1232, size: 62, width: 920 });
    const sub = subline(root, 'Тәжірибе жасап, өз нәтижеңді жаса!', { y: 1468, size: 46 });

    const bloom = el('div', 'abs', root);
    css(bloom, { left: '-200px', top: '360px', width: '1480px', height: '1200px', background: 'radial-gradient(closest-side, rgba(62,230,255,0.35), rgba(62,230,255,0.08) 50%, transparent)' });

    cue(75.15, 'swish', { gain: 0.45 });
    cue(76.5, 'blip', { pitch: 1.0, gain: 0.4 });
    cue(79.35, 'blip', { pitch: 1.3, gain: 0.4 });
    cue(83.0, 'shimmer', { dur: 1.6, gain: 0.35 });
    cue(85.9, 'outro', { gain: 0.8 });

    return {
      update(lt, t) {
        const k1 = prog(t, 75.1, 1.0, ease.outQuint);
        const k2 = prog(t, 75.3, 1.0, ease.outQuint);
        const end = prog(t, 85.9, 1.5, ease.inOutSine);
        place(left.root, { x: (1 - k1) * -120, o: prog(t, 75.1, 0.4) * (1 - end), s: 1 + 0.02 * prog(t, 76.5, 0.6) * (1 - prog(t, 79.2, 0.6)) });
        place(right.root, { x: (1 - k2) * 120, o: prog(t, 75.3, 0.4) * (1 - end), s: 1 + 0.02 * prog(t, 79.3, 0.6) });
        css(left.ring, { opacity: (0.2 + 0.7 * prog(t, 76.5, 0.4) * (1 - prog(t, 79.2, 0.5) * 0.7)).toFixed(3) });
        css(right.ring, { opacity: (0.2 + 0.7 * prog(t, 79.3, 0.4)).toFixed(3) });
        lShot.update(t);
        rShot.update(t);
        place(mid, { s: lerp(0.3, 1, prog(t, 75.8, 0.5, ease.outBack)), o: prog(t, 75.8, 0.2) * (1 - end) });

        const kb = prog(t, 79.3, 0.7, ease.outQuint);
        place(bar, { o: prog(t, 79.3, 0.3) * (1 - end), y: (1 - kb) * 30 });
        css(bt, { clipPath: `inset(0 ${((1 - prog(t, 79.5, 1.2, ease.inOutSine)) * 100).toFixed(2)}% 0 0)` });
        css(barGlow, { opacity: (Math.max(0, 1 - Math.abs(t - 80.0) / 0.6) * 0.8).toFixed(3) });

        main.update(t, 75.6, 85.6);
        sub.update(t, 83.0, 85.8);
        const kg = prog(t, 85.4, 1.0, ease.inOutSine) * (1 - prog(t, 86.4, 1.4, ease.inOutSine));
        place(bloom, { o: kg, s: 0.8 + 0.3 * kg });
      },
    };
  },
};
