// Көліктер: «УАЗ» тәрізді жүргізуге болатын джип (аркадалық физика).
import * as THREE from 'three';
import { mergeParts, mat4, roundedBox } from '../gfx/geom.js';
import { clamp, damp, RNG } from '../core/rng.js';
import { ROADS, POIS } from '../world/map.js';
import { audio } from '../audio/audio.js';

export const VEHICLE_HP = 650;
const BODY_COLORS = [0x5a6640, 0xe8e8e2, 0x2f5f9f, 0x8a2f2a, 0x3a3f44, 0xc8a050];

function jeepGeometry(color) {
  const p = [];
  const dark = 0x1c1c1e, metal = 0x8a8e94, glass = 0x2a3a48;
  // Шасси мен шанақ
  p.push({ g: roundedBox(1.86, 0.62, 4.0, 0.12, 2), m: mat4(0, 0.82, 0), color });
  p.push({ g: roundedBox(1.8, 0.74, 2.1, 0.1, 2), m: mat4(0, 1.47, -0.45), color });
  p.push({ g: roundedBox(1.84, 0.08, 2.2, 0.04, 1), m: mat4(0, 1.87, -0.45), color: new THREE.Color(color).multiplyScalar(0.8).getHex() });
  // Капот
  p.push({ g: roundedBox(1.78, 0.18, 1.5, 0.08, 2), m: mat4(0, 1.18, 1.25, -0.06, 0, 0), color });
  // Жел әйнек жақтауы мен әйнектер
  p.push({ g: new THREE.BoxGeometry(1.7, 0.6, 0.06), m: mat4(0, 1.5, 0.62, -0.22, 0, 0), color: glass });
  for (const s of [-1, 1]) p.push({ g: new THREE.BoxGeometry(0.04, 0.5, 1.9), m: mat4(s * 0.905, 1.52, -0.45), color: glass });
  p.push({ g: new THREE.BoxGeometry(1.6, 0.46, 0.04), m: mat4(0, 1.5, -1.52), color: glass });
  for (const s of [-1, 1]) p.push({ g: new THREE.BoxGeometry(0.06, 0.68, 0.06), m: mat4(s * 0.88, 1.5, 0.64, -0.22, 0, 0), color: dark });
  // Есік жігі мен тұтқалары
  for (const s of [-1, 1]) {
    p.push({ g: new THREE.BoxGeometry(0.01, 0.5, 0.02), m: mat4(s * 0.935, 0.95, 0.15), color: dark });
    p.push({ g: new THREE.BoxGeometry(0.01, 0.5, 0.02), m: mat4(s * 0.935, 0.95, -0.95), color: dark });
    p.push({ g: new THREE.BoxGeometry(0.03, 0.04, 0.14), m: mat4(s * 0.94, 1.05, -0.1), color: metal });
  }
  // Радиатор торы, фаралар, бампер
  p.push({ g: new THREE.BoxGeometry(1.2, 0.4, 0.06), m: mat4(0, 0.95, 2.0), color: dark });
  for (let i = 0; i < 6; i++) p.push({ g: new THREE.BoxGeometry(0.04, 0.36, 0.07), m: mat4(-0.45 + i * 0.18, 0.95, 2.02), color: metal });
  for (const s of [-1, 1]) {
    p.push({ g: new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14).rotateX(Math.PI / 2), m: mat4(s * 0.72, 1.0, 2.0), color: 0xfff6d8 });
    p.push({ g: new THREE.BoxGeometry(0.14, 0.12, 0.05), m: mat4(s * 0.75, 0.88, -2.01), color: 0xc02020 });
  }
  p.push({ g: roundedBox(1.95, 0.16, 0.18, 0.05, 1), m: mat4(0, 0.6, 2.08), color: dark });
  p.push({ g: roundedBox(1.95, 0.16, 0.18, 0.05, 1), m: mat4(0, 0.6, -2.08), color: dark });
  // Артқы қосалқы дөңгелек
  p.push({ g: new THREE.CylinderGeometry(0.38, 0.38, 0.22, 16).rotateX(Math.PI / 2), m: mat4(0, 1.2, -2.18), color: dark });
  p.push({ g: new THREE.CylinderGeometry(0.2, 0.2, 0.24, 12).rotateX(Math.PI / 2), m: mat4(0, 1.2, -2.18), color: metal });
  // Қанаттар (доңғалақ үстіндегі)
  for (const sx of [-1, 1]) for (const sz of [-1.3, 1.3]) p.push({ g: roundedBox(0.3, 0.12, 1.0, 0.05, 1), m: mat4(sx * 0.9, 1.08, sz), color });
  // Руль мен орындықтар (ішінде)
  p.push({ g: new THREE.TorusGeometry(0.17, 0.025, 6, 16), m: mat4(0.42, 1.22, 0.2, -0.9, 0, 0), color: dark });
  for (const sx of [-0.42, 0.42]) {
    p.push({ g: roundedBox(0.5, 0.14, 0.5, 0.05, 1), m: mat4(sx, 0.95, -0.25), color: 0x3a2a20 });
    p.push({ g: roundedBox(0.5, 0.6, 0.12, 0.05, 1), m: mat4(sx, 1.3, -0.52, -0.1, 0, 0), color: 0x3a2a20 });
  }
  // Антенна
  p.push({ g: new THREE.CylinderGeometry(0.008, 0.008, 1.1, 4), m: mat4(0.85, 2.2, 0.55), color: dark });
  return mergeParts(p);
}

