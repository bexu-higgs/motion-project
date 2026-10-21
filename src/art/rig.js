// Side-view articulated figure (facing right) used for full-body shots:
// the hero (same hair, camel jacket, mole as the portrait) and a neutral
// studio silhouette that plays the "source video" performer.
import { svgEl, attr, lerp, clamp, ease } from '../engine.js';

const SEG = { torso: 292, upper: 150, fore: 138, thigh: 212, shin: 204 };
// Sole line in rig space (hip at y=0 when standing straight).
export const GROUND = 438;

const SKINS = {
  hero: {
    skin: '#d79d78', skinDark: '#a46a4c', hair: '#14151a', hairHi: '#3a3f4a',
    jacket: '#b9895c', jacketDark: '#7c5636', jacketLit: '#d6a877',
    pants: '#1d2230', pantsDark: '#121521', shoe: '#e9e6df', sole: '#2a2b30', tee: '#15171c',
  },
  silhouette: {
    skin: '#5d6673', skinDark: '#434a55', hair: '#4f5763', hairHi: '#5d6673',
    jacket: '#5d6673', jacketDark: '#434a55', jacketLit: '#6d7785',
    pants: '#535b67', pantsDark: '#3d444e', shoe: '#6d7785', sole: '#3d444e', tee: '#535b67',
  },
};

// Tapered capsule from (0,0) pointing down to (0,len).
function capsule(len, w0, w1) {
  const a = w0 / 2, b = w1 / 2;
  return `M${-a},0 C${-a},${-a * 1.1} ${a},${-a * 1.1} ${a},0 L${b},${len} C${b},${len + b * 1.1} ${-b},${len + b * 1.1} ${-b},${len} Z`;
}

