// Preview player + headless render entry point.
// index.html            interactive preview (space = play/pause, arrows = ±1 s)
// index.html?render     bare canvas; tools/render.mjs drives window.renderAt(t)
(function () {
  const M = window.M;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const renderMode = params.has('render');
  if (renderMode) document.body.classList.add('render');

  const faces = [
    '400 20px Inter', '500 20px Inter', '600 20px Inter', '700 20px Inter',
    '300 20px "Inter Display"', '600 20px "Inter Display"', '700 20px "Inter Display"',
    '400 20px "JetBrains Mono"', '500 20px "JetBrains Mono"',
  ];
  const sample = 'Aa ӘәҒғҚқҢңӨөҰұҮүҺһІі';

  Promise.all(faces.map((f) => document.fonts.load(f, sample))).then(() => {
    M.buildTimeline();
    window.renderAt = (t) => M.renderFrame(ctx, t);
    window.exportCues = () => M.exportCues();
    window.READY = true;
    if (renderMode) {
      M.renderFrame(ctx, +(params.get('t') || 0));
      return;
    }
    initPlayer();
  });

  function initPlayer() {
    const audio = document.getElementById('audio');
    const scrub = document.getElementById('scrub');
    const time = document.getElementById('time');
    const play = document.getElementById('play');
    const chapters = document.getElementById('chapters');
    let t = +(params.get('t') || 0), playing = false, last = 0, hasAudio = false;
    audio.addEventListener('canplay', () => (hasAudio = true));
    audio.addEventListener('error', () => (hasAudio = false));
    M.SCENES.forEach((sc, i) => {
      const b = document.createElement('button');
      b.textContent = String(i + 1).padStart(2, '0');
      b.title = sc.title || sc.id;
      b.onclick = () => seek(sc.start + 0.6);
      chapters.appendChild(b);
    });
    const seek = (v) => {
      t = M.clamp(v, 0, M.DURATION - 1 / M.FPS);
      if (hasAudio) audio.currentTime = t;
      draw();
    };
    const toggle = () => {
      playing = !playing;
      play.textContent = playing ? 'Pause' : 'Play';
      last = performance.now();
      if (hasAudio) {
        audio.currentTime = t;
        if (playing) audio.play().catch(() => (hasAudio = false));
        else audio.pause();
      }
      if (playing) requestAnimationFrame(loop);
    };
    const draw = () => {
      M.renderFrame(ctx, t);
      scrub.value = t;
      time.textContent = `${t.toFixed(2)} / ${M.DURATION.toFixed(2)}`;
    };
    const loop = (now) => {
      if (!playing) return;
      if (hasAudio && !audio.paused) t = audio.currentTime;
      else t += (now - last) / 1000;
      last = now;
      if (t >= M.DURATION) {
        t = M.DURATION - 1 / M.FPS;
        toggle();
      }
      draw();
      requestAnimationFrame(loop);
    };
    play.onclick = toggle;
    scrub.oninput = () => seek(+scrub.value);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.code === 'ArrowRight') seek(t + (e.shiftKey ? 1 / M.FPS : 1));
      else if (e.code === 'ArrowLeft') seek(t - (e.shiftKey ? 1 / M.FPS : 1));
    });
    draw();
  }
})();
