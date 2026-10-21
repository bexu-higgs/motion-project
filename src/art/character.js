// The lesson's example character: a young Kazakh man drawn as a vector
// illustration. Every shot in the video is built from this one design, so his
// face, hairstyle, jacket and the small mole under his left eye stay identical
// across all "generated" results — the very consistency the lesson teaches.

export const LOOKS = {
  // Neutral studio reference: warm key from the right, cool cyan rim on the left.
  studio: { key: '#ffd9b8', keyK: 0.5, rim: '#5fe6ff', rimK: 0.85, rim2: '#ffb27a', rim2K: 0.25, shadow: '#2a1a14', grade: 0 },
  city: { key: '#ffc9a0', keyK: 0.45, rim: '#38d9ff', rimK: 1, rim2: '#ff6fb1', rim2K: 0.45, shadow: '#1b1626', grade: 0.15 },
  forest: { key: '#ffe7b0', keyK: 0.55, rim: '#b8ff9e', rimK: 0.55, rim2: '#ffd27a', rim2K: 0.4, shadow: '#16201a', grade: 0.1 },
  dusk: { key: '#ffb47a', keyK: 0.65, rim: '#6fb6ff', rimK: 0.8, rim2: '#ff9a5a', rim2K: 0.5, shadow: '#26161a', grade: 0.12 },
  lab: { key: '#ffae6b', keyK: 0.7, rim: '#2fe3ff', rimK: 1, rim2: '#ff9a4a', rim2K: 0.55, shadow: '#101a22', grade: 0.15 },
  steppe: { key: '#ffc58a', keyK: 0.6, rim: '#ffdca8', rimK: 0.6, rim2: '#ff9e5e', rim2K: 0.45, shadow: '#2a1a14', grade: 0.1 },
};

const SKIN = { lit: '#e6b28e', mid: '#cf9572', dark: '#a8704f', deep: '#7a4a34' };
const HAIR = { base: '#121317', mid: '#1d2026', hi: '#3a3f4a' };
const JACKET = { base: '#b9895c', lit: '#d6a877', dark: '#7c5636', deep: '#4f3522' };
const TEE = '#15171c';

