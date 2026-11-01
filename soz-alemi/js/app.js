/* ==========================================================
   Сөз әлемі — ойын логикасы (тіркелусіз, сервер қажет емес)
   ========================================================== */
(function () {
  'use strict';

  var C = window.SOZ;
  var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var ANIM = new Set(['1f425', '1f422', '1f34e', '1f431', '1f697', '1f4ac', '1f4da', '1f338', '1f62e_200d_1f4a8',
    '1f389', '1f3c6', '1f31f', '1f973', '26bd', '2601_fe0f', '1f31e', '1f321_fe0f', '1f44f', '1f4a1', '2b50']);
  var STARS_PER_LEVEL = 5;

  /* ---------- Көмекші функциялар ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function h(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function cap(s) { return s.charAt(0).toLocaleUpperCase('kk') + s.slice(1); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function emo(code, cls, still) {
    var anim = !still && ANIM.has(code);
    return '<span class="emo ' + (cls || '') + '"' + (anim ? ' data-anim="' + code + '"' : '') + ' aria-hidden="true">' +
      '<img src="emoji/svg/' + code + '.svg" alt="" draggable="false"></span>';
  }

  var I = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4.5 7.5 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.6" fill="currentColor"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m16 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor"/></svg>',
    rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="#ff3b30"/></svg>',
    redo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4v4.5H9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wind: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5h10.5a2.75 2.75 0 1 0-2.75-2.75M3 12.5h15a3 3 0 1 1-3 3M3 16.5h6.5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>',
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2.2" fill="currentColor"/><rect x="13" y="4" width="7" height="7" rx="2.2" fill="currentColor" opacity=".55"/><rect x="4" y="13" width="7" height="7" rx="2.2" fill="currentColor" opacity=".55"/><rect x="13" y="13" width="7" height="7" rx="2.2" fill="currentColor"/></svg>'
  };

  /* ---------- Сақтау (тек осы құрылғыда) ---------- */
  var Store = {
    key: 'soz-alemi:v1',
    d: { stars: { 1: [], 2: [], 3: [] }, sound: true },
    load: function () {
      try {
        var raw = localStorage.getItem(this.key);
        if (raw) {
          var p = JSON.parse(raw);
          if (p && p.stars) { for (var k in this.d.stars) if (Array.isArray(p.stars[k])) this.d.stars[k] = p.stars[k]; }
          if (p && typeof p.sound === 'boolean') this.d.sound = p.sound;
        }
      } catch (e) { /* localStorage жоқ — ештеңе етпейміз */ }
    },
    save: function () { try { localStorage.setItem(this.key, JSON.stringify(this.d)); } catch (e) { } },
    star: function (lvl, idx) { var a = this.d.stars[lvl]; if (a.indexOf(idx) < 0) { a.push(idx); this.save(); return true; } return false; },
    count: function (lvl) { return Math.min(STARS_PER_LEVEL, this.d.stars[lvl].length); },
    total: function () { var t = 0; for (var k in this.d.stars) t += this.count(k); return t; },
    reset: function () { this.d.stars = { 1: [], 2: [], 3: [] }; this.save(); }
  };

  /* ---------- Дыбыстар (Web Audio, файлсыз) ---------- */
  var Sound = {
    ctx: null,
    ensure: function () {
      try {
        if (!this.ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; this.ctx = new AC(); }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { return null; }
      return this.ctx;
    },
    tone: function (f, when, dur, type, vol) {
      if (!Store.d.sound) return;
      var c = this.ensure(); if (!c) return;
      try {
        var t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2));
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + (dur || 0.2) + 0.05);
      } catch (e) { }
    },
    tap: function () { this.tone(880, 0, 0.07, 'sine', 0.045); },
    pop: function () { this.tone(587, 0, 0.1, 'triangle', 0.1); this.tone(1175, 0.045, 0.14, 'sine', 0.06); },
    soft: function () { this.tone(440, 0, 0.18, 'sine', 0.05); this.tone(392, 0.09, 0.22, 'sine', 0.04); },
    success: function () { var s = this;[523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { s.tone(f, i * 0.085, 0.42, 'triangle', 0.085); }); },
    fanfare: function () { var s = this;[523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach(function (f, i) { s.tone(f, i * 0.11, 0.55, 'triangle', 0.085); }); },
    breathIn: function () { this.tone(330, 0, 0.9, 'sine', 0.04); this.tone(495, 0.3, 0.9, 'sine', 0.03); },
    breathOut: function () { this.tone(495, 0, 0.9, 'sine', 0.03); this.tone(330, 0.3, 1.1, 'sine', 0.04); }
  };

  /* ---------- Қазақша дауыс (құрылғыда бар болса ғана) ---------- */
  var Voice = {
    v: null,
    init: function () {
      if (!('speechSynthesis' in window)) return;
      var self = this;
      function pickVoice() {
        try {
          var vs = speechSynthesis.getVoices() || [];
          self.v = vs.filter(function (x) { return /^kk/i.test(x.lang); })[0] || null;
          document.documentElement.classList.toggle('has-voice', !!self.v);
        } catch (e) { }
      }
      pickVoice();
      try { speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) { speechSynthesis.onvoiceschanged = pickVoice; }
    },
    say: function (text, onEnd) {
      if (!this.v) { if (onEnd) onEnd(); return; }
      try {
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.voice = this.v; u.lang = this.v.lang; u.rate = 0.8; u.pitch = 1.05;
        if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
        speechSynthesis.speak(u);
      } catch (e) { if (onEnd) onEnd(); }
    },
    stop: function () { try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { } }
  };

  /* ---------- Lottie анимациялары ---------- */
  var animText = new Map();
  var live = new Set();
  function animData(code) {
    if (!animText.has(code)) {
      animText.set(code, fetch('emoji/anim/' + code + '.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }));
    }
    return animText.get(code);
  }
  function hydrate(root) {
    sweep();
    if (RM || !window.lottie || !window.fetch) return;
    $$('.emo[data-anim]', root).forEach(function (el) {
      if (el._hyd) return; el._hyd = true;
      animData(el.dataset.anim).then(function (txt) {
        if (!el.isConnected) return;
        var box = document.createElement('i'); box.className = 'emo-anim'; el.appendChild(box);
        var a = window.lottie.loadAnimation({
          container: box, renderer: 'svg', loop: true, autoplay: true,
          animationData: JSON.parse(txt), rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true }
        });
        a.addEventListener('DOMLoaded', function () { el.classList.add('live'); });
        live.add({ el: el, a: a });
      }).catch(function () { animText.delete(el.dataset.anim); });
    });
  }
  function sweep() {
    live.forEach(function (o) { if (!o.el.isConnected) { try { o.a.destroy(); } catch (e) { } live.delete(o); } });
  }
  document.addEventListener('visibilitychange', function () {
    live.forEach(function (o) { try { document.hidden ? o.a.pause() : o.a.play(); } catch (e) { } });
  });

  /* ---------- «Dynamic Island» хабарламасы ---------- */
  var island = $('#island'), islandT = 0;
  function toast(code, text) {
    island.innerHTML = emo(code) + '<span>' + text + '</span>';
    hydrate(island);
    island.classList.remove('show'); void island.offsetWidth; island.classList.add('show');
    clearTimeout(islandT);
    islandT = setTimeout(function () { island.classList.remove('show'); }, 2300);
  }

  /* ---------- Конфетти ---------- */
  var cv = $('#confetti'), cx = cv.getContext && cv.getContext('2d'), parts = [], raf = 0;
  var COLORS = ['#ff375f', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#40c8e0', '#ff6bd6'];
  function sizeCanvas() {
    if (!cx) return;
    var d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0);
  }
  window.addEventListener('resize', sizeCanvas);
  function confetti(n, el) {
    if (!cx) return;
    n = RM ? Math.min(n || 60, 16) : (n || 60);
    var x = innerWidth / 2, y = innerHeight * 0.38;
    if (el && el.getBoundingClientRect) { var r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 8;
      parts.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, g: 0.2 + Math.random() * 0.12,
        s: 7 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35,
        c: pick(COLORS), shape: Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? 1 : 2), life: 0, max: 100 + Math.random() * 60
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(function (p) { return p.life < p.max && p.y < innerHeight + 40; });
    parts.forEach(function (p) {
      p.life++; p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      cx.globalAlpha = Math.max(0, Math.min(1, (p.max - p.life) / 25));
      cx.fillStyle = p.c; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r);
      if (p.shape === 0) { cx.beginPath(); cx.arc(0, 0, p.s / 2, 0, 7); cx.fill(); }
      else if (p.shape === 1) { cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
      else { cx.beginPath(); for (var k = 0; k < 5; k++) { var an = k * 1.2566 - 1.5708; cx.lineTo(Math.cos(an) * p.s / 1.6, Math.sin(an) * p.s / 1.6); var an2 = an + 0.6283; cx.lineTo(Math.cos(an2) * p.s / 3.6, Math.sin(an2) * p.s / 3.6); } cx.closePath(); cx.fill(); }
      cx.restore();
    });
    cx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(tick) : 0;
    if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
  }

  function celebrate(el, big) {
    Sound.success();
    confetti(big ? 140 : 70, el);
    if (navigator.vibrate) { try { navigator.vibrate(18); } catch (e) { } }
  }

  /* ---------- Экран ауыстыру ---------- */
  var app = $('#app'), cur = null;
  function go(make, dir) {
    Voice.stop();
    var next = make();
    var prev = cur; cur = next;
    document.body.dataset.tone = next.dataset.tone || 'base';
    app.appendChild(next);
    hydrate(next);
    if (prev) {
      if (prev._leave) prev._leave();
      if (RM) { prev.remove(); sweep(); }
      else {
        var back = dir === 'back';
        next.classList.add(back ? 'in-back' : 'in-fwd');
        prev.classList.add(back ? 'out-back' : 'out-fwd');
        setTimeout(function () { prev.remove(); sweep(); next.classList.remove('in-back', 'in-fwd'); }, 480);
      }
    }
    try { next.focus({ preventScroll: true }); } catch (e) { }
  }

  function screenEl(html, tone, cls) {
    var el = h('<section class="screen ' + (cls || '') + '" data-scope data-tone="' + (tone || 'base') + '" tabindex="-1">' + html + '</section>');
    el._acts = {};
    return el;
  }

  function soundIcon() { return Store.d.sound ? I.sound : I.mute; }
  function topbar(back) {
    return '<header class="topbar">' +
      (back ? '<button class="icon-btn glass" data-act="back" aria-label="Артқа">' + I.back + '</button>' : '<span class="icon-spacer"></span>') +
      '<div class="tb-actions glass">' +
      '<button class="icon-btn" data-act="breath" aria-label="Тыныс алу жаттығуы" title="Тыныс алу жаттығуы">' + I.wind + '</button>' +
      '<button class="icon-btn" data-act="sound" aria-label="Дыбысты қосу/өшіру" title="Дыбыс">' + soundIcon() + '</button>' +
      '<button class="icon-btn" data-act="info" aria-label="Ата-аналар мен педагогтарға" title="Үлкендерге">' + I.info + '</button>' +
      '</div></header>';
  }

  function starsRow(n, total, cls) {
    var s = '';
    for (var i = 0; i < total; i++) s += emo('2b50', (i < n ? '' : 'off ') + (cls || ''), true);
    return s;
  }

  /* ---------- Глобал әрекеттер ---------- */
  var Global = {
    sound: function () {
      Store.d.sound = !Store.d.sound; Store.save();
      $$('[data-act="sound"]').forEach(function (b) { b.innerHTML = soundIcon(); });
      if (Store.d.sound) Sound.success();
    },
    info: function () { openInfo(); },
    breath: function () { openBreath(); }
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    var scope = b.closest('[data-scope]');
    var map = (scope && scope._acts) || {};
    var fn = map[b.dataset.act] || Global[b.dataset.act];
    if (fn) { if (b.dataset.act !== 'tile') Sound.tap(); fn(b, e); }
  });

  /* ==========================================================
     1. Басты бет
     ========================================================== */
  function nextLevel() {
    for (var i = 0; i < C.levels.length; i++) if (Store.count(C.levels[i].id) < STARS_PER_LEVEL) return C.levels[i].id;
    return 1;
  }

  function screenHome() {
    var started = Store.total() > 0;
    var el = screenEl(topbar(false) +
      '<div class="wrap">' +
      '<div class="bubble glass hero-bubble">Сәлем! Бірге ойнайық!<span class="tail"></span></div>' +
      '<div class="hero">' +
      '<div class="hero-orb glass"><div class="rays"></div><div class="halo"></div>' + emo('1f425') + '</div>' +
      '<span class="float f1">' + emo('1f34e', '', true) + '</span>' +
      '<span class="float f2">' + emo('2b50', '', true) + '</span>' +
      '<span class="float f3">' + emo('1f4ac', '', true) + '</span>' +
      '<span class="float f4">' + emo('1f4da', '', true) + '</span>' +
      '</div>' +
      '<h1 class="hero-title">Сөз әлемі</h1>' +
      '<p class="hero-sub">Сөйлеуді дамытатын көңілді ойындар</p>' +
      '<div class="level-pills">' +
      C.levels.map(function (L) { return '<span class="chip glass">' + emo(L.mark, '', true) + L.difficulty + '</span>'; }).join('') +
      '</div>' +
      '<button class="btn btn-primary btn-xl pulse" data-act="start">' + I.play + (started ? 'Жалғастыру' : 'Бастау') + '</button>' +
      '<p class="calm">' + emo('2728', '', true) + 'Тіркелусіз · Тегін · Уақыт шектелмейді</p>' +
      '<div class="home-links">' +
      '<button class="btn btn-glass glass btn-sm" data-act="levels">' + I.grid + 'Деңгейлер</button>' +
      '<button class="btn btn-glass glass btn-sm" data-act="info">' + emo('1f468_200d_1f469_200d_1f467', '', true) + 'Үлкендерге</button>' +
      '</div>' +
      '</div>', 'base', 'home');
    el._acts.start = function () { openLevel(nextLevel()); };
    el._acts.levels = function () { go(screenLevels); };
    return el;
  }

  /* ==========================================================
     2. Деңгейлер
     ========================================================== */
  function screenLevels() {
    var el = screenEl(topbar(true) +
      '<div class="wrap">' +
      '<div class="levels-head">' +
      '<span class="eyebrow">' + emo('1f3af', '', true) + 'Тақырыбы</span>' +
      '<p class="sub">' + C.topic + '</p>' +
      '<h1 class="large-title">Деңгейді таңда</h1>' +
      '</div>' +
      '<div class="mascot-row">' + emo('1f425') + '<div class="bubble glass">Қай ойыннан бастаймыз? Асықпа, уақытымыз жеткілікті!</div></div>' +
      '<button class="warmup glass" data-act="breath">' + emo('1f338') +
      '<div><b>Алдымен тыныс алайық</b><span>Сөйлер алдында денені босаңсытатын жаттығу</span></div><span class="chev">' + I.chev + '</span></button>' +
      '<div class="levels">' +
      C.levels.map(function (L) {
        var n = Store.count(L.id);
        return '<button class="level-card glass t-' + L.tone + '" data-act="open" data-level="' + L.id + '">' +
          (n >= STARS_PER_LEVEL ? '<span class="lc-done">✓ Орындалды</span>' : '') +
          '<span class="lc-icon">' + emo(L.icon) + '</span>' +
          '<span class="lc-body">' +
          '<span class="lc-badge"><i></i>' + L.id + '-деңгей · ' + L.difficulty + '</span>' +
          '<b class="lc-title">«' + L.title + '»</b>' +
          '<span class="lc-desc">' + L.instruction + '</span>' +
          '<span class="lc-stars">' + starsRow(n, STARS_PER_LEVEL) + '<span>' + n + '/' + STARS_PER_LEVEL + '</span></span>' +
          '</span>' +
          '<span class="lc-go">' + I.chev + '</span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '<div class="total glass">' + emo('1f31f') + 'Барлық жұлдыз: ' + Store.total() + ' / ' + (STARS_PER_LEVEL * C.levels.length) + '</div>' +
      '</div>', 'base', 'levels-screen');
    el._acts.back = function () { go(screenHome, 'back'); };
    el._acts.open = function (b) { openLevel(+b.dataset.level); };
    return el;
  }

  function openLevel(id, dir) {
    var make = id === 1 ? screenL1 : id === 2 ? screenL2 : screenL3;
    go(make, dir);
  }

  /* ---------- Тапсырма бетінің қаңқасы ---------- */
  function taskShell(L) {
    var el = screenEl(topbar(true) +
      '<div class="wrap">' +
      '<div class="task-head">' +
      '<span class="eyebrow">' + emo(L.mark, '', true) + L.id + '-деңгей · ' + L.difficulty + '</span>' +
      '<h1 class="large-title">«' + L.title + '»</h1>' +
      '<div class="dots" data-ref="dots" aria-hidden="true"></div>' +
      '</div>' +
      '<p class="instr glass">' + emo('1f422') + '<span><small>Нұсқаулық</small>' + L.instruction + '</span></p>' +
      '<div class="stage glass" data-ref="stage"><div class="stage-inner"></div></div>' +
      '<div class="actions" data-ref="actions"></div>' +
      '</div>', L.tone, 'task');
    el._acts.back = function () { go(screenLevels, 'back'); };
    return el;
  }
  function setDots(box, total, i) {
    var s = '';
    for (var k = 0; k < total; k++) s += '<i class="' + (k < i ? 'done' : k === i ? 'cur' : '') + '"></i>';
    box.innerHTML = s;
  }
  function swapStage(stage, html, animate) {
    var old = stage.firstElementChild;
    function put() {
      var n = h('<div class="stage-inner' + (animate ? ' entering' : '') + '">' + html + '</div>');
      stage.innerHTML = ''; stage.appendChild(n); hydrate(stage);
      return n;
    }
    if (!animate || RM || !old) return Promise.resolve(put());
    old.classList.add('leaving');
    return wait(220).then(put);
  }
  function praiseHTML() { return '<span class="praise">' + emo(pick(['1f389', '1f31f', '1f44f', '1f973'])) + pick(C.praise) + '</span>'; }
  function btn(act, label, kind, extra) {
    return '<button class="btn ' + (kind || 'btn-primary') + (extra ? ' ' + extra : '') + '" data-act="' + act + '">' + label + '</button>';
  }
  function giveStar(L, idx, el) {
    var isNew = Store.star(L.id, idx);
    celebrate(el);
    toast('2b50', isNew ? '+1 жұлдыз · ' + Store.count(L.id) + '/' + STARS_PER_LEVEL : pick(C.praise));
  }
  function scrollIntoViewSoft(el) {
    try { el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); } catch (e) { }
  }

  /* ==========================================================
     3. 1-деңгей — «Суретті ата»
     ========================================================== */
  function screenL1() {
    var L = C.levels[0];
    var el = taskShell(L);
    var stage = $('[data-ref=stage]', el), actions = $('[data-ref=actions]', el), dots = $('[data-ref=dots]', el);
    var i = 0, hint = 0, said = false;

    function render(animate) {
      var it = L.items[i]; hint = 0; said = false;
      setDots(dots, L.items.length, i);
      swapStage(stage,
        '<button class="pic" data-act="poke" aria-label="Сурет">' +
        '<span class="rays"></span><span class="halo"></span>' + emo(it.e, 'pic-emo') + '<span class="pic-shadow"></span></button>' +
        '<h2 class="question">' + it.q + '</h2>' +
        '<div data-ref="hint"></div>' +
        '<div data-ref="answer"></div>', animate);
      actions.innerHTML =
        btn('hint', emo('1f4a1', '', true) + 'Көмек', 'btn-glass glass') +
        btn('said', emo('1f3a4', '', true) + 'Айттым!', 'btn-primary', 'pulse');
    }

    el._acts.poke = function () {
      var p = $('.pic-emo', stage); if (!p) return;
      Sound.pop(); p.classList.remove('poke'); void p.offsetWidth; p.classList.add('poke');
    };
    el._acts.hint = function (b) {
      var it = L.items[i], box = $('[data-ref=hint]', stage);
      hint = Math.min(2, hint + 1);
      Sound.soft();
      if (hint === 1) {
        box.innerHTML = '<div class="hint">' + emo('1f4a1') + 'Алғашқы дыбысы: <b>«' + cap(it.a.charAt(0)) + '…»</b></div>';
      } else {
        box.innerHTML = '<div class="hint">' + emo('1f425') + 'Бірге айтайық: <span class="syl">' +
          it.syl.map(function (s) { return '<span>' + s + '</span>'; }).join('<i>–</i>') + '</span></div>';
        b.disabled = true;
      }
      hydrate(box);
    };
    el._acts.said = function () {
      if (said) return; said = true;
      var it = L.items[i];
      $('[data-ref=hint]', stage).innerHTML = '';
      var ans = $('[data-ref=answer]', stage);
      ans.innerHTML = '<div class="answer">' + praiseHTML() +
        '<div class="answer-word">Бұл — <b>' + it.a + '</b>!</div>' +
        '<div class="syl">' + it.syl.map(function (s) { return '<span>' + s + '</span>'; }).join('<i>·</i>') + '</div></div>';
      hydrate(ans);
      giveStar(L, i, $('.pic', stage));
      var last = i === L.items.length - 1;
      actions.innerHTML =
        btn('listen', emo('1f50a', '', true) + 'Тыңда', 'btn-glass glass tts') +
        btn('next', last ? emo('1f3c1', '', true) + 'Аяқтау' : 'Келесі ' + I.next);
      scrollIntoViewSoft(ans);
    };
    el._acts.listen = function () { Voice.say(L.items[i].a); };
    el._acts.next = function () {
      if (i < L.items.length - 1) { i++; render(true); try { el.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { } }
      else go(function () { return screenDone(L); });
    };
    render(false);
    return el;
  }

  /* ==========================================================
     4. 2-деңгей — «Сөйлем құрастыр»
     ========================================================== */
  function screenL2() {
    var L = C.levels[1];
    var el = taskShell(L);
    var stage = $('[data-ref=stage]', el), actions = $('[data-ref=actions]', el), dots = $('[data-ref=dots]', el);
    var i = 0, said = false, phase = 'ask', placed = [], busy = false;

    function orders(it) { return [it.tiles].concat(it.alt || []); }
    function prefixOk(it, seq) {
      return orders(it).some(function (o) { for (var k = 0; k < seq.length; k++) if (o[k] !== seq[k]) return false; return true; });
    }
    function sentence(seq) { return cap(seq.join(' ')) + '.'; }

    function render(animate) {
      var it = L.items[i]; said = false; phase = 'ask'; placed = []; busy = false;
      setDots(dots, L.items.length, i);
      swapStage(stage,
        '<div class="words">' + it.words.map(function (w) { return '<div class="word">' + emo(w[1]) + '<b>' + w[0] + '</b></div>'; }).join('<span class="plus">+</span>') + '</div>' +
        '<p class="tip" data-ref="tip">' + emo('1f4ac') + 'Осы сөздерді қолданып, сөйлем айт</p>' +
        '<div data-ref="builder" class="builder-box"></div>' +
        '<div data-ref="answer"></div>', animate);
      actions.innerHTML =
        btn('help', emo('1f9e9', '', true) + 'Көмек', 'btn-glass glass') +
        btn('said', emo('1f3a4', '', true) + 'Айттым!', 'btn-primary', 'pulse');
    }

    function openBuilder(title) {
      var it = L.items[i];
      phase = 'build';
      var pool;
      var guard = 0;
      do { pool = shuffle(it.tiles); guard++; } while (guard < 20 && orders(it).some(function (o) { return o.join() === pool.join(); }));
      var box = $('[data-ref=builder]', stage);
      box.innerHTML = '<div class="builder">' +
        '<p class="builder-title">' + emo('1f9e9', '', true) + title + '</p>' +
        '<div class="slots" data-ref="slots">' + it.tiles.map(function () { return '<span class="slot"></span>'; }).join('') + '<span class="slot period">.</span></div>' +
        '<div class="pool">' + pool.map(function (w) { return '<button class="tile" data-act="tile" data-w="' + w + '">' + w + '</button>'; }).join('') + '</div>' +
        '</div>';
      actions.innerHTML = btn('auto', emo('1f4a1', '', true) + 'Мысалды көрсету', 'btn-glass glass');
      scrollIntoViewSoft(box);
    }

    function place(tileBtn) {
      var slots = $$('.slot:not(.period)', stage);
      var target = slots[placed.length];
      placed.push(tileBtn.dataset.w);
      Sound.pop();
      return fly(tileBtn, target).then(function () {
        target.textContent = placed.length === 1 ? cap(tileBtn.dataset.w) : tileBtn.dataset.w;
        target.classList.add('filled');
        if (placed.length === L.items[i].tiles.length) finishBuild();
      });
    }

    function finishBuild() {
      phase = 'done';
      var it = L.items[i];
      $('[data-ref=slots]', stage).classList.add('complete');
      var built = sentence(placed);
      var ans = $('[data-ref=answer]', stage);
      ans.innerHTML = '<div class="answer">' + praiseHTML() +
        '<p class="example">Мысалы: <q>' + it.example.replace(/\.$/, '') + '</q>.</p>' +
        (built !== it.example ? '<p class="note">Сенің жинағаның да дұрыс: «' + built.replace(/\.$/, '') + '».</p>' : '') +
        '<p class="note">' + emo('1f44d', '', true) + 'Сенің сөйлемің басқаша болса да, ол да дұрыс!</p></div>';
      hydrate(ans);
      $('[data-ref=tip]', stage).innerHTML = emo('1f4ac') + (said ? 'Сөйлем дайын!' : 'Енді осы сөйлемді өзің айтып көр');
      hydrate($('[data-ref=tip]', stage));
      Sound.success(); confetti(50, $('[data-ref=slots]', stage));
      setDoneActions();
      scrollIntoViewSoft(ans);
    }

    function setDoneActions() {
      var last = i === L.items.length - 1;
      actions.innerHTML = btn('listen', emo('1f50a', '', true) + 'Тыңда', 'btn-glass glass tts') +
        (said ? btn('next', last ? emo('1f3c1', '', true) + 'Аяқтау' : 'Келесі ' + I.next)
          : btn('said', emo('1f3a4', '', true) + 'Айттым!', 'btn-primary', 'pulse'));
    }

    el._acts.help = function () {
      Sound.soft();
      $('[data-ref=tip]', stage).innerHTML = emo('1f4a1') + 'Сөздерді ретімен бас — сөйлем шығады';
      hydrate($('[data-ref=tip]', stage));
      openBuilder('Сөйлемді жинап көр');
    };
    el._acts.said = function () {
      if (said) return; said = true;
      giveStar(L, i, $('.words', stage));
      if (phase === 'ask') {
        $('[data-ref=tip]', stage).innerHTML = emo('1f44f') + pick(C.praise) + ' Енді сөйлемді жина';
        hydrate($('[data-ref=tip]', stage));
        openBuilder('Сөйлемді жинап көр');
      } else if (phase === 'done') {
        $('[data-ref=tip]', stage).innerHTML = emo('1f44f') + 'Сөйлем дайын!';
        hydrate($('[data-ref=tip]', stage));
        setDoneActions();
      }
    };
    el._acts.tile = function (b) {
      if (phase !== 'build' || busy || b.classList.contains('used')) return;
      var it = L.items[i];
      if (prefixOk(it, placed.concat(b.dataset.w))) { busy = true; place(b).then(function () { busy = false; }); }
      else {
        Sound.soft();
        b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
        $('[data-ref=tip]', stage).innerHTML = emo('1f422') + 'Басқа сөзді байқап көр — асықпа';
        hydrate($('[data-ref=tip]', stage));
      }
    };
    el._acts.auto = function () {
      if (phase !== 'build' || busy) return;
      var it = L.items[i];
      var target = orders(it).filter(function (o) { return placed.every(function (w, k) { return o[k] === w; }); })[0] || it.tiles;
      busy = true;
      var chain = Promise.resolve();
      target.slice(placed.length).forEach(function (w) {
        chain = chain.then(function () {
          var t = $$('.tile:not(.used)', stage).filter(function (x) { return x.dataset.w === w; })[0];
          return t ? place(t).then(function () { return wait(120); }) : null;
        });
      });
      chain.then(function () { busy = false; });
    };
    el._acts.listen = function () { Voice.say(phase === 'done' ? sentence(placed) : L.items[i].example); };
    el._acts.next = function () {
      if (i < L.items.length - 1) { i++; render(true); try { el.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { } }
      else go(function () { return screenDone(L); });
    };
    render(false);
    return el;
  }

  function fly(fromEl, toEl) {
    var a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    var g = fromEl.cloneNode(true);
    g.classList.add('ghost'); g.removeAttribute('data-act');
    g.style.cssText = 'position:fixed;margin:0;z-index:55;left:' + a.left + 'px;top:' + a.top + 'px;width:' + a.width + 'px;height:' + a.height + 'px;';
    document.body.appendChild(g);
    fromEl.classList.add('used');
    var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    if (RM || !g.animate) { g.remove(); return Promise.resolve(); }
    var an = g.animate([
      { transform: 'translate(0,0) scale(1)' },
      { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 50) + 'px) scale(1.12) rotate(-4deg)' },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1)' }
    ], { duration: 460, easing: 'cubic-bezier(.2,.8,.2,1)' });
    return new Promise(function (res) { an.onfinish = function () { g.remove(); res(); }; an.oncancel = an.onfinish; });
  }

  /* ==========================================================
     5. 3-деңгей — «Әңгімені жалғастыр»
     ========================================================== */
  function screenL3() {
    var L = C.levels[2];
    var el = taskShell(L);
    var stage = $('[data-ref=stage]', el), actions = $('[data-ref=actions]', el), dots = $('[data-ref=dots]', el);
    var step = 0, count = 0, said = false, reading = false;
    var rec = { mr: null, chunks: [], url: null, stream: null, audio: null };
    var STEPS = 2 + L.questions.length; // басы + сұрақтар + әңгіме

    function scene() {
      return '<div class="scene" aria-label="Айдос пен күшік">' +
        '<span class="hill"></span><span class="hill h2"></span>' +
        emo('1f31e', 's-sun') + emo('2601_fe0f', 's-cloud') + emo('2601_fe0f', 's-cloud c2', true) +
        emo('1f3e1', 's-house') + emo('1f333', 's-tree') + emo('1f436', 's-dog') + emo('1f466', 's-boy') +
        emo('1f98b', 's-fly') + emo('1f337', 's-flower') + emo('1f33c', 's-flower f2') +
        '</div>';
    }

    function render(animate) {
      said = false; reading = false; Voice.stop();
      setDots(dots, STEPS, step);
      var html, acts;
      if (step === 0) {
        html = scene() +
          '<div class="story" data-ref="story"><small>Басталуы</small>«' +
          L.story.map(function (s, k) { return '<span data-k="' + k + '">' + s + '</span>'; }).join(' ') + '»</div>';
        acts = btn('read', emo('1f50a', '', true) + 'Оқып беру', 'btn-glass glass tts') +
          btn('readDone', emo('1f4d6', '', true) + 'Оқыдым', 'btn-primary', 'pulse');
      } else if (step <= L.questions.length) {
        var q = L.questions[step - 1];
        html = '<div class="q-card">' +
          '<span class="q-label">' + step + '-сұрақ</span>' +
          '<span class="q-num">' + step + '</span>' +
          '<h2 class="question">' + q.q + '</h2>' +
          '<p class="tip" data-ref="tip">' + emo('1f422') + pick(C.calm) + '</p>' +
          '<div data-ref="ideas" style="width:100%"></div>' +
          '<div data-ref="answer"></div>' +
          '</div>';
        acts = btn('ideas', emo('1f4a1', '', true) + 'Ой-көмекші', 'btn-glass glass') +
          btn('said', emo('1f3a4', '', true) + 'Айттым!', 'btn-primary', 'pulse');
      } else {
        count = 0;
        html = '<div class="q-card">' +
          '<span class="q-label">Соңғы қадам</span>' +
          '<div class="q-mini">' + emo('1f466', '', true) + emo('2764_fe0f') + emo('1f436', '', true) + '</div>' +
          '<h2 class="question">Енді бүкіл әңгімені айтып бер!</h2>' +
          '<p class="tip">' + emo('1f4da') + L.task + '</p>' +
          '<div class="recap"><ul>' + L.questions.map(function (q, k) { return '<li><i>' + (k + 1) + '</i>' + q.q + '</li>'; }).join('') + '</ul></div>' +
          '<div class="counter">' +
          '<div class="c-slots" data-ref="cslots">' + Array.apply(null, Array(L.maxSentences)).map(function (_, k) {
            return '<span class="c-slot' + (k < L.minSentences ? ' goal' : '') + '">' + emo('2b50', '', true) + '</span>';
          }).join('') + '</div>' +
          '<div class="c-row"><button class="c-undo glass" data-act="minus" aria-label="Бір сөйлемді алып тастау">−1</button>' +
          '<button class="c-btn" data-act="plus" aria-label="Мен бір сөйлем айттым"><b>+1</b><small>сөйлем</small></button>' +
          '<span style="width:52px"></span></div>' +
          '<p class="c-msg" data-ref="cmsg">Әр сөйлем айтқан сайын «+1» бас</p>' +
          '</div>' +
          (canRecord() ? '<div class="rec glass">' + emo('1f399_fe0f', '', true) +
            '<div class="rec-info"><b>Әңгімеңді жазып ал</b><span>Кейін өзің тыңдай аласың. Жазба тек осы құрылғыда қалады.</span></div>' +
            '<div class="rec-ctrl" data-ref="recctrl"></div></div>' : '') +
          '</div>';
        acts = btn('finish', emo('1f3c1', '', true) + 'Аяқтау', 'btn-primary');
      }
      swapStage(stage, html, animate).then(function () {
        if (step === STEPS - 1) { renderRec(); var f = $('[data-act=finish]', actions); if (f) f.disabled = true; }
      });
      actions.innerHTML = acts;
      if (step === STEPS - 1) { var f0 = $('[data-act=finish]', actions); if (f0) f0.disabled = true; }
    }

    function advance() {
      if (step < STEPS - 1) { step++; render(true); try { el.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { } }
    }

    el._acts.read = function () {
      if (reading) return; reading = true;
      var spans = $$('[data-ref=story] span', stage), k = 0;
      (function nextSentence() {
        spans.forEach(function (s) { s.classList.remove('reading'); });
        if (k >= spans.length || !spans[k].isConnected) { reading = false; return; }
        spans[k].classList.add('reading');
        Voice.say(L.story[k], function () { k++; setTimeout(nextSentence, 350); });
      })();
    };
    el._acts.readDone = function () {
      Voice.stop();
      giveStar(L, 0, $('.scene', stage));
      setTimeout(advance, RM ? 0 : 650);
    };
    el._acts.ideas = function (b) {
      var q = L.questions[step - 1], box = $('[data-ref=ideas]', stage);
      Sound.soft();
      box.innerHTML = '<p class="ideas-label">Мына суреттер көмектеседі — біреуін таңда немесе өзің ойла:</p>' +
        '<div class="ideas">' + q.ideas.map(function (d) {
          return '<button class="idea" data-act="idea" data-t="' + d[1] + '">' + emo(d[0], '', true) + '<span>' + d[1] + '</span></button>';
        }).join('') + '</div>';
      b.disabled = true;
      scrollIntoViewSoft(box);
    };
    el._acts.idea = function (b) {
      $$('.idea', stage).forEach(function (x) { x.classList.toggle('on', x === b); });
      Sound.pop();
      Voice.say(b.dataset.t);
    };
    el._acts.said = function () {
      if (said) return; said = true;
      var ans = $('[data-ref=answer]', stage);
      ans.innerHTML = '<div class="answer">' + praiseHTML() + '<p class="note">' + emo('1f425', '', true) + 'Қандай қызық ой!</p></div>';
      hydrate(ans);
      giveStar(L, step, $('.q-num', stage));
      actions.innerHTML = btn('next', 'Келесі ' + I.next);
      scrollIntoViewSoft(ans);
    };
    el._acts.next = function () { advance(); };

    var MSG = ['Әр сөйлем айтқан сайын «+1» бас', 'Керемет бастама!', 'Жарайсың! Әрі қарай…', 'Тамаша! 3 сөйлем — мақсат орындалды!', 'Ғажап! Тағы айтасың ба?', 'Керемет әңгіме! 5 сөйлем!'];
    function paintCounter() {
      $$('.c-slot', stage).forEach(function (s, k) { s.classList.toggle('on', k < count); });
      $('[data-ref=cmsg]', stage).textContent = MSG[count];
      var plus = $('[data-act=plus]', stage); if (plus) plus.disabled = count >= L.maxSentences;
      var f = $('[data-act=finish]', actions); if (f) { f.disabled = count < L.minSentences; f.classList.toggle('pulse', count >= L.minSentences); }
    }
    el._acts.plus = function () {
      if (count >= L.maxSentences) return;
      count++;
      Sound.pop();
      paintCounter();
      if (count === L.minSentences) { celebrate($('.c-btn', stage)); toast('1f31f', 'Мақсат орындалды!'); }
      else if (count === L.maxSentences) { celebrate($('.c-btn', stage), true); }
    };
    el._acts.minus = function () { if (count > 0) { count--; Sound.soft(); paintCounter(); } };
    el._acts.finish = function () {
      if (count < L.minSentences) return;
      stopRecording(true);
      Store.star(L.id, STEPS - 1);
      go(function () { return screenDone(L); });
    };

    /* --- Дыбыс жазу (міндетті емес) --- */
    function canRecord() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
    function renderRec(state) {
      var box = $('[data-ref=recctrl]', stage); if (!box) return;
      state = state || (rec.url ? 'ready' : 'idle');
      if (state === 'idle') box.innerHTML = btn('recStart', I.rec + 'Жазу', 'btn-glass glass');
      else if (state === 'rec') box.innerHTML = btn('recStop', '<span class="rec-dot"></span>Тоқтату', 'btn-glass glass');
      else box.innerHTML = btn('recPlay', I.play + 'Тыңдау', 'btn-primary') + btn('recStart', I.redo + 'Қайта', 'btn-glass glass');
    }
    el._acts.recStart = function () {
      stopRecording(true);
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        rec.stream = stream; rec.chunks = [];
        if (rec.url) { URL.revokeObjectURL(rec.url); rec.url = null; }
        var mr = new MediaRecorder(stream); rec.mr = mr;
        mr.ondataavailable = function (e) { if (e.data && e.data.size) rec.chunks.push(e.data); };
        mr.onstop = function () {
          if (rec.chunks.length) rec.url = URL.createObjectURL(new Blob(rec.chunks, { type: mr.mimeType || 'audio/webm' }));
          releaseStream(); renderRec();
        };
        mr.start(); renderRec('rec');
      }).catch(function () { toast('1f399_fe0f', 'Микрофон қолжетімсіз'); });
    };
    el._acts.recStop = function () { stopRecording(); };
    el._acts.recPlay = function () {
      if (!rec.url) return;
      try { if (rec.audio) rec.audio.pause(); rec.audio = new Audio(rec.url); rec.audio.play().catch(function () { }); } catch (e) { }
    };
    function releaseStream() { if (rec.stream) { rec.stream.getTracks().forEach(function (t) { t.stop(); }); rec.stream = null; } }
    function stopRecording(silent) {
      if (rec.mr && rec.mr.state === 'recording') { if (silent) rec.mr.onstop = function () { releaseStream(); }; rec.mr.stop(); }
      rec.mr = null;
      if (silent) releaseStream();
    }
    el._leave = function () {
      stopRecording(true);
      if (rec.audio) rec.audio.pause();
      if (rec.url) { URL.revokeObjectURL(rec.url); rec.url = null; }
    };

    render(false);
    return el;
  }

  /* ==========================================================
     6. Нәтиже беті
     ========================================================== */
  function screenDone(L) {
    var n = Store.count(L.id);
    var all = C.levels.every(function (l) { return Store.count(l.id) >= STARS_PER_LEVEL; });
    var nextL = C.levels[L.id] || null;
    var el = screenEl(topbar(true) +
      '<div class="wrap">' +
      '<div class="trophy"><span class="rays"></span><span class="halo"></span>' + emo(all ? '1f3c6' : (L.id === 3 ? '1f3c6' : '1f31f')) + '</div>' +
      '<span class="eyebrow">' + emo(L.mark, '', true) + L.id + '-деңгей · «' + L.title + '»</span>' +
      '<h1 class="large-title">' + pick(C.praise) + '</h1>' +
      '<p class="sub">Деңгей орындалды! Жиналған жұлдыздар: ' + n + '/' + STARS_PER_LEVEL + '</p>' +
      '<div class="stars-row">' + (function () {
        var s = ''; for (var k = 0; k < STARS_PER_LEVEL; k++) s += emo('2b50', k < n ? '' : 'off', k >= n).replace('class="emo', 'style="animation-delay:' + (0.25 + k * 0.12) + 's" class="emo');
        return s;
      })() + '</div>' +
      '<div class="crit glass">' + emo('2705', '', true) + '<span>' + L.criterion + '</span></div>' +
      (all ? '<div class="master glass">' + emo('1f973') + ' Барлық деңгей орындалды! Сен — нағыз сөз шебері!</div>' : '') +
      '<div class="done-actions">' +
      (nextL ? btn('nextLevel', 'Келесі деңгей ' + I.next, 'btn-primary', 'pulse') : btn('levels', I.grid + 'Деңгейлерге', 'btn-primary')) +
      btn('again', I.redo + 'Қайта ойнау', 'btn-glass glass') +
      (nextL ? btn('levels', I.grid + 'Деңгейлерге', 'btn-glass glass') : btn('home', emo('1f3e0', '', true) + 'Басты бет', 'btn-glass glass')) +
      '</div>' +
      '</div>', L.tone, 'done');
    el._acts.back = function () { go(screenLevels, 'back'); };
    el._acts.nextLevel = function () { openLevel(nextL.id); };
    el._acts.again = function () { openLevel(L.id, 'back'); };
    el._acts.levels = function () { go(screenLevels, 'back'); };
    el._acts.home = function () { go(screenHome, 'back'); };
    setTimeout(function () { Sound.fanfare(); confetti(170); }, 250);
    return el;
  }

  /* ==========================================================
     7. Тыныс алу жаттығуы
     ========================================================== */
  var modalOpen = null;
  function openModal(m, focusSel) {
    closeModal(true);
    m._prevFocus = document.activeElement;
    document.body.appendChild(m);
    modalOpen = m;
    hydrate(m);
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
    var f = $(focusSel, m); try { (f || m).focus({ preventScroll: true }); } catch (e) { }
  }
  function closeModal(instant) {
    var m = modalOpen; if (!m) return;
    modalOpen = null;
    if (m._close) m._close();
    var prev = m._prevFocus;
    if (instant || RM) { m.remove(); sweep(); }
    else { m.classList.add('closing'); setTimeout(function () { m.remove(); sweep(); }, 300); }
    try { if (prev && prev.focus) prev.focus({ preventScroll: true }); } catch (e) { }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalOpen) closeModal(); });

  function openBreath() {
    var m = h('<div class="modal breath" data-scope role="dialog" aria-modal="true" aria-label="Тыныс алу жаттығуы">' +
      '<div class="breath-card glass">' +
      '<button class="icon-btn close" data-act="close" aria-label="Жабу">' + I.close + '</button>' +
      '<h2>Тыныс алу жаттығуы</h2>' +
      '<p class="b-sub">Сөйлер алдында денеңді босаңсыт</p>' +
      '<div class="b-circle" data-ref="circle"><div class="b-ring"></div><div class="b-emo" data-ref="bemo">' + emo('1f338') + '</div></div>' +
      '<p class="b-text" data-ref="text">Дайын болсаң, «Бастау» батырмасын бас</p>' +
      '<p class="b-count" data-ref="count"></p>' +
      '<button class="btn btn-primary" data-act="go">' + I.play + 'Бастау</button>' +
      '</div></div>');
    m._acts = {};
    var token = 0;
    var circle = $('[data-ref=circle]', m), text = $('[data-ref=text]', m), count = $('[data-ref=count]', m), bemo = $('[data-ref=bemo]', m);
    function setEmo(code) { bemo.innerHTML = emo(code); hydrate(bemo); }
    m._acts.close = function () { closeModal(); };
    m._acts.go = function (b) {
      var my = ++token, CYCLES = 3;
      b.style.display = 'none';
      var k = 0;
      (function cycle() {
        if (my !== token || !m.isConnected) return;
        if (k >= CYCLES) {
          circle.classList.remove('in', 'out');
          setEmo('1f4aa');
          text.textContent = 'Жарайсың! Енді сөйлеуге дайынсың';
          count.textContent = '';
          b.innerHTML = emo('1f44d', '', true) + 'Дайынмын!';
          b.dataset.act = 'close'; b.style.display = '';
          Sound.success();
          return;
        }
        count.textContent = (k + 1) + ' / ' + CYCLES;
        setEmo('1f338');
        text.textContent = 'Гүлді иіскегендей, мұрныңмен баяу дем ал…';
        circle.classList.remove('out'); circle.classList.add('in');
        Sound.breathIn();
        setTimeout(function () {
          if (my !== token || !m.isConnected) return;
          setEmo('1f62e_200d_1f4a8');
          text.textContent = 'Шамды үрлегендей, аузыңмен ақырын дем шығар…';
          circle.classList.remove('in'); circle.classList.add('out');
          Sound.breathOut();
          setTimeout(function () { k++; cycle(); }, 5000);
        }, 4000);
      })();
    };
    m._close = function () { token++; };
    openModal(m, '[data-act=go]');
  }

  /* ==========================================================
     8. «Ата-аналар мен педагогтарға» парағы
     ========================================================== */
  function infoAbout() {
    return '<div class="card"><div class="kv"><small>Тақырыбы</small><span>' + C.topic + '</span></div>' +
      '<div class="kv"><small>Мақсаты</small><span>' + C.goal + '</span></div></div>' +
      '<h3>' + emo('1f9e9', '', true) + 'Сайт қалай жұмыс істейді?</h3>' +
      '<ol>' +
      '<li><b>«Бастау»</b> батырмасын басыңыз — тіркелу, логин, құпиясөз қажет емес.</li>' +
      '<li>Бала тапсырманы <b>дауыстап</b> орындайды. Жауабын айтқаннан кейін <b>«Айттым!»</b> батырмасы басылады.</li>' +
      '<li><b>«Көмек»</b> батырмасы алғашқы дыбысты, буындарды немесе ой-көмекші суреттерді көрсетеді.</li>' +
      '<li>Уақыт өлшенбейді, «қате» деген белгі жоқ — әр талпыныс мадақталады.</li>' +
      '<li>Жұлдыздар тек осы құрылғыда сақталады, ешқайда жіберілмейді.</li>' +
      '</ol>' +
      '<div class="card warn"><h3>' + emo('1f422', '', true) + 'Ескерту</h3><p>' + C.note + '</p></div>' +
      '<h3>' + emo('1f4a1', '', true) + 'Пайдалы кеңестер</h3>' +
      '<ul>' +
      '<li>Баланың айтайын деген сөзін оның орнына аяқтамаңыз.</li>' +
      '<li>Өзіңіз баяу әрі жайлы сөйлеп, үлгі көрсетіңіз.</li>' +
      '<li>Жылдамдыққа емес, тапсырманың орындалуына назар аударыңыз.</li>' +
      '<li>Сабақ алдында «Тыныс алу жаттығуын» бірге орындаңыз.</li>' +
      '</ul>';
  }
  function infoTasks() {
    var L1 = C.levels[0], L2 = C.levels[1], L3 = C.levels[2];
    return '<div class="card">' +
      '<h3>' + emo(L1.mark, '', true) + '1-деңгей — жеңіл</h3>' +
      '<p><b>Тапсырма:</b> «' + L1.title + '»</p><p><b>Нұсқаулық:</b> ' + L1.instruction + '</p>' +
      '<ol>' + L1.items.map(function (it) { return '<li>' + emo(it.e, '', true) + ' — ' + it.q + '</li>'; }).join('') + '</ol>' +
      '<p><b>Жауаптары:</b> ' + L1.items.map(function (it) { return it.a; }).join(', ') + '.</p>' +
      '<p><b>Мақсаты:</b> ' + L1.goal + '</p></div>' +

      '<div class="card">' +
      '<h3>' + emo(L2.mark, '', true) + '2-деңгей — орташа</h3>' +
      '<p><b>Тапсырма:</b> «' + L2.title + '»</p><p><b>Нұсқаулық:</b> ' + L2.instruction + '</p>' +
      '<ol>' + L2.items.map(function (it) { return '<li>' + it.words.map(function (w) { return w[0]; }).join(', ') + '.</li>'; }).join('') + '</ol>' +
      '<p><b>Мысал жауаптар:</b></p>' +
      '<ol>' + L2.items.map(function (it) { return '<li>' + it.example + '</li>'; }).join('') + '</ol>' +
      '<p><b>Мақсаты:</b> ' + L2.goal + '</p></div>' +

      '<div class="card">' +
      '<h3>' + emo(L3.mark, '', true) + '3-деңгей — күрделі</h3>' +
      '<p><b>Тапсырма:</b> «' + L3.title + '»</p><p><b>Нұсқаулық:</b> ' + L3.instruction + '</p>' +
      '<p><b>Басталуы:</b> «' + L3.story.join(' ') + '»</p>' +
      '<p><b>Сұрақтар:</b></p>' +
      '<ol>' + L3.questions.map(function (q) { return '<li>' + q.q + '</li>'; }).join('') + '</ol>' +
      '<p><b>Тапсырма:</b> ' + L3.task + '</p>' +
      '<p><b>Мақсаты:</b> ' + L3.goal + '</p></div>';
  }
  function infoEval() {
    return '<h3>' + emo('2705', '', true) + 'Бағалау критерийлері</h3>' +
      '<ul>' + C.levels.map(function (L) { return '<li><b>' + L.id + '-деңгей:</b> ' + L.criterion + '</li>'; }).join('') + '</ul>' +
      '<div class="card warn"><h3>' + emo('1f422', '', true) + 'Ескерту</h3><p>' + C.note + '</p></div>' +
      '<div class="card"><h3>' + emo('2b50', '', true) + 'Осы құрылғыдағы нәтиже</h3>' +
      C.levels.map(function (L) { return '<p>' + L.id + '-деңгей «' + L.title + '»: <b>' + Store.count(L.id) + '/' + STARS_PER_LEVEL + '</b> жұлдыз</p>'; }).join('') +
      '<div class="reset-row" data-ref="reset">' + btn('resetAsk', I.redo + 'Нәтижені тазалау', 'btn-glass glass') + '</div></div>' +
      '<p class="credits">Эмодзи суреттері мен анимациялары: Google Noto Emoji (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>). ' +
      'Қаріп: Nunito (SIL Open Font License). Анимация ойнатқышы: lottie-web (MIT).</p>';
  }

  function openInfo() {
    var tabs = [['about', 'Туралы', infoAbout], ['tasks', 'Тапсырмалар', infoTasks], ['eval', 'Бағалау', infoEval]];
    var m = h('<div class="modal sheet-modal" data-scope role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
      '<div class="sheet">' +
      '<div class="grabber" aria-hidden="true"></div>' +
      '<div class="sheet-head" data-ref="head">' + emo('1f468_200d_1f469_200d_1f467', '', true) +
      '<h2 id="sheet-title">Ата-аналар мен педагогтарға</h2>' +
      '<button class="icon-btn" data-act="close" aria-label="Жабу">' + I.close + '</button></div>' +
      '<div class="segmented" role="tablist" data-ref="seg">' +
      tabs.map(function (t, k) { return '<button role="tab" data-act="tab" data-i="' + k + '" aria-selected="' + (k === 0) + '">' + t[1] + '</button>'; }).join('') +
      '<span class="seg-thumb"></span></div>' +
      '<div class="sheet-body" data-ref="body" role="tabpanel"></div>' +
      '</div></div>');
    m._acts = {};
    var body = $('[data-ref=body]', m), seg = $('[data-ref=seg]', m);
    function show(k) {
      seg.style.setProperty('--i', k);
      $$('[role=tab]', seg).forEach(function (b, j) { b.setAttribute('aria-selected', j === k); });
      body.innerHTML = tabs[k][2](); body.scrollTop = 0;
    }
    m._acts.tab = function (b) { show(+b.dataset.i); };
    m._acts.close = function () { closeModal(); };
    m._acts.resetAsk = function () {
      $('[data-ref=reset]', body).innerHTML = '<span>Барлық жұлдыз өшеді. Сенімдісіз бе?</span>' +
        btn('resetYes', 'Иә, тазалау', 'btn-danger') + btn('resetNo', 'Жоқ', 'btn-glass glass');
    };
    m._acts.resetNo = function () { show(2); };
    m._acts.resetYes = function () {
      Store.reset(); show(2); toast('2705', 'Нәтиже тазаланды');
      if (cur && cur.classList.contains('levels-screen')) go(screenLevels);
      if (cur && cur.classList.contains('home')) go(screenHome);
    };
    show(0);

    /* Төмен тартып жабу */
    var sheet = $('.sheet', m), head = $('[data-ref=head]', m), grab = $('.grabber', m), y0 = null, dy = 0;
    function down(e) { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; sheet.style.transition = 'none'; try { e.target.setPointerCapture(e.pointerId); } catch (x) { } }
    function move(e) { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = 'translateY(' + dy + 'px)'; }
    function up() {
      if (y0 === null) return; y0 = null; sheet.style.transition = 'transform .35s cubic-bezier(.2,.8,.2,1)';
      if (dy > 110) closeModal(); else sheet.style.transform = '';
    }
    [head, grab].forEach(function (x) { x.addEventListener('pointerdown', down); x.addEventListener('pointermove', move); x.addEventListener('pointerup', up); x.addEventListener('pointercancel', up); });

    openModal(m, '[data-act=close]');
  }

  /* ---------- Іске қосу ---------- */
  Store.load();
  Voice.init();
  sizeCanvas();
  go(screenHome);
  window.addEventListener('pageshow', function () { sizeCanvas(); });
})();
