// SCENE 2 — WHAT IS A REFERENCE? One image guides new results.
import { el, css, place, prog, ease, lerp } from '../engine.js';
import { heading, subline, card, lines, ICON } from '../ui.js';
import { bustShot, walkShot } from '../shots.js';
import { cue } from '../timeline.js';

export default {
  build(root) {
    const head = heading(root, 'Референс дегеніміз не?', { y: 196, size: 72 });
    const sub = subline(root, 'AI-ға бағыт беретін үлгі', { y: 300, size: 42 });

    const L = lines(root);
    const PANELS = [
      { cx: 204, icon: 'mountain', make: (p) => bustShot(p, { w: 276, h: 368, env: 'forest', walk: false, seed: 4 }) },
      { cx: 540, icon: 'camera', make: (p) => bustShot(p, { w: 276, h: 368, env: 'dusk', s: 2.1, fy: 0.5, fx: 0.45, seed: 6 }) },
      { cx: 876, icon: 'run', make: (p) => walkShot(p, { w: 276, h: 368, figH: 0.7, groundY: 0.9, seed: 8 }) },
    ];
    const PY = 1214 + 184;
    const paths = PANELS.map((p) => L.add(`M540,1062 C540,1140 ${p.cx},1120 ${p.cx},1206`, { pulses: 2 }));

    const ref = card(root, { cx: 540, cy: 668, w: 400, h: 533, label: 'Референс', labelCls: 'cyan' });
    const refShot = bustShot(ref.frame, { w: 400, h: 533, env: 'studio', seed: 2 });

    const BADGES = ['image', 'person', 'video'].map((ic, i) => {
      const b = el('div', 'icon-badge', root);
      b.innerHTML = ICON[ic];
      css(b, { left: 540 - 48 + (i - 1) * 124 + 'px', top: 966 + 'px', color: '#8ff3ff' });
      return b;
    });
    const BT = [12.55, 13.3, 14.25];

    const panels = PANELS.map((p, i) => {
      const c = card(root, { cx: p.cx, cy: PY, w: 276, h: 368 });
      const shot = p.make(c.frame);
      if (i === 1) css(shot.root, { transform: 'rotate(-6deg) scale(1.12)' });
      const ic = el('div', 'icon-badge', c.root);
      ic.innerHTML = ICON[p.icon];
      css(ic, { width: '64px', height: '64px', left: '14px', top: '14px', color: '#8ff3ff' });
      css(ic.firstChild, { width: '32px', height: '32px' });
      return { c, shot, t0: 8.9 + i * 0.55 };
    });

    cue(6.85, 'blip', { pitch: 1.0, gain: 0.35 });
    cue(7.0, 'swish', { gain: 0.4 });
    cue(8.55, 'shimmer', { dur: 1.3, gain: 0.3 });
    panels.forEach((p, i) => cue(p.t0, 'pop', { pitch: 1 + i * 0.15, gain: 0.45 }));
    BT.forEach((t, i) => cue(t, 'blip', { pitch: 1.2 + i * 0.2, gain: 0.45 }));

    return {
      update(lt, t) {
        head.update(t, 6.8);
        sub.update(t, 7.7);
        const kr = prog(t, 7.0, 1.0, ease.outQuint);
        place(ref.root, { s: lerp(0.9, 1, kr), o: prog(t, 7.0, 0.4), y: (1 - kr) * 40 });
        place(ref.chip, { s: lerp(0.6, 1, prog(t, 7.6, 0.5, ease.outBack)), o: prog(t, 7.6, 0.25), origin: '0 50%' });
        // the reference "pulses" each time a reference type is named
        let pulse = 0;
        for (const bt of BT) pulse = Math.max(pulse, Math.max(0, 1 - Math.abs(t - bt - 0.15) / 0.4));
        css(ref.ring, { opacity: (0.25 * prog(t, 8, 0.6) + pulse * 0.75).toFixed(3) });
        refShot.update(t);
        BADGES.forEach((b, i) => {
          const k = prog(t, BT[i], 0.6, ease.outBack);
          place(b, { s: lerp(0.4, 1, k) * (1 + 0.08 * Math.max(0, 1 - Math.abs(t - BT[i] - 0.2) / 0.3)), o: prog(t, BT[i], 0.2), y: (1 - k) * 20 });
        });
        paths.forEach((p, i) => L.set(p, prog(t, 8.55 + i * 0.12, 0.7, ease.inOutCubic), 1, t + i * 0.33, 0.55));
        panels.forEach((p, i) => {
          const k = prog(t, p.t0, 0.9, ease.outQuint);
          place(p.c.root, { y: (1 - k) * 80 + Math.sin(t * 0.8 + i) * 4, s: lerp(0.85, 1, k), o: prog(t, p.t0, 0.35), blur: (1 - k) * 6 });
          p.shot.update(t + i);
        });
      },
    };
  },
};