// Portrait bust, 600×800 viewBox, transparent background.
export function portraitSVG(look = LOOKS.studio, { id = 'p' } = {}) {
  const L = look;
  const u = (n) => `${id}-${n}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
<defs>
  <linearGradient id="${u('skin')}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${SKIN.dark}"/>
    <stop offset="0.38" stop-color="${SKIN.mid}"/>
    <stop offset="0.72" stop-color="${SKIN.lit}"/>
    <stop offset="1" stop-color="${SKIN.mid}"/>
  </linearGradient>
  <linearGradient id="${u('neck')}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${SKIN.deep}"/>
    <stop offset="0.5" stop-color="${SKIN.dark}"/>
    <stop offset="1" stop-color="${SKIN.mid}"/>
  </linearGradient>
  <linearGradient id="${u('hair')}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${HAIR.mid}"/>
    <stop offset="0.6" stop-color="${HAIR.base}"/>
    <stop offset="1" stop-color="#0b0c0f"/>
  </linearGradient>
  <linearGradient id="${u('jacket')}" x1="0" y1="0" x2="1" y2="0.3">
    <stop offset="0" stop-color="${JACKET.dark}"/>
    <stop offset="0.45" stop-color="${JACKET.base}"/>
    <stop offset="0.8" stop-color="${JACKET.lit}"/>
    <stop offset="1" stop-color="${JACKET.base}"/>
  </linearGradient>
  <linearGradient id="${u('fadeDown')}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.75"/>
  </linearGradient>
  <radialGradient id="${u('iris')}" cx="0.45" cy="0.45" r="0.6">
    <stop offset="0" stop-color="#5a3a26"/>
    <stop offset="0.7" stop-color="#2a1a12"/>
    <stop offset="1" stop-color="#120a06"/>
  </radialGradient>
  <filter id="${u('b2')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="${u('b4')}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="${u('b8')}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="${u('b14')}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="${u('b24')}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="24"/></filter>
  <clipPath id="${u('faceClip')}"><path d="${FACE}"/></clipPath>
  <clipPath id="${u('neckClip')}"><path d="${NECK}"/></clipPath>
  <clipPath id="${u('hairClip')}"><path d="${HAIR_SHAPE}"/></clipPath>
  <clipPath id="${u('bodyClip')}"><path d="${JACKET_SHAPE}"/></clipPath>
</defs>

<!-- ===== back collar (behind the neck) ===== -->
<path d="M200,570 C212,528 248,516 292,514 C338,516 372,528 384,570 Z" fill="${JACKET.deep}"/>
<path d="M214,562 C226,530 254,516 292,514" fill="none" stroke="${L.rim}" stroke-width="5" opacity="${0.6 * L.rimK}" filter="url(#${u('b2')})"/>

<!-- ===== neck ===== -->
<path d="${NECK}" fill="url(#${u('neck')})"/>
<g clip-path="url(#${u('neckClip')})">
  <path d="M236,420 C260,486 322,486 350,420 L350,478 C320,522 262,522 236,478 Z" fill="${SKIN.deep}" opacity="0.85" filter="url(#${u('b8')})"/>
  <path d="M326,470 L352,476 L356,580 L322,580 Z" fill="${L.key}" opacity="${0.28 * L.keyK}" filter="url(#${u('b8')})"/>
  <path d="M242,450 C238,490 236,530 232,572" fill="none" stroke="${L.rim}" stroke-width="7" opacity="${0.75 * L.rimK}" filter="url(#${u('b4')})"/>
  <path d="M284,520 C292,534 296,548 298,566" stroke="${SKIN.deep}" stroke-width="6" opacity="0.3" fill="none" filter="url(#${u('b4')})"/>
</g>

<!-- ===== tee + jacket ===== -->
<g>
  <path d="M222,556 C246,600 340,600 364,556 L392,610 L392,800 L196,800 L196,610 Z" fill="${TEE}"/>
  <path d="M226,560 C250,598 336,598 360,560" fill="none" stroke="#2c3038" stroke-width="7" stroke-linecap="round"/>
  <path d="M230,566 C254,600 332,600 356,566" fill="none" stroke="#0c0d10" stroke-width="2" opacity="0.8"/>
  <path d="${JACKET_SHAPE}" fill="url(#${u('jacket')})"/>
  <g clip-path="url(#${u('bodyClip')})">
    <!-- open front -->
    <path d="M246,610 C252,660 258,720 256,800 L334,800 C330,720 334,660 342,610 C320,600 270,600 246,610 Z" fill="${TEE}"/>
    <!-- collar points folded over the chest -->
    <path d="M216,560 C206,580 196,598 190,612 L254,664 L250,604 Z" fill="${JACKET.dark}"/>
    <path d="M190,612 L254,664 L246,610 Z" fill="${JACKET.base}" opacity="0.6"/>
    <path d="M370,560 C380,580 390,598 396,612 L334,664 L340,604 Z" fill="${JACKET.base}"/>
    <path d="M396,612 L334,664 L342,610 Z" fill="${JACKET.lit}" opacity="0.6"/>
    <path d="M216,560 C206,580 196,598 190,612 L254,664" fill="none" stroke="${JACKET.deep}" stroke-width="2.5" opacity="0.6"/>
    <path d="M370,560 C380,580 390,598 396,612 L334,664" fill="none" stroke="${JACKET.deep}" stroke-width="2.5" opacity="0.5"/>
    <!-- placket edges + stitching -->
    <path d="M254,664 C258,720 258,760 256,800" fill="none" stroke="${JACKET.deep}" stroke-width="4" opacity="0.7"/>
    <path d="M334,664 C330,720 330,760 334,800" fill="none" stroke="${JACKET.deep}" stroke-width="4" opacity="0.6"/>
    <path d="M244,668 C248,720 248,760 246,800" fill="none" stroke="${JACKET.lit}" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.5"/>
    <path d="M344,668 C340,720 340,760 344,800" fill="none" stroke="${JACKET.lit}" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.5"/>
    <!-- shoulder seams, chest pockets -->
    <path d="M118,640 C140,664 150,700 152,740" fill="none" stroke="${JACKET.deep}" stroke-width="3" opacity="0.45"/>
    <path d="M470,640 C448,664 438,700 436,740" fill="none" stroke="${JACKET.deep}" stroke-width="3" opacity="0.4"/>
    <path d="M170,706 L232,708 L230,722 L172,720 Z" fill="${JACKET.dark}" opacity="0.6"/>
    <path d="M418,706 L356,708 L358,722 L416,720 Z" fill="${JACKET.base}" opacity="0.7"/>
    <!-- folds -->
    <path d="M100,800 C110,740 132,700 168,672" fill="none" stroke="${JACKET.deep}" stroke-width="12" opacity="0.3" filter="url(#${u('b8')})"/>
    <path d="M200,800 C204,760 212,720 226,690" fill="none" stroke="${JACKET.deep}" stroke-width="8" opacity="0.25" filter="url(#${u('b8')})"/>
    <path d="M488,800 C478,740 456,700 420,672" fill="none" stroke="#fff" stroke-width="10" opacity="0.08" filter="url(#${u('b8')})"/>
    <!-- light: key from right, shadow on left -->
    <path d="M320,580 L600,580 L600,800 L350,800 Z" fill="${L.key}" opacity="${0.2 * L.keyK}" filter="url(#${u('b24')})"/>
    <path d="M0,580 L230,580 L180,800 L0,800 Z" fill="${L.shadow}" opacity="0.55" filter="url(#${u('b24')})"/>
    <path d="${JACKET_LEFT_EDGE}" fill="none" stroke="${L.rim}" stroke-width="12" opacity="${0.9 * L.rimK}" filter="url(#${u('b4')})"/>
    <path d="${JACKET_RIGHT_EDGE}" fill="none" stroke="${L.rim2}" stroke-width="9" opacity="${0.8 * L.rim2K}" filter="url(#${u('b4')})"/>
    <!-- chin/neck shadow on chest -->
    <ellipse cx="294" cy="586" rx="80" ry="20" fill="#000" opacity="0.35" filter="url(#${u('b8')})"/>
  </g>
</g>

<g transform="translate(0,14)">
<!-- ===== ears ===== -->
<path d="M193,322 C178,314 168,330 172,352 C175,372 184,388 198,392 Z" fill="${SKIN.dark}"/>
<path d="M190,334 C182,334 180,346 183,358 C185,368 190,376 196,378" fill="none" stroke="${SKIN.deep}" stroke-width="3" opacity="0.7"/>
<path d="M193,322 C178,314 168,330 172,352" fill="none" stroke="${L.rim}" stroke-width="4" opacity="${0.85 * L.rimK}" filter="url(#${u('b2')})"/>
<path d="M398,318 C414,308 428,322 425,348 C422,372 410,388 396,392 Z" fill="${SKIN.mid}"/>
<path d="M403,330 C412,330 416,344 413,358 C410,370 404,378 398,380" fill="none" stroke="${SKIN.dark}" stroke-width="3.5" opacity="0.8"/>
<path d="M406,316 C420,314 428,330 424,350" fill="none" stroke="${L.key}" stroke-width="3" opacity="${0.6 * L.keyK}" filter="url(#${u('b2')})"/>

<!-- ===== face ===== -->
<path d="${FACE}" fill="url(#${u('skin')})"/>
<g clip-path="url(#${u('faceClip')})">
  <!-- broad form shadow on the far (left) side -->
  <path d="M150,220 L232,220 C214,300 214,380 240,440 L270,480 L150,480 Z" fill="${SKIN.deep}" opacity="0.5" filter="url(#${u('b14')})"/>
  <path d="M150,220 L205,220 C194,300 196,380 218,450 L150,480 Z" fill="${L.shadow}" opacity="0.45" filter="url(#${u('b8')})"/>
  <!-- cheekbone + forehead highlight on the lit side -->
  <ellipse cx="352" cy="372" rx="30" ry="24" fill="${L.key}" opacity="${0.45 * L.keyK}" filter="url(#${u('b14')})"/>
  <ellipse cx="318" cy="262" rx="58" ry="22" fill="${L.key}" opacity="${0.35 * L.keyK}" filter="url(#${u('b14')})"/>
  <ellipse cx="292" cy="458" rx="22" ry="10" fill="${L.key}" opacity="${0.35 * L.keyK}" filter="url(#${u('b8')})"/>
  <!-- cheek hollow / jaw shading -->
  <path d="M360,400 C356,430 340,450 320,462" fill="none" stroke="${SKIN.dark}" stroke-width="16" opacity="0.35" filter="url(#${u('b8')})"/>
  <path d="M222,396 C230,430 248,452 270,466" fill="none" stroke="${SKIN.deep}" stroke-width="18" opacity="0.4" filter="url(#${u('b8')})"/>
  <!-- eye sockets -->
  <ellipse cx="246" cy="338" rx="34" ry="16" fill="${SKIN.deep}" opacity="0.45" filter="url(#${u('b8')})"/>
  <ellipse cx="333" cy="338" rx="32" ry="14" fill="${SKIN.dark}" opacity="0.4" filter="url(#${u('b8')})"/>
  <!-- nose: bridge shadow, tip, nostrils -->
  <path d="M282,340 C280,366 274,388 268,404" fill="none" stroke="${SKIN.deep}" stroke-width="9" opacity="0.45" filter="url(#${u('b4')})"/>
  <path d="M298,346 C300,368 304,388 306,398" fill="none" stroke="${L.key}" stroke-width="6" opacity="${0.45 * L.keyK}" filter="url(#${u('b4')})"/>
  <path d="M266,408 C274,418 300,420 314,410 C312,402 304,398 296,404 C290,398 276,398 266,408 Z" fill="${SKIN.dark}" opacity="0.9"/>
  <ellipse cx="279" cy="410" rx="7" ry="3.5" fill="${SKIN.deep}"/>
  <ellipse cx="303" cy="411" rx="6" ry="3.2" fill="${SKIN.deep}"/>
  <ellipse cx="292" cy="398" rx="10" ry="6" fill="${L.key}" opacity="${0.4 * L.keyK}" filter="url(#${u('b2')})"/>
  <path d="M262,420 C276,428 304,430 320,420" fill="none" stroke="${SKIN.deep}" stroke-width="6" opacity="0.35" filter="url(#${u('b4')})"/>
  <!-- mouth -->
  <path d="M264,442 C278,437 286,439 291,441 C297,439 306,437 318,442 C306,446 296,448 291,448 C284,448 274,447 264,442 Z" fill="#9a5a46"/>
  <path d="M264,443 C278,447 304,448 318,443" fill="none" stroke="#5a2e22" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M268,449 C280,460 304,460 314,449 C304,456 280,456 268,449 Z" fill="#b06e58" opacity="0.9"/>
  <ellipse cx="292" cy="455" rx="12" ry="3" fill="${L.key}" opacity="${0.35 * L.keyK}" filter="url(#${u('b2')})"/>
  <path d="M276,468 C286,472 298,472 308,468" fill="none" stroke="${SKIN.deep}" stroke-width="6" opacity="0.3" filter="url(#${u('b4')})"/>
  <!-- rim light along the left contour -->
  <path d="M194,262 C186,320 190,374 206,412 C224,452 252,474 286,478" fill="none" stroke="${L.rim}" stroke-width="6" opacity="${0.85 * L.rimK}" filter="url(#${u('b4')})"/>
  <path d="M398,262 C400,325 390,375 372,412" fill="none" stroke="${L.rim2}" stroke-width="7" opacity="${0.7 * L.rim2K}" filter="url(#${u('b4')})"/>
  <!-- hair shadow on forehead -->
  <path d="M190,250 C240,262 330,248 405,262 L405,236 L190,236 Z" fill="#000" opacity="0.45" filter="url(#${u('b8')})"/>
</g>

<!-- ===== eyes ===== -->
${eye(246, 344, -1, L, u)}
${eye(333, 344, 1, L, u)}

<!-- eyebrows: straight, dense -->
<path d="M210,320 C226,311 252,308 274,313 L273,321 C252,317 230,320 213,327 Z" fill="${HAIR.base}"/>
<path d="M306,313 C330,308 352,310 368,318 L366,325 C350,318 330,317 307,321 Z" fill="${HAIR.base}"/>
<path d="M214,322 C230,314 250,312 270,315" fill="none" stroke="${HAIR.hi}" stroke-width="1.5" opacity="0.5"/>
<path d="M310,315 C330,311 348,313 362,319" fill="none" stroke="${HAIR.hi}" stroke-width="1.5" opacity="0.5"/>

<!-- distinguishing mark: small mole under his left eye -->
<circle cx="351" cy="384" r="3.6" fill="#4a2a1c"/>
<circle cx="350" cy="383" r="1.2" fill="#8a5a44" opacity="0.6"/>

<!-- ===== hair ===== -->
<path d="${HAIR_SHAPE}" fill="url(#${u('hair')})"/>
<g clip-path="url(#${u('hairClip')})">
  <!-- faded sides: skin shows through -->
  <path d="M174,262 C176,296 184,320 192,334 L204,334 C198,306 196,280 200,258 Z" fill="${SKIN.dark}" opacity="0.5" filter="url(#${u('b4')})"/>
  <path d="M414,262 C412,296 406,320 400,334 L390,334 C396,306 398,280 396,258 Z" fill="${SKIN.mid}" opacity="0.5" filter="url(#${u('b4')})"/>
  ${locks()}
  ${texture()}
  <!-- side part -->
  <path d="M230,250 C228,226 232,204 242,186" fill="none" stroke="#050507" stroke-width="4" opacity="0.8" filter="url(#${u('b2')})"/>
  <!-- rim + top light -->
  <path d="M180,320 C170,262 178,214 214,182 C246,156 300,144 352,152" fill="none" stroke="${L.rim}" stroke-width="10" opacity="${0.85 * L.rimK}" filter="url(#${u('b4')})"/>
  <path d="M352,152 C392,162 420,194 424,246" fill="none" stroke="${L.rim2}" stroke-width="8" opacity="${0.55 * L.rim2K}" filter="url(#${u('b4')})"/>
  <ellipse cx="318" cy="178" rx="70" ry="16" fill="#cfe6ff" opacity="0.12" filter="url(#${u('b8')})"/>
</g>
<!-- a single lock falling onto the forehead -->
<path d="M232,254 C266,236 318,234 362,246 C332,246 302,252 282,266 C270,258 252,254 232,254 Z" fill="${HAIR.base}" opacity="0.95"/>
<path d="M246,252 C276,242 312,240 344,246" fill="none" stroke="${HAIR.hi}" stroke-width="2" opacity="0.5"/>

</g>
<!-- subtle bottom fade for compositing -->
<rect x="0" y="560" width="600" height="240" fill="url(#${u('fadeDown')})" opacity="${0.6 + L.grade}"/>
</svg>`;
}

