// Бот миы: олжа жинау, аймаққа көшу, жауды байқау, шайқас, емделу, мұз қабырға қою.
import * as THREE from 'three';
import { clamp, angleDiff } from '../core/rng.js';
import { ITEMS, WEAPONS, AMMO_FOR } from './weapons.js';
import { VEST_DUR, HELM_DUR, MAX_HP } from './actor.js';
import { POIS } from '../world/map.js';

const IDEAL = { fists: 1.5, pistol: 14, smg: 14, ak: 28, m4: 32, shotgun: 7, sniper: 90 };
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _o = new THREE.Vector3();

export class Bot {
  constructor(actor, match, skill, rng) {
    this.a = actor;
    this.m = match;
    this.skill = skill;
    this.rng = rng;
    this.reset();
  }

  reset() {
    const r = this.rng;
    this.mode = 'plane';
    this.jumpAt = r.float(0.12, 0.82);
    const p = r.weighted(POIS.map((p) => [p, p.id === 'military' || p.id === 'bayterek' ? 3 : p.id === 'fortress' || p.id === 'factory' ? 2 : 1.2]));
    const a = r.float(0, Math.PI * 2), d = r.float(0, p.r * 0.8);
    this.landX = p.x + Math.cos(a) * d; this.landZ = p.z + Math.sin(a) * d;
    if (r.chance(0.2)) { this.landX = r.float(-330, 330); this.landZ = r.float(-330, 330); }
    this.target = null;
    this.thinkT = r.float(0, 0.3);
    this.losT = 0;
    this.hasLOS = false;
    this.lastSeen = new THREE.Vector3();
    this.lastSeenT = -99;
    this.reactT = 0;
    this.trackT = 0;
    this.strafeDir = r.sign();
    this.strafeT = 0;
    this.burstT = 0; this.pauseT = 0;
    this.path = [];
    this.goal = null;
    this.goalT = 0;
    this.lootItem = null;
    this.stuckT = 0; this.stuckN = 0;
    this.lastPos = new THREE.Vector3();
    this.detourT = 0; this.detour = 0;
    this.avoid = 0; this.avoidT = 0;
    this.glooCd = 0; this.nadeCd = r.float(5, 15);
    this.aimErr = new THREE.Vector2(r.float(-1, 1), r.float(-1, 1));
    this.wantJump = false;
    this.wishX = 0; this.wishZ = 0;
    this.walk = false;
    this.alertYaw = null;
    this.roamT = 0;
    this.crouchT = 0;
  }

  // ---------- Оқиғалар ----------
  onDamaged(attacker) {
    if (!attacker || attacker === this.a || !attacker.alive) return;
    if (!this.target || this.target === attacker || this.rng.chance(0.6)) {
      this.target = attacker;
      this.lastSeen.copy(attacker.pos);
      this.lastSeenT = this.m.time;
      this.reactT = Math.min(this.reactT, 0.15);
    }
    this.alertYaw = Math.atan2(attacker.pos.x - this.a.pos.x, attacker.pos.z - this.a.pos.z);
  }

  hearShot(shooter, pos) {
    if (shooter === this.a || this.target) return;
    const d = this.a.pos.distanceTo(pos);
    if (d > 110) return;
    this.alertYaw = Math.atan2(pos.x - this.a.pos.x, pos.z - this.a.pos.z);
    if (d < 70 && this.rng.chance(0.5)) { this.lastSeen.copy(pos); this.lastSeenT = this.m.time - 2; }
  }

