// Дыбыс қозғалтқышы: WebAudio, 3D кеңістіктік дыбыс, циклдар, музыка.
import { SR } from './dsp.js';
import { SFX_LIST } from './sfx.js';
import { menuTheme, victoryTheme, defeatTheme } from './music.js';
import { settings } from '../core/settings.js';
import { cacheGet, cacheSet } from '../core/cache.js';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.raw = {};
    this.loops = {};
    this.ready = false;
    this.listener = { x: 0, y: 0, z: 0 };
    this.voices = 0;
    this.lastPlay = {};
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const c = this.ctx;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 4;
    this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
    this.master.connect(this.comp).connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.applyVolumes();
    for (const [k, v] of Object.entries(this.raw)) this._toBuffer(k, v);
  }

  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }

  applyVolumes() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = settings.sfx;
    this.musicBus.gain.value = settings.music * 0.7;
  }

  _toBuffer(name, data) {
    if (!this.ctx) return;
    const chans = Array.isArray(data) ? data : [data];
    const b = this.ctx.createBuffer(chans.length, chans[0].length, SR);
    chans.forEach((ch, i) => b.copyToChannel ? b.copyToChannel(ch, i) : b.getChannelData(i).set(ch));
    this.buffers[name] = b;
  }

  // Барлық дыбыстарды синтездеу (бөліктермен, жүктеу жолағы жаңарып тұруы үшін)
  async generate(onProgress) {
    const list = SFX_LIST;
    let last = performance.now();
    const all = await cacheGet('snd:all');
    for (let i = 0; i < list.length; i++) {
      let d = all && all[list[i].name];
      if (!d) d = list[i].fn();
      this.raw[list[i].name] = d;
      this._toBuffer(list[i].name, d);
      if (performance.now() - last > 30) {
        onProgress && onProgress(i / (list.length + 1));
        await new Promise((r) => setTimeout(r, 0));
        last = performance.now();
      }
    }
    const m = (all && all.music_menu) || menuTheme();
    this.raw.music_menu = m; this._toBuffer('music_menu', m);
    onProgress && onProgress(1);
    this.ready = true;
    // Қалғандарын кейін
    setTimeout(() => {
      const v = (all && all.music_win) || victoryTheme(); this.raw.music_win = v; this._toBuffer('music_win', v);
      const d = (all && all.music_lose) || defeatTheme(); this.raw.music_lose = d; this._toBuffer('music_lose', d);
      if (!all) cacheSet('snd:all', this.raw);
    }, 1500);
  }

  setListener(x, y, z, yaw) {
    this.listener.x = x; this.listener.y = y; this.listener.z = z; this.listener.yaw = yaw;
  }

  // 3D дыбыс: pos берілсе — қашықтық пен бағыт бойынша дыбыс деңгейі мен панорама
  play(name, o = {}) {
    if (!this.ctx || !this.buffers[name]) return null;
    if (this.voices > 40 && !o.important) return null;
    const now = this.ctx.currentTime;
    // Бір дыбысты тым жиі қайталамау
    const lp = this.lastPlay[name] || 0;
    if (o.minGap && now - lp < o.minGap) return null;
    this.lastPlay[name] = now;
    let vol = o.volume ?? 1;
    let pan = 0;
    let lowpass = 0;
    if (o.pos) {
      const L = this.listener;
      const dx = o.pos.x - L.x, dy = o.pos.y - L.y, dz = o.pos.z - L.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const ref = o.ref ?? 6, max = o.max ?? 250;
      if (d > max) return null;
      vol *= ref / (ref + Math.max(0, d - ref) * (o.rolloff ?? 1));
      vol *= 1 - Math.pow(d / max, 3);
      if (vol < 0.004) return null;
      // Тыңдаушының бағытына қатысты панорама
      const yaw = L.yaw || 0;
      const rx = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
      const rz = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
      const ang = Math.atan2(rx, -rz);
      pan = Math.sin(ang) * Math.min(1, d / 3) * 0.85;
      if (rz > 0) lowpass = Math.min(1, d / 40) * 0.5; // артқы дыбыстар сәл күңгірт
      lowpass = Math.max(lowpass, Math.min(1, d / max) * 0.8);
      o.pan = pan;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.playbackRate.value = (o.rate ?? 1) * (1 + (o.rateRand ? (Math.random() - 0.5) * 2 * o.rateRand : 0));
    let node = src;
    if (lowpass > 0.05) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 18000 * Math.pow(1 - lowpass, 2.2) + 600;
      node.connect(f); node = f;
    }
    const g = this.ctx.createGain();
    g.gain.value = vol;
    node.connect(g); node = g;
    if (o.pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      node.connect(p); node = p;
    }
    node.connect(o.music ? this.musicBus : this.sfxBus);
    src.start(now + (o.delay || 0));
    this.voices++;
    src.onended = () => { this.voices--; };
    return { src, gain: g };
  }

  loop(name, vol = 1, music = false) {
    if (!this.ctx || !this.buffers[name]) return null;
    if (this.loops[name]) { this.loops[name].gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.2); return this.loops[name]; }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.3);
    src.connect(g).connect(music ? this.musicBus : this.sfxBus);
    src.start();
    const h = { src, gain: g, name };
    this.loops[name] = h;
    return h;
  }

  loopVolume(name, vol, tc = 0.15) {
    const h = this.loops[name];
    if (h && this.ctx) h.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, tc);
  }

  loopRate(name, rate) {
    const h = this.loops[name];
    if (h) h.src.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.2);
  }

  stopLoop(name, fade = 0.4) {
    const h = this.loops[name];
    if (!h || !this.ctx) return;
    delete this.loops[name];
    h.gain.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    setTimeout(() => { try { h.src.stop(); } catch (e) { /* */ } }, fade * 1000 + 100);
  }

  stopAllLoops() { for (const k of Object.keys(this.loops)) this.stopLoop(k, 0.3); }

  music(name, vol = 1) {
    if (this.curMusic === name) return;
    if (this.curMusic) this.stopLoop(this.curMusic, 1.2);
    this.curMusic = name;
    if (name) this.loop(name, vol, true);
  }

  playMusicOnce(name, vol = 1) {
    if (this.curMusic) { this.stopLoop(this.curMusic, 0.8); this.curMusic = null; }
    return this.play(name, { volume: vol, music: true, important: true });
  }
}

export const audio = new AudioEngine();
