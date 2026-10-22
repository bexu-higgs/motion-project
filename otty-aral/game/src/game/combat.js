// Ату, оқтың тиюі, зақым және өлтіру оқиғалары.
import * as THREE from 'three';
import { VEST_RED, HELM_RED } from '../actors/actor.js';
import { audio } from '../audio/audio.js';

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _t = new THREE.Vector3(), _m = new THREE.Vector3();

export class Combat {
  constructor(match) {
    this.match = match;
  }

  // Сәуле бойындағы ең жақын нысан: әлем / кейіпкер / мұз қабырға
  trace(o, d, maxT, ignore) {
    const W = this.match.world.col;
    const h = W.raycast(o.x, o.y, o.z, d.x, d.y, d.z, maxT, true);
    let best = h ? { t: h.t, kind: 'world', x: h.x, y: h.y, z: h.z, nx: h.nx, ny: h.ny, nz: h.nz, mat: h.mat, solid: h.solid } : null;
    let lim = best ? best.t : maxT;
    // Су беті
    if (d.y < -0.001 && o.y > 0) {
      const tw = -o.y / d.y;
      if (tw < lim && this.match.world.terrain.heightAt(o.x + d.x * tw, o.z + d.z * tw) < -0.3) {
        best = { t: tw, kind: 'world', x: o.x + d.x * tw, y: 0, z: o.z + d.z * tw, nx: 0, ny: 1, nz: 0, mat: 'water', solid: null };
        lim = tw;
      }
    }
    for (const a of this.match.actors) {
      if (a === ignore || !a.alive) continue;
      const r = a.hitTest(o, d, lim);
      if (r && r.t < lim) {
        lim = r.t;
        best = { t: r.t, kind: 'actor', actor: a, part: r.part, x: o.x + d.x * r.t, y: o.y + d.y * r.t, z: o.z + d.z * r.t, nx: -d.x, ny: -d.y, nz: -d.z };
      }
    }
    return best;
  }