function wheelGeometry() {
  const p = [];
  const t = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18);
  t.rotateZ(Math.PI / 2);
  p.push({ g: t, m: null, color: 0x161616 });
  const h = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 10);
  h.rotateZ(Math.PI / 2);
  p.push({ g: h, m: null, color: 0x9a9a9a });
  for (let i = 0; i < 6; i++) {
    const tr = new THREE.BoxGeometry(0.31, 0.06, 0.1);
    tr.translate(0, 0.41, 0);
    tr.rotateX(i / 6 * Math.PI * 2);
    p.push({ g: tr, m: null, color: 0x222222 });
  }
  return mergeParts(p);
}

export class Vehicles {
  constructor(match) {
    this.match = match;
    this.scene = match.scene;
    this.list = [];
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 });
    this.wheelGeo = wheelGeometry();
    this.geos = BODY_COLORS.map((c) => jeepGeometry(c));
    this.spots = this.findSpots();
    for (let i = 0; i < this.spots.length; i++) this.list.push(this.make(i));
    this.reset();
  }

  findSpots() {
    const rng = new RNG(808);
    const T = this.match.world.terrain;
    const out = [];
    for (const road of ROADS) {
      for (let i = 0; i < road.length - 1 && out.length < 14; i++) {
        const [ax, az] = road[i], [bx, bz] = road[i + 1];
        const t = rng.float(0.25, 0.75);
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        let near = 1e9;
        for (const p of POIS) near = Math.min(near, Math.hypot(x - p.x, z - p.z) - p.r * 0.6);
        if (near < 0 || T.heightAt(x, z) < 2) continue;
        const len = Math.hypot(bx - ax, bz - az);
        const nx = -(bz - az) / len, nz = (bx - ax) / len;
        out.push({ x: x + nx * 4, z: z + nz * 4, yaw: Math.atan2(bx - ax, bz - az) + rng.float(-0.3, 0.3) });
      }
    }
    return out;
  }

  make(i) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.geos[i % this.geos.length], this.mat);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const wheels = [];
    for (const [x, z] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) {
      const piv = new THREE.Group();
      piv.position.set(x, 0.42, z);
      const w = new THREE.Mesh(this.wheelGeo, this.mat);
      w.castShadow = true;
      piv.add(w);
      g.add(piv);
      wheels.push({ piv, w, front: z > 0 });
    }
    this.scene.add(g);
    return { id: i, group: g, body, wheels, pos: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, speed: 0, steer: 0, vy: 0, hp: VEHICLE_HP, driver: null, solid: null, dead: false, spin: 0 };
  }

  reset() {
    const T = this.match.world;
    this.list.forEach((v, i) => {
      const s = this.spots[i];
      v.pos.set(s.x, T.col.groundAt(s.x, s.z, 1, 300), s.z);
      v.yaw = s.yaw; v.speed = 0; v.steer = 0; v.vy = 0; v.hp = VEHICLE_HP; v.driver = null; v.dead = false;
      v.group.visible = true;
      v.body.material = this.mat;
      this.place(v, 0, true);
      this.updateSolid(v, true);
    });
  }

  updateSolid(v, force = false) {
    const col = this.match.world.col;
    if (!force && v.solid && Math.hypot(v.solid.x - v.pos.x, v.solid.z - v.pos.z) < 0.15) return;
    if (v.solid) col.remove(v.solid);
    v.solid = col.addCyl(v.pos.x, v.pos.z, 1.25, v.pos.y + 0.2, v.pos.y + 1.2, 'metal', true);
    v.solid.vehicle = v;
  }

  nearest(pos, r = 3.4) {
    let best = null, bd = r;
    for (const v of this.list) {
      if (v.dead || v.driver) continue;
      const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z);
      if (d < bd && Math.abs(v.pos.y - pos.y) < 2.5) { bd = d; best = v; }
    }
    return best;
  }

  enter(actor, v) {
    if (v.driver || v.dead) return false;
    v.driver = actor;
    actor.vehicle = v;
    actor.crouch = false; actor.aiming = false;
    actor.healT = 0; actor.reloadT = 0;
    audio.play('switch', { volume: 0.5 });
    audio.play('door', { volume: 0.7 });
    if (actor.isPlayer) audio.loop('engine_loop', 0.45);
    return true;
  }

  exit(actor) {
    const v = actor.vehicle;
    if (!v) return;
    v.driver = null;
    actor.vehicle = null;
    // Сол жақ есіктің жанына түсу
    const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
    const col = this.match.world.col;
    let ex = v.pos.x + c * 1.9, ez = v.pos.z - s * 1.9;
    actor.pos.set(ex, col.groundAt(ex, ez, 0.3, v.pos.y + 2), ez);
    col.resolve(actor.pos, 0.34, 1.78, 0.5);
    actor.vel.set(v.speed * s * 0.5, 0, v.speed * c * 0.5);
    actor.onGround = true;
    audio.play('door', { volume: 0.7 });
    if (actor.isPlayer) audio.stopLoop('engine_loop', 0.5);
  }

  damage(v, dmg, attacker) {
    if (v.dead) return;
    v.hp -= dmg;
    if (v.hp <= 0) this.explode(v, attacker);
  }

  explode(v, attacker) {
    v.dead = true;
    v.hp = 0;
    const d = v.driver;
    if (d) { this.exit(d); this.match.combat.damage(d, 140, attacker, 'body', 'grenade', null); }
    v.body.material = this.burntMat || (this.burntMat = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.95 }));
    this.match.explode(v.pos.clone().add(new THREE.Vector3(0, 1, 0)), attacker);
    v.fire = this.match.effects.addEmitter({ type: 'fire', pos: v.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), rate: 18, camDist: 200 });
    setTimeout(() => { if (v.fire) { this.match.effects.removeEmitter(v.fire); v.fire = null; } }, 25000);
  }

  // Жүргізуші енгізуі: throttle (-1..1), steerIn (-1..1)
  drive(v, dt, throttle, steerIn) {
    if (v.dead) throttle = 0;
    const maxF = 24, maxR = -7;
    const ground = this.match.world.col.groundMat;
    const off = ground === 'grass' || ground === 'sand' || ground === 'dirt';
    if (throttle > 0.05) {
      if (v.speed < -0.5) v.speed += 18 * throttle * dt;
      else v.speed += (v.speed < 10 ? 9 : 5) * throttle * dt;
    } else if (throttle < -0.05) {
      if (v.speed > 0.5) v.speed += 18 * throttle * dt;
      else v.speed += 5 * throttle * dt;
    }
    v.speed = clamp(v.speed, maxR, maxF * (off ? 0.8 : 1));
    v.speed *= Math.exp(-(Math.abs(throttle) < 0.05 ? 0.7 : 0.15) * dt);
    if (Math.abs(v.speed) < 0.05 && Math.abs(throttle) < 0.05) v.speed = 0;
    v.steer = damp(v.steer, steerIn * 0.6, 7, dt);
  }

  place(v, dt, snap = false) {
    const col = this.match.world.col;
    const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
    // Төрт дөңгелектің астындағы биіктік
    const h = (lx, lz) => col.groundAt(v.pos.x + lx * c + lz * s, v.pos.z - lx * s + lz * c, 0.3, v.pos.y + 1.2);
    const fl = h(-0.9, 1.3), fr = h(0.9, 1.3), bl = h(-0.9, -1.3), br = h(0.9, -1.3);
    const g = (fl + fr + bl + br) / 4;
    const pitch = Math.atan2(((bl + br) - (fl + fr)) / 2, 2.6);
    const roll = Math.atan2(((fr + br) - (fl + bl)) / 2, 1.8);
    if (snap || v.pos.y <= g + 0.05) { v.pos.y = g; v.vy = 0; v.air = false; }
    else { v.vy -= 22 * dt; v.pos.y = Math.max(g, v.pos.y + v.vy * dt); v.air = v.pos.y > g + 0.05; }
    v.pitch = snap ? pitch : damp(v.pitch, pitch, 10, dt);
    v.roll = snap ? roll : damp(v.roll, roll, 10, dt);
    v.group.position.copy(v.pos);
    v.group.rotation.set(v.pitch, v.yaw, v.roll, 'YXZ');
    for (const w of v.wheels) {
      w.w.rotation.x += v.speed * dt / 0.42;
      if (w.front) w.piv.rotation.y = v.steer;
    }
  }

  update(dt) {
    const M = this.match, col = M.world.col;
    for (const v of this.list) {
      if (!v.group.visible) continue;
      const moving = Math.abs(v.speed) > 0.05 || v.air;
      if (!moving && !v.driver) continue;
      if (!v.driver) v.speed *= Math.exp(-2 * dt);
      // Бұрылу (жылдамдыққа тәуелді)
      v.yaw += v.steer * v.speed / 3.0 * dt;
      const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
      if (v.solid) { col.remove(v.solid); v.solid = null; }
      const before = new THREE.Vector3(v.pos.x, v.pos.y, v.pos.z);
      v.pos.x += s * v.speed * dt; v.pos.z += c * v.speed * dt;
      // Кедергілерге соғылу
      const dir = v.speed >= 0 ? 1 : -1;
      const px0 = v.pos.x + s * 1.3 * dir, pz0 = v.pos.z + c * 1.3 * dir;
      const probe = { x: px0, y: v.pos.y, z: pz0 };
      const hit1 = col.resolve(v.pos, 1.05, 1.6, 0.7);
      const hit2 = col.resolve(probe, 0.9, 1.6, 0.7);
      if (hit2) { v.pos.x += probe.x - px0; v.pos.z += probe.z - pz0; }
      void before;
      if (hit1 || hit2) {
        const impact = Math.abs(v.speed);
        if (impact > 6) {
          audio.play('crash', { pos: v.pos, volume: Math.min(1, impact / 18), ref: 6, max: 80 });
          this.damage(v, impact * 3, null);
          if (v.driver) { M.effects.shake = Math.min(1.2, M.effects.shake + impact / 25); }
        }
        v.speed *= -0.25;
      }
      // Су
      const tg = M.world.terrain.heightAt(v.pos.x, v.pos.z);
      if (tg < -1.0) { v.speed *= Math.exp(-3 * dt); if (!v.dead && (M.frame & 15) === 0) this.damage(v, 25, null); }
      const lim = 470;
      v.pos.x = clamp(v.pos.x, -lim, lim); v.pos.z = clamp(v.pos.z, -lim, lim);
      this.place(v, dt);
      this.updateSolid(v, true);
      // Жаяу жүргіншілерді қағу
      if (Math.abs(v.speed) > 5) {
        for (const a of M.actors) {
          if (!a.alive || a.vehicle || a.state !== 'ground') continue;
          const dx = a.pos.x - v.pos.x, dz = a.pos.z - v.pos.z;
          const fwd = dx * s + dz * c, side = Math.abs(dx * c - dz * s);
          if (side < 1.2 && fwd * Math.sign(v.speed) > 0 && Math.abs(fwd) < 2.8 && Math.abs(a.pos.y - v.pos.y) < 1.5) {
            M.combat.damage(a, Math.abs(v.speed) * 7, v.driver, 'body', 'vehicle', { x: a.pos.x, y: a.pos.y + 1, z: a.pos.z, nx: s, ny: 0, nz: c });
            a.vel.set(s * v.speed * 0.6, 4, c * v.speed * 0.6);
            a.onGround = false;
            v.speed *= 0.7;
          }
        }
      }
    }
    // Жүргізушінің дыбысы
    const P = M.player;
    if (P.vehicle) {
      const v = P.vehicle;
      audio.loopRate('engine_loop', 0.7 + Math.min(1.4, Math.abs(v.speed) / 14));
      audio.loopVolume('engine_loop', 0.35 + Math.min(0.35, Math.abs(v.speed) / 40), 0.1);
    }
  }
}