  // ---------- Негізгі цикл ----------
  update(dt) {
    const a = this.a, M = this.m;
    if (!a.alive) return;
    this.wantJump = false;
    this.glooCd -= dt; this.nadeCd -= dt;
    if (a.state === 'plane') {
      if (M.plane.progress > this.jumpAt && M.plane.progress > 0.08) M.jumpFromPlane(a);
      return;
    }
    if (a.state === 'fall' || a.state === 'chute') {
      _v.set(this.landX - a.pos.x, 0, this.landZ - a.pos.z);
      const d = _v.length();
      if (d > 3) _v.divideScalar(d); else _v.set(0, 0, 0);
      const k = clamp(d / 40, 0, 1);
      a.yaw = Math.atan2(_v.x, _v.z) || a.yaw;
      a.physics(dt, _v.x * k, _v.z * k, false);
      if (a.state === 'fall' && a.pos.y - M.world.terrain.heightAt(a.pos.x, a.pos.z) < 140 && d < 60) a.openChute();
      return;
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.2 + this.rng.float(0, 0.15); this.think(); }
    // Шайқас немесе жүру
    let wx = 0, wz = 0;
    const T = this.target;
    a.firing = false;
    if (T && T.alive) {
      this.combat(dt, T);
      wx = this.wishX; wz = this.wishZ;
    } else {
      a.aiming = false;
      if (this.goal) {
        const r = this.steer(dt, this.goal.x, this.goal.z);
        wx = r.x; wz = r.z;
        if (r.arrived) this.onArrive();
        // Жүрген бағытына қарау
        if (Math.abs(wx) + Math.abs(wz) > 0.1) {
          const ty = Math.atan2(wx, wz);
          a.yaw += angleDiff(a.yaw, ty) * Math.min(1, dt * 8);
        }
      } else if (this.alertYaw !== null) {
        a.yaw += angleDiff(a.yaw, this.alertYaw) * Math.min(1, dt * 5);
        if (Math.abs(angleDiff(a.yaw, this.alertYaw)) < 0.1) this.alertYaw = null;
      }
      a.pitch *= 0.9;
    }
    if (this.walk) { wx *= 0.45; wz *= 0.45; }
    if (a.healT > 0) { wx *= 0.2; wz *= 0.2; }
    a.physics(dt, wx, wz, this.wantJump);
  }

