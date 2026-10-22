// Мәзірлер: жүктеу, басты мәзір, баптаулар, кейіпкер, нұсқаулық, статистика, нәтиже, кідіріс.
import { T, fmtTime } from '../core/i18n.js';
import { settings, saveSettings, stats, android } from '../core/settings.js';
import { ICON } from './icons.js';
import { OUTFITS } from '../actors/charModel.js';
import { audio } from '../audio/audio.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const click = () => audio.play('ui_click', { volume: 0.7 });

export class Menus {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.buildLoading();
    this.rotate = el('div', '', `<div style="font-size:48px">⟳</div><div>Телефонды көлденең ұстаңыз</div>`);
    this.rotate.id = 'rotate';
    root.appendChild(this.rotate);
  }

  // ---------- Жүктеу ----------
  buildLoading() {
    const L = this.loading = el('div', '', `
      <div class="orn t"></div><div class="orn b"></div>
      <div class="logo"><div class="big">ОТТЫ<span class="flame"></span>АРАЛ</div><div class="small">${T.subtitle}</div></div>
      <div class="loadbar"><i></i></div><div class="loadlabel">${T.loading}…</div>
      <div class="loadtip"></div>`);
    L.id = 'loading';
    this.root.appendChild(L);
    this.loadBar = L.querySelector('.loadbar i');
    this.loadLabel = L.querySelector('.loadlabel');
    this.loadTip = L.querySelector('.loadtip');
    this.loadTip.textContent = T.tips[Math.floor(Math.random() * T.tips.length)];
  }

  setLoading(p, label) {
    this.loadBar.style.width = Math.round(p * 100) + '%';
    if (label) this.loadLabel.textContent = T.loadSteps[label] || label;
  }

  hideLoading() { this.loading.style.transition = 'opacity .6s'; this.loading.style.opacity = 0; setTimeout(() => this.loading.classList.add('hidden'), 650); }
  showLoading(tip = true) {
    this.loading.classList.remove('hidden'); this.loading.style.opacity = 1;
    if (tip) this.loadTip.textContent = T.tips[Math.floor(Math.random() * T.tips.length)];
  }

  // ---------- Басты мәзір ----------
  buildMenu() {
    const m = this.menu = el('div', '');
    m.id = 'menu';
    const lvl = 1 + Math.floor(stats.xp / 1000);
    const xpPct = (stats.xp % 1000) / 10;
    m.innerHTML = `
      <div class="shade"></div>
      <div class="left">
        <div>
          <div class="logo"><div class="big">ОТТЫ<span class="flame"></span>АРАЛ</div><div class="small">${T.subtitle}</div></div>
          <div class="profile"><div class="lvl">${lvl}</div><div class="xp"><div class="nm">${T.menu.level} ${lvl}</div><div class="bar"><i style="width:${xpPct}%"></i></div></div></div>
        </div>
        <div class="menubtns">
          <button class="mbtn" data-a="char">${ICON.person}${T.menu.character}</button>
          <button class="mbtn" data-a="settings">${ICON.settings}${T.menu.settings}</button>
          <button class="mbtn" data-a="howto">${ICON.book}${T.menu.howto}</button>
          <button class="mbtn" data-a="stats">${ICON.chart}${T.menu.stats}</button>
          ${android ? `<button class="mbtn" data-a="exit">${ICON.exit}${T.menu.exit}</button>` : ''}
        </div>
      </div>
      <div class="topright"><span class="badge">${T.offline}</span></div>
      <div class="right">
        <div class="modecard"><b>${T.menu.mode}</b><span>${T.menu.map} · 40 ${T.menu.players}</span></div>
        <button class="playbtn">${T.menu.play}</button>
      </div>`;
    this.root.appendChild(m);
    m.querySelector('.playbtn').addEventListener('click', () => { click(); this.game.startMatch(); });
    m.querySelectorAll('.mbtn').forEach((b) => b.addEventListener('click', () => {
      click();
      const a = b.dataset.a;
      if (a === 'settings') this.openSettings();
      if (a === 'char') this.openChar();
      if (a === 'howto') this.openHowto();
      if (a === 'stats') this.openStats();
      if (a === 'exit' && android) android.exitGame();
    }));
  }

  showMenu(v) {
    if (!this.menu) this.buildMenu();
    if (v) { this.menu.remove(); this.menu = null; this.buildMenu(); }
    this.menu.classList.toggle('hidden', !v);
  }

  overlay(title, body, onClose) {
    const o = el('div', 'overlay');
    const p = el('div', 'panel', `<div class="hd"><h2>${title}</h2><button class="xbtn">✕</button></div><div class="bd"></div>`);
    o.appendChild(p);
    p.querySelector('.bd').appendChild(body);
    const close = () => { click(); o.remove(); onClose && onClose(); };
    p.querySelector('.xbtn').addEventListener('click', close);
    o.addEventListener('pointerdown', (e) => { if (e.target === o) close(); });
    this.root.appendChild(o);
    return { o, close };
  }

  // ---------- Баптаулар ----------
  openSettings(inGame = false) {
    const S = T.settings;
    const body = el('div');
    const tabs = el('div', 'tabs');
    const pages = {};
    const names = [['g', S.graphics], ['c', S.controls], ['a', S.audio], ['p', S.game]];
    const qualityBefore = settings.quality;
    for (const [k, n] of names) {
      const t = el('button', 'tab' + (k === 'g' ? ' on' : ''), n);
      t.addEventListener('click', () => { click(); tabs.querySelectorAll('.tab').forEach((x) => x.classList.remove('on')); t.classList.add('on'); for (const p of Object.values(pages)) p.classList.add('hidden'); pages[k].classList.remove('hidden'); });
      tabs.appendChild(t);
      pages[k] = el('div', k === 'g' ? '' : 'hidden');
    }
    body.appendChild(tabs);
    for (const p of Object.values(pages)) body.appendChild(p);
    const row = (page, label, sub, ctl) => {
      const r = el('div', 'row', `<div><div class="lab">${label}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`);
      r.appendChild(ctl);
      pages[page].appendChild(r);
    };
    const seg = (key, opts, onChange) => {
      const s = el('div', 'seg');
      for (const [v, lab] of opts) {
        const b = el('button', settings[key] === v ? 'on' : '', lab);
        b.addEventListener('click', () => { click(); settings[key] = v; s.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); saveSettings(); onChange && onChange(v); });
        s.appendChild(b);
      }
      return s;
    };
    const tog = (key, onChange) => {
      const t = el('div', 'tog' + (settings[key] ? ' on' : ''));
      t.addEventListener('click', () => { click(); settings[key] = !settings[key]; t.classList.toggle('on', settings[key]); saveSettings(); onChange && onChange(settings[key]); });
      return t;
    };
    const slider = (key, min, max, step, onChange) => {
      const i = el('input');
      i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = settings[key];
      i.addEventListener('input', () => { settings[key] = parseFloat(i.value); saveSettings(); onChange && onChange(settings[key]); });
      return i;
    };
    const maxHz = android && android.getMaxRefreshRate ? Math.round(android.getMaxRefreshRate()) : 0;
    row('g', S.fps, maxHz ? `${T.fpsNote} (${maxHz} Гц)` : T.fpsNote, seg('fps', [[30, '30'], [60, '60'], [120, '120']], (v) => this.game.applyFps(v)));
    row('g', S.quality, S.restartNote, seg('quality', [['low', S.qLow], ['medium', S.qMed], ['high', S.qHigh], ['ultra', S.qUltra]]));
    row('g', S.autoRes, '', tog('autoRes', () => this.game.applyResolution()));
    row('g', S.showFps, '', tog('showFps'));
    row('c', S.sens, '', slider('sens', 0.3, 2.5, 0.05));
    row('c', S.aimSens, '', slider('aimSens', 0.3, 2, 0.05));
    row('c', S.aimAssist, '', tog('aimAssist'));
    row('c', S.leftFire, '', tog('leftFire', () => this.game.hud && this.game.hud.applyTouchMode()));
    row('c', S.vibration, '', tog('vibration'));
    row('a', S.sfx, '', slider('sfx', 0, 1, 0.05, () => audio.applyVolumes()));
    row('a', S.music, '', slider('music', 0, 1, 0.05, () => audio.applyVolumes()));
    row('p', S.bots, '', seg('bots', [['easy', S.bEasy], ['medium', S.bMed], ['hard', S.bHard]]));
    this.overlay(S.title, body, () => {
      if (settings.quality !== qualityBefore) {
        saveSettings();
        if (!inGame) location.reload();
        else this.game.pendingReload = true;
      }
    });
  }

  // ---------- Кейіпкер ----------
  openChar() {
    const body = el('div', 'chars');
    for (const o of T.outfits) {
      const f = OUTFITS[o.id];
      const c = el('div', 'char' + (settings.outfit === o.id ? ' on' : ''), `<div class="sw"><i style="background:${hex(f.top)}"></i><i style="background:${hex(f.trim)}"></i><i style="background:${hex(f.pants)}"></i><i style="background:${hex(f.skin)}"></i></div><b>${o.name}</b><span>${o.desc}</span>`);
      c.addEventListener('click', () => {
        click();
        settings.outfit = o.id; saveSettings();
        body.querySelectorAll('.char').forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
        this.game.setLobbyOutfit(o.id);
      });
      body.appendChild(c);
    }
    this.overlay(T.char.title, body);
  }

  openHowto() {
    const body = el('div', 'howto');
    for (const [a, b] of T.howto.lines) body.appendChild(el('div', 'it', `<b>${a}</b><span>${b}</span>`));
    this.overlay(T.howto.title, body);
  }

  openStats() {
    const S = T.stats;
    const kd = stats.deaths ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2);
    const body = el('div', 'statgrid', [
      [S.matches, stats.matches], [S.wins, stats.wins], [S.kills, stats.kills],
      [S.best, stats.best ? '#' + stats.best : '—'], [S.damage, Math.round(stats.damage)], [S.kd, kd],
    ].map(([a, b]) => `<div class="stat"><b>${b}</b><span>${a}</span></div>`).join(''));
    this.overlay(S.title, body);
  }

  // ---------- Нәтиже ----------
  showResult(r, onAgain, onMenu) {
    const R = T.result;
    const d = el('div');
    d.id = 'result';
    const score = Math.round(r.kills * 100 + r.damage * 0.5 + (41 - r.place) * 20 + (r.win ? 500 : 0));
    d.innerHTML = `
      <div class="ttl ${r.win ? 'win' : 'lose'}">${r.win ? R.win : R.lose}</div>
      <div class="sub">${r.win ? R.winSub : R.loseSub}</div>
      <div class="rank">#${r.place} <small>/ 40</small></div>
      ${!r.win && r.killer ? `<div class="killer">${R.killedBy}: <b>${r.killer}</b></div>` : !r.win && r.cause === 'zone' ? `<div class="killer">${R.zoneDeath}</div>` : !r.win && r.cause === 'fall' ? `<div class="killer">${R.fallDeath}</div>` : ''}
      <div class="grid">
        <div class="stat"><b>${r.kills}</b><span>${R.kills}</span></div>
        <div class="stat"><b>${Math.round(r.damage)}</b><span>${R.damage}</span></div>
        <div class="stat"><b>${fmtTime(r.time)}</b><span>${R.time}</span></div>
        <div class="stat"><b>${score}</b><span>${R.score}</span></div>
      </div>
      <div class="actions"><button class="ghost menu">${R.menu}</button><button class="playbtn again">${R.again}</button></div>`;
    this.root.appendChild(d);
    d.querySelector('.again').addEventListener('click', () => { click(); d.remove(); onAgain(); });
    d.querySelector('.menu').addEventListener('click', () => { click(); d.remove(); onMenu(); });
    return score;
  }

  // ---------- Кідіріс ----------
  showPause(onResume, onLeave) {
    if (this.pauseEl) return;
    const body = el('div', '', `<div class="menubtns" style="align-items:center"></div>`);
    const list = body.firstChild;
    const mk = (icon, text, fn) => { const b = el('button', 'mbtn', icon + text); b.style.width = 'min(360px,80vw)'; b.addEventListener('click', () => { click(); fn(); }); list.appendChild(b); };
    const ov = this.overlay(T.hud.paused, body, () => { this.pauseEl = null; onResume(); });
    this.pauseEl = ov;
    mk(ICON.jump, T.hud.resume, () => ov.close());
    mk(ICON.settings, T.settings.title, () => this.openSettings(true));
    mk(ICON.exit, T.hud.leave, () => this.confirm(T.hud.leaveConfirm, () => { ov.o.remove(); this.pauseEl = null; onLeave(); }));
  }

  hidePause() { if (this.pauseEl) { this.pauseEl.o.remove(); this.pauseEl = null; } }

  confirm(text, yes) {
    const body = el('div', 'confirm', `<p>${text}</p><div class="acts"><button class="ghost no">${T.hud.no}</button><button class="ghost yes" style="background:rgba(200,40,40,.6)">${T.hud.yes}</button></div>`);
    const ov = this.overlay('', body);
    ov.o.classList.add('confirm');
    body.querySelector('.no').addEventListener('click', () => ov.close());
    body.querySelector('.yes').addEventListener('click', () => { ov.o.remove(); yes(); });
  }
}
