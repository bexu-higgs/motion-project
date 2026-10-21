// SCENE 7 — PRACTICAL EXERCISE: a step-by-step workflow for beginners.
import { el, css, place, prog, ease, lerp, clamp, splitChars, revealSpans, svgEl, attr, splitWords } from '../engine.js';
import { card, cursor, ICON } from '../ui.js';
import { bustShot, walkShot } from '../shots.js';
import { cue } from '../timeline.js';

const STEPS = ['1. Кейіпкердің суретін таңда', '2. Референс ретінде жүкте', '3. Қажетті әрекетті сипатта', '4. Видео жаса'];
const STEP_T = [63.1, 65.0, 67.1, 70.0];
const PROMPT = 'Осы кейіпкердің сыртқы келбетін сақта. Оның заманауи қала көшесімен баяу жүріп келе жатқанын көрсет. Бет-әлпетін, шаш үлгісін және негізгі ерекшеліктерін өзгертпе.';
const WX = 80, WY = 690, WW = 920, WH = 990;
const RES_T = 72.35;

export default {
  build(root) {
    // big title that settles into the header
    const tb = el('div', 'heading', root);
    css(tb, { top: '820px', transformOrigin: '50% 0' });
    const tt = el('div', 'title-xl grad', tb);
    css(tt, { fontSize: '132px', letterSpacing: '0.1em', paddingLeft: '0.1em', whiteSpace: 'nowrap' });
    const tchars = splitChars(tt, 'ПРАКТИКА');
    tchars.forEach((c) => c.classList.add('grad'));
    const glow = el('div', 'abs', root);
    css(glow, { left: '140px', top: '720px', width: '800px', height: '360px', background: 'radial-gradient(closest-side, rgba(62,230,255,0.28), transparent)' });

    // step list
    const steps = STEPS.map((s, i) => {
      const r = el('div', 'step', root);
      css(r, { top: 318 + i * 84 + 'px' });
      const hl = el('div', 'hl', r);
      const m = s.match(/^(\d+\.)\s(.*)$/);
      const n = el('span', 'n', r);
      n.textContent = m[1];
      const txt = el('span', '', r);
      txt.textContent = m[2];
      const st = el('div', 'st', r);
      st.innerHTML = ICON.check;
      return { r, hl, n, txt, st };
    });

    // workspace
    const win = el('div', 'glass dark', root);
    css(win, { left: WX + 'px', top: WY + 'px', width: WW + 'px', height: WH + 'px' });
    const lab = (txt, x, y) => {
      const e = el('div', 'abs label', win);
      e.textContent = txt;
      css(e, { left: x + 'px', top: y + 'px' });
      return e;
    };
    const SX = 40, SY = 76, SW = 300, SH = 400;
    lab('Референс', SX, 36);
    const slot = el('div', 'slot', win);
    css(slot, { left: SX + 'px', top: SY + 'px', width: SW + 'px', height: SH + 'px' });
    const up = el('div', 'abs', slot);
    up.innerHTML = ICON.upload;
    css(up, { left: SW / 2 - 30 + 'px', top: SH / 2 - 30 + 'px', width: '60px', height: '60px', color: 'rgba(143,243,255,0.6)' });
    const upBar = el('div', 'bar', win);
    css(upBar, { left: SX + 'px', top: SY + SH + 22 + 'px', width: SW + 'px', height: '8px' });
    const upFill = el('i', '', upBar);
    const upOk = el('div', 'icon-badge', win);
    upOk.innerHTML = ICON.check;
    css(upOk, { width: '52px', height: '52px', left: SX + SW - 40 + 'px', top: SY - 12 + 'px', color: '#021216', background: '#3ee6ff', zIndex: 3 });
    css(upOk.firstChild, { width: '30px', height: '30px' });

    const PX = 370, PY = 76, PW = 510, PH = 400;
    lab('Промпт', PX, 36);
    const field = el('div', 'field', win);
    css(field, { left: PX + 'px', top: PY + 'px', width: PW + 'px', height: PH + 'px' });
    const ptext = el('div', 'prompt-text', field);
    css(ptext, { left: '26px', top: '22px', right: '22px', fontSize: '27.5px', lineHeight: '1.45' });
    const pwords = splitWords(ptext, PROMPT);

    const btn = el('div', 'btn', win);
    btn.innerHTML = ICON.sparkle + '<span>Жасау</span>';
    css(btn, { left: PX + PW - 280 + 'px', top: '520px', width: '280px', height: '84px' });

    // generation area
    const GA = { x: 40, y: 640, w: 840, h: 310 };
    const ga = el('div', 'field', win);
    css(ga, { left: GA.x + 'px', top: GA.y + 'px', width: GA.w + 'px', height: GA.h + 'px' });
    const ringSvg = svgEl('svg', { width: 240, height: 240, viewBox: '0 0 240 240', style: `position:absolute;left:${GA.w / 2 - 120}px;top:${GA.h / 2 - 120}px` }, ga);
    svgEl('circle', { cx: 120, cy: 120, r: 96, fill: 'none', stroke: 'rgba(255,255,255,0.08)', 'stroke-width': 12 }, ringSvg);
    const ring = svgEl('circle', { cx: 120, cy: 120, r: 96, fill: 'none', stroke: '#3ee6ff', 'stroke-width': 12, 'stroke-linecap': 'round', transform: 'rotate(-90 120 120)', 'stroke-dasharray': '0 1000' }, ringSvg);
    const ringGlow = svgEl('circle', { cx: 120, cy: 120, r: 96, fill: 'none', stroke: '#3ee6ff', 'stroke-width': 26, opacity: 0.25, transform: 'rotate(-90 120 120)', 'stroke-dasharray': '0 1000', style: 'filter:blur(8px)' }, ringSvg);
    const pct = el('div', 'abs mono', ga);
    css(pct, { left: GA.w / 2 - 100 + 'px', top: GA.h / 2 - 30 + 'px', width: '200px', textAlign: 'center', font: '700 52px Inter', color: '#eef6fb' });
    const gaIcon = el('div', 'abs', ga);
    gaIcon.innerHTML = ICON.film;
    css(gaIcon, { left: GA.w / 2 - 36 + 'px', top: GA.h / 2 - 36 + 'px', width: '72px', height: '72px', color: 'rgba(255,255,255,0.16)' });

    // the portrait chosen in step 1 (stage coordinates)
    const pick = card(root, { cx: 540, cy: WY + GA.y + GA.h / 2, w: 210, h: 280 });
    const pickShot = bustShot(pick.frame, { w: 210, h: 280, env: 'studio', seed: 60 });
    const slotC = { cx: WX + SX + SW / 2, cy: WY + SY + SH / 2 };

    // result: vertical video
    const RW = 560, RH = 996;
    const res = card(root, { cx: 560, cy: 1150, w: RW, h: RH, label: 'Нәтиже', labelCls: 'cyan' });
    const resShot = walkShot(res.frame, { w: RW, h: RH, figH: 0.56, groundY: 0.86, seed: 61 });
    const resScan = el('div', 'abs', res.root);
    css(resScan, { left: '-10px', width: RW + 20 + 'px', height: '3px', background: '#8ff3ff', boxShadow: '0 0 24px 6px rgba(62,230,255,0.7)' });
    res.root.appendChild(res.chip);
    const refPin = card(root, { cx: 210, cy: 1430, w: 190, h: 253, label: 'Референс', chipPos: 'bottom' });
    css(refPin.chip, { height: '42px', fontSize: '19px', bottom: '-21px' });
    const refPinShot = bustShot(refPin.frame, { w: 190, h: 253, env: 'studio', seed: 62 });

    const cur = cursor(root);
    const BTN = { x: WX + PX + PW - 140, y: WY + 562 };
    const PATH = [[63.3, 1000, 1700], [63.8, 560, WY + GA.y + GA.h / 2 + 40], [65.0, 560, WY + GA.y + GA.h / 2 + 40], [65.7, slotC.cx + 20, slotC.cy + 30], [69.6, slotC.cx + 20, slotC.cy + 30], [70.2, BTN.x, BTN.y], [72.4, BTN.x + 40, BTN.y + 60]];
    const CLICKS = [63.95, 70.3];

    cue(61.15, 'boom', { gain: 0.6 });
    cue(61.2, 'shimmer', { dur: 1.4, gain: 0.3 });
    cue(62.6, 'swish', { gain: 0.45 });
    STEP_T.forEach((t0, i) => cue(t0, 'blip', { pitch: 1 + i * 0.15, gain: 0.5 }));
    CLICKS.forEach((c) => cue(c, 'click', { gain: 0.7 }));
    cue(65.1, 'lift', { gain: 0.4 });
    cue(65.75, 'drop', { gain: 0.7 });
    cue(65.8, 'upload', { dur: 0.9, gain: 0.35 });
    cue(66.75, 'success', { gain: 0.35, pitch: 1.3 });
    cue(67.25, 'typing', { dur: 2.4, gain: 0.4 });
    cue(70.4, 'process', { dur: 1.9, gain: 0.5 });
    cue(72.3, 'reveal', { gain: 0.6 });
    cue(72.45, 'success', { gain: 0.55 });

    return {
      update(lt, t) {
        // title: big centre → header
        revealSpans(tchars, t, 61.15, { stagger: 0.045, dur: 0.9, dy: 70, blur: 16 });
        const km = prog(t, 62.55, 0.9, ease.inOutCubic);
        place(tb, { y: lerp(0, 180 - 820, km), s: lerp(1, 0.5, km), origin: '50% 0' });
        place(glow, { o: prog(t, 61.1, 0.6) * (1 - km), s: 1 + 0.1 * Math.sin(t * 2) });

        steps.forEach((s, i) => {
          const t0 = STEP_T[i];
          const k = prog(t, t0, 0.6, ease.outQuint);
          const active = t >= t0 && (i === 3 ? t < RES_T : t < STEP_T[i + 1]);
          const done = i < 3 ? t >= STEP_T[i + 1] : t >= RES_T;
          const dim = prog(t, RES_T - 0.2, 0.5);
          place(s.r, { x: (1 - k) * -40, o: prog(t, t0, 0.3) * (1 - dim * 0.75) });
          css(s.hl, { opacity: active ? '1' : '0' });
          css(s.txt, { color: done ? '#8b98a8' : '#eef6fb' });
          css(s.st, { background: done ? '#3ee6ff' : 'transparent', borderColor: done ? '#3ee6ff' : active ? 'rgba(62,230,255,0.6)' : 'rgba(255,255,255,0.2)', color: done ? '#021216' : 'transparent' });
        });

        const kw = prog(t, 62.9, 0.9, ease.outQuint);
        const wdim = prog(t, RES_T - 0.1, 0.6);
        place(win, { y: (1 - kw) * 120, o: prog(t, 62.9, 0.4) * (1 - wdim * 0.7), blur: wdim * 6 });

        // step 1 → 2: pick and upload
        const kp = prog(t, 63.1, 0.6, ease.outBack);
        const kf = prog(t, 65.1, 0.7, ease.inOutCubic);
        const from = { x: 540, y: WY + GA.y + GA.h / 2 };
        const s1 = SW / 210;
        place(pick.root, {
          x: lerp(0, slotC.cx - from.x, kf), y: lerp(0, slotC.cy - from.y, kf) + (1 - kw) * 120,
          s: lerp(0.7, 1, kp) * lerp(1, s1, kf) * (1 + 0.04 * Math.max(0, 1 - Math.abs(t - 64.0) / 0.25)),
          o: prog(t, 63.1, 0.25) * (1 - wdim * 0.7), blur: wdim * 6,
        });
        css(pick.ring, { opacity: (prog(t, 63.95, 0.2) * (1 - prog(t, 66.7, 0.4)) * 0.9).toFixed(3) });
        pickShot.update(t);
        css(gaIcon, { opacity: (prog(t, 65.6, 0.4) * (1 - prog(t, 70.3, 0.2))).toFixed(3) });
        const ku = prog(t, 65.8, 0.9, ease.inOutCubic);
        css(upFill, { transform: `scaleX(${ku.toFixed(4)})` });
        place(upOk, { s: lerp(0.3, 1, prog(t, 66.7, 0.45, ease.outBack)), o: prog(t, 66.7, 0.2) });
        css(slot, { borderColor: `rgba(143,243,255,${0.35 + 0.45 * prog(t, 65.3, 0.3) * (1 - prog(t, 65.8, 0.3))})` });

        // step 3: prompt
        css(field, { borderColor: t > 67.1 && t < 70.2 ? 'rgba(62,230,255,0.5)' : 'rgba(255,255,255,0.12)' });
        pwords.forEach((w, i) => {
          const k = prog(t, 67.25 + i * 0.11, 0.25);
          css(w, { opacity: k.toFixed(3), transform: `translate3d(0,${((1 - k) * 8).toFixed(2)}px,0)` });
        });

        // step 4: generate
        css(btn, { filter: `brightness(${1 + 0.45 * Math.max(0, 1 - Math.abs(t - 70.3) / 0.3)})` });
        const kg = prog(t, 70.4, 1.9, ease.inOutSine);
        const C = 2 * Math.PI * 96;
        const showRing = t > 70.35;
        attr(ring, { 'stroke-dasharray': `${(C * kg).toFixed(1)} 1000`, opacity: showRing ? 1 : 0 });
        attr(ringGlow, { 'stroke-dasharray': `${(C * kg).toFixed(1)} 1000`, opacity: showRing ? 0.25 : 0 });
        pct.textContent = showRing ? Math.round(kg * 100) + '%' : '';

        // reveal the vertical video
        const kr = prog(t, RES_T, 0.9, ease.outQuint);
        place(res.root, { o: prog(t, RES_T, 0.3), s: lerp(0.8, 1, kr), y: (1 - kr) * 80 });
        const ks = prog(t, RES_T, 0.8, ease.inOutCubic);
        css(res.frame, { clipPath: `inset(0 0 ${((1 - ks) * 100).toFixed(2)}% 0 round 26px)` });
        css(resScan, { top: ks * RH + 'px', opacity: ks > 0 && ks < 1 ? '1' : '0' });
        css(res.ring, { opacity: (Math.max(0, 1 - Math.abs(t - RES_T - 0.9) / 0.6) * 0.8 + 0.2 * prog(t, RES_T + 0.8, 0.4)).toFixed(3) });
        place(res.chip, { o: prog(t, RES_T + 0.6, 0.3), origin: '0 50%', s: lerp(0.7, 1, prog(t, RES_T + 0.6, 0.5, ease.outBack)) });
        resShot.update(t);
        const kpin = prog(t, RES_T + 0.7, 0.7, ease.outBack);
        place(refPin.root, { o: prog(t, RES_T + 0.7, 0.3), s: lerp(0.6, 1, kpin), r: -5 * kpin, x: (1 - kpin) * -60 });
        place(refPin.chip, { extra: 'translateX(-50%)' });
        refPinShot.update(t);

        cur.update(t, PATH, CLICKS, { o: prog(t, 63.3, 0.3) * (1 - prog(t, 72.2, 0.3)) });
      },
    };
  },
};