  // Шешім қабылдау (жиілігі аз)
  think() {
    const a = this.a, M = this.m;
    this.perceive();
    let T = this.target;
    // Жауды көрмесе — ұмыту
    if (T && (!T.alive || M.time - this.lastSeenT > 7)) { this.target = T = null; }
    // Қаруы жоқ бот алыстағы жаумен шайқаспайды — олжа іздейді
    if (T && !this.armed() && T.pos.distanceTo(a.pos) > 6) { this.target = T = null; }
    if (T) { this.goal = null; return; }
    // Қару дайындау
    this.chooseWeapon(60);
    const w = a.weapon;
    if (w && !w.def.melee && w.mag < w.def.mag * 0.6 && a.ammo[w.def.ammo] > 0 && a.reloadT <= 0) a.reload();
    // Емделу
    if (a.hp < MAX_HP * 0.7 && M.time - a.lastDamageT > 2.5 && a.healT <= 0) {
      if (a.hp < MAX_HP * 0.6 && a.items.medkit > 0) { a.startHeal('medkit'); a.crouch = true; return; }
      if (a.items.kymyz > 0 && a.regen <= 0) { a.startHeal('kymyz'); return; }
    }
    if (a.healT > 0) return;
    a.crouch = false;
    // Аймақ
    const Z = M.zone;
    const outside = !Z.inside(a.pos.x, a.pos.z, 4);
    const outNext = !Z.insideNext(a.pos.x, a.pos.z, 8);
    const distNext = Math.hypot(a.pos.x - Z.to.x, a.pos.z - Z.to.z) - Z.to.r;
    const travel = distNext / 5.5;
    const urgent = outside || (outNext && (Z.state === 'shrink' || Z.timer < travel + 15 + this.skill * 12));
    this.zoneSoon = Z.state === 'shrink' || Z.timer < travel + 30;
    // Аймаққа бара жатса — мақсатқа жеткенше жалғастырады (ауытқымау үшін)
    if (this.mode === 'zone' && this.goal && !Z.insideNext(a.pos.x, a.pos.z, Math.min(25, Z.to.r * 0.3))) return;
    if (urgent) {
      if (this.mode !== 'zone' || !this.goal) {
        const ang = this.rng.float(0, Math.PI * 2), rr = this.rng.float(0, Z.to.r * 0.55);
        this.setGoal(Z.to.x + Math.cos(ang) * rr, Z.to.z + Math.sin(ang) * rr, 'zone');
      }
      this.walk = false;
      // Жолда жақын олжаны алу
      if (this.lootItem && M.loot.items.indexOf(this.lootItem) >= 0 && Math.hypot(this.lootItem.x - a.pos.x, this.lootItem.z - a.pos.z) < 1.8) M.actorPickup(a, this.lootItem);
      return;
    }
    // Олжа
    if (this.lootItem && (M.loot.items.indexOf(this.lootItem) < 0 || (this.lootItem.claimedBy && this.lootItem.claimedBy !== a))) this.lootItem = null;
    if (this.lootItem && this.lootValue(this.lootItem.type) <= 0) { this.lootItem.claimedBy = null; this.lootItem = null; }
    if (!this.lootItem) {
      const it = this.findLoot();
      if (it) { this.lootItem = it; it.claimedBy = a; this.mode = 'none'; }
    }
    if (this.lootItem) {
      const it = this.lootItem;
      if (this.mode !== 'loot' || !this.goal) this.setGoal(it.x, it.z, 'loot', it.y);
      this.walk = false;
      return;
    }
    // Өлім қораптары
    if (this.mode !== 'box' || !this.goal) {
      const box = M.loot.nearestBox(a.pos.x, a.pos.y, a.pos.z, 45);
      if (box && this.needsSupplies() && !box.botVisited?.includes(a.id)) { (box.botVisited = box.botVisited || []).push(a.id); this.setGoal(box.x, box.z, 'box', box.y); this.goalBox = box; return; }
    } else return;
    // Аң аулау (кеш кезеңде)
    if (this.armed() && Z.phase >= 2 && this.mode !== 'hunt' && this.rng.chance(0.1 + this.skill * 0.2)) {
      const prey = this.nearestEnemy(150);
      if (prey) { this.setGoal(prey.pos.x + this.rng.float(-10, 10), prey.pos.z + this.rng.float(-10, 10), 'hunt'); return; }
    }
    if ((this.mode === 'hunt' || this.mode === 'investigate' || this.mode === 'roam') && this.goal) return;
    // Тексеру
    if (this.armed() && M.time - this.lastSeenT < 12 && this.rng.chance(0.6)) {
      this.setGoal(this.lastSeen.x, this.lastSeen.z, 'investigate');
      this.lastSeenT = -99;
      this.walk = this.rng.chance(0.5);
      return;
    }
    // Кезу
    this.roamT -= 0.3;
    if (this.roamT <= 0) {
      this.roamT = this.rng.float(2, 7);
      if (this.rng.chance(0.7) || !this.armed()) {
        const ang = this.rng.float(0, Math.PI * 2), rr = this.rng.float(15, 60);
        let x = a.pos.x + Math.cos(ang) * rr, z = a.pos.z + Math.sin(ang) * rr;
        if (!Z.insideNext(x, z, 5)) { x = Z.to.x + (x - Z.to.x) * 0.5; z = Z.to.z + (z - Z.to.z) * 0.5; }
        this.setGoal(x, z, 'roam');
        this.walk = this.armed() && this.rng.chance(0.4);
      } else { this.goal = null; this.mode = 'idle'; a.crouch = this.rng.chance(0.5); this.alertYaw = this.rng.float(-Math.PI, Math.PI); }
    }
  }

  armed() {
    const a = this.a;
    return a.weapons.some((w) => w && (w.mag > 0 || a.ammo[w.def.ammo] > 0));
  }

  needsSupplies() {
    const a = this.a;
    return !a.weapons[0] || a.items.medkit < 2 || a.vest.lvl < 2 || a.items.gloo < 3;
  }

