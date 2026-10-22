// Ойын барысындағы интерфейс (HUD): миникарта, компас, денсаулық, қару, батырмалар, хабарламалар.
import * as THREE from 'three';
import { T, fmtTime } from '../core/i18n.js';
import { settings, isTouch } from '../core/settings.js';
import { ICON } from './icons.js';
import { RARITY_COLORS, ITEMS } from '../actors/weapons.js';
import { MAX_HP, VEST_DUR, HELM_DUR } from '../actors/actor.js';
import { POIS } from '../world/map.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const _v = new THREE.Vector3();

export class HUD {
  constructor(root, game) {
    this.game = game;
    const h = this.root = el('div', 'hidden');
    h.id = 'hud';
    root.appendChild(h);
    this.lookLayer = el('div', 'look'); h.appendChild(this.lookLayer);
    this.joyZone = el('div', 'joyzone'); h.appendChild(this.joyZone);
    this.joyBase = el('div', 'joybase', '<div class="arrow"></div>'); this.joyKnob = el('div', 'joyknob'); this.joyBase.appendChild(this.joyKnob); this.joyZone.appendChild(this.joyBase);
    this.vigRed = el('div', 'vignette red'); h.appendChild(this.vigRed);
    this.vigBlue = el('div', 'vignette blue'); h.appendChild(this.vigBlue);
    this.scope = el('div', 'scope hidden', '<i></i>'); h.appendChild(this.scope);
    // Нысана белгісі
    this.cross = el('div', 'cross', '<i class="c"></i><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i>'); h.appendChild(this.cross);
    this.crossParts = [...this.cross.children];
    this.hitm = el('div', 'hitm', '<i></i><i></i><i></i><i></i>'); h.appendChild(this.hitm);
    this.hitdir = el('div', 'hitdir'); h.appendChild(this.hitdir);
    this.dmgLayer = el('div'); h.appendChild(this.dmgLayer);
    // Миникарта
    this.mini = el('div', 'minimap'); this.miniCanvas = document.createElement('canvas'); this.miniCanvas.width = this.miniCanvas.height = 300; this.mini.appendChild(this.miniCanvas); h.appendChild(this.mini);
    this.mini.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.toggleBigMap(true); });
    this.info = el('div', 'infobar', `<div class="pill">${T.hud.alive} <b class="al">40</b></div><div class="pill">${T.hud.kills} <b class="kl">0</b></div>`); h.appendChild(this.info);
    this.alEl = this.info.querySelector('.al'); this.klEl = this.info.querySelector('.kl');
    // Компас
    this.compass = el('div', 'compass'); this.compCanvas = document.createElement('canvas'); this.compCanvas.width = 880; this.compCanvas.height = 60; this.compass.appendChild(this.compCanvas); h.appendChild(this.compass);
    h.appendChild(el('div', 'compass-mark'));
    this.zonebox = el('div', 'zonebox', '<div class="ic"></div><span class="tx"></span><span class="dist"></span>'); h.appendChild(this.zonebox);
    this.zoneTx = this.zonebox.querySelector('.tx'); this.zoneDist = this.zonebox.querySelector('.dist');
    this.fpsEl = el('div', 'fps'); h.appendChild(this.fpsEl);
    this.kfEl = el('div', 'killfeed'); h.appendChild(this.kfEl);
    this.toastsEl = el('div', 'toasts'); h.appendChild(this.toastsEl);
    this.pickEl = el('div', 'pickups'); h.appendChild(this.pickEl);
    this.kbEl = el('div', 'killbanner'); h.appendChild(this.kbEl);
    this.planeHint = el('div', 'plane-hint hidden'); h.appendChild(this.planeHint);
    this.altEl = el('div', 'alt hidden'); h.appendChild(this.altEl);
    this.healRing = el('div', 'healring hidden', `<svg viewBox="0 0 76 76"><circle cx="38" cy="38" r="32" stroke="rgba(0,0,0,.45)" stroke-width="8" fill="none"/><circle class="p" cx="38" cy="38" r="32" stroke="#6cff8a" stroke-width="8" fill="none" stroke-linecap="round" transform="rotate(-90 38 38)" stroke-dasharray="201" stroke-dashoffset="201"/></svg><div class="tx"></div>`);
    h.appendChild(this.healRing);
    this.healP = this.healRing.querySelector('.p'); this.healTx = this.healRing.querySelector('.tx');
    // Күй
    this.status = el('div', 'status', `<div class="armor"><div class="arm v">🛡 <span class="vl">—</span><div class="d"><i></i></div></div><div class="arm hm">⛑ <span class="hl">—</span><div class="d"><i></i></div></div></div><div class="hpbar"><i class="dmg"></i><i class="regen"></i><i class="hp"></i><span></span></div>`);
    h.appendChild(this.status);
    this.hpI = this.status.querySelector('i.hp'); this.dmgI = this.status.querySelector('i.dmg'); this.regI = this.status.querySelector('i.regen'); this.hpTx = this.status.querySelector('.hpbar span');
    this.vestEl = this.status.querySelector('.arm.v'); this.helmEl = this.status.querySelector('.arm.hm');
    this.wpn = el('div', 'wpninfo', '<div class="mag">—</div><div class="nm"></div>'); h.appendChild(this.wpn);
    this.magEl = this.wpn.querySelector('.mag'); this.wnEl = this.wpn.querySelector('.nm');
    // Қару ұяшықтары
    this.slotsEl = el('div', 'slots'); h.appendChild(this.slotsEl);
    this.slots = [];
    for (let i = 0; i < 4; i++) {
      const s = el('div', 'slot', `<div class="rar"></div><div class="wn"></div><div class="am"></div><div class="k">${i === 3 ? '' : i + 1}</div>`);
      s.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); game.input.press(i === 3 ? 'holster' : 'slot' + i); });
      this.slotsEl.appendChild(s);
      this.slots.push({ el: s, wn: s.querySelector('.wn'), am: s.querySelector('.am'), rar: s.querySelector('.rar') });
    }
    // Сенсорлы батырмалар
    this.buttons = [];
    const B = (action, cls, icon, label, cnt) => {
      const b = el('div', 'btn ' + cls, (icon || '') + (cnt ? '<div class="cnt">0</div>' : '') + (label ? `<div class="lbl">${label}</div>` : ''));
      b.dataset.action = action;
      h.appendChild(b);
      this.buttons.push(b);
      return b;
    };
    this.bFire = B('fire', 'fire', ICON.fire);
    this.bFireL = B('fire', 'fireL', ICON.fire);
    this.bAim = B('aim', 'aim', ICON.aim);
    this.bJump = B('jump', 'jump', ICON.jump);
    this.bCrouch = B('crouch', 'crouch', ICON.crouch);
    this.bReload = B('reload', 'reload', ICON.reload);
    this.bGloo = B('gloo', 'gloo', ICON.gloo, T.hud.gloo, true);
    this.bHeal = B('heal', 'heal', ICON.heal, T.hud.heal, true);
    this.bKymyz = B('kymyz', 'kymyz', ICON.kymyz, T.hud.kymyz, true);
    this.bNade = B('grenade', 'grenade', ICON.grenade, T.hud.grenade, true);
    this.bPick = B('pickup', 'pickup hidden', ICON.pickup + '<span class="pt"></span>');
    this.pickTx = this.bPick.querySelector('.pt');
    this.bPlane = B('jump', 'planejump hidden', '', '');
    this.bPlane.textContent = T.hud.jump;
    this.bChute = B('parachute', 'chute hidden', '', '');
    this.bChute.textContent = T.hud.parachute;
    this.bPause = B('pause', 'pausebtn', ICON.pause);
    this.bMap = B('map', 'mapbtn', ICON.map);
    this.cnt = { gloo: this.bGloo.querySelector('.cnt'), heal: this.bHeal.querySelector('.cnt'), kymyz: this.bKymyz.querySelector('.cnt'), grenade: this.bNade.querySelector('.cnt') };
    this.onButton = (act) => { if (act === 'map') this.toggleBigMap(true); };
    // Үлкен карта
    this.big = el('div', 'bigmap hidden'); this.bigCanvas = document.createElement('canvas'); this.bigCanvas.width = this.bigCanvas.height = 900; this.big.appendChild(this.bigCanvas);
    this.big.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.toggleBigMap(false); });
    root.appendChild(this.big);
    this.last = {};
    this.frames = 0; this.fpsT = 0;
    this.dmgPool = [];
    this.applyTouchMode();
  }

  applyTouchMode() {
    const touch = isTouch;
    for (const b of this.buttons) if (!['pause', 'map'].includes(b.dataset.action) && !b.classList.contains('planejump') && !b.classList.contains('chute') && !b.classList.contains('pickup')) b.style.display = touch ? '' : 'none';
    this.bFireL.style.display = touch && settings.leftFire ? '' : 'none';
    this.joyZone.style.display = touch ? '' : 'none';
    this.lookLayer.style.display = touch ? '' : 'none';
  }

  show(v) { this.root.classList.toggle('hidden', !v); if (!v) this.toggleBigMap(false); }

  // Миникарта негізі (жер бедерінен бір рет салынады)
  buildMapImage(world) {
    const S = 512;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const T0 = world.terrain;
    const half = 500;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = -half + (i + 0.5) / S * 1000, z = -half + (j + 0.5) / S * 1000;
      const h = T0.heightAt(x, z);
      let r, g, b;
      if (h < -0.2) { const d = Math.min(1, -h / 12); r = 30 - d * 12; g = 110 - d * 50; b = 150 - d * 40; }
      else if (h < 2.2) { r = 214; g = 196; b = 146; }
      else {
        const gw = T0.grassWeight(x, z);
        const k = Math.min(1, (h - 2) / 60);
        r = 92 + k * 40 - gw * 10; g = 128 + k * 10 - gw * 5; b = 70 + k * 40;
        if (h > 40) { r = 140 + (h - 40); g = 140 + (h - 40); b = 136 + (h - 40); }
        if (gw < 0.4) { r = 150; g = 128; b = 94; }
      }
      // Жарықтандыру
      const n = T0.normalAt(x, z);
      const l = 0.75 + (n.x * -0.5 + n.z * -0.5 + n.y) * 0.3;
      const k = (j * S + i) * 4;
      img.data[k] = r * l; img.data[k + 1] = g * l; img.data[k + 2] = b * l; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // Ғимараттар
    ctx.fillStyle = 'rgba(235,235,240,0.85)';
    for (const f of world.footprints) {
      const x = (f.x + half) / 1000 * S, z = (f.z + half) / 1000 * S;
      ctx.fillRect(x - f.w / 1000 * S / 2, z - f.d / 1000 * S / 2, Math.max(1.5, f.w / 1000 * S), Math.max(1.5, f.d / 1000 * S));
    }
    this.mapImg = c;
  }

  toggleBigMap(v) {
    this.bigOpen = v;
    this.big.classList.toggle('hidden', !v);
    if (v && this.game.match) this.drawBigMap(this.game.match);
  }

  drawMapLayer(ctx, M, S, cx, cz, span, big) {
    const k = S / span;
    const tx = (x) => (x - cx) * k + S / 2, tz = (z) => (z - cz) * k + S / 2;
    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#1a4a66'; ctx.fillRect(0, 0, S, S);
    const img = this.mapImg;
    const sx = (cx - span / 2 + 500) / 1000 * img.width, sz = (cz - span / 2 + 500) / 1000 * img.width, sw = span / 1000 * img.width;
    ctx.drawImage(img, sx, sz, sw, sw, 0, 0, S, S);
    // Ұшақ жолы
    const P = M.player;
    if (M.plane.active || P.state === 'plane') {
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([8, 6]); ctx.lineWidth = big ? 3 : 2;
      const a = M.plane.start0, d = M.plane.dir;
      ctx.beginPath(); ctx.moveTo(tx(a.x), tz(a.z)); ctx.lineTo(tx(a.x + d.x * 1120), tz(a.z + d.z * 1120)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fec50c';
      ctx.beginPath(); ctx.arc(tx(M.plane.pos.x), tz(M.plane.pos.z), big ? 9 : 6, 0, 7); ctx.fill();
    }
    // Аймақтар
    const Z = M.zone;
    ctx.lineWidth = big ? 3 : 2;
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath(); ctx.arc(tx(Z.to.x), tz(Z.to.z), Z.to.r * k, 0, 7); ctx.stroke();
    // Аймақтан тыс — көк бояу
    ctx.fillStyle = 'rgba(40,110,255,.28)';
    ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.arc(tx(Z.cx), tz(Z.cz), Math.max(0, Z.r) * k, 0, Math.PI * 2, true); ctx.fill();
    ctx.strokeStyle = 'rgba(80,170,255,1)';
    ctx.beginPath(); ctx.arc(tx(Z.cx), tz(Z.cz), Math.max(0, Z.r) * k, 0, 7); ctx.stroke();
    // Әуе жүгі
    if (this.airdrop && M.loot.boxes.indexOf(this.airdrop) >= 0) {
      ctx.fillStyle = '#ff3b3b';
      const ax = tx(this.airdrop.x), az = tz(this.airdrop.z);
      ctx.fillRect(ax - 5, az - 5, 10, 10);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(ax - 5, az - 5, 10, 10);
    }
    if (big) {
      ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      for (const p of POIS) {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        const name = T.places[p.id];
        const w = ctx.measureText(name).width + 14;
        ctx.fillRect(tx(p.x) - w / 2, tz(p.z) - 13, w, 24);
        ctx.fillStyle = '#fff'; ctx.fillText(name, tx(p.x), tz(p.z) + 6);
      }
    }
    // Ойыншы
    const px = tx(P.pos.x), pz = tz(P.pos.z);
    ctx.translate(px, pz);
    ctx.rotate(-M.pc.yaw + Math.PI);
    ctx.fillStyle = '#fec50c'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    const s = big ? 14 : 9;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.8); ctx.lineTo(0, s * 0.4); ctx.lineTo(-s * 0.7, s * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  drawBigMap(M) {
    const ctx = this.bigCanvas.getContext('2d');
    this.drawMapLayer(ctx, M, 900, 0, 0, 1000, true);
  }

  drawCompass(yawDeg) {
    const c = this.compCanvas, ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const pxPerDeg = W / 120;
    ctx.textAlign = 'center';
    for (let d = Math.floor(yawDeg - 62); d <= yawDeg + 62; d++) {
      const dd = ((d % 360) + 360) % 360;
      const x = W / 2 + (d - yawDeg) * pxPerDeg;
      if (dd % 15 === 0) {
        const card = { 0: T.hud.compass.N, 90: T.hud.compass.E, 180: T.hud.compass.S, 270: T.hud.compass.W }[dd];
        ctx.fillStyle = card ? (dd === 0 ? '#fec50c' : '#fff') : 'rgba(255,255,255,.85)';
        ctx.font = card ? 'bold 30px sans-serif' : 'bold 20px sans-serif';
        ctx.fillText(card || String(dd), x, card ? 36 : 32);
        ctx.fillRect(x - 1, 46, 2, 12);
      } else if (dd % 5 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - 1, 50, 2, 8);
      }
    }
  }

  startMatch(M) {
    this.show(true);
    this.kfEl.innerHTML = ''; this.toastsEl.innerHTML = ''; this.pickEl.innerHTML = ''; this.kbEl.innerHTML = ''; this.dmgLayer.innerHTML = '';
    this.last = {};
    this.airdrop = null;
    this.hpShown = MAX_HP;
    this.applyTouchMode();
    if (!this.mapImg) this.buildMapImage(M.world);
  }

  css(e, prop, v) { const k = '_c_' + prop; if (e[k] !== v) { e[k] = v; e.style[prop] = v; } }
  setVis(e, v) { if (e._v !== v) { e._v = v; e.classList.toggle('hidden', !v); } }
  setText(e, t) { if (e._t !== t) { e._t = t; e.textContent = t; } }
  setHTML(e, t) { if (e._h !== t) { e._h = t; e.innerHTML = t; } }

  update(M, dt) {
    const P = M.player, pc = M.pc;
    // FPS
    this.frames++; this.fpsT += dt;
    if (this.fpsT > 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; this.setText(this.fpsEl, settings.showFps ? this.fps + ' FPS' : ''); }
    const st = P.state;
    const ground = st === 'ground' && P.alive;
    this.setVis(this.bPlane, st === 'plane');
    this.setVis(this.bChute, st === 'fall');
    this.setVis(this.planeHint, st === 'plane');
    if (st === 'plane') this.setHTML(this.planeHint, (M.plane.progress > 0.75 ? T.hud.jumpSoon : T.hud.planeHint) + `<small>${T.hud.alive}: ${M.actors.filter((a) => a.state === 'plane').length}</small>`);
    this.setVis(this.altEl, st === 'fall' || st === 'chute');
    if (st === 'fall' || st === 'chute') this.setText(this.altEl, Math.max(0, Math.round(P.agl || 0)) + ' ' + T.hud.meters);
    const groundCtl = ground ? '' : 'none';
    if (isTouch) {
      for (const b of [this.bAim, this.bCrouch, this.bReload, this.bGloo, this.bHeal, this.bKymyz, this.bNade, this.bJump, this.bFire]) this.css(b, 'display', groundCtl);
      this.css(this.bFireL, 'display', ground && settings.leftFire ? '' : 'none');
      this.css(this.joyZone, 'visibility', st === 'plane' || !P.alive ? 'hidden' : 'visible');
    }
    this.css(this.slotsEl, 'visibility', ground ? 'visible' : 'hidden');
    this.css(this.status, 'visibility', st === 'plane' ? 'hidden' : 'visible');
    this.css(this.wpn, 'visibility', ground ? 'visible' : 'hidden');
    if (this.last.aimOn !== pc.aiming) { this.last.aimOn = pc.aiming; this.bAim.classList.toggle('on', pc.aiming); }
    if (this.last.crOn !== P.crouch) { this.last.crOn = P.crouch; this.bCrouch.classList.toggle('on', P.crouch); }
    // Скоп
    this.setVis(this.scope, pc.scoped);
    this.css(this.cross, 'display', pc.scoped || !ground ? 'none' : '');
    // Нысана белгісінің шашырауы
    const spread = Math.max(4, P.spread * 600 * (pc.aiming ? 0.7 : 1));
    if (Math.abs((this.last.spread || 0) - spread) > 0.5) {
      this.last.spread = spread;
      const [, t, b, l, r] = this.crossParts;
      t.style.top = -(spread + 9) + 'px'; b.style.top = spread + 'px'; l.style.left = -(spread + 9) + 'px'; r.style.left = spread + 'px';
    }
    // Денсаулық
    const hp = Math.ceil(P.hp);
    if (this.last.hp !== hp) {
      this.last.hp = hp;
      const pct = hp / MAX_HP * 100;
      this.hpI.style.width = pct + '%';
      this.dmgI.style.width = pct + '%';
      this.hpI.style.background = pct > 50 ? 'linear-gradient(180deg,#8dff8a,#2ec94a)' : pct > 25 ? 'linear-gradient(180deg,#ffe27a,#f0a020)' : 'linear-gradient(180deg,#ff8a7a,#e02a2a)';
      this.hpTx.textContent = hp;
    }
    const rg = Math.min(MAX_HP, P.hp + P.regen) / MAX_HP * 100;
    if (Math.abs((this.last.rg || 0) - rg) > 0.5) { this.last.rg = rg; this.regI.style.width = rg + '%'; }
    const vk = P.vest.lvl + ':' + Math.round(P.vest.dur);
    if (this.last.vest !== vk) {
      this.last.vest = vk;
      this.vestEl.querySelector('.vl').textContent = P.vest.lvl && P.vest.dur > 0 ? P.vest.lvl : '—';
      this.vestEl.querySelector('.d i').style.width = (P.vest.lvl ? P.vest.dur / VEST_DUR[P.vest.lvl] * 100 : 0) + '%';
    }
    const hk = P.helm.lvl + ':' + Math.round(P.helm.dur);
    if (this.last.helm !== hk) {
      this.last.helm = hk;
      this.helmEl.querySelector('.hl').textContent = P.helm.lvl && P.helm.dur > 0 ? P.helm.lvl : '—';
      this.helmEl.querySelector('.d i').style.width = (P.helm.lvl ? P.helm.dur / HELM_DUR[P.helm.lvl] * 100 : 0) + '%';
    }
    // Қару
    const w = P.weapon;
    const wk = (w ? w.id + w.mag + ':' + P.ammo[w.def.ammo] : 'f') + (P.reloadT > 0 ? 'r' : '');
    if (this.last.w !== wk) {
      this.last.w = wk;
      if (w) { this.magEl.innerHTML = (P.reloadT > 0 ? `<small>${T.hud.reloading}</small>` : w.mag) + ` <small>/ ${P.ammo[w.def.ammo]}</small>`; this.wnEl.textContent = T.weapons[w.id]; }
      else { this.magEl.innerHTML = '✊'; this.wnEl.textContent = T.weapons.fists; }
    }
    for (let i = 0; i < 4; i++) {
      const s = this.slots[i];
      const ww = i < 3 ? P.weapons[i] : null;
      const key = i === 3 ? 'fists' + (P.cur === -1) : (ww ? ww.id + ww.mag + ':' + P.ammo[ww.def.ammo] + (P.cur === i) : 'e' + i);
      if (s._k === key) continue;
      s._k = key;
      s.el.classList.toggle('on', i === 3 ? P.cur === -1 : P.cur === i);
      if (i === 3) { s.wn.textContent = '✊ ' + T.weapons.fists; s.am.textContent = ''; s.rar.style.background = '#888'; s.el.style.width = 'auto'; continue; }
      s.wn.textContent = ww ? T.weaponShort[ww.id] : '—';
      s.am.textContent = ww ? ww.mag + '/' + P.ammo[ww.def.ammo] : '';
      s.rar.style.background = ww ? RARITY_COLORS[ww.def.rarity] : 'transparent';
    }
    for (const k of ['gloo', 'grenade', 'kymyz']) this.setText(this.cnt[k], String(P.items[k]));
    this.setText(this.cnt.heal, String(P.items.medkit));
    // Емделу
    const healing = P.healT > 0;
    this.setVis(this.healRing, healing);
    if (healing) {
      this.healP.setAttribute('stroke-dashoffset', String(201 * (P.healT / P.healDur)));
      this.setText(this.healTx, P.healKind === 'kymyz' ? T.hud.drinking : T.hud.healing);
    }
    // Алу батырмасы
    const ni = pc.nearItem;
    this.setVis(this.bPick, !!ni && ground);
    if (ni) this.setText(this.pickTx, T.hud.pickup + ': ' + (T.weapons[ni.type] || T.items[ni.type]));
    // Инфо
    this.setText(this.alEl, String(M.aliveCount));
    this.setText(this.klEl, String(M.stats.kills));
    // Аймақ
    const Z = M.zone;
    const zt = Z.state === 'shrink' ? T.hud.zoneShrink : Z.state === 'done' ? T.hud.zoneFinal : T.hud.zoneWait;
    this.setText(this.zoneTx, zt + (Z.state === 'done' ? '' : ' ' + fmtTime(Z.timer)));
    this.zonebox.classList.toggle('shrink', Z.state === 'shrink');
    const dOut = Math.hypot(P.pos.x - Z.to.x, P.pos.z - Z.to.z) - Z.to.r;
    this.setText(this.zoneDist, dOut > 0 ? Math.round(dOut) + T.hud.meters : '');
    const out = ground && !Z.inside(P.pos.x, P.pos.z);
    this.css(this.vigBlue, 'opacity', out ? '0.9' : '0');
    this.css(this.vigRed, 'opacity', (P.alive && P.hp < 60 ? (0.35 + 0.25 * Math.sin(M.time * 6)) * (1 - P.hp / 60) + 0.2 : Math.max(0, (this.redT || 0))).toFixed(2));
    this.redT = Math.max(0, (this.redT || 0) - dt * 2);
    if (out && (!this.lastOutWarn || M.time - this.lastOutWarn > 6)) { this.lastOutWarn = M.time; this.toast(T.hud.outZone, 'warn'); }
    // Компас
    const yawDeg = ((-(pc.yaw) * 180 / Math.PI + 180) % 360 + 360) % 360;
    if (Math.abs((this.last.yaw ?? -999) - yawDeg) > 0.3) { this.last.yaw = yawDeg; this.drawCompass(yawDeg); }
    // Миникарта (10 Гц)
    this.mapT = (this.mapT || 0) - dt;
    if (this.mapT <= 0 && this.mapImg) {
      this.mapT = 0.1;
      const ctx = this.miniCanvas.getContext('2d');
      const span = st === 'plane' || st === 'fall' ? 700 : st === 'chute' ? 320 : 240;
      const cx = st === 'plane' ? M.plane.pos.x * 0.3 : P.pos.x, cz = st === 'plane' ? M.plane.pos.z * 0.3 : P.pos.z;
      this.drawMapLayer(ctx, M, 300, cx, cz, span, false);
      if (this.bigOpen) this.drawBigMap(M);
    }
    // Зақым сандарын орналастыру
    this.updateDamageNumbers(M);
  }

  // ---------- Оқиғалар ----------
  toast(text, kind = '') {
    const t = el('div', 'toast ' + kind, text);
    this.toastsEl.appendChild(t);
    while (this.toastsEl.children.length > 3) this.toastsEl.firstChild.remove();
    setTimeout(() => t.remove(), 2600);
  }

  pickupToast(type, amount) {
    const name = T.weapons[type] || T.items[type] || type;
    const t = el('div', 'pk', `+ ${name}${amount > 1 ? ' ×' + amount : ''}`);
    const rar = ITEMS[type] ? ITEMS[type].rarity : 0;
    t.style.borderLeftColor = RARITY_COLORS[rar];
    this.pickEl.appendChild(t);
    while (this.pickEl.children.length > 5) this.pickEl.firstChild.remove();
    setTimeout(() => t.remove(), 2500);
  }

  killFeed(killer, victim, weapon, head, mine, dead) {
    const html = killer
      ? `<span class="k">${killer}</span><span class="w">[${weapon}]</span>${head ? '<span class="hs">' + T.hud.headshot + '</span>' : ''}<span class="v">${victim}</span>`
      : `<span class="v">${victim}</span><span class="w">${weapon}</span>`;
    const k = el('div', 'kf' + (mine ? ' me' : '') + (dead ? ' dead' : ''), html);
    this.kfEl.appendChild(k);
    while (this.kfEl.children.length > 5) this.kfEl.firstChild.remove();
    setTimeout(() => k.remove(), 6000);
  }

  killBanner(name, head, count) {
    this.kbEl.innerHTML = '';
    const b = el('div', 'kb', `<div class="icn">${count}</div><div class="t1">${head ? T.hud.headshot + '! ' : ''}${T.hud.youKilled}</div><div class="t2">${name}</div>`);
    this.kbEl.appendChild(b);
    setTimeout(() => b.remove(), 1900);
  }

  hitMarker(head, armor) {
    const h = this.hitm;
    h.className = 'hitm' + (head ? ' head' : armor ? ' armor' : '');
    void h.offsetWidth;
    h.classList.add('show');
  }

  damageNumber(pos, dmg, head, armor) {
    let e = this.dmgPool.pop();
    if (!e) e = el('div', 'dmgnum');
    e.className = 'dmgnum' + (head ? ' head' : armor ? ' armor' : '');
    e.textContent = dmg;
    e._p = new THREE.Vector3(pos.x, pos.y + 0.3, pos.z);
    e._t = 0.9;
    e._off = (Math.random() - 0.5) * 30;
    this.dmgLayer.appendChild(e);
    this.dmgs = this.dmgs || [];
    this.dmgs.push(e);
    void e.offsetWidth;
  }

  updateDamageNumbers(M) {
    if (!this.dmgs || !this.dmgs.length) return;
    const cam = M.camera;
    const W = window.innerWidth, H = window.innerHeight;
    for (let i = this.dmgs.length - 1; i >= 0; i--) {
      const e = this.dmgs[i];
      e._t -= 1 / 60;
      if (e._t <= 0) { e.remove(); this.dmgs.splice(i, 1); this.dmgPool.push(e); continue; }
      _v.copy(e._p).project(cam);
      if (_v.z > 1) { e.style.display = 'none'; continue; }
      e.style.display = '';
      e.style.left = ((_v.x * 0.5 + 0.5) * W + e._off) + 'px';
      e.style.top = ((-_v.y * 0.5 + 0.5) * H) + 'px';
    }
  }

  playerHit(attacker, dmg) {
    this.redT = Math.min(0.8, (this.redT || 0) + dmg / 60);
    if (!attacker) return;
    const M = this.game.match;
    const P = M.player;
    const ang = Math.atan2(attacker.pos.x - P.pos.x, attacker.pos.z - P.pos.z);
    const rel = -(ang - M.pc.yaw);
    const i = el('i');
    i.style.transform = `rotate(${rel}rad)`;
    this.hitdir.appendChild(i);
    while (this.hitdir.children.length > 4) this.hitdir.firstChild.remove();
    setTimeout(() => i.remove(), 1100);
  }

  zoneHit() { this.redT = Math.min(0.5, (this.redT || 0) + 0.15); }
  nearMiss() { }
  onFire() { }
}
