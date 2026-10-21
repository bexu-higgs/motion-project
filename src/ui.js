// Reusable interface pieces: headings, glass cards, chips, connection lines, cursor.
import { el, css, place, svgEl, attr, splitWords, splitChars, revealSpans, prog, ease, clamp, lerp, pathLen, drawPath } from './engine.js';
import { ICON, CURSOR_SVG } from './icons.js';

// Section heading. A leading "N." is coloured cyan but kept as part of the text.
export function heading(parent, text, { y = 200, size = 68, cls = 'h1', width } = {}) {
  const box = el('div', 'heading', parent);
  css(box, { top: y + 'px' });
  if (width) css(box, { left: (1080 - width) / 2 + 'px', right: (1080 - width) / 2 + 'px' });
  const h = el('div', cls, box);
  css(h, { fontSize: size + 'px' });
  const m = text.match(/^(\d+\.)\s(.*)$/);
  let words = [];
  if (m) {
    const n = el('span', 'w num', h);
    const ni = el('span', 'wi', n);
    ni.textContent = m[1];
    words.push(ni);
    h.appendChild(document.createTextNode(' '));
    words = words.concat(splitWords(h, m[2]));
  } else words = splitWords(h, text);
  return {
    box,
    words,
    update(t, tin, tout = Infinity, o = {}) {
      revealSpans(words, t, tin, { stagger: 0.05, dur: 0.8, dy: 46, blur: 12, exitAt: tout, exitDur: 0.35, ...o });
    },
  };
}

export function subline(parent, text, { y, size = 40, cls = 'sub' } = {}) {
  const box = el('div', 'heading', parent);
  css(box, { top: y + 'px' });
  const h = el('div', cls, box);
  css(h, { fontSize: size + 'px' });
  const words = splitWords(h, text);
  return {
    box,
    words,
    update(t, tin, tout = Infinity) {
      revealSpans(words, t, tin, { stagger: 0.06, dur: 0.7, dy: 26, blur: 8, exitAt: tout, exitDur: 0.3 });
    },
  };
}

// Glass-framed card holding a shot. (cx, cy) is the centre.
export function card(parent, { cx, cy, w, h, label, labelCls = '', icon, chipPos = 'top' }) {
  const root = el('div', 'card', parent);
  css(root, { width: w + 'px', height: h + 'px', left: cx - w / 2 + 'px', top: cy - h / 2 + 'px' });
  const ring = el('div', 'ring', root);
  const frame = el('div', 'frame', root);
  let chip = null;
  if (label) {
    chip = el('div', 'chip ' + labelCls, root);
    chip.innerHTML = (icon ? ICON[icon] : '<span class="dot"></span>') + `<span>${label}</span>`;
    if (chipPos === 'top') css(chip, { left: '18px', top: '18px' });
    else css(chip, { left: '50%', bottom: '-25px', transform: 'translateX(-50%)' });
  }
  return { root, frame, ring, chip, w, h, cx, cy };
}

export function chip(parent, html, cls = '', { x, y, center = true } = {}) {
  const c = el('div', 'chip ' + cls, parent);
  c.innerHTML = html;
  if (x != null) {
    css(c, { left: x + 'px', top: y + 'px' });
    if (center) css(c, { marginLeft: '0px' });
  }
  return c;
}

// SVG overlay with animated connection paths and travelling light pulses.
export function lines(parent) {
  const svg = svgEl('svg', { class: 'lines', width: 1080, height: 1920, viewBox: '0 0 1080 1920' }, parent);
  const defs = svgEl('defs', {}, svg);
  defs.innerHTML = `<filter id="lg" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
  <radialGradient id="pulse"><stop offset="0" stop-color="#fff"/><stop offset="0.35" stop-color="#8ff3ff"/><stop offset="1" stop-color="#3ee6ff" stop-opacity="0"/></radialGradient>`;
  const items = [];
  return {
    svg,
    add(d, { width = 2.5, color = '#3ee6ff', glow = true, pulses = 1, dashed = false } = {}) {
      const g = svgEl('g', {}, svg);
      const halo = glow ? svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': width * 4, opacity: 0.25, filter: 'url(#lg)' }, g) : null;
      const p = svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', opacity: 0.85 }, g);
      const dots = [];
      for (let i = 0; i < pulses; i++) dots.push(svgEl('circle', { r: 9, fill: 'url(#pulse)', opacity: 0 }, g));
      const it = { g, p, halo, dots, dashed };
      items.push(it);
      return it;
    },
    // k: draw progress 0..1, o: opacity, pt: pulse phase time
    set(it, k, o = 1, pt = 0, pulseSpeed = 0.9) {
      drawPath(it.p, k);
      if (it.halo) drawPath(it.halo, k);
      attr(it.g, { opacity: o.toFixed(3) });
      const L = pathLen(it.p);
      it.dots.forEach((d, i) => {
        if (k < 1 || o < 0.01) return attr(d, { opacity: 0 });
        const ph = (pt * pulseSpeed + i / it.dots.length) % 1;
        const pt2 = it.p.getPointAtLength(L * ph);
        const fade = Math.sin(ph * Math.PI);
        attr(d, { cx: pt2.x.toFixed(1), cy: pt2.y.toFixed(1), opacity: (fade * o).toFixed(3) });
      });
    },
  };
}

// Mouse pointer with click ripple.
export function cursor(parent) {
  const c = el('div', 'cursor', parent);
  c.innerHTML = CURSOR_SVG;
  const rip = el('div', 'ripple', parent);
  return {
    // path: [[t, x, y], ...]; clicks: [t, ...]
    update(t, path, clicks = [], { o = 1 } = {}) {
      let x = path[0][1], y = path[0][2];
      for (let i = 0; i < path.length - 1; i++) {
        const [t0, x0, y0] = path[i], [t1, x1, y1] = path[i + 1];
        if (t >= t0 && t <= t1) {
          const k = ease.inOutCubic(clamp((t - t0) / (t1 - t0)));
          x = lerp(x0, x1, k);
          y = lerp(y0, y1, k);
        } else if (t > t1) {
          x = x1;
          y = y1;
        }
      }
      let press = 0, rk = -1;
      for (const ct of clicks) {
        const d = t - ct;
        if (d > -0.08 && d < 0.18) press = Math.max(press, 1 - Math.abs(d - 0.04) / 0.14);
        if (d >= 0 && d < 0.6) rk = d / 0.6;
      }
      place(c, { x: x - 10, y: y - 6, s: 1 - press * 0.14, o, origin: '10px 6px' });
      if (rk >= 0) place(rip, { x, y, s: 0.2 + ease.outCubic(rk) * 1.1, o: (1 - rk) * o * 0.9 });
      else place(rip, { o: 0 });
      return { x, y };
    },
  };
}

// Typing: shows the first n characters plus a blinking caret.
export function typer(target, text) {
  const span = el('span', '', target);
  const caret = el('span', 'caret', target);
  const chars = [...text];
  let last = -1;
  return {
    update(t, start, cps, { caretOn = true } = {}) {
      const n = Math.max(0, Math.min(chars.length, Math.floor((t - start) * cps)));
      if (n !== last) {
        span.textContent = chars.slice(0, n).join('');
        last = n;
      }
      const typing = t >= start && n < chars.length;
      const blink = typing || Math.floor(t * 2.2) % 2 === 0;
      css(caret, { opacity: caretOn && blink ? '1' : '0' });
      return n / chars.length;
    },
  };
}

export { ICON };
