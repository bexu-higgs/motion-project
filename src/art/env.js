// Procedural environment art (SVG strings). Layers are rasterised once at
// load time and then animated with parallax in the scenes.
import { rng } from '../engine.js';

const f = (n) => n.toFixed(1);

// ---------------------------------------------------------------- city night
// Wide, horizontally tileable layers (W×H) for tracking shots.
export function citySky(W = 2400, H = 1400) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#03060d"/><stop offset="0.45" stop-color="#0a1626"/><stop offset="0.72" stop-color="#16324a"/><stop offset="1" stop-color="#0d2030"/></linearGradient>
<radialGradient id="h" cx="0.5" cy="0.7" r="0.6"><stop offset="0" stop-color="#2a6a8a" stop-opacity="0.55"/><stop offset="1" stop-color="#2a6a8a" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#h)"/></svg>`;
}

function towers(r, W, H, { count, minW, maxW, minH, maxH, base, color, win, winK, neon, seedShift = 0 }) {
  let out = '';
  let x = -40;
  const items = [];
  while (x < W) {
    const w = minW + r() * (maxW - minW);
    const h = minH + r() * (maxH - minH);
    items.push({ x, w, h });
    x += w * (0.7 + r() * 0.5);
  }
  for (const it of items) {
    for (const dx of [0, W]) {
      const X = it.x + dx;
      if (X > W + 50) continue;
      const top = base - it.h;
      out += `<rect x="${f(X)}" y="${f(top)}" width="${f(it.w)}" height="${f(it.h + 40)}" fill="${color}"/>`;
      // crown details
      if (r() > 0.6) out += `<rect x="${f(X + it.w * 0.4)}" y="${f(top - 40 - r() * 60)}" width="${f(3 + r() * 3)}" height="80" fill="${color}"/>`;
    }
  }
  // windows (separate pass so both tile copies share the same pattern)
  const wr = rng(99 + seedShift);
  for (const it of items) {
    const cols = Math.max(2, Math.floor(it.w / 16));
    const rows = Math.floor(it.h / 22);
    const lit = wr() * 0.5 + 0.15;
    let cells = '';
    for (let cy = 1; cy < rows; cy++)
      for (let cx = 0; cx < cols; cx++) {
        if (wr() > lit) continue;
        const warm = wr() > 0.72;
        cells += `<rect x="${f(it.x + 6 + cx * (it.w - 10) / cols)}" y="${f(base - it.h + cy * 22)}" width="${f((it.w - 10) / cols - 5)}" height="9" fill="${warm ? '#ffc890' : win}" opacity="${(winK * (0.35 + wr() * 0.65)).toFixed(2)}"/>`;
      }
    out += `<g>${cells}</g><g transform="translate(${W},0)">${cells}</g>`;
    if (neon && wr() > 0.55) {
      const nx = it.x + (wr() > 0.5 ? 4 : it.w - 8);
      const nc = wr() > 0.35 ? '#3ee6ff' : '#ff5fa8';
      const seg = `<rect x="${f(nx)}" y="${f(base - it.h * 0.9)}" width="4" height="${f(it.h * 0.6)}" fill="${nc}" opacity="0.9"/><rect x="${f(nx - 8)}" y="${f(base - it.h * 0.9)}" width="20" height="${f(it.h * 0.6)}" fill="${nc}" opacity="0.18" filter="url(#nb)"/>`;
      out += seg + `<g transform="translate(${W},0)">${seg}</g>`;
    }
  }
  return out;
}

export function cityFar(W = 2400, H = 1400) {
  const r = rng(11);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><filter id="nb"><feGaussianBlur stdDeviation="6"/></filter>
<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#1b3a52" stop-opacity="0"/><stop offset="1" stop-color="#1b3a52" stop-opacity="0.85"/></linearGradient></defs>
${towers(r, W, H, { minW: 60, maxW: 150, minH: 260, maxH: 620, base: 1060, color: '#0e1b2b', win: '#7fdcff', winK: 0.45, neon: false })}
<rect y="500" width="${W}" height="600" fill="url(#fog)"/></svg>`;
}

export function cityMid(W = 2400, H = 1400) {
  const r = rng(23);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><filter id="nb"><feGaussianBlur stdDeviation="7"/></filter>
<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0.6" stop-color="#10283a" stop-opacity="0"/><stop offset="1" stop-color="#10283a" stop-opacity="0.9"/></linearGradient></defs>
${towers(r, W, H, { minW: 120, maxW: 260, minH: 420, maxH: 980, base: 1160, color: '#08111c', win: '#9be8ff', winK: 0.7, neon: true, seedShift: 5 })}
<rect y="600" width="${W}" height="600" fill="url(#fog)"/></svg>`;
}

