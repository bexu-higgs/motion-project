// SCENE 3 — USING AN IMAGE AS A REFERENCE: gallery → reference slot → prompt → result.
import { el, css, place, prog, ease, lerp, clamp } from '../engine.js';
import { heading, cursor, typer, ICON } from '../ui.js';
import { bustShot, plateShot } from '../shots.js';
import { cue } from '../timeline.js';

const WX = 80, WY = 500, WW = 920, WH = 1180;
const PROMPT = 'Осы кейіпкердің заманауи қала көшесімен баяу жүріп келе жатқанын көрсет.';

export default {
  build(root) {
    const head = heading(root, '1. Суретті референс ретінде пайдалану', { y: 176, size: 62, width: 900 });

    // formula row, built up step by step
    const row = el('div', 'abs', root);
    css(row, { left: '0', top: '372px', width: '1080px', height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' });
    const mk = (cls, txt) => {
      const e = el('div', cls, row);
      css(e, { position: 'relative' });
      e.textContent = txt;
      return e;
    };
    const fA = mk('pill', 'Сурет'), op1 = mk('op', '+'), fB = mk('pill', 'Промпт'), op2 = mk('op', '→'), fC = mk('pill cyan', 'Жаңа нәтиже');
    for (const p of [fA, fB, fC]) css(p, { height: '70px', fontSize: '33px', padding: '0 28px' });
    css(op1, { position: 'relative', width: '40px' });
    css(op2, { position: 'relative', width: '50px' });

    // app window
    const win = el('div', 'glass dark', root);
    css(win, { left: WX + 'px', top: WY + 'px', width: WW + 'px', height: WH + 'px' });
    const dots = el('div', 'abs', win);
    css(dots, { left: '34px', top: '30px', display: 'flex', gap: '12px' });
    for (const c of ['#ff6b6b', '#ffcf5a', '#4be38a']) css(el('div', '', dots), { width: '16px', height: '16px', borderRadius: '50%', background: c, opacity: '0.8' });
    const spark = el('div', 'abs', win);
    spark.innerHTML = ICON.sparkle;
    css(spark, { left: (WW - 70) + 'px', top: '22px', width: '34px', height: '34px', color: '#3ee6ff' });
    css(el('div', 'abs', win), { left: '0', top: '74px', width: WW + 'px', height: '1px', background: 'rgba(255,255,255,0.08)' });

    const lab = (txt, x, y) => {
      const e = el('div', 'abs label', win);
      e.textContent = txt;
      css(e, { left: x + 'px', top: y + 'px' });
      return e;
    };
    lab('Суреттер', 36, 96);
    const thumbs = [];
    const TH = 196;
    const gx = (i) => 36 + i * (TH + 21.3);
    const thumbMakers = [
      (p) => bustShot(p, { w: TH, h: TH, env: 'studio', s: 1.5, fy: 0.5, seed: 11 }),
      (p) => plateShot(p, { w: TH, h: TH, key: 'steppe', ox: 0.6, oy: 0.7 }),
      (p) => plateShot(p, { w: TH, h: TH, key: 'building', ox: 0.35, oy: 0.4 }),
      (p) => plateShot(p, { w: TH, h: TH, key: 'lab' }),
    ];
    thumbMakers.forEach((m, i) => {
      const c = el('div', 'card', win);
      css(c, { left: gx(i) + 'px', top: '136px', width: TH + 'px', height: TH + 'px' });
      const ring = el('div', 'ring', c);
      css(ring, { borderRadius: '24px' });
      const fr = el('div', 'frame', c);
      css(fr, { borderRadius: '18px' });
      const shot = m(fr);
      thumbs.push({ c, ring, shot });
    });
    const check = el('div', 'icon-badge', win);
    check.innerHTML = ICON.check;
    css(check, { width: '48px', height: '48px', left: gx(0) + TH - 58 + 'px', top: '146px', color: '#021216', background: '#3ee6ff' });
    css(check.firstChild, { width: '28px', height: '28px' });

    // reference slot
    const SX = 36, SY = 380, SW = 300, SH = 400;
    lab('Референс', SX, SY - 34);
    const slot = el('div', 'slot', win);
    css(slot, { left: SX + 'px', top: SY + 'px', width: SW + 'px', height: SH + 'px' });
    const up = el('div', 'abs', slot);
    up.innerHTML = ICON.upload;
    css(up, { left: SW / 2 - 30 + 'px', top: SH / 2 - 30 + 'px', width: '60px', height: '60px', color: 'rgba(143,243,255,0.6)' });
    const slotCard = el('div', 'card', win);
    css(slotCard, { left: SX + 'px', top: SY + 'px', width: SW + 'px', height: SH + 'px' });
    const slotRing = el('div', 'ring', slotCard);
    const slotFrame = el('div', 'frame', slotCard);
    const slotShot = bustShot(slotFrame, { w: SW, h: SH, env: 'studio', seed: 12 });

    // output
    const OX = 360, OY = 380, OW = 524, OH = 400;
    lab('Нәтиже', OX, OY - 34);
    const out = el('div', 'field', win);
    css(out, { left: OX + 'px', top: OY + 'px', width: OW + 'px', height: OH + 'px', overflow: 'hidden' });
    const film = el('div', 'abs', out);
    film.innerHTML = ICON.film;
    css(film, { left: OW / 2 - 34 + 'px', top: OH / 2 - 34 + 'px', width: '68px', height: '68px', color: 'rgba(255,255,255,0.18)' });
    const shimmer = el('div', 'abs', out);
    css(shimmer, { left: '-300px', top: '0', width: '300px', height: OH + 'px', background: 'linear-gradient(90deg, transparent, rgba(62,230,255,0.25), transparent)' });
    const resCard = el('div', 'card', win);
    css(resCard, { left: OX + 'px', top: OY + 'px', width: OW + 'px', height: OH + 'px' });
    const resRing = el('div', 'ring', resCard);
    const resFrame = el('div', 'frame', resCard);
    const result = bustShot(resFrame, { w: OW, h: OH, env: 'city', walk: true, s: 1.25, fy: 0.42, seed: 13 });
    const resScan = el('div', 'abs', resCard);
    css(resScan, { top: '-10px', width: '3px', height: OH + 20 + 'px', background: '#8ff3ff', boxShadow: '0 0 24px 6px rgba(62,230,255,0.7)' });

    // prompt
    lab('Промпт', 36, 820);
    const field = el('div', 'field', win);
    css(field, { left: '36px', top: '856px', width: '848px', height: '176px' });
    const ptext = el('div', 'prompt-text', field);
    css(ptext, { left: '28px', top: '22px', right: '28px' });
    const ty = typer(ptext, PROMPT);

    // generate
    const bar = el('div', 'bar', win);
    css(bar, { left: '36px', top: '1100px', width: '540px' });
    const barFill = el('i', '', bar);
    const pct = el('div', 'abs mono', win);
    css(pct, { left: '36px', top: '1060px', font: '600 24px Inter', color: '#8ff3ff' });
    const btn = el('div', 'btn', win);
    btn.innerHTML = ICON.sparkle + '<span>Жасау</span>';
    css(btn, { left: '604px', top: '1062px', width: '280px', height: '84px' });

    // drag ghost + cursor (stage coordinates)
    const ghost = el('div', 'card', root);
    css(ghost, { width: TH + 'px', height: TH + 'px', left: '0', top: '0' });
    const gfr = el('div', 'frame', ghost);
    const gshot = bustShot(gfr, { w: TH, h: TH, env: 'studio', s: 1.5, fy: 0.5, seed: 14 });
    const cur = cursor(root);

    const T1 = { x: WX + gx(0) + TH / 2, y: WY + 136 + TH / 2 };
    const SL = { x: WX + SX + SW / 2, y: WY + SY + SH / 2 };
    const PF = { x: WX + 420, y: WY + 944 };
    const BT = { x: WX + 744, y: WY + 1104 };
    const PATH = [[16.9, 990, 1560], [17.55, T1.x + 30, T1.y + 20], [18.25, T1.x + 30, T1.y + 20], [19.15, SL.x + 20, SL.y + 20], [20.35, SL.x + 20, SL.y + 20], [20.95, PF.x, PF.y], [23.6, PF.x, PF.y], [24.0, BT.x, BT.y], [25.9, BT.x, BT.y]];
    const CLICKS = [17.7, 21.0, 24.05];

    // sound
    cue(16.3, 'swish', { gain: 0.45 });
    cue(16.95, 'tick', { gain: 0.25 });
    CLICKS.forEach((c) => cue(c, 'click', { gain: 0.7 }));
    cue(18.3, 'lift', { gain: 0.4 });
    cue(19.2, 'drop', { gain: 0.8 });
    cue(19.35, 'blip', { pitch: 1.0, gain: 0.4 });
    cue(21.15, 'typing', { dur: PROMPT.length / 28, gain: 0.45 });
    cue(21.3, 'blip', { pitch: 1.2, gain: 0.35 });
    cue(24.1, 'process', { dur: 0.85, gain: 0.5 });
    cue(24.95, 'success', { gain: 0.6 });
    cue(25.05, 'blip', { pitch: 1.5, gain: 0.35 });

    return {
      update(lt, t) {
        head.update(t, 16.1);
        const kw = prog(t, 16.3, 1.0, ease.outQuint);
        place(win, { y: (1 - kw) * 120, o: prog(t, 16.3, 0.5), s: lerp(0.96, 1, kw) });

        // formula
        const pop = (e, t0) => place(e, { s: lerp(0.6, 1, prog(t, t0, 0.5, ease.outBack)), o: prog(t, t0, 0.25), y: (1 - prog(t, t0, 0.5, ease.outQuint)) * 20 });
        pop(fA, 19.35); pop(op1, 21.25); pop(fB, 21.3); pop(op2, 25.0); pop(fC, 25.05);

        thumbs.forEach((th, i) => {
          place(th.c, { o: prog(t, 16.6 + i * 0.08, 0.4), y: (1 - prog(t, 16.6 + i * 0.08, 0.6, ease.outQuint)) * 20 });
          th.shot.update(t);
        });
        const hover = prog(t, 17.4, 0.3);
        css(thumbs[0].ring, { opacity: Math.max(hover * 0.5, prog(t, 17.7, 0.2)) * (1 - prog(t, 19.3, 0.4) * 0.6) + '' });
        place(thumbs[0].c, { s: 1 + 0.04 * hover - 0.04 * prog(t, 17.7, 0.15) + 0.03 * prog(t, 17.85, 0.3, ease.outBack) - 0.03 * prog(t, 18.2, 0.2), o: prog(t, 16.6, 0.4) });
        place(check, { s: lerp(0.3, 1, prog(t, 17.75, 0.45, ease.outBack)), o: prog(t, 17.75, 0.2) });

        // drag ghost follows the cursor
        const c = cur.update(t, PATH, CLICKS, { o: prog(t, 16.9, 0.3) * (1 - prog(t, 25.4, 0.3)) });
        const dragging = t >= 18.25 && t < 19.25;
        const gk = prog(t, 18.25, 0.25);
        const gOut = prog(t, 19.15, 0.15);
        place(ghost, { x: c.x - 20 - TH / 2, y: c.y - 20 - TH / 2, s: 1 + 0.08 * gk, r: -3 * gk, o: dragging ? gk * (1 - gOut) * 0.95 : 0 });
        gshot.update(t);

        // slot fills on drop
        const kd = prog(t, 19.2, 0.55, ease.outBack);
        place(slotCard, { s: lerp(0.8, 1, kd), o: prog(t, 19.2, 0.15) });
        css(slotRing, { opacity: (Math.max(0, 1 - Math.abs(t - 19.5) / 0.5) * 0.9 + prog(t, 19.2, 0.3) * 0.3) + '' });
        css(slot, { borderColor: `rgba(143,243,255,${0.35 + 0.4 * prog(t, 18.6, 0.4) * (1 - prog(t, 19.2, 0.2))})` });
        slotShot.update(t);

        // prompt typing
        css(field, { borderColor: t > 21.0 ? 'rgba(62,230,255,0.5)' : 'rgba(255,255,255,0.12)' });
        ty.update(t, 21.15, 28, { caretOn: t > 21.0 && t < 24.1 });

        // generation
        const kp = prog(t, 24.1, 0.85, ease.inOutCubic);
        css(barFill, { transform: `scaleX(${kp.toFixed(4)})` });
        pct.textContent = t > 24.1 ? Math.round(kp * 100) + '%' : '';
        css(btn, { filter: `brightness(${1 + 0.4 * Math.max(0, 1 - Math.abs(t - 24.1) / 0.3)})` });
        const sh = (t - 24.1) / 0.5;
        css(shimmer, { transform: `translate3d(${(((sh % 1) + 1) % 1) * (OW + 300)}px,0,0)`, opacity: t > 24.1 && t < 25.0 ? '1' : '0' });
        const kv = prog(t, 24.95, 0.7, ease.inOutCubic);
        css(resFrame, { clipPath: `inset(0 ${((1 - kv) * 100).toFixed(2)}% 0 0 round 26px)` });
        css(resScan, { left: kv * OW + 'px', opacity: kv > 0 && kv < 1 ? '1' : '0' });
        css(resRing, { opacity: (Math.max(0, 1 - Math.abs(t - 25.5) / 0.6) * 0.8 + 0.25 * prog(t, 25.3, 0.4)) + '' });
        result.update(t);
      },
    };
  },
};
