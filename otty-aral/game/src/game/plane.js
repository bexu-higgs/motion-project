// Әскери жүк ұшағы: ойыншылар осыдан секіреді. Әуе жүгін тастайтын шағын ұшақ.
import * as THREE from 'three';
import { mergeParts, mat4, roundedBox } from '../gfx/geom.js';

export function makePlaneMesh(material, scale = 1) {
  const p = [];
  const body = 0xc8ccc4, dark = 0x3a3f44, accent = 0x00afca, gold = 0xfec50c;
  // Тұлға
  const fus = new THREE.CylinderGeometry(2.2, 2.2, 22, 16);
  fus.rotateX(Math.PI / 2);
  p.push({ g: fus, m: mat4(0, 0, 0), color: body });
  const nose = new THREE.SphereGeometry(2.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  nose.rotateX(Math.PI / 2);
  p.push({ g: nose, m: mat4(0, 0, 11, 0, 0, 0, 1, 1, 1.5), color: body });
  const tail = new THREE.CylinderGeometry(2.2, 0.6, 9, 16);
  tail.rotateX(-Math.PI / 2);
  p.push({ g: tail, m: mat4(0, 0.8, -15.5), color: body });
  // Кабина терезелері
  p.push({ g: roundedBox(2.6, 0.7, 1.6, 0.2, 2), m: mat4(0, 1.3, 13.2, 0.35, 0, 0), color: 0x1a2a3a });
  // Қанаттар
  p.push({ g: new THREE.BoxGeometry(40, 0.45, 5), m: mat4(0, 1.9, 1), color: body });
  p.push({ g: new THREE.BoxGeometry(40.2, 0.47, 0.6), m: mat4(0, 1.9, -1.2), color: accent });
  // Құйрық қанаттары
  p.push({ g: new THREE.BoxGeometry(13, 0.35, 3), m: mat4(0, 1.5, -18), color: body });
  p.push({ g: new THREE.BoxGeometry(0.4, 6, 4), m: mat4(0, 4.4, -18.5, -0.2, 0, 0), color: body });
  p.push({ g: new THREE.BoxGeometry(0.45, 1.6, 2.5), m: mat4(0, 6.2, -19.2, -0.2, 0, 0), color: accent });
  p.push({ g: new THREE.SphereGeometry(0.5, 10, 8), m: mat4(0, 5.0, -18.7), color: gold });
  // Қозғалтқыштар
  for (const x of [-12, -6.5, 6.5, 12]) {
    const e = new THREE.CylinderGeometry(0.9, 0.8, 4.5, 12);
    e.rotateX(Math.PI / 2);
    p.push({ g: e, m: mat4(x, 1.2, 3.2), color: dark });
    p.push({ g: new THREE.SphereGeometry(0.5, 10, 8), m: mat4(x, 1.2, 5.6), color: 0x666666 });
  }
  // Шасси
  for (const x of [-2.2, 2.2]) p.push({ g: roundedBox(1.4, 1.4, 5, 0.4, 2), m: mat4(x, -1.6, 0), color: dark });
  // Жолақ
  const stripe = new THREE.CylinderGeometry(2.23, 2.23, 1.2, 16, 1, true);
  stripe.rotateX(Math.PI / 2);
  p.push({ g: stripe, m: mat4(0, 0, 4), color: accent });
  p.push({ g: stripe.clone(), m: mat4(0, 0, 2.6), color: gold });
  const g = mergeParts(p);
  if (scale !== 1) g.scale(scale, scale, scale);
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  // Пропеллерлер
  const props = [];
  const bladeG = mergeParts([{ g: new THREE.BoxGeometry(0.35, 4.2, 0.12), m: mat4(0, 0, 0), color: 0x222222 }, { g: new THREE.BoxGeometry(4.2, 0.35, 0.12), m: mat4(0, 0, 0), color: 0x222222 }]);
  for (const x of [-12, -6.5, 6.5, 12]) {
    const pr = new THREE.Mesh(bladeG, material);
    pr.position.set(x * scale, 1.2 * scale, 6.0 * scale);
    pr.scale.setScalar(scale);
    group.add(pr);
    props.push(pr);
  }
  group.userData.props = props;
  return group;
}

export class Plane {
  constructor(match) {
    this.match = match;
    this.group = makePlaneMesh(match.planeMat);
    this.group.visible = false;
    match.scene.add(this.group);
    this.pos = new THREE.Vector3();
    this.dir = new THREE.Vector3();
  }

  start(rng) {
    const ang = rng.float(0, Math.PI * 2);
    const off = rng.float(-140, 140);
    this.dir.set(Math.cos(ang), 0, Math.sin(ang));
    const perp = new THREE.Vector3(-this.dir.z, 0, this.dir.x);
    this.start0 = perp.clone().multiplyScalar(off).addScaledVector(this.dir, -560);
    this.start0.y = 290;
    this.pos.copy(this.start0);
    this.speed = 62;
    this.t = 0;
    this.length = 1120;
    this.group.visible = true;
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, Math.atan2(this.dir.x, this.dir.z), 0);
    this.active = true;
  }

  // Ұшақ аралдың үстінде ме (секіруге болатын аралық)
  get progress() { return this.t * this.speed / this.length; }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    this.pos.copy(this.start0).addScaledVector(this.dir, this.t * this.speed);
    this.group.position.copy(this.pos);
    this.group.position.y += Math.sin(this.t * 0.7) * 0.6;
    this.group.rotation.z = Math.sin(this.t * 0.5) * 0.03;
    for (const p of this.group.userData.props) p.rotation.z += dt * 40;
    if (this.progress > 1.05) { this.active = false; this.group.visible = false; }
  }
}