export function cityNear(W = 2400, H = 1400) {
  const r = rng(37);
  let lamps = '';
  for (let x = 120; x < W; x += 600) {
    const g = `<rect x="${x}" y="560" width="10" height="700" fill="#05080d"/>
<path d="M${x + 5},570 C${x + 5},540 ${x + 40},528 ${x + 90},530" stroke="#05080d" stroke-width="8" fill="none"/>
<ellipse cx="${x + 92}" cy="538" rx="26" ry="7" fill="#ffe2b8"/>
<circle cx="${x + 92}" cy="545" r="90" fill="#ffcf91" opacity="0.18" filter="url(#lb)"/>`;
    lamps += g;
  }
  let panels = '';
  for (let x = 380; x < W; x += 600) {
    panels += `<rect x="${x}" y="760" width="${180 + r() * 60}" height="300" rx="6" fill="#0a1a26" opacity="0.7" stroke="#3ee6ff" stroke-opacity="0.35" stroke-width="2"/>
<rect x="${x + 16}" y="780" width="${120}" height="6" fill="#3ee6ff" opacity="0.55"/><rect x="${x + 16}" y="800" width="${80}" height="6" fill="#3ee6ff" opacity="0.3"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><filter id="lb" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="30"/></filter>
<linearGradient id="st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1520"/><stop offset="1" stop-color="#04070b"/></linearGradient></defs>
${panels}${lamps}
<rect y="1060" width="${W}" height="${H - 1060}" fill="url(#st)"/>
<rect y="1060" width="${W}" height="3" fill="#3ee6ff" opacity="0.25"/></svg>`;
}

// ---------------------------------------------------------------- forest
export function forestLayer(depth, W = 2400, H = 1400) {
  const r = rng(51 + depth * 7);
  const cfg = [
    { n: 22, w: [16, 30], col: '#4a6a60', op: 0.55 },
    { n: 11, w: [34, 56], col: '#22382f', op: 0.85 },
    { n: 5, w: [80, 130], col: '#0b1412', op: 1 },
  ][depth];
  let trunks = '';
  for (let i = 0; i < cfg.n; i++) {
    const x = (i / cfg.n) * W + r() * (W / cfg.n) * 0.8;
    const w = cfg.w[0] + r() * (cfg.w[1] - cfg.w[0]);
    const t = `<path d="M${f(x)},-20 L${f(x + w)},-20 L${f(x + w * 1.08)},${H} L${f(x - w * 0.08)},${H} Z" fill="${cfg.col}"/>`;
    trunks += t;
    if (x < 300) trunks += `<g transform="translate(${W},0)">${t}</g>`;
    if (depth === 2) trunks += `<path d="M${f(x + w * 0.75)},-20 L${f(x + w)},-20 L${f(x + w * 1.08)},${H} L${f(x + w * 0.8)},${H} Z" fill="#c7ffb8" opacity="0.09"/>`;
  }
  let ground = '';
  if (depth === 2) {
    ground += `<path d="M0,1250 C600,1200 1800,1220 ${W},1250 L${W},${H} L0,${H} Z" fill="#0c1612"/>`;
    for (let i = 0; i < 220; i++) {
      const x = r() * W, y = 1240 + r() * 150, h = 30 + r() * 70;
      ground += `<path d="M${f(x)},${f(y)} q${f(-6 + r() * 12)},${f(-h * 0.6)} ${f(-14 + r() * 28)},${f(-h)}" stroke="#16281f" stroke-width="4" fill="none"/>`;
    }
  }
  const fog = depth < 2 ? `<rect width="${W}" height="${H}" fill="#a8d8c0" opacity="${depth === 0 ? 0.12 : 0.05}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${trunks}${ground}${fog}</svg>`;
}
export function forestSky(W = 2400, H = 1400) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c4a40"/><stop offset="0.5" stop-color="#6f8f72"/><stop offset="1" stop-color="#1a2a24"/></linearGradient>
<radialGradient id="sun" cx="0.3" cy="0.15" r="0.5"><stop offset="0" stop-color="#fff2c0" stop-opacity="0.9"/><stop offset="1" stop-color="#fff2c0" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#sun)"/>
<path d="M600,0 L900,0 L1500,${H} L700,${H} Z" fill="#fff6d0" opacity="0.10"/>
<path d="M1100,0 L1250,0 L2100,${H} L1700,${H} Z" fill="#fff6d0" opacity="0.07"/></svg>`;
}

// ---------------------------------------------------------------- futuristic building at dusk
export function buildingScene(W = 1400, H = 1400) {
  const r = rng(71);
  let small = '';
  for (let i = 0; i < 26; i++) {
    const x = r() * W, w = 50 + r() * 120, h = 120 + r() * 320;
    small += `<rect x="${f(x)}" y="${f(1060 - h)}" width="${f(w)}" height="${f(h + 20)}" fill="#1a1630"/>`;
  }
  let bands = '';
  for (let i = 0; i < 26; i++) {
    const y = 300 + i * 30;
    const k = (y - 260) / 820;
    const half = 70 + k * 190 + Math.sin(k * 3.2) * 30;
    bands += `<path d="M${f(560 - half)},${y} L${f(560 + half)},${y}" stroke="#ffd6a0" stroke-width="3" opacity="${(0.35 + (i % 3 === 0 ? 0.45 : 0)).toFixed(2)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1430"/><stop offset="0.45" stop-color="#3a2f5c"/><stop offset="0.7" stop-color="#c0646a"/><stop offset="0.85" stop-color="#f0a070"/><stop offset="1" stop-color="#2a1a2a"/></linearGradient>
<linearGradient id="tw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a3a66"/><stop offset="0.55" stop-color="#5a6aa0"/><stop offset="0.6" stop-color="#9fb8e8"/><stop offset="1" stop-color="#1c2448"/></linearGradient>
<filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter></defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<circle cx="980" cy="880" r="120" fill="#ffd2a0" opacity="0.5" filter="url(#gl)"/>
${small}
<!-- monumental tower -->
<path d="M500,1080 C470,820 470,520 540,250 C548,220 572,220 580,250 C650,520 650,820 620,1080 Z" fill="url(#tw)"/>
<path d="M330,1080 C380,900 460,780 560,760 C660,780 740,900 790,1080 Z" fill="#232c52" opacity="0.95"/>
${bands}
<ellipse cx="560" cy="560" rx="230" ry="38" fill="none" stroke="#7fe8ff" stroke-width="6" opacity="0.9"/>
<ellipse cx="560" cy="560" rx="230" ry="38" fill="none" stroke="#7fe8ff" stroke-width="22" opacity="0.25" filter="url(#gl)"/>
<path d="M560,250 L560,120" stroke="#9fb8e8" stroke-width="5"/><circle cx="560" cy="118" r="7" fill="#ff8a7a"/>
<rect y="1060" width="${W}" height="${H - 1060}" fill="#120e1e"/>
<path d="M0,1062 L${W},1062" stroke="#ffb27a" stroke-width="3" opacity="0.5"/></svg>`;
}

// ---------------------------------------------------------------- laboratory
export function labScene(W = 1600, H = 1400, { warm = 0.6 } = {}) {
  const vp = { x: 800, y: 640 };
  let ceil = '', floor = '', walls = '';
  for (let i = -6; i <= 6; i++) {
    const xb = vp.x + i * 260;
    ceil += `<path d="M${vp.x + i * 30},${vp.y - 160} L${xb},-40" stroke="#bff6ff" stroke-width="${i % 2 ? 2 : 6}" opacity="${i % 2 ? 0.15 : 0.55}"/>`;
    floor += `<path d="M${vp.x + i * 34},${vp.y + 220} L${vp.x + i * 420},${H}" stroke="#3ee6ff" stroke-width="2" opacity="0.18"/>`;
  }
  for (let k = 0; k < 7; k++) {
    const y = vp.y + 220 + Math.pow(k / 6, 2) * (H - vp.y - 220);
    floor += `<path d="M0,${f(y)} L${W},${f(y)}" stroke="#3ee6ff" stroke-width="1.5" opacity="0.1"/>`;
  }
  // back wall panels with light strips
  for (let i = 0; i < 9; i++) {
    const x = vp.x - 420 + i * 105;
    walls += `<rect x="${x}" y="${vp.y - 160}" width="92" height="380" fill="#0d1c26" stroke="#2a4a5a" stroke-width="2"/>`;
    if (i % 2 === 0) walls += `<rect x="${x + 42}" y="${vp.y - 140}" width="8" height="340" fill="#7ff0ff" opacity="0.85"/><rect x="${x + 30}" y="${vp.y - 140}" width="32" height="340" fill="#7ff0ff" opacity="0.2" filter="url(#b)"/>`;
  }
  const holo = (x, y, w, h) => `<g opacity="0.95"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#0b2a36" fill-opacity="0.55" stroke="#5feaff" stroke-width="2.5"/>
<path d="M${x + 20},${y + h - 30} L${x + w * 0.3},${y + h * 0.5} L${x + w * 0.5},${y + h * 0.62} L${x + w * 0.75},${y + h * 0.3} L${x + w - 20},${y + h * 0.4}" fill="none" stroke="#5feaff" stroke-width="3"/>
<rect x="${x + 20}" y="${y + 18}" width="${w * 0.4}" height="6" fill="#5feaff" opacity="0.7"/><rect x="${x + 20}" y="${y + 32}" width="${w * 0.25}" height="6" fill="#5feaff" opacity="0.4"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050b10"/><stop offset="0.45" stop-color="#0c1c26"/><stop offset="1" stop-color="#03070a"/></linearGradient>
<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="bb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>
<radialGradient id="warm" cx="0.85" cy="0.35" r="0.6"><stop offset="0" stop-color="#ff9a4a" stop-opacity="${0.55 * warm}"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${ceil}${walls}${floor}
<rect x="${vp.x - 440}" y="${vp.y + 216}" width="880" height="6" fill="#7ff0ff" opacity="0.5"/>
${holo(140, 420, 330, 220)}${holo(1130, 380, 320, 240)}
<!-- glass partitions -->
<path d="M60,300 L300,360 L300,1100 L60,1250 Z" fill="#9fefff" opacity="0.05" stroke="#9fefff" stroke-opacity="0.25" stroke-width="2"/>
<path d="M1540,300 L1300,360 L1300,1100 L1540,1250 Z" fill="#9fefff" opacity="0.05" stroke="#9fefff" stroke-opacity="0.25" stroke-width="2"/>
<rect width="${W}" height="${H}" fill="url(#warm)"/>
<ellipse cx="800" cy="700" rx="420" ry="200" fill="#3ee6ff" opacity="0.12" filter="url(#bb)"/></svg>`;
}

// ---------------------------------------------------------------- style reference: light & composition
export function styleScene(W = 1200, H = 1500) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#061016"/><stop offset="1" stop-color="#0d1a20"/></linearGradient>
<linearGradient id="beam" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb066" stop-opacity="0.85"/><stop offset="1" stop-color="#ff8a3a" stop-opacity="0"/></linearGradient>
<filter id="b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
<filter id="b2"><feGaussianBlur stdDeviation="4"/></filter></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<!-- window -->
<rect x="820" y="160" width="300" height="520" fill="#ffd9a8"/>
<path d="M970,160 L970,680 M820,420 L1120,420" stroke="#1a1410" stroke-width="16"/>
<!-- volumetric beam -->
<path d="M820,160 L1120,160 L620,1500 L-100,1500 Z" fill="url(#beam)" opacity="0.6" filter="url(#b)"/>
<path d="M120,1180 L900,1180 L760,1500 L-60,1500 Z" fill="#ffb066" opacity="0.35" filter="url(#b)"/>
<!-- floor -->
<rect y="1180" width="${W}" height="${H - 1180}" fill="#0a1216" opacity="0.6"/>
<!-- lone figure on the left third -->
<g transform="translate(400,1180)">
  <ellipse cx="0" cy="0" rx="110" ry="14" fill="#000" opacity="0.6"/>
  <path d="M-56,0 L-40,-360 C-60,-380 -66,-470 -40,-500 C-20,-520 20,-520 40,-500 C66,-470 60,-380 40,-360 L56,0 Z" fill="#050809"/>
  <circle cx="0" cy="-560" r="52" fill="#050809"/>
  <path d="M40,-500 C66,-470 60,-380 40,-360 L56,0" fill="none" stroke="#ffb066" stroke-width="8" opacity="0.8" filter="url(#b2)"/>
  <path d="M38,-600 C56,-580 56,-540 46,-520" fill="none" stroke="#ffb066" stroke-width="7" opacity="0.8" filter="url(#b2)"/>
  <path d="M-40,-500 C-66,-470 -60,-380 -40,-360 L-56,0" fill="none" stroke="#2fe3ff" stroke-width="6" opacity="0.55" filter="url(#b2)"/>
</g></svg>`;
}

