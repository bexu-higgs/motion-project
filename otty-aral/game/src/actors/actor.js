// Шайқасушы (ойыншы мен боттарға ортақ): физика, түгендеме, денсаулық, сауыт.
import * as THREE from 'three';
import { CharacterModel } from './charModel.js';
import { WEAPONS, ITEMS, AMMO_FOR, AMMO_PACK } from './weapons.js';
import { clamp, damp } from '../core/rng.js';

export const GRAVITY = 22;
export const MAX_HP = 200;
export const VEST_RED = [0, 0.22, 0.36, 0.5];
export const HELM_RED = [0, 0.25, 0.4, 0.55];
export const VEST_DUR = [0, 120, 170, 230];
export const HELM_DUR = [0, 80, 120, 160];
export const CAPS = { medkit: 5, kymyz: 6, gloo: 8, grenade: 4 };
const R = 0.34;

let NEXT_ID = 1;

export class Actor {
  constructor(match, o) {
    this.id = NEXT_ID++;
    this.match = match;
    this.name = o.name;
    this.isPlayer = !!o.isPlayer;
    this.model = new CharacterModel(match.charMat, o.outfit);
    this.obj = this.model.group;
    match.scene.add(this.obj);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;          // қарау бағыты (дене)
    this.aimYaw = 0;
    this.pitch = 0;
    this.visualY = 0;
    this.reset();
  }

  reset() {
    this.hp = MAX_HP;
    this.vest = { lvl: 0, dur: 0 };
    this.helm = { lvl: 0, dur: 0 };
    this.weapons = [null, null, null];
    this.cur = -1;
    this.ammo = { ammo_9: 0, ammo_556: 0, ammo_762: 0, ammo_12: 0, ammo_300: 0 };
    this.items = { medkit: 0, kymyz: 0, gloo: 0, grenade: 0 };
    this.state = 'plane';
    this.alive = true;
    this.vehicle = null;
    this.crouch = false;
    this.aiming = false;
    this.onGround = false;
    this.inWater = false;
    this.reloadT = 0;
    this.healT = 0; this.healKind = null;
    this.regen = 0;
    this.fireCd = 0;
    this.switchT = 0;
    this.throwCd = 0;
    this.kills = 0;
    this.damage = 0;
    this.lastHitBy = null;
    this.lastDamageT = -99;
    this.deathT = 0;
    this.moveSpeed = 0;
    this.moveAngle = 0;
    this.spread = 0;
    this.stepAcc = 0;
    this.fallStartY = 0;
    this.airT = 0;
    this.fireKick = 0;
    this.firing = false;
    this.visible = true;
    this.model.setGear(0, 0, false);
    this.model.setWeapon(null, null);
    this.model.st.dead = 0;
    this.obj.visible = true;
  }

  get weapon() { return this.cur >= 0 ? this.weapons[this.cur] : null; }
  get def() { const w = this.weapon; return w ? w.def : WEAPONS.fists; }
  get eyeY() { return this.pos.y + (this.crouch ? 1.15 : 1.62); }
  get height() { return this.crouch ? 1.25 : 1.78; }
  get busy() { return this.reloadT > 0 || this.healT > 0 || this.switchT > 0; }