const FACE = 'M192,250 C182,318 186,374 204,414 C222,454 252,476 288,478 C324,476 354,454 372,414 C390,374 404,326 402,252 C360,232 240,232 192,250 Z';
const NECK = 'M230,430 C232,484 226,534 208,584 L378,584 C360,534 354,484 356,430 Z';
const JACKET_SHAPE =
  'M20,800 C22,700 54,640 130,612 C168,598 196,584 216,560 L250,604 C270,600 318,600 340,604 L370,560 C392,584 420,598 458,612 C534,640 566,700 568,800 Z';
const JACKET_LEFT_EDGE = 'M22,800 C24,700 56,640 130,612 C168,598 196,584 216,560';
const JACKET_RIGHT_EDGE = 'M370,560 C392,584 420,598 458,612 C534,640 566,700 568,800';
const HAIR_SHAPE =
  'M182,334 C168,294 164,250 178,214 C194,176 230,152 276,144 C324,138 370,146 400,170 C424,190 432,222 428,258 C426,290 416,314 404,334 L398,334 C398,304 398,280 396,262 C384,250 360,240 330,238 C296,236 262,242 236,250 C222,254 210,258 204,262 C200,286 198,310 194,334 Z';

function eye(cx, cy, side, L, u) {
  // side: -1 = far (shadow) eye, 1 = near (lit) eye
  const w = side < 0 ? 26 : 27;
  const top = `M${cx - w},${cy + 2} C${cx - w * 0.5},${cy - 11} ${cx + w * 0.45},${cy - 12} ${cx + w},${cy - 1}`;
  const bot = `C${cx + w * 0.5},${cy + 7} ${cx - w * 0.5},${cy + 8} ${cx - w},${cy + 2} Z`;
  const shape = top + ' ' + bot;
  const ix = cx + side * -2;
  return `<g>
  <path d="${shape}" fill="#efe3da"/>
  <clipPath id="${u('eye' + side)}"><path d="${shape}"/></clipPath>
  <g clip-path="url(#${u('eye' + side)})">
    <circle cx="${ix}" cy="${cy}" r="10.5" fill="url(#${u('iris')})"/>
    <circle cx="${ix}" cy="${cy}" r="4.6" fill="#07040a"/>
    <path d="M${cx - w},${cy - 14} L${cx + w},${cy - 14} L${cx + w},${cy - 1} C${cx + w * 0.45},${cy - 7} ${cx - w * 0.5},${cy - 6} ${cx - w},${cy + 3} Z" fill="#000" opacity="0.35"/>
  </g>
  <circle cx="${ix + 3.5}" cy="${cy - 3.5}" r="2.6" fill="#fff" opacity="0.9"/>
  <circle cx="${ix - 4}" cy="${cy + 3}" r="1.1" fill="${L.rim}" opacity="0.7"/>
  <path d="${top}" fill="none" stroke="#1a0f0b" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M${cx - w + 4},${cy - 6} C${cx - w * 0.3},${cy - 15} ${cx + w * 0.4},${cy - 16} ${cx + w - 2},${cy - 8}" fill="none" stroke="${SKIN.deep}" stroke-width="2" opacity="0.55"/>
  <path d="M${cx - w + 5},${cy + 4} C${cx - w * 0.4},${cy + 9} ${cx + w * 0.4},${cy + 9} ${cx + w - 4},${cy + 2}" fill="none" stroke="${SKIN.deep}" stroke-width="1.4" opacity="0.45"/>
</g>`;
}

