// «Отты Арал» — кіру нүктесі: рендерер, жүктеу, мәзір, ойын циклі, FPS шектеуі.
import * as THREE from 'three';
import { settings, saveSettings, quality, stats, saveStats, android, isTouch } from './core/settings.js';
import { T } from './core/i18n.js';
import { TextureLib } from './gfx/textures.js';
import { makeMaterials } from './gfx/materials.js';
import { World } from './world/world.js';
import { poi } from './world/map.js';
import { Match } from './game/match.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { Input } from './ui/input.js';
import { audio } from './audio/audio.js';
import { cachePrune } from './core/cache.js';
import { WEAPONS } from './actors/weapons.js';
import { OUTFITS as OUTFITS_ALL } from './actors/charModel.js';

class Game {
  constructor() {
    this.q = this.quality = quality();
    this.canvas = document.getElementById('gl');
    this.uiRoot = document.getElementById('ui');
    this.menus = new Menus(this.uiRoot, this);
    this.state = 'loading';
    this.resScale = 1;
    this.frameTimes = [];
    window.addEventListener('error', (e) => this.reportError(e.error || e.message));
    window.addEventListener('unhandledrejection', (e) => this.reportError(e.reason));
    this.boot().catch((e) => this.reportError(e));
  }

  reportError(e) {
    console.error('ERR', e && e.stack ? e.stack : e);
    window.err = String(e && e.stack ? e.stack : e);
  }

