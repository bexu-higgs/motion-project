// Ойыншыны басқару: үшінші тұлғадан камера, нысанаға алу, ату, әрекеттер.
import * as THREE from 'three';
import { clamp, damp, angleDiff } from '../core/rng.js';
import { settings, isTouch, vibrate } from '../core/settings.js';
import { audio } from '../audio/audio.js';

const _dir = new THREE.Vector3(), _piv = new THREE.Vector3(), _des = new THREE.Vector3(), _o = new THREE.Vector3(), _t = new THREE.Vector3();

export class PlayerController {
  constructor(match, actor, input, camera) {
    this.m = match;
    this.a = actor;
    this.input = input;
    this.cam = camera;
    this.reset();
  }

  reset() {
    this.yaw = 0; this.pitch = -0.15;
    this.recoilP = 0; this.recoilY = 0;
    this.aimToggle = false;
    this.camPos = new THREE.Vector3();
    this.camDist = 3;
    this.fov = 70;
    this.scoped = false;
    this.firePrev = false;
    this.semiReady = true;
    this.nearItem = null;
    this.nearBox = null;
    this.camInit = false;
    this.shoulder = 1;
  }

  aimDir(out) {
    const y = this.yaw + this.recoilY, p = clamp(this.pitch + this.recoilP, -1.45, 1.45);
    return out.set(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p));
  }

  update(dt) {
    const a = this.a, M = this.m, I = this.input;
    // ---- Қарау ----
    const [lx, ly] = I.consumeLook();
    const zoom = this.scoped ? a.def.zoom : this.aiming ? Math.min(1.6, a.def.zoom || 1.3) : 1;
    const base = (isTouch ? 0.0058 : 0.0026) * settings.sens;
    const k = base * (this.aiming ? settings.aimSens / zoom : 1);
    this.yaw -= lx * k;
    this.pitch = clamp(this.pitch - ly * k, -1.35, 1.25);
    // Шегіну қалпына келу
    if (!I.fire) { this.recoilP = damp(this.recoilP, 0, 5, dt); this.recoilY = damp(this.recoilY, 0, 5, dt); }
    else { this.recoilP = damp(this.recoilP, 0, 1.4, dt); this.recoilY = damp(this.recoilY, 0, 1.4, dt); }

    if (a.state === 'plane') return this.updatePlane(dt);
    if (!a.alive) return this.updateDead(dt);

    // ---- Әрекеттер ----
    if (I.take('aim')) this.aimToggle = !this.aimToggle;
    if (I.take('crouch') && a.state === 'ground') a.crouch = !a.crouch;
    if (I.take('reload')) a.reload();
    if (I.take('slot0')) this.selectSlot(0);
    if (I.take('slot1')) this.selectSlot(1);
    if (I.take('slot2')) this.selectSlot(2);
    if (I.take('holster')) a.equip(-1);
    if (I.take('next')) this.cycle(1);
    if (I.take('prev')) this.cycle(-1);
    if (I.take('view')) this.shoulder *= -1;
    if (I.take('heal')) { if (!a.startHeal('medkit')) M.hud.toast(a.items.medkit ? M.T.hud.full : '—', 'small'); }
    if (I.take('kymyz')) a.startHeal('kymyz');
    if (I.take('gloo')) { if (a.items.gloo > 0 && a.throwCd <= 0 && a.state === 'ground') M.useGloo(a, this.yaw); }
    if (I.take('grenade')) { if (a.items.grenade > 0 && a.throwCd <= 0 && a.state === 'ground') { this.aimDir(_dir); _dir.y += 0.18; _dir.normalize(); M.throwGrenade(a, _dir); } }
    if (I.take('pickup')) this.doPickup();
    if (I.take('parachute')) a.openChute();
    const wantJump = I.take('jump');

    // ---- Қозғалыс ----
    const mx = I.moveX, my = I.moveY;
    let wl = Math.hypot(mx, my);
    let walk = I.walkKey || (isTouch && wl < 0.45);
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    // Алға = (sin, cos), оңға = (-cos, sin)
    let wx = s * my + -c * mx, wz = c * my + s * mx;
    if (wl > 1) { wx /= wl; wz /= wl; }
    if (walk && wl > 0.05) { const f = 0.5 / Math.max(0.01, Math.hypot(wx, wz)); wx *= Math.min(1, f); wz *= Math.min(1, f); }
    a.aiming = this.aiming && a.state === 'ground';
    a.yaw = this.yaw;
    a.pitch = this.pitch + this.recoilP;
    a.physics(dt, wx, wz, wantJump);

    // ---- Ату ----
    const def = a.def;
    a.firing = false;
    if (I.fire && a.state === 'ground') {
      if (!this.firePrev) this.semiReady = true;
      const w = a.weapon;
      if (a.healT > 0) { /* емделу кезінде атуға болмайды */ }
      else if (w && w.mag <= 0 && !def.melee) {
        if (!a.reload() && !this.firePrev) { audio.play('dry', { volume: 0.6 }); M.hud.toast(M.T.hud.noAmmo, 'warn'); }
      } else if (a.fireCd <= 0 && !a.busy && (def.auto || this.semiReady || isTouch)) {
        this.semiReady = false;
        this.shoot(dt);
      }
      a.firing = true;
      this.aimAssist(dt);
    }
    this.firePrev = I.fire;

    // ---- Жақын олжа ----
    this.scanLoot();
  }

  get aiming() { return (this.aimToggle || this.input.aimHold) && this.a.alive && this.a.state === 'ground' && !this.a.def.melee; }

  selectSlot(i) {
    const a = this.a;
    if (a.weapons[i]) a.equip(a.cur === i ? -1 : i);
  }

  cycle(d) {
    const a = this.a;
    const order = [-1, 0, 1, 2];
    let i = order.indexOf(a.cur);
    for (let k = 0; k < 4; k++) {
      i = (i + d + 4) % 4;
      const s = order[i];
      if (s === -1 || a.weapons[s]) { a.equip(s); return; }
    }
  }

  shoot() {
    const a = this.a, M = this.m;
    const def = a.def;
    this.aimDir(_dir);
    const camO = _o.copy(this.cam.position);
    // Камерадан ойыншының алдына дейінгі бөлікті өткізіп жібереміз
    const skip = Math.max(0, _t.subVectors(a.pos, camO).dot(_dir) - 0.5);
    camO.addScaledVector(_dir, Math.min(skip, 6));
    const hit = M.combat.fire(a, camO, _dir);
    if (!def.melee) {
      const r = def.recoil * (this.aiming ? 0.75 : 1) * (a.crouch ? 0.8 : 1);
      this.recoilP += r * (0.65 + Math.random() * 0.35);
      this.recoilY += (Math.random() - 0.5) * r * 0.7;
      vibrate(def.id === 'sniper' || def.id === 'shotgun' ? 35 : 10);
      M.effects.shake = Math.min(1, M.effects.shake + def.recoil * 3);
    }
    void hit;
  }

  // Нысанаға жеңіл көмек (сенсорлы экранда)
  aimAssist(dt) {
    if (!settings.aimAssist || !isTouch) return;
    const a = this.a, M = this.m;
    const dir = this.aimDir(_dir);
    let best = null, bs = 0.09;
    for (const o of M.actors) {
      if (o === a || !o.alive || o.state !== 'ground') continue;
      _t.set(o.pos.x - this.cam.position.x, o.pos.y + 1.15 - this.cam.position.y, o.pos.z - this.cam.position.z);
      const d = _t.length();
      if (d > a.def.range || d < 1) continue;
      _t.divideScalar(d);
      const ang = Math.acos(clamp(_t.dot(dir), -1, 1));
      const lim = 0.09 * Math.min(1, 25 / d + 0.3);
      if (ang < lim && ang < bs) { bs = ang; best = o; }
    }
    if (!best) return;
    const ty = Math.atan2(best.pos.x - this.cam.position.x, best.pos.z - this.cam.position.z);
    const tp = Math.atan2(best.pos.y + 1.15 - this.cam.position.y, Math.hypot(best.pos.x - this.cam.position.x, best.pos.z - this.cam.position.z));
    const s = 3.5 * dt;
    this.yaw += angleDiff(this.yaw, ty) * s;
    this.pitch += (tp - this.pitch) * s * 0.6;
  }

  scanLoot() {
    const a = this.a, M = this.m;
    this.nearItem = null; this.nearBox = null;
    if (a.state !== 'ground') return;
    // Автоматты алу (оқ, сауыт, дәрі)
    const auto = M.loot.nearest(a.pos.x, a.pos.y, a.pos.z, 1.5, (it) => it.type.indexOf('ammo') === 0 || it.type === 'medkit' || it.type === 'kymyz' || it.type === 'gloo' || it.type === 'grenade' || it.type.indexOf('vest') === 0 || it.type.indexOf('helm') === 0);
    if (auto && a.pickup(auto.type, auto.amount, true)) { M.onPickup(a, auto); M.loot.remove(auto); }
    const w = M.loot.nearest(a.pos.x, a.pos.y, a.pos.z, 1.9, (it) => it.type in M.weaponDefs);
    this.nearItem = w;
    const box = M.loot.nearestBox(a.pos.x, a.pos.y, a.pos.z, 2.2);
    if (box) {
      this.nearBox = box;
      if (!box.autoOpened) { box.autoOpened = true; M.loot.openBox(box, a); M.onPickup(a, { type: 'medkit', box: true }); }
    }
  }

  doPickup() {
    const a = this.a, M = this.m;
    if (this.nearItem) { M.actorPickup(a, this.nearItem); this.nearItem = null; return; }
    if (this.nearBox) M.loot.openBox(this.nearBox, a);
  }

  updatePlane(dt) {
    const M = this.m, I = this.input;
    if (I.take('jump') || I.take('parachute')) M.jumpFromPlane(this.a);
    I.take('aim'); I.take('crouch');
    void dt;
  }

  updateDead(dt) { void dt; }

  // ---- Камера ----
  updateCamera(dt) {
    const a = this.a, M = this.m, cam = this.cam;
    const def = a.def;
    let targetFov = 70, dist = 3.0, height = 1.74, side = 0.68 * this.shoulder;
    this.scoped = false;
    if (a.state === 'plane') {
      const p = M.plane.pos;
      _piv.set(p.x, p.y + 2, p.z);
      dist = 32; side = 0; targetFov = 65;
    } else {
      const ey = a.visualY;
      if (a.state === 'fall') { dist = 5.5; height = 1.2; side = 0; targetFov = 78; }
      else if (a.state === 'chute') { dist = 6.5; height = 2.2; side = 0; targetFov = 72; }
      else if (!a.alive) { dist = 5; height = 1.8; side = 0; }
      else if (this.aiming) {
        if (def.scope) { this.scoped = true; dist = 0; side = 0; height = a.crouch ? 1.12 : 1.6; targetFov = 70 / def.zoom; }
        else { dist = 1.75; side = 0.78 * this.shoulder; targetFov = 70 / Math.min(1.6, def.zoom || 1.3); height = a.crouch ? 1.28 : 1.7; }
      } else if (a.crouch) { height = 1.3; dist = 2.7; }
      const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
      _piv.set(a.pos.x + rx * side, ey + height, a.pos.z + rz * side);
    }
    this.aimDir(_dir);
    this.camDist = damp(this.camDist, dist, 12, dt);
    _des.copy(_piv).addScaledVector(_dir, -this.camDist);
    // Камера соқтығысуы
    if (this.camDist > 0.3 && a.state !== 'plane') {
      const back = _t.subVectors(_des, _piv);
      const L = back.length();
      back.divideScalar(L || 1);
      const h = M.world.col.raycast(_piv.x, _piv.y, _piv.z, back.x, back.y, back.z, L + 0.25, true);
      if (h) _des.copy(_piv).addScaledVector(back, Math.max(0.2, h.t - 0.25));
      // Судың астына түспеу
      if (_des.y < 0.3 && M.world.terrain.heightAt(_des.x, _des.z) < 0) _des.y = 0.3;
    }
    if (!this.camInit) { this.camPos.copy(_des); this.camInit = true; }
    this.camPos.lerp(_des, 1 - Math.exp(-dt * (this.scoped ? 60 : 30)));
    cam.position.copy(this.camPos);
    // Дірілі
    const sh = M.effects.shake;
    const sy = this.yaw + Math.PI + this.recoilY + (sh ? (Math.random() - 0.5) * sh * 0.012 : 0);
    const sp = clamp(this.pitch + this.recoilP, -1.45, 1.45) + (sh ? (Math.random() - 0.5) * sh * 0.012 : 0);
    cam.rotation.set(sp, sy, 0, 'YXZ');
    this.fov = damp(this.fov, targetFov, 14, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    a.obj.visible = !this.scoped || !a.alive;
  }
}