  // ---------- Физика ----------
  physics(dt, wishX, wishZ, wantJump) {
    const col = this.match.world.col;
    const p = this.pos, v = this.vel;
    if (this.state === 'fall' || this.state === 'chute') return this.airPhysics(dt, wishX, wishZ);
    let speed = this.crouch ? 2.5 : 6.0;
    if (this.aiming) speed = Math.min(speed, 3.2);
    if (this.healT > 0) speed = Math.min(speed, 1.8);
    if (this.inWater) speed *= 0.55;
    const wl = Math.hypot(wishX, wishZ);
    const tx = wishX * speed, tz = wishZ * speed;
    const accel = this.onGround ? 14 : 3;
    v.x = damp(v.x, tx, accel, dt);
    v.z = damp(v.z, tz, accel, dt);
    v.y -= GRAVITY * dt;
    if (this.onGround && wantJump && !this.inWater && !this.crouch) {
      v.y = 7.4;
      this.onGround = false;
      this.match.onJump(this);
    }
    if (this.onGround && wantJump && this.crouch) this.crouch = false;
    const oldY = p.y;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    // Карта шекарасы
    const lim = 470;
    p.x = clamp(p.x, -lim, lim); p.z = clamp(p.z, -lim, lim);
    col.resolve(p, R, this.height, 0.5);
    const g = col.groundAt(p.x, p.z, R, Math.max(p.y, oldY), 0.55);
    this.groundMat = col.groundMat;
    // Су
    const waterDeep = g < -1.1;
    this.inWater = p.y < -0.6 && g < -0.4;
    if (waterDeep && p.y < -1.25) { p.y = -1.25; v.y = Math.max(0, v.y); this.onGround = true; this.groundMat = 'water'; }
    else if (p.y <= g + 0.02 && v.y <= 0.5) {
      if (!this.onGround) this.land(oldY);
      p.y = g; v.y = 0; this.onGround = true;
    } else if (p.y > g + 0.3) {
      if (this.onGround) { this.fallStartY = p.y; this.airT = 0; }
      this.onGround = false;
    }
    if (!this.onGround) this.airT += dt;
    if (this.inWater && !waterDeep) this.groundMat = 'water';
    // Төбе
    const c = col.ceilingAt(p.x, p.z, R, p.y + 0.6, p.y + this.height + 0.4);
    if (p.y + this.height > c) {
      if (this.crouch === false && c - p.y < 1.78 && c - p.y > 1.25) this.crouch = true;
      else { p.y = Math.min(p.y, c - this.height); v.y = Math.min(0, v.y); }
    }
    const hs = Math.hypot(v.x, v.z);
    this.moveSpeed = hs;
    if (hs > 0.3) this.moveAngle = Math.atan2(v.x, v.z) - this.yaw;
    while (this.moveAngle > Math.PI) this.moveAngle -= Math.PI * 2;
    while (this.moveAngle < -Math.PI) this.moveAngle += Math.PI * 2;
    // Қадам дыбысы
    if (this.onGround && hs > 1.2) {
      this.stepAcc += hs * dt;
      const stride = this.crouch ? 0.9 : hs > 4.5 ? 1.55 : 1.15;
      if (this.stepAcc > stride) { this.stepAcc = 0; this.match.onStep(this, hs); }
    }
    void wl;
  }

  land(oldY) {
    const fallV = -this.vel.y;
    this.match.onLand(this, fallV);
    if (fallV > 17 && this.state === 'ground') {
      const dmg = (fallV - 17) * 9;
      this.match.combat.damage(this, dmg, null, 'body', 'fall');
    }
    void oldY;
  }

  airPhysics(dt, wishX, wishZ) {
    const p = this.pos, v = this.vel;
    const col = this.match.world.col;
    const chute = this.state === 'chute';
    const hMax = chute ? 9.5 : 30;
    const vy = chute ? -5.5 : -(30 + Math.hypot(wishX, wishZ) * 12);
    v.x = damp(v.x, wishX * hMax, chute ? 1.5 : 1.2, dt);
    v.z = damp(v.z, wishZ * hMax, chute ? 1.5 : 1.2, dt);
    v.y = damp(v.y, vy, chute ? 2.5 : 0.8, dt);
    p.addScaledVector(v, dt);
    const lim = 480;
    p.x = clamp(p.x, -lim, lim); p.z = clamp(p.z, -lim, lim);
    const g = col.groundAt(p.x, p.z, R, p.y, 0.5);
    const agl = p.y - g;
    if (!chute && agl < 105) this.openChute();
    if (agl <= 0.05) {
      p.y = Math.max(g, -1.25);
      v.set(v.x * 0.2, 0, v.z * 0.2);
      this.state = 'ground';
      this.onGround = true;
      this.match.onLand(this, 6, true);
    }
    this.moveSpeed = 0;
    this.agl = agl;
  }

  openChute() {
    if (this.state !== 'fall') return;
    this.state = 'chute';
    this.match.onChute(this);
  }

  // ---------- Түгендеме ----------
  canUseAmmo(type) { return (AMMO_FOR[type] || []).some((w) => this.weapons.some((x) => x && x.id === w)); }

  // Затты алу: true — алынды
  pickup(type, amount = 1, auto = false) {
    const it = ITEMS[type];
    if (!it) return false;
    if (it.kind === 'ammo') {
      if (auto && !this.canUseAmmo(type)) return false;
      if (this.ammo[type] >= 240) return false;
      this.ammo[type] = Math.min(240, this.ammo[type] + (amount || AMMO_PACK[type]));
      return true;
    }
    if (it.kind === 'vest') {
      if (it.level < this.vest.lvl || (it.level === this.vest.lvl && this.vest.dur >= VEST_DUR[it.level] * 0.6)) return false;
      this.vest = { lvl: it.level, dur: VEST_DUR[it.level] };
      this.updateGear();
      return true;
    }
    if (it.kind === 'helm') {
      if (it.level < this.helm.lvl || (it.level === this.helm.lvl && this.helm.dur >= HELM_DUR[it.level] * 0.6)) return false;
      this.helm = { lvl: it.level, dur: HELM_DUR[it.level] };
      this.updateGear();
      return true;
    }
    if (it.kind === 'weapon') {
      if (auto) return false;
      return this.takeWeapon(it.weapon);
    }
    if (CAPS[it.kind] !== undefined) {
      if (this.items[it.kind] >= CAPS[it.kind]) return false;
      this.items[it.kind] = Math.min(CAPS[it.kind], this.items[it.kind] + (amount || 1));
      return true;
    }
    return false;
  }