export function createRig(parent, skinName = 'hero', { rim = '#5fe6ff', rimK = 0.8, key = '#ffcf9e' } = {}) {
  const S = SKINS[skinName];
  const hero = skinName === 'hero';
  const root = svgEl('g', {}, parent);
  const defs = svgEl('defs', {}, root);
  const fid = 'rimblur' + Math.random().toString(36).slice(2, 7);
  defs.innerHTML = `<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>`;

  const shadow = svgEl('ellipse', { cx: 0, cy: 0, rx: 130, ry: 16, fill: '#000', opacity: 0.45 }, root);
  const body = svgEl('g', {}, root);

  const limb = (dark) => {
    const g0 = svgEl('g', {}, body);
    return g0;
  };

  // back limbs first (in shadow)
  const backLeg = limb(true), backArm = limb(true);
  const torso = svgEl('g', {}, body);
  const frontLeg = limb(false), frontArm = limb(false);

  function buildLeg(g, dark) {
    const thigh = svgEl('g', {}, g);
    svgEl('path', { d: capsule(SEG.thigh, 66, 46), fill: dark ? S.pantsDark : S.pants }, thigh);
    const shin = svgEl('g', {}, thigh);
    svgEl('path', { d: capsule(SEG.shin, 46, 34), fill: dark ? S.pantsDark : S.pants }, shin);
    const foot = svgEl('g', {}, shin);
    svgEl('path', { d: 'M-22,-6 C-22,-20 18,-22 30,-12 C52,-6 64,2 64,14 L64,20 L-24,20 Z', fill: dark ? S.sole : S.shoe }, foot);
    svgEl('path', { d: 'M-24,14 L64,14 L64,22 L-24,22 Z', fill: S.sole }, foot);
    if (!dark) svgEl('path', { d: capsule(SEG.thigh, 66, 46), fill: 'none', stroke: rim, 'stroke-width': 4, opacity: 0.5 * rimK, filter: `url(#${fid})`, transform: 'translate(-4,0)' }, thigh);
    return { thigh, shin, foot };
  }
  function buildArm(g, dark) {
    const upper = svgEl('g', {}, g);
    svgEl('path', { d: capsule(SEG.upper, 50, 40), fill: dark ? S.jacketDark : S.jacket }, upper);
    const fore = svgEl('g', {}, upper);
    svgEl('path', { d: capsule(SEG.fore, 40, 32), fill: dark ? S.jacketDark : S.jacketLit }, fore);
    const hand = svgEl('g', {}, fore);
    svgEl('path', { d: 'M-14,-4 C-16,14 -10,34 2,40 C12,44 18,34 16,18 L14,-4 Z', fill: dark ? S.skinDark : S.skin }, hand);
    if (!dark) svgEl('path', { d: capsule(SEG.upper, 50, 40), fill: 'none', stroke: rim, 'stroke-width': 4, opacity: 0.55 * rimK, filter: `url(#${fid})`, transform: 'translate(-3,0)' }, upper);
    return { upper, fore, hand };
  }

  const BL = buildLeg(backLeg, true), BA = buildArm(backArm, true);

  // torso (local origin at hip, pointing up)
  const torsoBody = svgEl('g', {}, torso);
  svgEl('path', { d: 'M-46,6 C-52,-80 -58,-180 -54,-250 C-50,-290 -20,-306 10,-304 C44,-300 62,-276 60,-230 C58,-160 54,-70 48,6 Z', fill: S.jacket }, torsoBody);
  if (hero) {
    svgEl('path', { d: 'M30,-292 C46,-270 52,-230 50,-160 L38,-160 C40,-220 36,-262 22,-290 Z', fill: S.tee }, torsoBody); // open front
    svgEl('path', { d: 'M-48,-40 L52,-40 L50,0 L-46,0 Z', fill: S.jacketDark, opacity: 0.55 }, torsoBody); // hem band
    svgEl('path', { d: 'M8,-300 C-10,-292 -26,-276 -30,-258 L4,-268 Z', fill: S.jacketDark }, torsoBody); // collar
  }
  svgEl('path', { d: 'M-50,0 C-56,-80 -60,-180 -54,-250 C-50,-290 -20,-306 10,-304', fill: 'none', stroke: rim, 'stroke-width': 7, opacity: 0.8 * rimK, filter: `url(#${fid})` }, torsoBody);
  svgEl('path', { d: 'M58,-230 C56,-160 52,-70 46,4', fill: 'none', stroke: key, 'stroke-width': 6, opacity: 0.35, filter: `url(#${fid})` }, torsoBody);

  // neck + head
  const head = svgEl('g', {}, torso);
  svgEl('path', { d: 'M-16,-290 L22,-290 L24,-336 L-12,-340 Z', fill: S.skinDark }, head);
  const headG = svgEl('g', { transform: 'translate(4,-398) scale(1.14)' }, head);
  if (hero) {
    headG.innerHTML = `
      <path d="M-50,-8 C-56,-50 -30,-74 4,-74 C40,-74 58,-52 60,-26 C62,-14 70,-6 72,4 C74,10 66,12 62,14 C64,22 60,28 56,30 C58,38 54,46 44,48 C34,50 24,52 18,58 L-22,58 C-40,48 -48,26 -50,-8 Z" fill="${S.skin}"/>
      <path d="M-50,-8 C-48,26 -40,48 -22,58 L-8,58 C-26,40 -32,20 -30,-6 Z" fill="${S.skinDark}" opacity="0.7"/>
      <path d="M-20,-2 C-30,-6 -34,8 -28,20 C-24,28 -16,28 -12,22 Z" fill="${S.skinDark}"/>
      <path d="M-58,-6 C-64,-52 -36,-86 6,-86 C40,-86 64,-66 66,-40 C60,-46 48,-50 36,-48 C24,-46 14,-40 8,-30 C0,-34 -14,-32 -22,-22 C-30,-14 -34,0 -32,12 C-40,8 -50,4 -58,-6 Z" fill="${S.hair}"/>
      <path d="M-40,-62 C-18,-84 30,-88 60,-56" fill="none" stroke="${S.hairHi}" stroke-width="5" opacity="0.7" stroke-linecap="round"/>
      <path d="M-58,-6 C-64,-52 -36,-86 6,-86" fill="none" stroke="${rim}" stroke-width="6" opacity="${0.85 * rimK}" filter="url(#${fid})"/>
      <path d="M40,-16 C46,-22 56,-22 60,-16" fill="none" stroke="${S.hair}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="50" cy="-4" rx="5" ry="3.6" fill="#1a0f0b"/>
      <circle cx="44" cy="16" r="2.6" fill="#4a2a1c"/>
      <path d="M50,36 C56,36 60,34 62,32" fill="none" stroke="#7a3e30" stroke-width="3" stroke-linecap="round"/>`;
  } else {
    headG.innerHTML = `
      <path d="M-50,-8 C-56,-50 -30,-74 4,-74 C40,-74 58,-52 60,-26 C62,-14 68,-4 68,6 C68,14 62,16 60,20 C60,34 52,46 40,50 C30,54 22,56 16,60 L-22,58 C-40,48 -48,26 -50,-8 Z" fill="${S.skin}"/>
      <path d="M-56,-8 C-62,-52 -34,-80 6,-80 C40,-80 60,-60 62,-36 C40,-44 10,-40 -14,-24 C-28,-14 -36,0 -36,14 C-46,6 -52,0 -56,-8 Z" fill="${S.hair}"/>
      <path d="M-56,-8 C-62,-52 -34,-80 6,-80" fill="none" stroke="${rim}" stroke-width="6" opacity="${0.6 * rimK}" filter="url(#${fid})"/>`;
  }

  const FL = buildLeg(frontLeg, false), FA = buildArm(frontArm, false);

  // shoulder joint location in torso space
  const SH = { x: 4, y: -262 };

  function pose(p) {
    const rad = Math.PI / 180;
    const ext = (h, k) => SEG.thigh * Math.cos(h * rad) + SEG.shin * Math.cos((h + k) * rad);
    const lift = p.lift || 0;
    const y = SEG.thigh + SEG.shin - Math.max(ext(p.hipF || 0, p.kneeF || 0), ext(p.hipB || 0, p.kneeB || 0)) - lift;
    attr(body, { transform: `translate(${(p.x || 0).toFixed(2)},${y.toFixed(2)})` });
    attr(shadow, {
      cx: (p.x || 0) + 10, cy: GROUND,
      rx: (130 * (1 - clamp(lift / 500) * 0.5)).toFixed(1), opacity: (0.45 * (1 - clamp(lift / 300) * 0.6)).toFixed(3),
    });
    const tor = p.torso || 0;
    attr(torso, { transform: `rotate(${tor})` });
    attr(head, { transform: `rotate(${p.neck || 0} 4 -300)` });
    // legs hang from hip (0,0) in body space, independent of torso lean
    const leg = (L, hip, knee, foot) => {
      attr(L.thigh, { transform: `rotate(${-hip})` });
      attr(L.shin, { transform: `translate(0,${SEG.thigh}) rotate(${-knee})` });
      attr(L.foot, { transform: `translate(0,${SEG.shin}) rotate(${(foot ?? hip + knee).toFixed(2)})` });
    };
    leg(FL, p.hipF || 0, p.kneeF || 0, p.footF);
    leg(BL, p.hipB || 0, p.kneeB || 0, p.footB);
    const arm = (A, g, sh, el) => {
      const r = (tor * Math.PI) / 180;
      const sx = SH.x * Math.cos(r) - SH.y * Math.sin(r), sy = SH.x * Math.sin(r) + SH.y * Math.cos(r);
      attr(g, { transform: `translate(${sx.toFixed(2)},${sy.toFixed(2)})` });
      attr(A.upper, { transform: `rotate(${(tor - sh).toFixed(2)})` });
      attr(A.fore, { transform: `translate(0,${SEG.upper}) rotate(${-el})` });
      attr(A.hand, { transform: `translate(0,${SEG.fore})` });
    };
    arm(FA, frontArm, p.shF || 0, p.elF || 0);
    arm(BA, backArm, p.shB || 0, p.elB || 0);
  }

  return { root, pose };
}

