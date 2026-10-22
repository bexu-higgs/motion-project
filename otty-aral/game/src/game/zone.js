// Қауіпсіз аймақ: кезеңдер, тарылу, зақым, көк энергия қабырғасы.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';

export const PHASES = [
  { wait: 75, shrink: 45, r: 250, dps: 1.5 },
  { wait: 50, shrink: 40, r: 150, dps: 3 },
  { wait: 40, shrink: 32, r: 88, dps: 5 },
  { wait: 32, shrink: 26, r: 48, dps: 8 },
  { wait: 26, shrink: 22, r: 22, dps: 12 },
  { wait: 20, shrink: 22, r: 6, dps: 18 },
  { wait: 15, shrink: 15, r: 0, dps: 30 },
];

export class Zone {
  constructor(match) {
    this.match = match;
    this.uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x3aa0ff) }, uAlpha: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; varying vec3 vW;
        void main(){
          float h = vUv.y;
          float d = length(vW - cameraPosition);
          float fade = clamp(1.0 - d / 900.0, 0.0, 1.0);
          float wave = sin(vUv.x * 520.0 + h * 60.0 - uTime * 1.5) * 0.5 + 0.5;
          float lines = smoothstep(0.92, 1.0, sin(h * 220.0 - uTime * 3.0) * 0.5 + 0.5) * 0.35;
          float band = smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.25, 0.9, h));
          float near = smoothstep(120.0, 10.0, d);
          float glow = 0.12 + wave * 0.06 + lines * (0.4 + near);
          float base = smoothstep(0.03, 0.0, h) * 0.6;
          gl_FragColor = vec4(uColor * (glow * band + base) * fade * uAlpha, 1.0);
        }`,
    });
    this.wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128, 1, true), mat);
    this.wall.geometry.translate(0, 0.5, 0);
    this.wall.frustumCulled = false;
    this.wall.renderOrder = 7;
    match.scene.add(this.wall);
  }

  reset(seed) {
    const rng = new RNG(seed);
    this.rng = rng;
    this.phase = -1;
    this.t = 0;
    this.cx = 0; this.cz = 0; this.r = 520;
    this.from = { x: 0, z: 0, r: 520 };
    this.to = this.pickNext(0, 0, 520, PHASES[0].r);
    this.state = 'wait';
    this.phase = 0;
    this.timer = PHASES[0].wait;
    this.dps = 0.8;
  }

  pickNext(cx, cz, r, nr) {
    const T = this.match.world.terrain;
    for (let k = 0; k < 40; k++) {
      const a = this.rng.float(0, Math.PI * 2), d = Math.sqrt(this.rng.next()) * Math.max(0, r - nr) * 0.85;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.hypot(x, z) > 360 - nr * 0.5 && nr > 50) continue;
      if (T.heightAt(x, z) > 2 || k > 35) return { x, z, r: nr };
    }
    return { x: cx, z: cz, r: nr };
  }

  update(dt) {
    this.uniforms.uTime.value += dt;
    if (this.phase >= PHASES.length) return;
    this.timer -= dt;
    const P = PHASES[this.phase];
    if (this.state === 'wait') {
      if (this.timer <= 0) {
        this.state = 'shrink';
        this.timer = P.shrink;
        this.match.onZoneShrink(this.phase);
      }
    } else if (this.state === 'shrink') {
      const k = 1 - Math.max(0, this.timer) / P.shrink;
      this.cx = this.from.x + (this.to.x - this.from.x) * k;
      this.cz = this.from.z + (this.to.z - this.from.z) * k;
      this.r = this.from.r + (this.to.r - this.from.r) * k;
      if (this.timer <= 0) {
        this.dps = P.dps;
        this.phase++;
        this.from = { x: this.cx, z: this.cz, r: this.r };
        if (this.phase < PHASES.length) {
          const N = PHASES[this.phase];
          this.to = this.pickNext(this.cx, this.cz, this.r, N.r);
          this.state = 'wait';
          this.timer = N.wait;
          this.match.onZoneNext(this.phase);
        } else this.state = 'done';
      }
    }
    const r = Math.max(0.5, this.r);
    this.wall.position.set(this.cx, -20, this.cz);
    this.wall.scale.set(r, 260, r);
    // Алғашқы үлкен аймақ аралдан тыс — көрсетпейміз
    this.uniforms.uAlpha.value = r > 470 ? 0 : Math.min(1, (470 - r) / 40);
    this.wall.visible = this.uniforms.uAlpha.value > 0.01;
  }

  inside(x, z, margin = 0) { return Math.hypot(x - this.cx, z - this.cz) < this.r - margin; }
  insideNext(x, z, margin = 0) { return Math.hypot(x - this.to.x, z - this.to.z) < this.to.r - margin; }
  get damagePerSec() { return this.phase === 0 && this.state === 'wait' ? 1 : Math.max(this.dps, PHASES[Math.min(this.phase, PHASES.length - 1)].dps * 0.6); }
}