  // Қаруды алу; ауыстырылған қару тасталады
  takeWeapon(id, mag) {
    const def = WEAPONS[id];
    const inst = { id, def, mag: mag ?? def.mag };
    let slot = def.slot;
    let dropped = null;
    if (slot === 2) {
      if (this.weapons[2]) dropped = this.weapons[2];
      this.weapons[2] = inst;
    } else {
      if (!this.weapons[0]) slot = 0;
      else if (!this.weapons[1]) slot = 1;
      else {
        if (this.isPlayer) slot = this.cur === 0 || this.cur === 1 ? this.cur : 0;
        else slot = this.weapons[0].def.rarity <= this.weapons[1].def.rarity ? 0 : 1; // бот ең әлсізін ауыстырады
        dropped = this.weapons[slot];
      }
      this.weapons[slot] = inst;
    }
    if (dropped && this.bot) this.bot.lastDropped = dropped.id;
    if (dropped) this.match.loot.drop(dropped.id, this.pos.x + Math.sin(this.yaw) * 0.6, this.pos.y, this.pos.z + Math.cos(this.yaw) * 0.6, dropped.mag);
    this.equip(slot, true);
    return true;
  }

  equip(slot, force = false) {
    if (slot !== -1 && !this.weapons[slot]) return;
    if (slot === this.cur && !force) return;
    this.cur = slot;
    this.reloadT = 0;
    this.switchT = 0.45;
    const w = this.weapon;
    this.model.setWeapon(w ? w.def : null, w ? this.match.weaponMesh(w.id) : null);
    this.match.onSwitch(this);
  }

  updateGear() {
    this.model.setGear(this.vest.dur > 0 ? this.vest.lvl : 0, this.helm.dur > 0 ? this.helm.lvl : 0, this.weapons[0] && this.weapons[1]);
  }

  reload() {
    const w = this.weapon;
    if (!w || w.def.melee || this.reloadT > 0 || this.healT > 0) return false;
    if (w.mag >= w.def.mag || this.ammo[w.def.ammo] <= 0) return false;
    this.reloadT = w.def.perShell ? w.def.reload : w.def.reload;
    this.match.onReloadStart(this);
    return true;
  }

  finishReload() {
    const w = this.weapon;
    if (!w) return;
    const need = w.def.perShell ? 1 : w.def.mag - w.mag;
    const take = Math.min(need, this.ammo[w.def.ammo]);
    w.mag += take;
    this.ammo[w.def.ammo] -= take;
    if (w.def.perShell && w.mag < w.def.mag && this.ammo[w.def.ammo] > 0) {
      this.reloadT = w.def.reload;
      this.match.onShell(this);
    }
  }

  startHeal(kind) {
    if (this.healT > 0 || this.items[kind] <= 0 || this.state !== 'ground') return false;
    if (kind === 'medkit' && this.hp >= MAX_HP) return false;
    if (kind === 'kymyz' && this.hp >= MAX_HP && this.regen <= 0) return false;
    this.healKind = kind;
    this.healT = kind === 'medkit' ? 3.5 : 1.8;
    this.healDur = this.healT;
    this.reloadT = 0;
    this.match.onHealStart(this, kind);
    return true;
  }

