// Timeline: scene registry, voiceover placement, cross-fades and cue export.
// Scenes are pure functions of local time; this file decides when they play.
(function () {
  const M = window.M;
  M.SCENES = [];
  M.DURATION = 120;
  M.XFADE = 0.6;

  // def: {id, start, end, vo: [local start per VO line], draw(ctx, t, sc), cues(sc) -> [{t, id, gain}]}
  M.scene = (def) => M.SCENES.push(def);

  M.buildTimeline = () => {
    const man = window.VO_MANIFEST || { lines: {} };
    M.SCENES.sort((a, b) => a.start - b.start);
    M.SCENES.forEach((sc) => {
      const lines = man.lines[sc.id] || [];
      sc.dur = sc.end - sc.start;
      sc.lines = (sc.vo || []).map((at, i) => {
        const ln = lines[i] || { dur: 3, marks: [0], text: '', file: '' };
        return { ...ln, t: at, end: at + ln.dur, m: (ln.marks || [0]).map((k) => at + k) };
      });
    });
  };

  // Keystroke cues for text typed at `cps` from t0 (thinned to a natural rate).
  M.typeCues = (t0, cps, n, gain = 0.5) => {
    const out = [];
    const step = Math.max(1, Math.round(cps / 14));
    for (let i = 0; i < n; i += step) out.push({ t: t0 + i / cps, id: 'key', gain: gain * (0.75 + 0.5 * M.hash(i * 7.7 + t0)) });
    return out;
  };

  const sceneEnv = (sc, t) => {
    const fi = sc.fadeIn ?? M.XFADE, fo = sc.fadeOut ?? M.XFADE;
    // staggered: the outgoing scene clears early, the incoming one arrives late,
    // so the overlap reads as a soft dissolve rather than a double exposure
    return Math.min(
      fi > 0 ? M.E.inOutSine(M.inv(t, fi * 0.3, fi)) : 1,
      fo > 0 ? 1 - M.E.inOutSine(M.inv(t, sc.dur - fo, sc.dur - fo * 0.3)) : 1
    );
  };

  M.renderFrame = (ctx, T) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, M.W, M.H);
    // background fades up from black at the open and back to black at the close
    const bgA = Math.min(M.E.inOutSine(M.inv(T, 0.9, 2.2)), 1 - M.E.inOutSine(M.inv(T, M.DURATION - 1.0, M.DURATION)));
    M.drawBg(ctx, bgA);
    M.SCENES.forEach((sc) => {
      if (T < sc.start || T >= sc.end) return;
      const t = T - sc.start;
      const a = sceneEnv(sc, t);
      if (a >= 0.999) {
        ctx.save();
        sc.draw(ctx, t, sc);
        ctx.restore();
        return;
      }
      // group opacity during transitions: render to a layer, then composite
      const L = M.layer('scene-' + sc.id, M.W, M.H);
      const lc = L.getContext('2d');
      sc.draw(lc, t, sc);
      const entering = t < sc.dur / 2;
      const s = entering ? 1 + 0.012 * (1 - a) : 1 - 0.012 * (1 - a);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(M.W / 2, M.H / 2);
      ctx.scale(s, s);
      ctx.drawImage(L, -M.W / 2, -M.H / 2);
      ctx.restore();
    });
  };

  // Everything the audio mixer needs, in absolute seconds.
  M.exportCues = () => {
    const vo = [], sfx = [];
    M.SCENES.forEach((sc) => {
      sc.lines.forEach((ln) => vo.push({ scene: sc.id, file: ln.file, t: +(sc.start + ln.t).toFixed(3), dur: ln.dur, text: ln.text }));
      (sc.cues ? sc.cues(sc) : []).forEach((c) => sfx.push({ ...c, t: +(sc.start + c.t).toFixed(3) }));
      sfx.push({ t: Math.max(0, sc.start - 0.15), id: 'whoosh', gain: sc.id === 's1' ? 0 : 0.5 });
    });
    return {
      duration: M.DURATION,
      fps: M.FPS,
      scenes: M.SCENES.map((s) => ({ id: s.id, start: s.start, end: s.end, title: s.title })),
      vo,
      sfx: sfx.filter((c) => c.gain > 0).sort((a, b) => a.t - b.t),
    };
  };
})();
