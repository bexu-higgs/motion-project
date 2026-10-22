// Бір ойын (матч): ойыншылар, ұшақ, аймақ, олжа, оқиғалар, жеңіс шарттары.
import * as THREE from 'three';
import { Actor, MAX_HP } from '../actors/actor.js';
import { Bot, botSkill } from '../actors/bot.js';
import { PlayerController } from '../actors/player.js';
import { OUTFITS, randomOutfit } from '../actors/charModel.js';
import { WEAPONS, makeWeaponGeometry, ITEMS } from '../actors/weapons.js';
import { Combat } from './combat.js';
import { Loot } from './loot.js';
import { Zone } from './zone.js';
import { Throwables } from './throwables.js';
import { Plane, Airdrop } from './plane.js';
import { Effects } from './effects.js';
import { Vehicles } from './vehicles.js';
import { RNG } from '../core/rng.js';
import { T } from '../core/i18n.js';
import { settings, vibrate } from '../core/settings.js';
import { audio } from '../audio/audio.js';
import { mergeParts, mat4 } from '../gfx/geom.js';

export const PLAYER_COUNT = 40;

export class Match {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.world = game.world;
    this.camera = game.camera;
    this.hud = game.hud;
    this.T = T;
    this.q = game.quality;
    this.weaponDefs = WEAPONS;
    this.charMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 });
    this.planeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.4 });
    this.weaponMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.55 });
    this.boxMat = new THREE.MeshStandardMaterial({ map: game.tex.crate.map, normalMap: game.tex.crate.normal || null, color: 0xc8a870, roughness: 0.8 });
    this.dropMat = new THREE.MeshStandardMaterial({ map: game.tex.metal.map, color: 0x3a7ad8, roughness: 0.5, metalness: 0.4, emissive: 0x112244 });
    this.weaponGeos = {};
    this.effects = new Effects(this.scene, this.q, (x, z) => this.world.terrain.heightAt(x, z));
    this.combat = new Combat(this);
    this.loot = new Loot(this);
    this.zone = new Zone(this);
    this.throwables = new Throwables(this);
    this.plane = new Plane(this);
    this.airdrop = new Airdrop(this);
    this.vehicles = new Vehicles(this);
    this.actors = [];
    this.bots = [];
    const rng = new RNG(7);
    const names = T.botNames.slice();
    for (let i = names.length - 1; i > 0; i--) { const j = rng.int(0, i); [names[i], names[j]] = [names[j], names[i]]; }
    this.player = new Actor(this, { name: 'Сен', outfit: OUTFITS[settings.outfit] || OUTFITS.batyr, isPlayer: true });
    this.player.chute = this.makeChuteFor(this.player);
    this.actors.push(this.player);
    for (let i = 0; i < PLAYER_COUNT - 1; i++) {
      const a = new Actor(this, { name: names[i % names.length], outfit: randomOutfit(rng) });
      this.makeChuteFor(a);
      const b = new Bot(a, this, 0.5, new RNG(1000 + i));
      a.bot = b;
      this.actors.push(a);
      this.bots.push(b);
    }
    this.pc = new PlayerController(this, this.player, game.input, this.camera);
    this.time = 0;
    this.frame = 0;
    // Ұшақтан көрінетін от/түтін көздері
    for (const s of this.world.ctx.smokeSources) this.effects.addEmitter({ type: 'smoke', pos: new THREE.Vector3(s.x, s.y, s.z), rate: 1.5, camDist: 600 });
    for (const f of this.world.ctx.fires) this.effects.addEmitter({ type: 'fire', pos: new THREE.Vector3(f.x, f.y, f.z), rate: 14, camDist: 140 });
  }

  setOutfit(id) {
    const p = this.player;
    const o = OUTFITS[id] || OUTFITS.batyr;
    p.model.outfit = o;
    p.model.gear = { vest: -1, helm: -1, pack: false };
    p.model.setGear(0, 0, false);
  }

  makeChute(scale = 1) {
    const parts = [];
    const canopy = new THREE.SphereGeometry(3.4, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.32);
    canopy.scale(1.3, 0.75, 1);
    const pos = canopy.attributes.position;
    const col = [];
    const ca = new THREE.Color(0x00afca), cb = new THREE.Color(0xfec50c), cc = new THREE.Color(0xf4f4f4);
    for (let i = 0; i < pos.count; i++) {
      const ang = Math.atan2(pos.getZ(i), pos.getX(i));
      const seg = Math.floor((ang + Math.PI) / (Math.PI * 2) * 10) % 3;
      const c = seg === 0 ? ca : seg === 1 ? cb : cc;
      col.push(c.r, c.g, c.b);
    }
    canopy.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    parts.push({ g: canopy, m: mat4(0, 4.2, 0) });
    const inner = canopy.clone();
    inner.scale(0.99, 0.99, 0.99);
    const ix = inner.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; }
    parts.push({ g: inner, m: mat4(0, 4.2, 0) });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const x = Math.cos(a) * 3.3 * 1.3, z = Math.sin(a) * 3.3;
      const len = Math.hypot(x, 3.6, z);
      const g = new THREE.CylinderGeometry(0.01, 0.01, len, 3);
      const mid = new THREE.Vector3(x / 2, 1.6 + 3.6 / 2, z / 2);
      const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 3.6, z), new THREE.Vector3(0, 1, 0));
      g.rotateX(Math.PI / 2);
      g.applyMatrix4(m);
      parts.push({ g, m: mat4(mid.x, mid.y, mid.z), color: 0x333333 });
    }
    const geo = mergeParts(parts.map((p) => ({ ...p, color: p.color })));
    const mesh = new THREE.Mesh(geo, this.planeMat);
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    const g = new THREE.Group();
    g.add(mesh);
    return g;
  }

  makeChuteFor(a) {
    return a.model.ensureParachute(() => { const c = this.makeChute(1); c.visible = false; return c; });
  }

  weaponMesh(id) {
    if (!this.weaponGeos[id]) this.weaponGeos[id] = makeWeaponGeometry(id);
    const g = this.weaponGeos[id];
    if (!g) return null;
    const m = new THREE.Mesh(g, this.weaponMat);
    m.castShadow = true;
    return m;
  }

  // ---------- Басталуы ----------
  start(seed = (Math.random() * 1e9) | 0) {
    this.seed = seed;
    const rng = new RNG(seed);
    this.rng = rng;
    this.time = 0;
    this.over = false;
    this.result = null;
    this.killFeed = [];
    this.effects.clear();
    this.throwables.clear();
    this.loot.spawnAll(this.world.lootSpots, seed);
    for (const a of this.actors) if (a.vehicle) this.vehicles.exit(a);
    this.vehicles.reset();
    this.zone.reset(seed + 1);
    this.plane.start(rng);
    this.airdropDone = false;
    this.airdrop.state = 'idle';
    this.airdrop.plane.visible = false; this.airdrop.chute.visible = false;
    for (const a of this.actors) {
      a.reset();
      a.pos.copy(this.plane.pos);
      a.obj.visible = false;
      a.state = 'plane';
    }
    this.setOutfit(settings.outfit);
    for (const b of this.bots) { b.skill = botSkill(settings.bots, rng); b.reset(); }
    this.pc.reset();
    this.pc.yaw = Math.atan2(this.plane.dir.x, this.plane.dir.z) + 2.4;
    this.pc.pitch = -0.35;
    this.aliveCount = this.actors.length;
    this.stats = { place: 0, kills: 0, damage: 0, time: 0, killer: null };
    this.zoneDmgAcc = 0;
    this.lowHpT = 0;
    this.birdT = 3;
    this.hud.startMatch(this);
    audio.music(null);
    audio.stopAllLoops();
    audio.loop('plane_loop', 0.55);
    audio.loop('ambient_loop', 0.0);
    audio.loop('waves_loop', 0.0);
  }

  // ---------- Негізгі цикл ----------
  update(dt) {
    this.time += dt;
    this.frame++;
    const P = this.player;
    this.plane.update(dt);
    // Ұшақ аралдан өтіп кетсе — бәрі секіреді
    if (this.plane.progress > 0.93) for (const a of this.actors) if (a.state === 'plane') this.jumpFromPlane(a);
    this.zone.update(dt);
    this.airdrop.update(dt);
    if (!this.airdropDone && this.zone.phase >= 1 && this.zone.state === 'wait' && this.zone.timer < PHASE_DROP) {
      this.airdropDone = true;
      const a = this.rng.float(0, Math.PI * 2), r = this.rng.float(0, this.zone.to.r * 0.6);
      this.airdrop.launch(this.zone.to.x + Math.cos(a) * r, this.zone.to.z + Math.sin(a) * r);
    }
    if (P.alive) this.pc.update(dt);
    for (const b of this.bots) b.update(dt);
    // Таймерлер, аймақ зақымы
    this.zoneDmgAcc += dt;
    const zoneTick = this.zoneDmgAcc >= 1;
    if (zoneTick) this.zoneDmgAcc -= 1;
    for (const a of this.actors) {
      if (!a.alive) continue;
      a.tick(dt);
      if (a.state === 'plane') { a.pos.copy(this.plane.pos); continue; }
      if (zoneTick && a.state === 'ground' && !this.zone.inside(a.pos.x, a.pos.z)) {
        this.combat.damage(a, this.zone.damagePerSec, null, 'zone', 'zone');
        if (a === P) { vibrate(30); this.hud.zoneHit(); }
      }
      if (a.pos.y < -40) this.combat.damage(a, 999, null, 'body', 'fall');
    }
    this.vehicles.update(dt);
    // Көліктегілер орындықта отырады
    for (const a of this.actors) if (a.vehicle && a.alive) this.seat(a);
    this.throwables.update(dt);
    this.loot.update(dt, this.camera);
    // Модельдер
    const cp = this.camera.position;
    for (const a of this.actors) {
      if (a.state === 'plane') { a.obj.visible = false; continue; }
      a.obj.visible = true;
      a.updateModel(dt, cp, true);
      if (!a.alive) {
        a.deathT += dt;
        if (a.deathT > 12) { a.obj.position.y -= (a.deathT - 12) * 0.5; if (a.deathT > 15) a.obj.visible = false; }
      }
    }
    this.pc.updateCamera(dt);
    this.effects.update(dt, this.camera);
    this.world.update(dt, cp);
    this.world.sky.follow(cp, dt);
    this.updateAudio(dt);
    this.hud.update(this, dt);
    if (P.alive && P.state === 'ground') this.stats.time = this.time;
  }

  updateAudio(dt) {
    const P = this.player, cp = this.camera.position;
    audio.setListener(cp.x, cp.y, cp.z, this.pc.yaw + Math.PI);
    const inPlane = P.state === 'plane';
    const falling = P.state === 'fall' || P.state === 'chute';
    if (!inPlane && this.plane.active) {
      const d = this.plane.pos.distanceTo(cp);
      audio.loopVolume('plane_loop', Math.max(0, 0.5 * (1 - d / 600)));
    } else if (!inPlane) audio.stopLoop('plane_loop', 1.5);
    if (falling) audio.loop('wind_loop', P.state === 'fall' ? 0.8 : 0.35);
    else audio.stopLoop('wind_loop', 0.8);
    if (falling) audio.loopRate('wind_loop', P.state === 'fall' ? 1.1 : 0.8);
    const ground = P.state === 'ground';
    audio.loopVolume('ambient_loop', ground ? 0.35 : 0.1, 0.8);
    // Теңіз толқыны жағалауға жақын
    const shore = Math.max(0, 1 - Math.abs(Math.hypot(cp.x, cp.z) - 380) / 90);
    audio.loopVolume('waves_loop', shore * 0.5, 0.8);
    // Аймақтың гуілі
    const dz = Math.abs(Math.hypot(cp.x - this.zone.cx, cp.z - this.zone.cz) - this.zone.r);
    const zv = Math.max(0, 1 - dz / 40) * 0.5;
    if (zv > 0.01) audio.loop('zone_loop', zv); else audio.stopLoop('zone_loop', 0.5);
    if (zv > 0.01) audio.loopVolume('zone_loop', zv);
    // Құстар
    this.birdT -= dt;
    if (this.birdT <= 0 && ground) {
      this.birdT = 4 + Math.random() * 9;
      const a = Math.random() * 6.28;
      audio.play('bird_' + Math.floor(Math.random() * 4), { pos: { x: cp.x + Math.cos(a) * 30, y: cp.y + 10, z: cp.z + Math.sin(a) * 30 }, volume: 0.5, ref: 20, max: 120, rateRand: 0.1 });
    }
    // Жүрек соғысы
    if (P.alive && P.hp < 50) {
      this.lowHpT -= dt;
      if (this.lowHpT <= 0) { this.lowHpT = 0.9; audio.play('heartbeat', { volume: 0.7 }); }
    }
  }

  seat(a) {
    const v = a.vehicle;
    const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
    const lx = 0.42, lz = -0.2;
    a.pos.set(v.pos.x + lx * c + lz * s, v.pos.y + 0.4, v.pos.z - lx * s + lz * c);
    a.visualY = a.pos.y;
    a.vel.set(s * v.speed, 0, c * v.speed);
    a.yaw = v.yaw;
    a.onGround = true;
    a.moveSpeed = 0;
  }

  // ---------- Әрекеттер ----------
  jumpFromPlane(a) {
    if (a.state !== 'plane') return;
    a.state = 'fall';
    a.pos.copy(this.plane.pos);
    a.pos.y -= 4;
    a.pos.x += (Math.random() - 0.5) * 6; a.pos.z += (Math.random() - 0.5) * 6;
    a.vel.copy(this.plane.dir).multiplyScalar(this.plane.speed * 0.4);
    a.vel.y = -5;
    a.obj.visible = true;
    if (a === this.player) {
      audio.play('chute', { volume: 0.4, rate: 1.4 });
      this.hud.toast(T.hud.freefall, 'info');
      audio.stopLoop('plane_loop', 2.5);
    }
  }

  useGloo(a, yaw) {
    if (a.items.gloo <= 0 || a.throwCd > 0) return;
    a.items.gloo--;
    a.throwCd = 0.9;
    a.model.st.throwT = 0.45;
    audio.play('gloo_throw', { pos: a.pos, volume: 0.6, ref: 4, max: 50 });
    setTimeout(() => { if (a.alive) this.throwables.placeGloo(a, yaw, 2.2); }, 250);
  }

  throwGrenade(a, dir) {
    if (a.items.grenade <= 0 || a.throwCd > 0) return;
    a.items.grenade--;
    a.throwCd = 1.2;
    this.throwables.throwGrenade(a, dir);
  }

  explode(pos, owner) {
    const d = this.camera.position.distanceTo(pos);
    this.effects.explosion(pos);
    audio.play(d > 90 ? 'explosion_far' : 'explosion', { pos, volume: 1, ref: 15, max: 700, rolloff: 0.5, important: true });
    if (d < 40) { this.effects.shake = Math.min(1.5, this.effects.shake + (1 - d / 40) * 1.5); vibrate(120); }
    for (const a of this.actors) {
      if (!a.alive || a.state !== 'ground') continue;
      const dd = a.pos.distanceTo(pos);
      if (dd > 7.5) continue;
      if (!this.world.col.visible(pos.x, pos.y + 0.3, pos.z, a.pos.x, a.pos.y + 1, a.pos.z)) continue;
      const dmg = 170 * Math.pow(1 - dd / 7.5, 1.3);
      this.combat.damage(a, dmg, owner, 'body', 'grenade', null);
    }
    for (const w of this.throwables.walls.slice()) {
      if (Math.hypot(w.x - pos.x, w.z - pos.z) < 6) this.throwables.damageGloo(w, 400);
    }
    for (const b of this.bots) b.hearShot(owner, pos);
  }

  actorPickup(a, it) {
    if (this.loot.items.indexOf(it) < 0) return false;
    const def = ITEMS[it.type];
    let ok;
    if (def.kind === 'weapon') ok = a.takeWeapon(def.weapon, it.mag);
    else ok = a.pickup(it.type, it.amount, false);
    if (ok) {
      this.loot.remove(it);
      // Қаруға сай оқ та жақын болса, автоматты түрде
      this.onPickup(a, it);
      a.updateGear();
    }
    return ok;
  }

  // ---------- Оқиғалар ----------
  onShot(shooter, pos) {
    for (const b of this.bots) if (b.a.alive && b.a !== shooter) b.hearShot(shooter, pos);
    if (shooter === this.player) this.hud.onFire();
  }

  onDamage(target, dmg, attacker, part, armor, hit) {
    if (target.bot) target.bot.onDamaged(attacker);
    if (attacker === this.player && target !== this.player) {
      this.stats.damage += dmg;
      this.hud.hitMarker(part === 'head', armor);
      if (hit) this.hud.damageNumber(hit, dmg, part === 'head', armor);
      audio.play(part === 'head' ? 'headshot' : 'hitmarker', { volume: part === 'head' ? 0.6 : 0.5, minGap: 0.03 });
      vibrate(part === 'head' ? 25 : 8);
    }
    if (target === this.player) {
      this.hud.playerHit(attacker, dmg);
      if (attacker) vibrate(20);
    }
  }

  onKill(victim, killer, weapon, head) {
    if (victim.vehicle) this.vehicles.exit(victim);
    victim.alive = false;
    victim.state = 'dead';
    victim.deathT = 0;
    victim.healT = 0; victim.reloadT = 0;
    this.aliveCount = this.actors.filter((a) => a.alive).length;
    if (killer && killer !== victim) killer.kills++;
    this.loot.deathBox(victim);
    victim.model.setWeapon(null, null);
    const wname = weapon === 'zone' ? T.weaponShort.zone : weapon === 'fall' ? T.weaponShort.fall : (T.weaponShort[weapon] || weapon);
    this.hud.killFeed(killer && killer !== victim ? killer.name : null, victim.name, wname, head, killer === this.player, victim === this.player);
    const d = this.camera.position.distanceTo(victim.pos);
    if (killer === this.player) {
      this.stats.kills++;
      audio.play(head ? 'kill_head' : 'kill', { volume: 0.8, important: true });
      this.hud.killBanner(victim.name, head, this.stats.kills);
      vibrate(60);
    }
    if (victim === this.player) {
      this.stats.place = this.aliveCount + 1;
      this.stats.killer = killer && killer !== victim ? killer.name : null;
      this.stats.cause = weapon;
      this.finish(false);
    } else if (this.aliveCount <= 1 && this.player.alive) {
      this.stats.place = 1;
      this.finish(true);
    }
    void d;
  }

  finish(win) {
    if (this.over) return;
    this.over = true;
    this.result = { win, ...this.stats, time: this.player.alive ? this.time : this.stats.time };
    setTimeout(() => this.game.showResult(this.result), win ? 1500 : 2200);
  }

  onStep(a, speed) {
    const d = a.pos.distanceTo(this.camera.position);
    if (d > 40) return;
    let mat = a.groundMat || 'grass';
    const map = { grass: 'grass', dirt: 'dirt', sand: 'sand', concrete: 'concrete', wood: 'wood', metal: 'metal', cloth: 'cloth', water: 'water', ice: 'concrete' };
    mat = map[mat] || 'dirt';
    const v = (a.crouch ? 0.35 : speed > 4.5 ? 0.9 : 0.6) * (a === this.player ? 0.55 : 1);
    audio.play(`step_${mat}_${(Math.random() * 4) | 0}`, { pos: a.pos, volume: v, ref: 3, max: 40, rateRand: 0.08 });
  }

  onLand(a, v, fromChute) {
    const d = a.pos.distanceTo(this.camera.position);
    if (d < 40) audio.play('land', { pos: a.pos, volume: Math.min(1, v / 12), ref: 3, max: 40 });
    if (fromChute) {
      if (d < 120) this.effects.dust(a.pos, 8, 1);
      if (a === this.player) { this.hud.toast(T.hud.landed, 'info'); audio.loop('ambient_loop', 0.35); }
    }
  }
  onJump(a) { if (a.pos.distanceTo(this.camera.position) < 30) audio.play('jump', { pos: a.pos, volume: 0.5, ref: 3, max: 30 }); }
  onChute(a) { if (a.pos.distanceTo(this.camera.position) < 150) audio.play('chute', { pos: a.pos, volume: a === this.player ? 0.9 : 0.6, ref: 8, max: 150 }); }
  onSwitch(a) { if (a === this.player || a.pos.distanceTo(this.camera.position) < 15) audio.play('switch', { pos: a.pos, volume: 0.5, ref: 3, max: 20 }); }
  onReloadStart(a) {
    if (a.pos.distanceTo(this.camera.position) > 35) return;
    const id = a.def.id;
    const snd = id === 'shotgun' ? 'shell' : id === 'sniper' ? 'reload_sniper' : id === 'pistol' ? 'reload_pistol' : 'reload_rifle';
    audio.play(snd, { pos: a.pos, volume: a === this.player ? 0.8 : 0.7, ref: 4, max: 35 });
  }
  onShell(a) { if (a.pos.distanceTo(this.camera.position) < 25) audio.play('shell', { pos: a.pos, volume: 0.7, ref: 3, max: 25 }); }
  onHealStart(a, kind) { if (a.pos.distanceTo(this.camera.position) < 25) audio.play(kind === 'kymyz' ? 'drink' : 'heal_start', { pos: a.pos, volume: 0.7, ref: 3, max: 25 }); }
  onHealDone(a) { if (a === this.player) audio.play('heal_done', { volume: 0.6 }); }
  onPickup(a, it) {
    if (a !== this.player) return;
    const kind = ITEMS[it.type] ? ITEMS[it.type].kind : '';
    audio.play(kind === 'weapon' ? 'pickup_weapon' : kind === 'vest' || kind === 'helm' ? 'armor' : 'pickup', { volume: 0.7 });
    if (!it.box) this.hud.pickupToast(it.type, it.amount);
  }
  onNearMiss() { this.hud.nearMiss(); }
  onZoneShrink(phase) {
    this.hud.toast(T.hud.zoneShrinkWarn, 'warn');
    audio.play('zone_warn', { volume: 0.7, important: true });
    void phase;
  }
  onZoneNext() { this.hud.toast(T.hud.zoneNext, 'info'); audio.play('beep_hi', { volume: 0.5 }); }
  onAirdropDropped(box) {
    this.hud.toast(T.hud.airdrop, 'gold');
    audio.play('beep', { volume: 0.5 });
    this.hud.airdrop = box;
  }
  onAirdropLanded(box) {
    audio.play('crate_land', { pos: box, volume: 1, ref: 10, max: 200 });
    this.effects.dust(new THREE.Vector3(box.x, box.y, box.z), 14, 1.5);
    box.emitter = this.effects.addEmitter({ type: 'flare', pos: new THREE.Vector3(box.x, box.y + 1.2, box.z), rate: 10, camDist: 700 });
  }
}

const PHASE_DROP = 30;
void MAX_HP;