// ------------------------------------------------------------ motion library
// Angles in degrees, "forward" positive. Hip (0,0) ≈ 416 units above the soles.
export function walkPose(t, period = 1.1) {
  const ph = (t / period) * Math.PI * 2;
  const legF = legAt(ph), legB = legAt(ph + Math.PI);
  return {
    lift: 0,
    torso: 5 + 1.5 * Math.sin(2 * ph),
    neck: -2,
    hipF: legF.hip, kneeF: legF.knee, footF: legF.foot,
    hipB: legB.hip, kneeB: legB.knee, footB: legB.foot,
    shF: -22 * Math.sin(ph), elF: 18 + 10 * Math.max(0, -Math.sin(ph)),
    shB: 22 * Math.sin(ph), elB: 18 + 10 * Math.max(0, Math.sin(ph)),
  };
}
function legAt(ph) {
  const hip = 24 * Math.sin(ph);
  const knee = -(6 + 52 * Math.pow(Math.max(0, Math.cos(ph + 0.55)), 1.6));
  const foot = hip + knee - Math.max(0, -Math.cos(ph + 1.2)) * 16 + 4;
  return { hip, knee, foot };
}

// Standing jump, ~2.6 s cycle. Keyframes interpolated with easing.
const STAND = { lift: 0, torso: 0, hipF: 3, kneeF: -4, hipB: -3, kneeB: -3, shF: 6, elF: 10, shB: -4, elB: 10 };
const JUMP = [
  [0.0, STAND],
  [0.5, { lift: 0, torso: 28, hipF: 58, kneeF: -96, hipB: 52, kneeB: -92, shF: -40, elF: 14, shB: -48, elB: 16 }],
  [0.74, { lift: 18, torso: 6, hipF: -4, kneeF: -4, hipB: -10, kneeB: -8, shF: 150, elF: 12, shB: 140, elB: 16 }],
  [1.0, { lift: 210, torso: 0, hipF: 46, kneeF: -84, hipB: 34, kneeB: -80, shF: 165, elF: 16, shB: 152, elB: 18 }],
  [1.26, { lift: 40, torso: 6, hipF: 18, kneeF: -22, hipB: 10, kneeB: -20, shF: 110, elF: 22, shB: 100, elB: 22 }],
  [1.44, { lift: 0, torso: 24, hipF: 54, kneeF: -90, hipB: 48, kneeB: -86, shF: 36, elF: 30, shB: 26, elB: 30 }],
  [1.95, STAND],
  [2.6, STAND],
];
export const JUMP_PERIOD = 2.6;
export function jumpPose(t) {
  const tt = ((t % JUMP_PERIOD) + JUMP_PERIOD) % JUMP_PERIOD;
  let i = 0;
  while (i < JUMP.length - 2 && JUMP[i + 1][0] <= tt) i++;
  const [t0, a] = JUMP[i], [t1, b] = JUMP[i + 1];
  const k = ease.inOutSine(clamp((tt - t0) / (t1 - t0)));
  const out = {};
  for (const key in a) out[key] = lerp(a[key], b[key], k);
  // feet flat while grounded, toes pointing down in the air
  const air = clamp(out.lift / 60);
  out.footF = (out.hipF + out.kneeF) * (1 - air) + air * 25;
  out.footB = (out.hipB + out.kneeB) * (1 - air) + air * 25;
  return out;
}
