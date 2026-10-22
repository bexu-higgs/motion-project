// Лақтырылатын заттар: жарылғыш граната және «Мұз қабырға».
import * as THREE from 'three';
import { makeItemGeometry } from '../actors/weapons.js';
import { audio } from '../audio/audio.js';

const GLOO_HP = 850;

export class Throwables {
  constructor(match) {
    this.match = match;
    this.scene = match.scene;
    this.grenades = [];
    this.walls = [];
    this.grenGeo = makeItemGeometry('grenade');
    this.grenMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 });
    this.iceMat = new THREE.MeshStandardMaterial({
      color: 0xa8dcff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.78,
      emissive: 0x2a6aa8, emissiveIntensity: 0.35, envMapIntensity: 2.2, side: THREE.DoubleSide,
    });
    this.wallGeo = this.makeWallGeo();
  }

  // Доға тәрізді қалың мұз қабырға (шеткі кристалдарымен)
  makeWallGeo() {
    const R = 4.2, T = 0.45, H = 2.35, arc = 0.95;
    const sh = new THREE.Shape();
    const n = 18;
    for (let i = 0; i <= n; i++) { const a = -arc / 2 + arc * i / n; sh.lineTo(Math.sin(a) * (R + T / 2), Math.cos(a) * (R + T / 2)); }
    for (let i = n; i >= 0; i--) { const a = -arc / 2 + arc * i / n; sh.lineTo(Math.sin(a) * (R - T / 2), Math.cos(a) * (R - T / 2)); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.PI);
    // Беті кедір-бұдыр
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = Math.sin(p.getX(i) * 7.1 + y * 3.3) * 0.04 + Math.sin(p.getZ(i) * 5.7 + y * 2.1) * 0.03;
      p.setXYZ(i, p.getX(i) * (1 + k * 0.2), y, p.getZ(i) + k);
    }
    g.computeVertexNormals();
    const parts = [g];
    // Үстіндегі мұз шыңдары
    for (let i = 0; i < 9; i++) {
      const a = -arc / 2 + arc * (i + 0.5) / 9;
      const c = new THREE.ConeGeometry(0.22, 0.5 + (i % 3) * 0.2, 5);
      c.translate(Math.sin(a) * R, H + 0.25, Math.cos(a) * R);
      parts.push(c.toNonIndexed());
    }
    const merged = new THREE.BufferGeometry();
    const geos = [g.toNonIndexed(), ...parts.slice(1)];
    let total = 0;
    for (const x of geos) total += x.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
    let o = 0;
    for (const x of geos) {
      if (!x.attributes.normal) x.computeVertexNormals();
      pos.set(x.attributes.position.array, o * 3);
      nor.set(x.attributes.normal.array, o * 3);
      o += x.attributes.position.count;
    }
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.computeBoundingSphere();
    this.wallR = R; this.wallT = T; this.wallH = H; this.wallArc = arc;
    return merged;
  }

  clear() {
    for (const g of this.grenades) this.scene.remove(g.mesh);
    for (const w of this.walls) { this.scene.remove(w.mesh); this.match.world.col.remove(w.solid); }
    this.grenades.length = 0;
    this.walls.length = 0;
  }

  throwGrenade(actor, dir) {
    const mesh = new THREE.Mesh(this.grenGeo, this.grenMat);
    mesh.castShadow = true;
    const p = new THREE.Vector3(actor.pos.x, actor.eyeY + 0.1, actor.pos.z);
    p.addScaledVector(dir, 0.5);
    const v = dir.clone().multiplyScalar(17).add(new THREE.Vector3(0, 4.5, 0)).add(actor.vel.clone().multiplyScalar(0.5));
    mesh.position.copy(p);
    this.scene.add(mesh);
    this.grenades.push({ mesh, p, v, t: 2.6, owner: actor, rot: new THREE.Vector3() });
    actor.model.st.throwT = 0.5;
    audio.play('grenade_pin', { pos: p, volume: 0.6, ref: 4, max: 40 });
  }

  // Мұз қабырға: актердің алдында, оған қарай иілген доға
  placeGloo(actor, dirYaw, dist = 2.4) {
    const col = this.match.world.col;
    const cx = actor.pos.x - Math.sin(dirYaw) * (this.wallR - dist), cz = actor.pos.z - Math.cos(dirYaw) * (this.wallR - dist);
    // Доға центрі актердің артында, қабырға алдында
    const wx = cx + Math.sin(dirYaw) * this.wallR, wz = cz + Math.cos(dirYaw) * this.wallR;
    const gy = col.groundAt(wx, wz, 0.5, actor.pos.y + 1.0);
    const y = Math.min(gy, actor.pos.y + 0.6);
    const mesh = new THREE.Mesh(this.wallGeo, this.iceMat);
    mesh.position.set(cx, y - 0.05, cz);
    mesh.rotation.y = dirYaw;
    mesh.scale.set(1, 0.01, 1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    // Соқтығысу сақинасы: atan2(z, x) бұрышымен
    const ac = Math.atan2(Math.cos(dirYaw), Math.sin(dirYaw));
    const solid = col.addRing(cx, cz, this.wallR - this.wallT / 2, this.wallT, y - 0.2, y + this.wallH + 0.2, ac, this.wallArc / 2, 'arc', 'ice');
    const w = { mesh, solid, hp: GLOO_HP, t: 0, life: 40, owner: actor, x: wx, z: wz, y };
    solid.gloo = w;
    this.walls.push(w);
    // Ішінде қалған кейіпкерлерді итеру
    for (const a of this.match.actors) {
      if (!a.alive || a.state !== 'ground') continue;
      col.resolve(a.pos, 0.34, a.height, 0.5);
    }
    audio.play('gloo_deploy', { pos: new THREE.Vector3(wx, y + 1, wz), volume: 0.9, ref: 6, max: 120 });
    this.match.effects.iceBurst(new THREE.Vector3(wx, y, wz), 10);
    return w;
  }

  damageGloo(w, dmg) {
    if (w.hp <= 0) return;
    w.hp -= dmg;
    if (w.hp <= 0) this.breakGloo(w);
  }

  breakGloo(w) {
    w.hp = 0;
    this.scene.remove(w.mesh);
    this.match.world.col.remove(w.solid);
    this.walls.splice(this.walls.indexOf(w), 1);
    const p = new THREE.Vector3(w.x, w.y, w.z);
    this.match.effects.iceBurst(p, 40);
    audio.play('gloo_break', { pos: p, volume: 1, ref: 6, max: 150 });
  }

  update(dt) {
    const col = this.match.world.col;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.t -= dt;
      g.v.y -= 20 * dt;
      const steps = 2;
      for (let s = 0; s < steps; s++) {
        const sdt = dt / steps;
        const sp = g.v.length();
        if (sp > 0.01) {
          const d = g.v.clone().divideScalar(sp);
          const h = col.raycast(g.p.x, g.p.y, g.p.z, d.x, d.y, d.z, sp * sdt + 0.08, true);
          if (h) {
            const n = new THREE.Vector3(h.nx, h.ny, h.nz);
            g.v.reflect(n).multiplyScalar(0.4);
            g.p.set(h.x + h.nx * 0.08, h.y + h.ny * 0.08, h.z + h.nz * 0.08);
            if (sp > 3) audio.play('grenade_bounce', { pos: g.p, volume: 0.5, ref: 3, max: 40, minGap: 0.1 });
            if (h.solid && h.solid.gloo) this.damageGloo(h.solid.gloo, 0);
            continue;
          }
        }
        g.p.addScaledVector(g.v, sdt);
      }
      g.mesh.position.copy(g.p);
      g.mesh.rotation.x += g.v.length() * dt * 2;
      g.mesh.rotation.z += g.v.length() * dt;
      if (g.t <= 0) {
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
        this.match.explode(g.p, g.owner);
      }
    }
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      w.t += dt;
      const grow = Math.min(1, w.t / 0.22);
      w.mesh.scale.y = 0.05 + 0.95 * (1 - Math.pow(1 - grow, 3));
      if (w.t > w.life) { this.breakGloo(w); continue; }
      const frac = w.hp / GLOO_HP;
      w.mesh.material = this.iceMat;
      w.mesh.visible = true;
      if (frac < 0.35) w.mesh.position.y = w.y - 0.05 + Math.sin(w.t * 60) * 0.004;
    }
  }
}