// Әуе жүгі: шағын ұшақ + парашютпен түсетін жәшік
export class Airdrop {
  constructor(match) {
    this.match = match;
    this.plane = makePlaneMesh(match.planeMat, 0.45);
    this.plane.visible = false;
    match.scene.add(this.plane);
    this.chute = match.makeChute(2.4);
    this.chute.visible = false;
    match.scene.add(this.chute);
    this.state = 'idle';
  }

  launch(tx, tz) {
    const ang = Math.random() * Math.PI * 2;
    this.dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    this.target = new THREE.Vector3(tx, 0, tz);
    this.p = this.target.clone().addScaledVector(this.dir, -600);
    this.p.y = 200;
    this.plane.visible = true;
    this.plane.rotation.y = Math.atan2(this.dir.x, this.dir.z);
    this.state = 'fly';
    this.dropped = false;
  }

  update(dt) {
    if (this.state === 'idle') return;
    if (this.plane.visible) {
      this.p.addScaledVector(this.dir, 75 * dt);
      this.plane.position.copy(this.p);
      for (const pr of this.plane.userData.props) pr.rotation.z += dt * 40;
      if (!this.dropped && this.p.distanceTo(new THREE.Vector3(this.target.x, 200, this.target.z)) < 10) {
        this.dropped = true;
        const g = this.match.world.col.groundAt(this.target.x, this.target.z, 1, 300);
        this.box = this.match.loot.airdropBox(this.target.x, 200, this.target.z);
        this.box.falling = true;
        this.groundY = g;
        this.chute.visible = true;
        this.state = 'fall';
        this.match.onAirdropDropped(this.box);
      }
      if (this.p.length() > 900) this.plane.visible = false;
    }
    if (this.state === 'fall' && this.box) {
      this.box.y -= 7 * dt;
      if (this.box.y <= this.groundY) {
        this.box.y = this.groundY;
        this.box.falling = false;
        this.chute.visible = false;
        this.state = this.plane.visible ? 'fly' : 'idle';
        this.match.onAirdropLanded(this.box);
      }
      this.box.mesh.position.set(this.box.x, this.box.y, this.box.z);
      this.chute.position.set(this.box.x, this.box.y + 1, this.box.z);
      this.chute.rotation.y += dt * 0.3;
    }
    if (this.state === 'fly' && !this.plane.visible) this.state = 'idle';
  }
}
