// SCENE 4 — PRESERVING CHARACTER APPEARANCE: same face, new environments.
import { el, css, place, prog, ease, lerp, clamp, svgEl, attr, drawPath } from '../engine.js';
import { heading, card, ICON } from '../ui.js';
import { bustShot } from '../shots.js';
import { cue } from '../timeline.js';

const MW = 640, MH = 853, MCX = 540, MCY = 430 + MH / 2;
const ENVS = [
  { env: 'studio', walk: false },
  { env: 'city', walk: false },
  { env: 'forest', walk: true },
  { env: 'dusk', walk: false },
];
// [time, env index]
const CYCLE = [[25.9, 0], [28.65, 1], [30.15, 2], [31.65, 3], [33.15, 1], [34.65, 2], [36.15, 3]];
const CHIP_T = [31.75, 33.0, 34.6];

export default {
  build(root) {
    const head = heading(root, '2. Кейіпкердің келбетін сақтау', { y: 176, size: 64, width: 900 });

    // feature chips: «Бет-әлпет • Шаш үлгісі • Ерекшеліктер»
    const row = el('div', 'abs', root);
    css(row, { left: '0', top: '328px', width: '1080px', height: '64px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px' });
    const chips = [['face', 'Бет-әлпет'], ['hair', 'Шаш үлгісі'], ['target', 'Ерекшеліктер']].map(([ic, txt], i) => {
      if (i > 0) {
        const d = el('div', '', row);
        d.textContent = '•';
        css(d, { color: '#3ee6ff', font: '700 30px Inter', position: 'relative' });
        d.dataset.sep = i;
      }
      const c = el('div', 'chip out', row);
      c.innerHTML = ICON[ic] + `<span>${txt}</span>`;
      css(c, { position: 'relative', height: '58px', fontSize: '27px', letterSpacing: '0.02em', padding: '0 22px' });
      return c;
    });
    const seps = [...row.querySelectorAll('[data-sep]')];

    // main frame with cycling shots, identical face framing
    const main = card(root, { cx: MCX, cy: MCY, w: MW, h: MH });
    const shots = ENVS.map((e, i) => {
      const holder = el('div', 'fill', main.frame);
      const s = bustShot(holder, { w: MW, h: MH, env: e.env, walk: e.walk, s: 1.12, fy: 0.4, seed: 20 + i });
      return { holder, s };
    });
    const wipe = el('div', 'abs', main.root);
    css(wipe, { top: '-12px', width: '4px', height: MH + 24 + 'px', background: '#8ff3ff', boxShadow: '0 0 30px 8px rgba(62,230,255,0.7)', zIndex: 5 });
    const chipRef = el('div', 'chip cyan', main.root);
    chipRef.innerHTML = '<span class="dot" style="background:#021216;box-shadow:none"></span><span>Референс</span>';
    const chipRes = el('div', 'chip out', main.root);
    chipRes.innerHTML = '<span class="dot"></span><span>Нәтиже</span>';
    for (const c of [chipRef, chipRes]) css(c, { left: '20px', top: '20px', zIndex: 6 });

    // face-lock HUD
    const m = shots[0].s.map;
    const hud = svgEl('svg', { width: MW, height: MH, style: 'position:absolute;left:0;top:0;overflow:visible;z-index:4' }, main.root);
    const eyeL = m(246, 358), eyeR = m(333, 358), nose = m(290, 410), mouth = m(291, 456), mole = m(351, 398), chin = m(288, 490);
    const fb = { x: m(180, 0).x, y: m(0, 250).y, x2: m(410, 0).x, y2: m(0, 505).y };
    const corner = (x, y, dx, dy) => `M${x},${y + dy * 36} L${x},${y} L${x + dx * 36},${y}`;
    const boxG = svgEl('g', {}, hud);
    const boxPath = [corner(fb.x, fb.y, 1, 1), corner(fb.x2, fb.y, -1, 1), corner(fb.x, fb.y2, 1, -1), corner(fb.x2, fb.y2, -1, -1)].join(' ');
    const box = svgEl('path', { d: boxPath, fill: 'none', stroke: '#3ee6ff', 'stroke-width': 4, 'stroke-linecap': 'round' }, boxG);
    const boxGlow = svgEl('rect', { x: fb.x, y: fb.y, width: fb.x2 - fb.x, height: fb.y2 - fb.y, rx: 14, fill: 'rgba(62,230,255,0.06)', stroke: '#3ee6ff', 'stroke-width': 1.5, opacity: 0 }, boxG);
    const mesh = svgEl('path', { d: `M${eyeL.x},${eyeL.y} L${eyeR.x},${eyeR.y} L${nose.x},${nose.y} Z M${nose.x},${nose.y} L${mouth.x},${mouth.y} L${chin.x},${chin.y}`, fill: 'none', stroke: '#8ff3ff', 'stroke-width': 1.4, opacity: 0.55 }, hud);
    const marks = [eyeL, eyeR, nose, mouth, chin].map((p) => svgEl('circle', { cx: p.x, cy: p.y, r: 5, fill: '#8ff3ff' }, hud));
    const hairTop = m(300, 150), hl = m(176, 300), hr = m(424, 300);
    const hairArc = svgEl('path', { d: `M${hl.x},${hl.y} C${hl.x - 20},${hairTop.y - 30} ${hr.x + 20},${hairTop.y - 30} ${hr.x},${hr.y}`, fill: 'none', stroke: '#3ee6ff', 'stroke-width': 4, 'stroke-dasharray': '10 10', 'stroke-linecap': 'round' }, hud);
    const moleRing = svgEl('circle', { cx: mole.x, cy: mole.y, r: 26, fill: 'none', stroke: '#ffd27a', 'stroke-width': 3.5 }, hud);
    const moleDot = svgEl('circle', { cx: mole.x, cy: mole.y, r: 40, fill: 'none', stroke: '#ffd27a', 'stroke-width': 1.5, opacity: 0.5 }, hud);
    const ok = el('div', 'icon-badge', main.root);
    ok.innerHTML = ICON.check;
    css(ok, { width: '58px', height: '58px', left: fb.x2 - 22 + 'px', top: fb.y - 36 + 'px', color: '#021216', background: '#3ee6ff', zIndex: 6 });
    css(ok.firstChild, { width: '32px', height: '32px' });

    // thumbnail strip: reference + generated results
    const TW = 190, TH2 = 253, TY = 1330 + TH2 / 2;
    const thumbs = ENVS.map((e, i) => {
      const c = card(root, { cx: 540 + (i - 1.5) * 214, cy: TY, w: TW, h: TH2 });
      css(c.frame, { borderRadius: '18px' });
      css(c.ring, { borderRadius: '24px' });
      const s = bustShot(c.frame, { w: TW, h: TH2, env: e.env, walk: e.walk, s: 1.12, fy: 0.4, seed: 30 + i });
      let tag;
      if (i === 0) {
        tag = el('div', 'chip cyan', c.root);
        tag.innerHTML = '<span>Референс</span>';
        css(tag, { left: '50%', bottom: '-22px', height: '42px', fontSize: '19px', padding: '0 16px', transform: 'translateX(-50%)' });
      } else {
        tag = el('div', 'icon-badge', c.root);
        tag.innerHTML = ICON.check;
        css(tag, { width: '44px', height: '44px', left: TW / 2 - 22 + 'px', bottom: '-22px', color: '#3ee6ff' });
        css(tag.firstChild, { width: '24px', height: '24px' });
      }
      return { c, s, tag };
    });
    const strip = el('div', 'abs', root);
    css(strip, { left: '112px', top: TY - 1 + 'px', width: '856px', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(62,230,255,0.5), transparent)' });
    root.insertBefore(strip, thumbs[0].c.root);

    cue(25.95, 'swish', { gain: 0.4 });
    CYCLE.slice(1).forEach(([ct]) => cue(ct, 'wipe', { gain: 0.45 }));
    cue(28.8, 'scan', { dur: 0.8, gain: 0.3 });
    CYCLE.slice(1).forEach(([ct]) => cue(ct + 0.55, 'tick', { gain: 0.35, pitch: 1.4 }));
    CHIP_T.forEach((ct, i) => cue(ct, 'blip', { pitch: 1.1 + i * 0.2, gain: 0.45 }));
    thumbs.forEach((_, i) => cue(27.0 + i * 0.12, 'pop', { pitch: 1 + i * 0.1, gain: 0.25 }));

    return {
      update(lt, t) {
        head.update(t, 25.9);
        chips.forEach((c, i) => {
          const k = prog(t, CHIP_T[i], 0.5, ease.outBack);
          place(c, { s: lerp(0.6, 1, k), o: prog(t, CHIP_T[i], 0.2), y: (1 - k) * 18 });
          if (i > 0) place(seps[i - 1], { o: prog(t, CHIP_T[i] - 0.1, 0.3) });
        });

        const km = prog(t, 26.0, 1.0, ease.outQuint);
        place(main.root, { s: lerp(0.92, 1, km), o: prog(t, 26.0, 0.4), y: (1 - km) * 50 });

        // which shot is showing, and the incoming wipe
        let cur = 0, prev = 0, tc = 0;
        for (let i = 0; i < CYCLE.length; i++) if (t >= CYCLE[i][0]) { cur = CYCLE[i][1]; prev = i > 0 ? CYCLE[i - 1][1] : cur; tc = CYCLE[i][0]; }
        const kw = tc > 26 ? prog(t, tc, 0.6, ease.inOutCubic) : 1;
        shots.forEach((s, i) => {
          const showing = i === cur || (i === prev && kw < 1);
          css(s.holder, { display: showing ? 'block' : 'none', zIndex: i === cur ? '2' : '1' });
          if (i === cur) css(s.holder, { clipPath: kw < 1 ? `inset(0 ${((1 - kw) * 100).toFixed(2)}% 0 0)` : 'none' });
          if (showing) s.s.update(t);
        });
        css(wipe, { left: kw * MW - 2 + 'px', opacity: kw > 0 && kw < 1 ? '1' : '0' });
        const isRef = cur === 0;
        place(chipRef, { o: (isRef ? 1 : 0) * prog(t, 26.6, 0.3), s: 1 });
        place(chipRes, { o: isRef ? 0 : 1 });
        css(main.ring, { opacity: (tc > 26 ? Math.max(0, 1 - (t - tc) / 1.0) * 0.8 : 0) + 0.15 + '' });

        // HUD
        const kh = prog(t, 28.75, 0.6);
        const flash = tc > 28 ? Math.max(0, 1 - Math.abs(t - tc - 0.6) / 0.35) : 0;
        attr(boxG, { opacity: (kh * (0.75 + 0.25 * flash)).toFixed(3) });
        const faceHL = prog(t, CHIP_T[0], 0.4) * (1 - prog(t, CHIP_T[1], 0.4) * 0.7);
        attr(boxGlow, { opacity: (faceHL * 0.9).toFixed(3) });
        attr(mesh, { opacity: (0.55 * prog(t, 29.0, 0.6)).toFixed(3) });
        marks.forEach((mk, i) => attr(mk, { opacity: prog(t, 29.0 + i * 0.06, 0.3).toFixed(3), r: (4 + 2 * flash).toFixed(2) }));
        drawPath(hairArc, prog(t, CHIP_T[1], 0.8, ease.inOutCubic));
        attr(hairArc, { 'stroke-dashoffset': 0, opacity: 1 });
        const km2 = prog(t, CHIP_T[2], 0.6, ease.outBack);
        attr(moleRing, { r: (26 * km2).toFixed(2), opacity: prog(t, CHIP_T[2], 0.2).toFixed(3) });
        attr(moleDot, { r: (34 + ((t * 30) % 20)).toFixed(2), opacity: (0.5 * prog(t, CHIP_T[2] + 0.3, 0.3) * (1 - ((t * 1.5) % 1))).toFixed(3) });
        place(ok, { s: tc > 28 ? 0.7 + 0.3 * prog(t, tc + 0.5, 0.4, ease.outBack) : 0, o: tc > 28 ? prog(t, tc + 0.5, 0.2) : 0 });

        // thumbnails
        thumbs.forEach((th, i) => {
          const k = prog(t, 27.0 + i * 0.12, 0.8, ease.outQuint);
          const active = i === cur;
          place(th.c.root, { y: (1 - k) * 60, o: prog(t, 27.0 + i * 0.12, 0.3), s: active ? 1.05 : 1 });
          css(th.c.ring, { opacity: active ? '0.9' : '0' });
          th.s.update(t + i * 0.5);
          place(th.tag, { o: i === 0 ? 1 : prog(t, 28.8 + i * 0.2, 0.3), extra: i === 0 ? 'translateX(-50%)' : '' });
        });
      },
    };
  },
};
