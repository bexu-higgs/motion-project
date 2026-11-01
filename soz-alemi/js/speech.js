/* ==========================================================
   Сөз әлемі — дауысты тану (Web Speech API, қазақ тілі)

   Браузердің өз дауыс тану қызметі қолданылады:
   Chrome → Google, Edge → Microsoft, Safari → Apple.
   Сайттың өзі дыбысты да, мәтінді де ешқайда сақтамайды.
   ========================================================== */
(function (root) {
  'use strict';

  var SR = root.SpeechRecognition || root.webkitSpeechRecognition || null;
  var ANDROID = !!(root.navigator && /Android/i.test(root.navigator.userAgent || ''));

  /* ---------- Мәтінді салыстыруға дайындау ----------
     Дауыс тану кейде қазақ әрпінің орнына орыс әрпін жазады
     (мысық → мысык, көлік → колик). Сондықтан екі жақты да
     бірдей «жалпы» түрге келтіреміз. Тұтығып айтылған
     қайталауларды да (а-а-алма, аааалма) біріктіреміз. */
  var MAP = { 'ә': 'а', 'ғ': 'г', 'қ': 'к', 'ң': 'н', 'ө': 'о', 'ұ': 'у', 'ү': 'у', 'һ': 'х', 'і': 'и', 'ё': 'е', 'й': 'и' };

  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[әғқңөұүһіёй]/g, function (c) { return MAP[c]; })
      .replace(/[^a-zа-я0-9\s-]/g, ' ')
      .replace(/-/g, '')
      .replace(/(.)\1+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function lev(a, b) {
    var m = a.length, n = b.length, i, j;
    if (!m) return n;
    if (!n) return m;
    var prev = [];
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      var cur = [i];
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  /* Жеке сөздер + буынға бөліп айтылғанда (ал ма, ба нан) біріктірілген түрлері */
  function candidates(text) {
    var t = norm(text).split(' ').filter(Boolean);
    var out = t.slice();
    for (var i = 0; i + 1 < t.length; i++) {
      out.push(t[i] + t[i + 1]);
      if (i + 2 < t.length) out.push(t[i] + t[i + 1] + t[i + 2]);
    }
    return out;
  }

  function wordMatch(c, w) {
    if (c === w) return true;
    if (w.length >= 4) {
      if (lev(c, w) <= 1) return true;                       // бір әріп қате танылса да
      if (c.length > w.length && c.length - w.length <= 4 &&   // жалғаумен: алмаНЫ, мысықТАР
          lev(c.slice(0, w.length), w) <= 1) return true;
    }
    return false;
  }

  /* texts — дауыс танудың нұсқалары, accept — дұрыс деп саналатын сөздер */
  function matches(texts, accept) {
    var targets = accept.map(norm).filter(Boolean);
    for (var i = 0; i < texts.length; i++) {
      var cs = candidates(texts[i]);
      for (var k = 0; k < cs.length; k++) {
        for (var n = 0; n < targets.length; n++) if (wordMatch(cs[k], targets[n])) return texts[i];
      }
    }
    return null;
  }

  /* ---------- Тыңдау ----------
     o.continuous — ұзақ тыңдау (Android-та өшіріледі, онда нәтиже қайталанып кетеді)
     o.restart    — сессия біткенде қайта қосу (әңгіме жазу үшін)
     o.onState('listening'|'speech'), o.onAlts(alts, isFinal), o.onText(finals, interim),
     o.onFinal(text), o.onError(code), o.onEnd({heard, finals, error})               */
  function listen(o) {
    var self = { active: true, finals: [], heard: false, error: null };
    var r = null, quiet = 0, ended = false;

    function finish() {
      if (ended) return;
      ended = true; self.active = false;
      if (o.onEnd) o.onEnd({ heard: self.heard, finals: self.finals.slice(), error: self.error });
    }

    function session() {
      var gotSpeech = false;
      r = new SR();
      r.lang = 'kk-KZ';
      r.interimResults = true;
      r.maxAlternatives = 5;
      r.continuous = !!o.continuous && !ANDROID;
      r.onstart = function () { if (o.onState) o.onState('listening'); };
      r.onspeechstart = function () { gotSpeech = true; if (o.onState) o.onState('speech'); };
      r.onresult = function (e) {
        var interim = '';
        gotSpeech = true;
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var res = e.results[i], alts = [];
          for (var j = 0; j < res.length; j++) alts.push(String(res[j].transcript || '').trim());
          if (ended) return;
          if (!alts[0]) continue;
          if (o.onAlts) o.onAlts(alts, res.isFinal);
          if (res.isFinal) {
            self.heard = true;
            self.finals.push(alts[0]);
            if (o.onFinal) o.onFinal(alts[0], alts);
          } else {
            interim += (interim ? ' ' : '') + alts[0];
          }
        }
        if (o.onText) o.onText(self.finals.slice(), interim);
      };
      r.onerror = function (e) {
        var code = e && e.error || 'unknown';
        if (code === 'aborted') return;
        if (code === 'no-speech') return;
        self.error = code;
        self.active = false;
        if (o.onError) o.onError(code);
      };
      r.onend = function () {
        quiet = gotSpeech ? 0 : quiet + 1;
        if (self.active && o.restart && quiet < 3) {
          try { session(); return; } catch (x) { /* төменде аяқтаймыз */ }
        }
        finish();
      };
      r.start();
    }

    try { session(); }
    catch (x) {
      self.error = 'start-failed';
      setTimeout(function () { if (o.onError) o.onError('start-failed'); finish(); }, 0);
    }

    self.stop = function () {
      if (!self.active) return;
      self.active = false;
      try { r.stop(); } catch (x) { finish(); }
    };
    self.abort = function () {
      self.active = false; ended = true;
      try { r.abort(); } catch (x) { }
    };
    return self;
  }

  root.SozSpeech = {
    supported: !!SR,
    android: ANDROID,
    norm: norm,
    lev: lev,
    matches: matches,
    listen: listen
  };
})(typeof window !== 'undefined' ? window : globalThis);