// ---------------------------------------------------------------- studio (source video)
export function studioScene(W = 1600, H = 900) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><radialGradient id="bg" cx="0.5" cy="0.45" r="0.8"><stop offset="0" stop-color="#3e444d"/><stop offset="0.6" stop-color="#262a31"/><stop offset="1" stop-color="#14171b"/></radialGradient>
<linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3037"/><stop offset="1" stop-color="#1a1d22"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<path d="M0,640 C400,610 1200,610 ${W},640 L${W},${H} L0,${H} Z" fill="url(#fl)"/>
<path d="M0,640 C400,610 1200,610 ${W},640" fill="none" stroke="#4a515b" stroke-width="2" opacity="0.6"/></svg>`;
}

// ---------------------------------------------------------------- steppe & mountains at sunset
export function steppeScene(W = 2400, H = 1400) {
  const r = rng(91);
  const ridge = (base, amp, seg, seed) => {
    const rr = rng(seed);
    let d = `M0,${H} L0,${base}`;
    const pts = [];
    for (let x = 0; x <= W; x += seg) pts.push([x, base - amp * (0.3 + rr() * 0.7)]);
    pts[pts.length - 1][1] = pts[0][1];
    for (const [x, y] of pts) d += ` L${x},${f(y)}`;
    return d + ` L${W},${H} Z`;
  };
  let grass = '';
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = 1240 + r() * 160, h = 30 + r() * 70;
    grass += `<path d="M${f(x)},${f(y)} q${f(4 + r() * 8)},${f(-h * 0.6)} ${f(10 + r() * 16)},${f(-h)}" stroke="#3a2a1a" stroke-width="3" fill="none" opacity="0.8"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1840"/><stop offset="0.4" stop-color="#5a3a6a"/><stop offset="0.62" stop-color="#e07a5a"/><stop offset="0.75" stop-color="#ffc07a"/><stop offset="1" stop-color="#ffd9a0"/></linearGradient>