  nearestEnemy(r) {
    let best = null, bd = r;
    for (const o of this.m.actors) {
      if (o === this.a || !o.alive || o.state !== 'ground') continue;
      const d = o.pos.distanceTo(this.a.pos);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  perceive() {
    const a = this.a, M = this.m;
    const range = 70 + this.skill * 90 + (a.def.id === 'sniper' ? 120 : 0);
    let best = null, bd = Infinity;
    let checks = 0;
    const cands = [];
    for (const o of M.actors) {
      if (o === a || !o.alive || o.state === 'plane') continue;
      const d = o.pos.distanceTo(a.pos);
      if (d > range) continue;
      cands.push([d, o]);
    }
    cands.sort((x, y) => x[0] - y[0]);
    for (const [d, o] of cands) {
      if (checks++ > 3) break;
      const ang = Math.abs(angleDiff(a.yaw, Math.atan2(o.pos.x - a.pos.x, o.pos.z - a.pos.z)));
      const fov = d < 12 ? Math.PI : 1.25 + this.skill * 0.4;
      if (ang > fov && o !== this.target) continue;
      // Отырған/жасырынған жауды байқау қиынырақ
      const stealth = o.crouch && o.moveSpeed < 1 && d > 25 ? 0.5 : 1;
      if (this.rng.next() > stealth) continue;
      if (M.world.col.visible(a.pos.x, a.eyeY, a.pos.z, o.pos.x, o.pos.y + 1.25, o.pos.z)) {
        if (d < bd) { bd = d; best = o; }
      }
    }
    if (best) {
      if (this.target !== best) {
        this.reactT = 0.45 + (1 - this.skill) * 0.85 + this.rng.float(0, 0.35);
        this.trackT = 0;
      }
      this.target = best;
      this.hasLOS = true;
      this.lastSeen.copy(best.pos);
      this.lastSeenT = M.time;
    } else if (this.target) {
      this.hasLOS = M.world.col.visible(a.pos.x, a.eyeY, a.pos.z, this.target.pos.x, this.target.pos.y + 1.25, this.target.pos.z);
      if (this.hasLOS) { this.lastSeen.copy(this.target.pos); this.lastSeenT = M.time; }
    }
  }

  chooseWeapon(dist) {
    const a = this.a;
    if (a.reloadT > 0 || a.healT > 0) return;
    let best = -1, bs = -1;
    for (let i = 0; i < 3; i++) {
      const w = a.weapons[i];
      if (!w) continue;
      const ammo = w.mag + a.ammo[w.def.ammo];
      if (ammo <= 0) continue;
      const ideal = IDEAL[w.id];
      let s = 10 - Math.abs(Math.log((dist + 2) / (ideal + 2))) * 4 + w.def.rarity;
      if (w.mag > 0) s += 2;
      if (s > bs) { bs = s; best = i; }
    }
    if (best !== -1 && best !== a.cur) a.equip(best);
    else if (best === -1 && a.cur !== -1 && (!a.weapon || a.weapon.mag + a.ammo[a.weapon.def.ammo] <= 0)) a.equip(-1);
  }

  findLoot() {
    const a = this.a, M = this.m;
    let best = null, bs = 0;
    const lateGame = M.zone.phase >= 3;
    for (const it of M.loot.items) {
      if (it.claimedBy && it.claimedBy !== a && it.claimedBy.alive) continue;
      const dx = it.x - a.pos.x, dz = it.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      const lim = !a.weapons[0] && !a.weapons[2] ? 150 : lateGame ? 30 : 60;
      if (d2 > lim * lim) continue;
      if (!M.zone.inside(it.x, it.z, 5)) continue;
      if (this.zoneSoon && !M.zone.insideNext(it.x, it.z, 10)) continue;
      const v = this.lootValue(it.type);
      if (v <= 0) continue;
      const s = v / (Math.sqrt(d2) + 6);
      if (s > bs) { bs = s; best = it; }
    }
    return best;
  }

  lootValue(type) {
    const a = this.a;
    const it = ITEMS[type];
    if (it.kind === 'weapon') {
      const def = WEAPONS[it.weapon];
      const has = a.weapons.some((w) => w && w.id === it.weapon);
      if (has) return 0;
      if (def.slot === 2) return a.weapons[2] ? 0 : (a.weapons[0] ? 1 : 6);
      if (!a.weapons[0]) return 10 + def.rarity;
      if (!a.weapons[1]) return 5 + def.rarity;
      const worst = Math.min(a.weapons[0].def.rarity, a.weapons[1].def.rarity);
      return def.rarity > worst && it.weapon !== this.lastDropped ? 3 : 0;
    }
    if (it.kind === 'ammo') return a.canUseAmmo(type) && a.ammo[type] < 90 ? (a.ammo[type] < 30 ? 5 : 2) : 0;
    if (it.kind === 'vest') return it.level > a.vest.lvl || (it.level === a.vest.lvl && a.vest.dur < VEST_DUR[it.level] * 0.5) ? 4 + it.level : 0;
    if (it.kind === 'helm') return it.level > a.helm.lvl || (it.level === a.helm.lvl && a.helm.dur < HELM_DUR[it.level] * 0.5) ? 3 + it.level : 0;
    if (it.kind === 'medkit') return a.items.medkit < 3 ? 3.5 : 0;
    if (it.kind === 'kymyz') return a.items.kymyz < 3 ? 2 : 0;
    if (it.kind === 'gloo') return a.items.gloo < 4 ? 4 : 0;
    if (it.kind === 'grenade') return a.items.grenade < 2 ? 1.5 : 0;
    return 0;
  }

  // Мақсатты орнату; ішкі нүктелер үшін есік арқылы жол
  setGoal(x, z, mode, y) {
    const a = this.a, M = this.m;
    this.mode = mode;
    this.goalT = 0;
    this.stuckN = 0;
    this.path = [];
    const col = M.world.col;
    const indoor = (px, pz, py) => col.ceilingAt(px, pz, 0.2, py + 1.0, py + 6) < Infinity;
    const gy = y ?? col.groundAt(x, z, 0.3, 200);
    const targetIn = indoor(x, z, gy);
    const selfIn = indoor(a.pos.x, a.pos.z, a.pos.y);
    const nearestDoor = (px, pz, r) => {
      let best = null, bd = r * r;
      for (const d of M.world.doors) {
        const dx = d.in.x - px, dz = d.in.z - pz;
        const dd = dx * dx + dz * dz;
        if (dd < bd) { bd = dd; best = d; }
      }
      return best;
    };
    if (selfIn) {
      const d = nearestDoor(a.pos.x, a.pos.z, 14);
      if (d && !(targetIn && nearestDoor(x, z, 14) === d)) this.path.push(d.in, d.out);
    }
    if (targetIn) {
      const d = nearestDoor(x, z, 16);
      if (d && !(selfIn && this.path.length === 0)) this.path.push(d.out, d.in);
    }
    this.path.push({ x, z });
    this.goal = this.path.shift();
    this.lastPos.copy(a.pos);
    this.stuckT = 0;
  }

  onArrive() {
    if (this.path.length) { this.goal = this.path.shift(); this.goalT = 0; return; }
    const a = this.a, M = this.m;
    if (this.mode === 'loot' && this.lootItem) {
      const it = this.lootItem;
      if (M.loot.items.indexOf(it) >= 0 && Math.hypot(it.x - a.pos.x, it.z - a.pos.z) < 2.0) M.actorPickup(a, it);
      it.claimedBy = null;
      this.lootItem = null;
    }
    if (this.mode === 'box' && this.goalBox) {
      if (M.loot.boxes.indexOf(this.goalBox) >= 0) M.loot.openBox(this.goalBox, a);
      this.goalBox = null;
    }
    this.goal = null;
    this.mode = 'idle';
    this.roamT = this.rng.float(0.5, 3);
  }

  // Кедергіден айналып өтетін басқару
  steer(dt, gx, gz) {
    const a = this.a, M = this.m;
    const dx = gx - a.pos.x, dz = gz - a.pos.z;
    const d = Math.hypot(dx, dz);
    const out = this._out || (this._out = { x: 0, z: 0, arrived: false });
    out.arrived = d < (this.path.length ? 1.0 : 1.3);
    if (out.arrived) { out.x = 0; out.z = 0; return out; }
    let ang = Math.atan2(dx, dz);
    this.goalT += dt;
    // Тұрып қалуды анықтау
    this.stuckT += dt;
    if (this.stuckT > 0.9) {
      const moved = a.pos.distanceTo(this.lastPos);
      this.lastPos.copy(a.pos);
      this.stuckT = 0;
      if (moved < 0.5) {
        this.stuckN++;
        this.wantJump = true;
        this.detour = this.rng.sign() * this.rng.float(0.9, 1.8);
        this.detourT = 0.8;
        if (this.stuckN > 4) { this.goal = null; this.path = []; this.mode = 'idle'; this.roamT = 0; if (this.lootItem) { this.lootItem.claimedBy = null; this.lootItem = null; } }
      } else this.stuckN = Math.max(0, this.stuckN - 1);
    }
    if (this.goalT > 40) { this.goal = null; this.mode = 'idle'; }
    if (this.detourT > 0) { this.detourT -= dt; ang += this.detour; }
    // Алдағы кедергіні тексеру
    this.avoidT -= dt;
    if (this.avoidT <= 0) {
      this.avoidT = 0.25;
      this.avoid = 0;
      const col = M.world.col;
      const tryA = (off) => {
        const aa = ang + off;
        const sx = Math.sin(aa), sz = Math.cos(aa);
        const h = col.raycast(a.pos.x, a.pos.y + 0.7, a.pos.z, sx, 0, sz, 1.6, false);
        return !h;
      };
      if (!tryA(0)) {
        for (const off of [0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6]) if (tryA(off)) { this.avoid = off; break; }
      }
    }
    ang += this.avoid;
    out.x = Math.sin(ang); out.z = Math.cos(ang);
    return out;
  }

  combat(dt, T) {
    const a = this.a, M = this.m;
    const dx = T.pos.x - a.pos.x, dz = T.pos.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    this.chooseWeapon(dist);
    const w = a.weapon;
    this.reactT -= dt;
    this.trackT += dt;
    // Нысанаға алу
    const tx = T.pos.x + T.vel.x * 0.12 * (dist / 40), tz = T.pos.z + T.vel.z * 0.12 * (dist / 40);
    const headAim = this.skill > 0.6 && this.rng.next() < 0.002 ? 1 : 0;
    const ty = T.pos.y + (T.crouch ? 0.85 : 1.2) + headAim * 0.4;
    const seeX = this.hasLOS ? tx : this.lastSeen.x, seeZ = this.hasLOS ? tz : this.lastSeen.z;
    const desiredYaw = Math.atan2(seeX - a.pos.x, seeZ - a.pos.z);
    const desiredPitch = Math.atan2(ty - a.eyeY, Math.max(0.5, dist));
    const turn = (2.5 + this.skill * 6) * dt;
    const dy = angleDiff(a.yaw, desiredYaw);
    a.yaw += clamp(dy, -turn, turn);
    a.pitch += clamp(desiredPitch - a.pitch, -turn, turn);
    // Қателік: кездейсоқ дрейф
    this.aimErr.x += (this.rng.next() - 0.5) * dt * 3; this.aimErr.y += (this.rng.next() - 0.5) * dt * 3;
    this.aimErr.clampLength(0, 1);
    const errBase = (0.016 + (1 - this.skill) * 0.055) * (0.5 + dist / 40) * (1 + 1.5 * Math.max(0, 1 - this.trackT / 1.6)) * (T.moveSpeed > 3 ? 1.3 : 1);
    // Қозғалыс: бүйірлей жылжу, жақындау/алыстау
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = this.rng.float(0.5, 1.6); this.strafeDir = this.rng.chance(0.2) ? 0 : this.rng.sign(); if (this.rng.chance(0.08 * this.skill)) this.wantJump = true; }
    const ideal = IDEAL[w ? w.id : 'fists'];
    const fx = dx / (dist || 1), fz = dz / (dist || 1);
    let adv = 0;
    if (!this.hasLOS) adv = 1;
    else if (dist > ideal * 1.4) adv = 0.8;
    else if (dist < ideal * 0.5 && w && w.id !== 'shotgun') adv = -0.6;
    let mx = fx * adv + -fz * this.strafeDir * 0.8, mz = fz * adv + fx * this.strafeDir * 0.8;
    if (!this.hasLOS && M.time - this.lastSeenT > 1.5) {
      // Соңғы көрген жерге бару
      const r = this.steer(dt, this.lastSeen.x, this.lastSeen.z);
      mx = r.x; mz = r.z;
      if (r.arrived) this.target = null;
    }
    // Кедергі
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    if (ml > 0.1 && M.world.col.raycast(a.pos.x, a.pos.y + 0.7, a.pos.z, mx / (ml || 1), 0, mz / (ml || 1), 1.2, false)) { this.strafeDir *= -1; mx *= -0.5; mz *= -0.5; }
    this.wishX = mx; this.wishZ = mz;
    // Отыру
    this.crouchT -= dt;
    if (this.crouchT <= 0) { this.crouchT = this.rng.float(0.8, 2.5); a.crouch = this.hasLOS && dist > 20 && this.rng.chance(0.25 + this.skill * 0.2); }
    a.aiming = this.hasLOS && dist > 12 && w && !w.def.melee;
    // Мұз қабырға
    if (a.items.gloo > 0 && this.glooCd <= 0 && M.time - a.lastDamageT < 0.6 && a.hp < MAX_HP * 0.6 && this.rng.chance(0.4 + this.skill * 0.4)) {
      M.useGloo(a, desiredYaw);
      this.glooCd = 6 + this.rng.float(0, 6);
      if (a.items.medkit > 0) { this.wishX = 0; this.wishZ = 0; a.crouch = true; setTimeout(() => { if (a.alive && a.healT <= 0) a.startHeal('medkit'); }, 400); }
    }
    // Граната
    if (a.items.grenade > 0 && this.nadeCd <= 0 && !this.hasLOS && dist > 10 && dist < 32 && M.time - this.lastSeenT < 4 && this.rng.chance(0.3)) {
      _d.set(dx, 0, dz).normalize();
      _d.y = 0.25 + dist / 120;
      _d.normalize();
      M.throwGrenade(a, _d);
      this.nadeCd = this.rng.float(12, 25);
    }
    if (!w) {
      // Қаруы жоқ: жақын болса ұрады, әйтпесе қашады
      if (dist < 2 && this.reactT <= 0 && a.fireCd <= 0) { _d.set(fx, 0, fz); M.combat.fire(a, _o.set(a.pos.x, a.eyeY, a.pos.z), _d); }
      if (dist > 3) { this.wishX = -fx * 0.8 + -fz * this.strafeDir; this.wishZ = -fz * 0.8 + fx * this.strafeDir; }
      return;
    }
    if (w.mag <= 0) {
      if (a.ammo[w.def.ammo] > 0) a.reload();
      return;
    }
    if (!this.hasLOS || this.reactT > 0 || a.busy) return;
    if (dist > w.def.range * 0.95) return;
    if (Math.abs(dy) > 0.25) return;
    // Атыс сериясы
    if (this.pauseT > 0) { this.pauseT -= dt; return; }
    this.burstT += dt;
    if (w.def.auto && this.burstT > 0.25 + this.skill * 0.6 + this.rng.float(0, 0.3)) { this.burstT = 0; this.pauseT = this.rng.float(0.15, 0.5) + dist / 150; return; }
    if (a.fireCd > 0) return;
    if (!w.def.auto && this.rng.next() < 0.35) return;
    const ey = a.eyeY;
    _o.set(a.pos.x, ey, a.pos.z);
    _d.set(tx - a.pos.x, ty - ey, tz - a.pos.z).normalize();
    // Қателікті қосу
    const side = new THREE.Vector3(-_d.z, 0, _d.x).normalize();
    _d.addScaledVector(side, this.aimErr.x * errBase).add(new THREE.Vector3(0, this.aimErr.y * errBase, 0)).normalize();
    a.firing = true;
    M.combat.fire(a, _o, _d);
  }
}

export function botSkill(level, rng) {
  if (level === 'easy') return rng.float(0.1, 0.4);
  if (level === 'hard') return rng.float(0.55, 0.92);
  return rng.float(0.28, 0.66);
}

void AMMO_FOR;
