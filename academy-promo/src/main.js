'use strict';
// Boot: load fonts + screenshots, set up the engine.
//   index.html?aspect=16x9|9x16&scale=1|2         (used by render.js)
//   index.html?aspect=16x9&scale=0.5&play=1        (live preview in a browser, space = pause, ←/→ = seek)
(async () => {
  const q = new URLSearchParams(location.search);
  const portrait = q.get('aspect') === '9x16';
  const scale = +(q.get('scale') || 1);
  const DW = portrait ? 1080 : 1920, DH = portrait ? 1920 : 1080;
  await Promise.all(['700 40px Nunito', '800 40px Nunito', '900 40px Nunito', '600 40px "Inter Display"', '700 40px "Inter Display"'].map((f) => document.fonts.load(f)));
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image ' + src)); i.src = src; });
  const lessons = await Promise.all([1, 2, 3, 4, 5, 6, 7].map((i) => load(`assets/screens/lesson${i}.png`)));
  const hero = await load('assets/screens/academy_hero.png');
  const canvas = document.getElementById('c');
  const info = Engine.init(canvas, { W: Math.round(DW * scale), H: Math.round(DH * scale), DW, DH });
  Scenes.setup(Engine, { portrait, DW, DH }, { lessons, hero });
  window.renderAt = (t, i = 0, show = true) => { Engine.draw(Scenes.frame(t, i)); if (show) Engine.show(); };
  window.cues = () => Scenes.cues();
  window.timeline = () => ({ TL: Scenes.TL, VO_OFFSET: Scenes.VO_OFFSET });
  window.info = info;
  window.ready = true;

  if (q.get('play')) {
    const hud = document.getElementById('hud');
    let t = +(q.get('t') || 0), last = performance.now(), paused = false;
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') paused = !paused;
      if (e.code === 'ArrowRight') t += 2;
      if (e.code === 'ArrowLeft') t = Math.max(0, t - 2);
    });
    const loop = (now) => {
      if (!paused) t += (now - last) / 1000;
      last = now;
      if (t > Scenes.TL.end) t = 0;
      renderAt(t, Math.round(t * 60));
      hud.textContent = t.toFixed(2) + ' s' + (paused ? ' (paused)' : '');
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
})().catch((e) => { window.bootError = String(e && e.stack || e); console.error(e); });