  // shooter: Actor; aimO/aimD — камера немесе боттың көзі бойынша нысана сәулесі
  fire(shooter, aimO, aimD) {
    const w = shooter.weapon;
    const def = shooter.def;
    const M = this.match;
    if (def.melee) return this.melee(shooter, aimO, aimD);
    if (!w || w.mag <= 0) return false;
    w.mag--;
    shooter.fireCd = 60 / def.rpm;
    shooter.fireKick = Math.min(1, def.recoil * 12 + 0.25);
    const muzzle = shooter.model.muzzlePos(_m);
    if (shooter.camDist > 60) muzzle.set(shooter.pos.x + Math.sin(shooter.yaw) * 0.5, shooter.eyeY - 0.2, shooter.pos.z + Math.cos(shooter.yaw) * 0.5);
    // Нысана нүктесін табу (камера сәулесі)
    const pre = this.trace(aimO, aimD, def.range * 1.5, shooter);
    _t.copy(aimO).addScaledVector(aimD, pre ? pre.t : def.range);
    const pellets = def.pellets || 1;
    const near = M.camera.position.distanceTo(muzzle) < 90;
    let hitAny = false;
    for (let k = 0; k < pellets; k++) {
      _d.subVectors(_t, muzzle).normalize();
      const sp = shooter.spread + (def.pellets ? def.spreadAim * (shooter.aiming ? 1 : 1.3) : 0);
      // Кездейсоқ шашырау (конус)
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sp;
      const up = Math.abs(_d.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const s1 = new THREE.Vector3().crossVectors(_d, up).normalize();
      const s2 = new THREE.Vector3().crossVectors(s1, _d);
      _d.addScaledVector(s1, Math.cos(a) * r).addScaledVector(s2, Math.sin(a) * r).normalize();
      const h = this.trace(muzzle, _d, def.range, shooter);
      _e.copy(muzzle).addScaledVector(_d, h ? h.t : def.range);
      if (near && (k === 0 || k % 3 === 0)) M.effects.tracers.add(muzzle, _e, def.tracer, shooter.isPlayer ? 0.028 : 0.035, 380);
      if (h) {
        if (h.kind === 'actor') {
          const fall = h.t > def.falloff ? Math.max(0.55, 1 - (h.t - def.falloff) / (def.range * 1.4)) : 1;
          this.damage(h.actor, def.dmg * fall, shooter, h.part, def.id, h);
          hitAny = true;
        } else this.worldHit(h, shooter, def);
      }
      // Оқтың ысқыруы (ойыншының жанынан өтсе)
      if (!shooter.isPlayer && M.player.alive) this.whizCheck(muzzle, _d, h ? h.t : def.range, M.player);
    }
    // Эффектілер мен дыбыс
    shooter.spread += def.bloom || 0;
    shooter.firing = true;
    shooter.lastFireT = M.time;
    if (near) {
      M.effects.muzzle(muzzle, _d, def.id === 'shotgun' || def.id === 'sniper' ? 1.5 : def.id === 'pistol' ? 0.7 : 1, true);
      // Гильза
      if (def.id !== 'shotgun' || true) {
        const right = new THREE.Vector3(Math.cos(shooter.yaw) * -1, 0, Math.sin(shooter.yaw));
        const ev = right.multiplyScalar(1.5 + Math.random()).add(new THREE.Vector3(0, 2 + Math.random(), 0));
        M.effects.shells.add(muzzle.clone().addScaledVector(_d, -0.35), ev, M.world.col.groundAt(shooter.pos.x, shooter.pos.z, 0.3, shooter.pos.y + 0.3));
      }
    }
    const dist = M.camera.position.distanceTo(muzzle);
    const far = dist > 70;
    audio.play('gun_' + def.sound + (far ? '_far' : ''), { pos: muzzle, volume: shooter.isPlayer ? 0.85 : 1, ref: far ? 30 : 8, max: 600, rolloff: far ? 0.4 : 0.8, rateRand: 0.04, important: shooter.isPlayer });
    if (def.bolt && w.mag > 0) setTimeout(() => audio.play('bolt', { pos: shooter.pos, volume: 0.7, ref: 4, max: 60 }), 420);
    if (def.id === 'shotgun' && w.mag > 0) setTimeout(() => audio.play('pump', { pos: shooter.pos, volume: 0.7, ref: 4, max: 60 }), 330);
    M.onShot(shooter, muzzle);
    return hitAny;
  }

  melee(shooter, o, d) {
    shooter.fireCd = 0.45;
    shooter.model.st.throwT = 0.3;
    const h = this.trace(new THREE.Vector3(shooter.pos.x, shooter.pos.y + 1.3, shooter.pos.z), d, 1.9, shooter);
    audio.play('punch', { pos: shooter.pos, volume: 0.8, ref: 4, max: 40, rateRand: 0.1 });
    if (h && h.kind === 'actor') this.damage(h.actor, WEAPONS_FIST_DMG, shooter, 'body', 'fists', h);
    void o;
    return !!h;
  }

  worldHit(h, shooter, def) {
    const M = this.match;
    let mat = h.mat || 'concrete';
    if (h.solid && h.solid.gloo) {
      M.throwables.damageGloo(h.solid.gloo, def.dmg * (def.pellets ? 0.5 : 1));
      mat = 'ice';
    }
    if (h.solid && h.solid.vehicle) M.vehicles.damage(h.solid.vehicle, def.dmg * 0.5, shooter);
    const kind = mat === 'grass' ? 'dirt' : mat;
    const d = M.camera.position.distanceTo(_e.set(h.x, h.y, h.z));
    if (d < 120) M.effects.impact(h, kind === 'water' ? 'water' : kind, def.id === 'sniper' ? 1.4 : 1);
    if (d < 50) {
      const snd = { dirt: 'hit_dirt', sand: 'hit_dirt', concrete: 'hit_concrete', metal: 'hit_metal', wood: 'hit_wood', cloth: 'hit_cloth', ice: 'hit_ice', water: 'step_water' }[kind] || 'hit_concrete';
      audio.play(snd + (snd.startsWith('step') ? '_1' : '_' + (Math.random() < 0.5 ? 0 : 1)), { pos: h, volume: 0.6, ref: 3, max: 50, rateRand: 0.1, minGap: 0.02 });
    }
    void shooter;
  }

  whizCheck(o, d, len, p) {
    const c = _o.set(p.pos.x - o.x, p.eyeY - o.y, p.pos.z - o.z);
    const t = c.dot(d);
    if (t < 3 || t > len) return;
    const dd = c.addScaledVector(d, -t).length();
    if (dd < 1.6) {
      audio.play('whiz_' + Math.floor(Math.random() * 3), { volume: 0.7 * (1 - dd / 1.6), rateRand: 0.1, minGap: 0.05 });
      this.match.onNearMiss(o);
    }
  }

  // Зақым келтіру (сауыттың әсерімен)
  damage(target, amount, attacker, part, weapon, hit) {
    if (!target.alive) return 0;
    const M = this.match;
    let dmg = amount;
    let armorHit = false;
    if (part === 'head') {
      dmg *= weapon === 'sniper' ? 2.2 : weapon === 'shotgun' ? 1.5 : 2.0;
      if (target.helm.lvl > 0 && target.helm.dur > 0) {
        const red = HELM_RED[target.helm.lvl];
        target.helm.dur -= dmg * red;
        dmg *= 1 - red;
        armorHit = true;
        if (target.helm.dur <= 0) { target.helm.dur = 0; target.updateGear(); }
      }
    } else if (part === 'body' && weapon !== 'zone' && weapon !== 'fall') {
      if (target.vest.lvl > 0 && target.vest.dur > 0) {
        const red = VEST_RED[target.vest.lvl];
        target.vest.dur -= dmg * red;
        dmg *= 1 - red;
        armorHit = true;
        if (target.vest.dur <= 0) { target.vest.dur = 0; target.updateGear(); }
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    target.hp -= dmg;
    target.lastDamageT = M.time;
    if (attacker) { target.lastHitBy = attacker; attacker.damage += Math.min(dmg, dmg + Math.min(0, target.hp)); }
    // Эффект пен дыбыс
    if (hit) {
      const d = M.camera.position.distanceTo(_e.set(hit.x, hit.y, hit.z));
      if (d < 120) M.effects.impact(hit, armorHit ? 'armor' : 'flesh');
      if (d < 60) audio.play(armorHit ? 'hit_armor_0' : 'hit_flesh_' + (Math.random() < 0.5 ? 0 : 1), { pos: hit, volume: 0.7, ref: 4, max: 60, rateRand: 0.1 });
    }
    M.onDamage(target, dmg, attacker, part, armorHit, hit);
    if (target.hp <= 0) {
      target.hp = 0;
      M.onKill(target, attacker, weapon, part === 'head');
    }
    return dmg;
  }
}

const WEAPONS_FIST_DMG = 18;
