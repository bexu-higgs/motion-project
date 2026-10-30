// Kazakh "қошқар мүйіз" (ram's horn) ornament, generated as SVG paths so
// every stroke can be drawn on with stroke-dashoffset.
"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";

function spiral(cx, cy, r0, r1, a0, turns, dir, n = 64) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = a0 + dir * u * turns * 2 * Math.PI;
    const r = r0 + (r1 - r0) * Math.pow(u, 0.85);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

const f2 = (v) => v.toFixed(2);
const poly = (pts) => pts.map((p) => ` L${f2(p[0])} ${f2(p[1])}`).join("");

// One ram's-horn motif, base at (0,0), growing towards -y (about 72 units tall).
function hornPath() {
  const R = spiral(26, -50, 22, 3.5, -Math.PI / 2, 1.6, +1);
  const L = spiral(-26, -50, 22, 3.5, -Math.PI / 2, 1.6, -1);
  let d = "M0 0 L0 -40";
  d += ` C0 -62 10 -72 ${f2(R[0][0])} ${f2(R[0][1])}` + poly(R.slice(1));
  d += ` M0 -40 C0 -62 -10 -72 ${f2(L[0][0])} ${f2(L[0][1])}` + poly(L.slice(1));
  // small inner curls at the root
  const r2 = spiral(9, -12, 8, 1.5, Math.PI, 1.2, +1, 32);
  const l2 = spiral(-9, -12, 8, 1.5, 0, 1.2, -1, 32);
  d += ` M0 -4 C0.5 -7 1 -9 ${f2(r2[0][0])} ${f2(r2[0][1])}` + poly(r2.slice(1));
  d += ` M0 -4 C-0.5 -7 -1 -9 ${f2(l2[0][0])} ${f2(l2[0][1])}` + poly(l2.slice(1));
  // leaf between the horns
  d += " M0 -44 Q7 -57 0 -70 Q-7 -57 0 -44";
  return d;
}

const polar = (r, deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];

function circlePath(r) {
  return `M${r} 0 A${r} ${r} 0 1 1 ${-r} 0 A${r} ${r} 0 1 1 ${r} 0`;
}

// Rosette medallion: returns [{d, transform, group}] centred on (0,0), radius ~345.
function rosetteParts() {
  const parts = [];
  parts.push({ d: circlePath(342), group: "ring" });
  parts.push({ d: circlePath(328), group: "ring" });
  parts.push({ d: circlePath(150), group: "ring" });
  parts.push({ d: circlePath(138), group: "ring" });
  parts.push({ d: circlePath(32), group: "ring" });
  for (let k = 0; k < 8; k++) {
    parts.push({ d: hornPath(), transform: `rotate(${k * 45}) translate(0 -158) scale(2)`, group: "horn", k });
  }
  for (let k = 0; k < 8; k++) {
    const a = k * 45 + 22.5;
    const p0 = polar(40, a - 90), tip = polar(128, a - 90);
    const c1 = polar(98, a - 90 - 20), c2 = polar(98, a - 90 + 20);
    parts.push({
      d: `M${f2(p0[0])} ${f2(p0[1])} Q${f2(c1[0])} ${f2(c1[1])} ${f2(tip[0])} ${f2(tip[1])} Q${f2(c2[0])} ${f2(c2[1])} ${f2(p0[0])} ${f2(p0[1])}`,
      group: "petal",
      k,
    });
  }
  for (let k = 0; k < 32; k++) {
    const [x, y] = polar(335, k * 11.25);
    const s = 4.2;
    parts.push({ d: `M${f2(x)} ${f2(y - s)} L${f2(x + s)} ${f2(y)} L${f2(x)} ${f2(y + s)} L${f2(x - s)} ${f2(y)} Z`, group: "dot", k });
  }
  return parts;
}

// Corner ornament for the frame: three horns fanning out of a corner.
function cornerParts() {
  return [
    { d: hornPath(), transform: "rotate(135) scale(0.9)", group: "corner" },
    { d: hornPath(), transform: "translate(70 0) rotate(90) scale(0.55)", group: "corner" },
    { d: hornPath(), transform: "translate(0 70) rotate(180) scale(0.55)", group: "corner" },
  ];
}

// Build embossed (shadow + highlight) strokes; returns path records for animation.
function buildOrnament(svgGroup, parts, style) {
  const records = [];
  const layers = [
    { stroke: style.dark, width: style.width, opacity: style.darkOpacity, dx: 0, dy: 0 },
    { stroke: style.light, width: style.width * 0.55, opacity: style.lightOpacity, dx: -1.3, dy: -1.3 },
  ];
  for (const layer of layers) {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("transform", `translate(${layer.dx} ${layer.dy})`);
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", layer.stroke);
    g.setAttribute("stroke-width", layer.width);
    g.setAttribute("stroke-linecap", "round");
    g.setAttribute("stroke-linejoin", "round");
    g.setAttribute("opacity", layer.opacity);
    svgGroup.appendChild(g);
    parts.forEach((p, i) => {
      const el = document.createElementNS(SVG_NS, "path");
      el.setAttribute("d", p.d);
      if (p.transform) el.setAttribute("transform", p.transform);
      if (p.group === "dot") el.setAttribute("fill", layer.stroke);
      g.appendChild(el);
      const len = el.getTotalLength();
      el.style.strokeDasharray = `${len + 1} ${len + 1}`;
      el.style.strokeDashoffset = `${len + 1}`;
      records.push({ el, len: len + 1, part: p, index: i });
    });
  }
  return records;
}

window.Ornament = { buildOrnament, rosetteParts, cornerParts, SVG_NS };