function texture() {
  // Fine strands for hair texture (deterministic).
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = [];
  for (let i = 0; i < 46; i++) {
    const x0 = 214 + r() * 40, y0 = 250 - r() * 70;
    const len = 0.55 + r() * 0.45;
    const x3 = x0 + (150 + r() * 60) * len, y3 = y0 - 20 + r() * 40 * len;
    const x1 = x0 + 30, y1 = y0 - 50 * len, x2 = x3 - 40, y2 = y3 - 30 * len;
    const c = r() > 0.5 ? '#3f4552' : '#08090b';
    out.push(`<path d="M${x0.toFixed(1)},${y0.toFixed(1)} C${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y3.toFixed(1)}" fill="none" stroke="${c}" stroke-width="${(0.8 + r() * 1.2).toFixed(2)}" stroke-linecap="round" opacity="${(0.15 + r() * 0.25).toFixed(2)}"/>`);
  }
  return out.join('');
}

function locks() {
  // Filled, tapered locks sweeping from the part (x≈232) up and over to the right.
  const L = [
    ['M232,236 C238,196 270,170 318,164 C356,160 392,176 410,206 C384,190 352,184 320,188 C284,192 254,210 232,236 Z', HAIR.mid, 0.9],
    ['M238,246 C252,214 286,198 326,196 C362,196 392,210 414,236 C388,222 360,216 330,218 C292,220 262,232 238,246 Z', HAIR.hi, 0.55],
    ['M250,250 C272,230 304,222 338,224 C370,226 396,240 416,262 C392,250 366,244 340,244 C306,244 278,248 250,250 Z', HAIR.mid, 0.85],
    ['M206,232 C210,204 226,182 252,168 C240,186 232,206 230,232 Z', HAIR.mid, 0.9],
    ['M190,270 C186,240 192,212 210,192 C204,214 202,240 204,266 Z', HAIR.hi, 0.45],
    ['M262,170 C296,154 340,152 372,164 C340,162 306,166 280,178 Z', '#5a616e', 0.6],
    ['M276,214 C306,202 344,202 374,212 C344,210 312,214 288,222 Z', '#4c5260', 0.7],
    ['M300,236 C326,230 356,232 382,242 C356,240 330,242 308,248 Z', '#3c414c', 0.7],
  ];
  return L.map(([d, c, o]) => `<path d="${d}" fill="${c}" opacity="${o}"/>`).join('\n');
}