<linearGradient id="mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a6aa0"/><stop offset="1" stop-color="#3a3a6a"/></linearGradient>
<linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c08a4a"/><stop offset="1" stop-color="#5a3a20"/></linearGradient>
<filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter></defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<circle cx="1500" cy="900" r="90" fill="#fff0c8"/><circle cx="1500" cy="900" r="240" fill="#ffcf8a" opacity="0.55" filter="url(#gl)"/>
<path d="${peaks(W, 900, 0)}" fill="url(#mt)" opacity="0.9"/>
<path d="${peaks(W, 900, 1)}" fill="#eef0ff" opacity="0.75"/>
<path d="${ridge(1040, 70, 200, 5)}" fill="#7a5a5a" opacity="0.8"/>
<path d="${ridge(1140, 60, 300, 6)}" fill="url(#hill)"/>
<rect y="1230" width="${W}" height="${H - 1230}" fill="#6a4628"/>
${grass}</svg>`;
}
function peaks(W, base, snow) {
  const P = [[0, 760], [180, 640], [320, 720], [520, 520], [700, 690], [860, 600], [1060, 470], [1260, 660], [1420, 560], [1620, 700], [1800, 540], [2000, 660], [2200, 590], [2400, 760]];
  if (!snow) return `M0,${base} ` + P.map(([x, y]) => `L${x},${y}`).join(' ') + ` L${W},${base} Z`;
  // snow caps: small triangles at each peak
  return P.filter(([, y], i) => i > 0 && i < P.length - 1 && y < 620)
    .map(([x, y]) => `M${x - 46},${y + 52} L${x},${y} L${x + 50},${y + 56} L${x + 24},${y + 44} L${x + 6},${y + 62} L${x - 16},${y + 42} Z`)
    .join(' ');
}
