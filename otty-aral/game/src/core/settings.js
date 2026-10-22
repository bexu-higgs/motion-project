// Баптаулар — localStorage-та сақталады.

const KEY = 'ottyaral.settings.v1';
const STATS_KEY = 'ottyaral.stats.v1';

const DEFAULTS = {
  fps: 60,
  quality: 'high',
  autoRes: true,
  showFps: false,
  sens: 1.0,
  aimSens: 0.75,
  aimAssist: true,
  leftFire: true,
  vibration: true,
  sfx: 0.9,
  music: 0.55,
  bots: 'medium',
  outfit: 'batyr',
};

export const QUALITY = {
  low: { pixel: 0.6, maxDpr: 1.0, shadows: 0, shadowSoft: false, antialias: false, grass: 0, veg: 0.55, draw: 320, tex: 256, normals: false, cloudOct: 2, waterDetail: false, decals: 40, particles: 0.5 },
  medium: { pixel: 0.8, maxDpr: 1.5, shadows: 1024, shadowSoft: false, antialias: true, grass: 0, veg: 0.8, draw: 450, tex: 512, normals: true, cloudOct: 3, waterDetail: true, decals: 70, particles: 0.8 },
  high: { pixel: 1.0, maxDpr: 2.0, shadows: 2048, shadowSoft: true, antialias: true, grass: 2600, veg: 1.0, draw: 600, tex: 512, normals: true, cloudOct: 4, waterDetail: true, decals: 100, particles: 1 },
  ultra: { pixel: 1.0, maxDpr: 3.0, shadows: 4096, shadowSoft: true, antialias: true, grass: 5000, veg: 1.0, draw: 750, tex: 1024, normals: true, cloudOct: 5, waterDetail: true, decals: 150, particles: 1 },
};

function load(key, def) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...def };
    return { ...def, ...JSON.parse(raw) };
  } catch (e) {
    return { ...def };
  }
}

// Алғашқы іске қосуда құрылғының қуатына қарай графика сапасын таңдау
function autoQuality() {
  try {
    const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!touch) return 'high';
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    let gpu = '';
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
    const strong = /Adreno \(TM\) (6[4-9]\d|7\d\d|8\d\d)|Mali-G(7[1-9]|71\d|72\d|6[1-9]\d)|Immortalis|Xclipse|Apple/i.test(gpu);
    if (strong && mem >= 6) return 'high';
    if (cores >= 8 && mem >= 4) return 'medium';
    return 'low';
  } catch (e) {
    return 'medium';
  }
}

let firstRun = false;
try { firstRun = !localStorage.getItem(KEY); } catch (e) { firstRun = true; }
export const settings = load(KEY, DEFAULTS);
if (firstRun) { settings.quality = autoQuality(); saveSettings(); }
if (![30, 60, 120].includes(settings.fps)) settings.fps = 60;
if (!QUALITY[settings.quality]) settings.quality = 'high';

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* жеке режим */ }
}

export function quality() { return QUALITY[settings.quality]; }

export const stats = load(STATS_KEY, { matches: 0, wins: 0, kills: 0, deaths: 0, best: 0, damage: 0, xp: 0 });
export function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
}

export const isTouch = (() => {
  try { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0; } catch (e) { return false; }
})();

export const android = typeof window !== 'undefined' && window.AndroidBridge ? window.AndroidBridge : null;

export function vibrate(ms) {
  if (!settings.vibration) return;
  try {
    if (android) android.vibrate(ms | 0);
    else if (navigator.vibrate) navigator.vibrate(ms | 0);
  } catch (e) { /* ignore */ }
}