  // ---------- Жаңарту ----------
  tick(dt) {
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.throwCd = Math.max(0, this.throwCd - dt);
    if (this.switchT > 0) this.switchT = Math.max(0, this.switchT - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.reloadT = 0; this.finishReload(); }
    }
    if (this.healT > 0) {
      this.healT -= dt;
      if (this.healT <= 0) {
        this.healT = 0;
        this.items[this.healKind]--;
        if (this.healKind === 'medkit') this.hp = Math.min(MAX_HP, this.hp + 80);
        else this.regen += 45;
        this.match.onHealDone(this, this.healKind);
      }
    }
    if (this.regen > 0) {
      const r = Math.min(this.regen, dt * 9);
      this.regen -= r;
      this.hp = Math.min(MAX_HP, this.hp + r);
    }
    const d = this.def;
    const baseSpread = this.aiming ? d.spreadAim : d.spreadHip;
    const mv = this.state === 'ground' ? Math.min(1, this.moveSpeed / 6) : 1;
    const target = baseSpread * (1 + mv * 0.9 + (this.onGround ? 0 : 1.5)) * (this.crouch ? 0.75 : 1);
    this.spread = damp(this.spread, target, 6, dt);
  }

  // Модельді күйге сәйкестендіру
  updateModel(dt, camPos, cheap) {
    const o = this.obj;
    this.visualY = this.state === 'ground' && this.onGround ? damp(this.visualY, this.pos.y, 18, dt) : this.pos.y;
    if (Math.abs(this.visualY - this.pos.y) > 0.8) this.visualY = this.pos.y;
    o.position.set(this.pos.x, this.visualY, this.pos.z);
    o.rotation.y = this.yaw;
    const dx = this.pos.x - camPos.x, dz = this.pos.z - camPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    this.camDist = dist;
    if (cheap && (dist > 160 && ((this.id + this.match.frame) & 3) !== 0)) return;
    const a = this._anim || (this._anim = {});
    a.speed = this.state === 'ground' ? this.moveSpeed : 0;
    a.moveAngle = this.moveAngle;
    a.crouch = this.crouch && this.state === 'ground';
    a.air = this.state === 'ground' && !this.onGround && this.airT > 0.15;
    a.aimPitch = this.pitch;
    a.aiming = this.aiming;
    a.running = this.moveSpeed > 4.5;
    a.firing = this.firing;
    a.dive = this.state === 'fall';
    a.chute = this.state === 'chute';
    a.dead = !this.alive;
    a.reloading = this.reloadT > 0;
    a.healing = this.healT > 0;
    a.holster = this.switchT > 0.2 || !!this.vehicle;
    a.sit = !!this.vehicle;
    if (this.vehicle) { a.crouch = false; a.air = false; a.speed = 0; }
    a.near = dist < 45;
    if (this.fireKick) { a.fireKick = this.fireKick; this.fireKick = 0; }
    this.model.animate(a, ((this.id + this.match.frame) & 3) === 0 && dist > 160 ? dt * 4 : dt);
  }

  // Хитбокстар: бас (шар) және дене (капсула)
  hitTest(o, d, maxT) {
    if (!this.alive || this.state === 'plane') return null;
    const p = this.pos;
    // Тез тексеру: сәуленің кейіпкерге жақындығы
    const cx = p.x - o.x, cy = p.y + 0.9 - o.y, cz = p.z - o.z;
    const tc = cx * d.x + cy * d.y + cz * d.z;
    if (tc < -1 || tc > maxT + 1) return null;
    const px = cx - d.x * tc, py = cy - d.y * tc, pz = cz - d.z * tc;
    if (px * px + py * py + pz * pz > 2.0) return null;
    let best = null;
    // Бас
    const hp = this.headWorld || (this.headWorld = new THREE.Vector3());
    if (this.camDist < 160) this.model.headPos(hp);
    else hp.set(p.x, p.y + (this.crouch ? 1.2 : 1.68), p.z);
    const hr = 0.15;
    const t1 = raySphere(o, d, hp, hr);
    if (t1 !== null && t1 < maxT) best = { t: t1, part: 'head' };
    // Дене: капсула (аяқтан мойынға дейін)
    const top = this.state === 'chute' || this.state === 'fall' ? 1.5 : this.crouch ? 1.05 : 1.48;
    const t2 = rayCapsule(o, d, p.x, p.y + 0.15, p.z, p.x, p.y + top, p.z, this.crouch ? 0.36 : 0.3);
    if (t2 !== null && t2 < maxT && (!best || t2 < best.t - 0.05)) best = { t: t2, part: 'body' };
    return best;
  }
}

const _w = new THREE.Vector3();
function raySphere(o, d, c, r) {
  _w.set(o.x - c.x, o.y - c.y, o.z - c.z);
  const b = _w.x * d.x + _w.y * d.y + _w.z * d.z;
  const cc = _w.lengthSq() - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

function rayCapsule(o, d, ax, ay, az, bx, by, bz, r) {
  // Тік капсула: XZ жазықтығында шеңбер + Y шектеуі
  const ox = o.x - ax, oz = o.z - az;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-8) {
    if (ox * ox + oz * oz > r * r) return null;
    const t = d.y > 0 ? (ay - o.y) / d.y : (by - o.y) / d.y;
    return t >= 0 ? t : null;
  }
  const b = ox * d.x + oz * d.z;
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t < 0) return null;
  const y = o.y + d.y * t;
  if (y < ay - r * 0.5 || y > by + r * 0.3) return null;
  return t;
}