  initRenderer() {
    const q = this.q;
    let r;
    try {
      r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q.antialias, powerPreference: 'high-performance', stencil: false, depth: true });
    } catch (e) {
      r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
    }
    this.renderer = r;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = q.shadows > 0;
    r.shadowMap.type = q.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = true;
    this.basePixel = Math.min(window.devicePixelRatio || 1, q.maxDpr) * q.pixel;
    this.applyResolution();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, q.draw + 300);
    this.camera.rotation.order = 'YXZ';
    window.addEventListener('resize', () => this.onResize());
  }

  applyResolution() {
    if (!this.renderer) return;
    const pr = this.basePixel * (settings.autoRes ? this.resScale : 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.applyResolution();
  }

  applyFps(v) {
    if (android && android.setRefreshRate) android.setRefreshRate(v >= 120 ? 120 : 60);
    void v;
  }

  async boot() {
    const step = (p, l) => this.menus.setLoading(p, l);
    const nf = () => new Promise((r) => setTimeout(r, 0));
    this.initRenderer();
    this.applyFps(settings.fps);
    step(0.02, 'textures');
    await nf();
    const lib = new TextureLib(this.renderer, this.q.tex, this.q.normals);
    const tm = { t0: performance.now() };
    this.tex = await lib.generateAll((p) => step(0.02 + p * 0.2, 'textures'));
    tm.tex = performance.now();
    this.mats = makeMaterials(this.tex);
    step(0.24, 'sounds');
    await audio.generate((p) => step(0.24 + p * 0.22, 'sounds'));
    tm.audio = performance.now();
    this.world = new World(this.scene, this.renderer, this.tex, this.mats, this.q);
    await this.world.build((p, l) => step(0.46 + p * 0.38, l));
    tm.world = performance.now();
    step(0.86, 'actors');
    await nf();
    this.input = new Input(this.canvas);
    this.hud = new HUD(this.uiRoot, this);
    this.input.attachTouch(this.hud);
    this.match = new Match(this);
    step(0.93, 'shaders');
    await nf();
    this.setupLobby();
    tm.match = performance.now();
    this.warmup();
    tm.warm = performance.now();
    console.log('boot ms: tex', (tm.tex - tm.t0) | 0, 'audio', (tm.audio - tm.tex) | 0, 'world', (tm.world - tm.audio) | 0, 'match', (tm.match - tm.world) | 0, 'warmup', (tm.warm - tm.match) | 0);
    step(1, 'ready');
    await nf();
    this.menus.hideLoading();
    this.enterMenu();
    // Алғашқы жанасуда дыбысты қосу
    const unlock = () => {
      audio.init(); audio.resume();
      if (this.state === 'menu') audio.music('music_menu', 0.9);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // Android: артқа, кідіру
    window.onAndroidBack = () => this.onBack();
    window.onAndroidPause = () => { this.pauseMatch(); audio.suspend(); };
    window.onAndroidResume = () => { audio.resume(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.pauseMatch(); audio.suspend(); } else audio.resume(); });
    this.input.wantLock = !isTouch;
    this.prevT = performance.now();
    this.lastFrame = 0;
    this.manual = /[?&]test=1/.test(location.search);
    requestAnimationFrame((t) => this.loop(t));
    window.game = this;
    setTimeout(() => cachePrune(), 5000);
    window.WEAP = WEAPONS;
    window.OUT = OUTFITS_ALL;
    window.ready = true;
  }

  // Шейдерлерді алдын ала құрастыру (алғашқы кадрда тоқырау болмауы үшін)
  warmup() {
    const M = this.match;
    for (const a of M.actors) { a.obj.visible = true; a.pos.set(0, 20, 0); a.obj.position.copy(a.pos); }
    M.player.model.setWeapon(WEAPONS.ak, M.weaponMesh('ak'));
    this.camera.position.set(0, 60, 120);
    this.camera.lookAt(0, 10, 0);
    try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* */ }
    this.renderer.render(this.scene, this.camera);
    for (const a of M.actors) a.obj.visible = false;
  }

  // ---------- Лобби: жайлаудағы от басы ----------
  setupLobby() {
    const p = poi('jailau');
    const col = this.world.col;
    const x = p.x + 3.2, z = p.z + 12.5;
    this.lobby = { x, z, y: col.groundAt(x, z, 0.3, 100), t: 0 };
  }

  setLobbyOutfit(id) {
    this.match.setOutfit(id);
  }

  enterMenu() {
    this.state = 'menu';
    if (this.pendingReload) { location.reload(); return; }
    this.hud.show(false);
    this.menus.showMenu(true);
    this.input.clear();
    audio.stopAllLoops();
    if (audio.ctx) audio.music('music_menu', 0.9);
    const M = this.match;
    for (const a of M.actors) a.obj.visible = false;
    M.effects.clear();
    M.throwables.clear();
    M.zone.wall.visible = false;
    M.plane.group.visible = false;
    M.airdrop.plane.visible = false; M.airdrop.chute.visible = false;
    M.loot.clear(); M.loot.update(0, this.camera);
    const P = M.player;
    P.reset();
    P.state = 'ground'; P.alive = true;
    P.pos.set(this.lobby.x, this.lobby.y, this.lobby.z);
    P.yaw = 3.55;
    P.obj.visible = true;
    P.model.setWeapon(WEAPONS.ak, M.weaponMesh('ak'));
    if (document.pointerLockElement) document.exitPointerLock();
  }

  updateLobby(dt) {
    const L = this.lobby;
    L.t += dt;
    const P = this.match.player;
    const M = this.match;
    P.pos.set(L.x, L.y, L.z);
    P.cur = 0;
    P.switchT = 0.3;
    P.updateModel(dt, this.camera.position, false);
    const a = 2.6 + Math.sin(L.t * 0.15) * 0.25 + 0.5;
    const d = 3.6;
    this.camera.position.set(L.x + Math.sin(a) * d - 0.9, L.y + 1.35, L.z + Math.cos(a) * d);
    this.camera.lookAt(L.x - 0.9, L.y + 1.05, L.z);
    this.camera.fov = 50; this.camera.updateProjectionMatrix();
    this.world.update(dt, this.camera.position);
    this.world.sky.follow(this.camera.position, dt);
    M.effects.update(dt, this.camera);
  }

  // ---------- Ойын ----------
  startMatch() {
    audio.init(); audio.resume();
    this.menus.showMenu(false);
    this.menus.showLoading();
    this.menus.setLoading(0.3, 'actors');
    setTimeout(() => {
      this.match.zone.wall.visible = true;
      this.match.start();
      this.menus.setLoading(1, 'ready');
      this.menus.hideLoading();
      this.state = 'play';
      this.input.clear();
      if (!isTouch && this.canvas.requestPointerLock) { try { this.canvas.requestPointerLock(); } catch (e) { /* */ } }
    }, 60);
  }

  showResult(r) {
    if (this.state !== 'play') return;
    this.state = 'result';
    this.hud.show(false);
    if (document.pointerLockElement) document.exitPointerLock();
    audio.stopAllLoops();
    audio.playMusicOnce(r.win ? 'music_win' : 'music_lose', 0.9);
    stats.matches++;
    stats.kills += r.kills;
    stats.damage += r.damage;
    if (r.win) stats.wins++; else stats.deaths++;
    if (!stats.best || r.place < stats.best) stats.best = r.place;
    const score = this.menus.showResult(r, () => this.startMatch(), () => this.enterMenu());
    stats.xp += score;
    saveStats();
  }

  pauseMatch() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    this.input.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    this.menus.showPause(() => { if (this.state === 'pause') { this.state = 'play'; this.input.clear(); if (!isTouch) { try { this.canvas.requestPointerLock(); } catch (e) { /* */ } } } }, () => { this.state = 'menu'; this.enterMenu(); });
  }

  onBack() {
    const ov = document.querySelector('.overlay .xbtn');
    if (ov) { ov.click(); return true; }
    if (this.hud.bigOpen) { this.hud.toggleBigMap(false); return true; }
    if (this.state === 'play') { this.pauseMatch(); return true; }
    if (this.state === 'result') { document.querySelector('#result .menu')?.click(); return true; }
    return false;
  }

  // ---------- Цикл ----------
  // Тестілеу үшін: кадрды қолмен жүргізу
  step(dt, n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.state === 'menu') this.updateLobby(dt);
      else if (this.state === 'play') this.match.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    if (this.manual) return;
    // Экранның нақты жаңару жиілігін өлшеу
    if (this.lastRaw) {
      const raw = t - this.lastRaw;
      this.raws = this.raws || [];
      this.raws.push(raw);
      if (this.raws.length >= 120) {
        const s = this.raws.slice().sort((a, b) => a - b);
        this.vsync = Math.max(4, s[12]);
        this.raws.length = 0;
      }
    }
    this.lastRaw = t;
    const interval = 1000 / settings.fps;
    if (t - this.lastFrame < interval - 2) return;
    this.lastFrame = t;
    let dt = (t - this.prevT) / 1000;
    this.prevT = t;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) dt = 0.001;
    if (this.input.take('pause') && this.state === 'play') this.pauseMatch();
    if (this.state === 'menu') this.updateLobby(dt);
    else if (this.state === 'play') {
      this.match.update(dt);
    } else if (this.state === 'result' || this.state === 'pause') {
      if (this.state === 'result') { this.match.effects.update(dt, this.camera); this.world.update(dt, this.camera.position); }
    }
    this.renderer.render(this.scene, this.camera);
    this.adaptResolution(dt);
  }

  // Динамикалық ажыратымдылық: мақсатты FPS сақталмаса, пиксель тығыздығын азайтамыз
  adaptResolution(dt) {
    if (!settings.autoRes || this.state !== 'play') return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    const target = Math.max(1 / settings.fps, (this.vsync || 16.6) / 1000);
    let s = this.resScale;
    if (avg > target * 1.25 && s > 0.55) s = Math.max(0.55, s - 0.1);
    else if (avg < target * 1.05 && s < 1) s = Math.min(1, s + 0.05);
    if (s !== this.resScale) { this.resScale = s; this.applyResolution(); }
  }
}

new Game();
void saveSettings; void T;
