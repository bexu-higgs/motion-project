// Аспан күмбезі (градиент + күн + бұлттар), жарық және тұман.
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(-0.45, 0.62, -0.38).normalize();
export const FOG_COLOR = new THREE.Color(0xb9d3e6);

const skyVert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w * 0.99999;
}`;

const skyFrag = (oct) => `
uniform vec3 uSun; uniform float uTime;
uniform vec3 uZenith, uHorizon, uGround, uSunCol;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < ${oct}; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(max(h, 0.0), 0.55));
  col = mix(col, uGround, smoothstep(0.0, -0.25, h));
  float sd = max(dot(d, uSun), 0.0);
  col += uSunCol * (pow(sd, 6.0) * 0.25 + pow(sd, 64.0) * 0.6);
  col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, sd) * 4.0;
  // Бұлттар
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 1.3 + vec2(uTime * 0.004, uTime * 0.002);
    float c = fbm(uv * 1.4);
    float cov = smoothstep(0.48, 0.82, c);
    float shade = fbm(uv * 1.4 + vec2(0.06, 0.04));
    vec3 cc = mix(vec3(1.0), vec3(0.72, 0.76, 0.84), smoothstep(0.4, 0.9, shade));
    cc += uSunCol * pow(sd, 8.0) * 0.4;
    col = mix(col, cc, cov * smoothstep(0.0, 0.18, h) * 0.92);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor(scene, quality) {
    this.uniforms = {
      uSun: { value: SUN_DIR.clone() },
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color(0x3d7fd1) },
      uHorizon: { value: new THREE.Color(0xc6dcec) },
      uGround: { value: new THREE.Color(0x9fb3c0) },
      uSunCol: { value: new THREE.Color(0xffe2b0) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: skyVert,
      fragmentShader: skyFrag(quality.cloudOct),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);

    scene.fog = new THREE.Fog(FOG_COLOR, 60, quality.draw);
    scene.background = FOG_COLOR;

    this.hemi = new THREE.HemisphereLight(0xcfe4ff, 0x5a4a32, 1.15);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 3.1);
    this.sun.position.copy(SUN_DIR).multiplyScalar(200);
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.shadowRange = 70;
    if (quality.shadows > 0) {
      this.sun.castShadow = true;
      const s = this.sun.shadow;
      s.mapSize.set(quality.shadows, quality.shadows);
      const R = quality.shadows >= 4096 ? 90 : quality.shadows >= 2048 ? 70 : 55;
      this.shadowRange = R;
      s.camera.left = -R; s.camera.right = R; s.camera.top = R; s.camera.bottom = -R;
      s.camera.near = 10; s.camera.far = 500;
      s.bias = -0.0004;
      s.normalBias = 0.04;
      s.radius = quality.shadowSoft ? 2 : 1;
      s.camera.updateProjectionMatrix();
    }
  }

  // Көлеңке камерасы ойыншыға ілеседі (тексель бойынша тұрақтандырылған)
  follow(pos, dt) {
    this.uniforms.uTime.value += dt;
    this.mesh.position.copy(pos);
    const step = (this.shadowRange * 2) / (this.sun.shadow.mapSize.x || 1024);
    const tx = Math.round(pos.x / step) * step, tz = Math.round(pos.z / step) * step;
    this.sun.target.position.set(tx, pos.y, tz);
    this.sun.position.set(tx + SUN_DIR.x * 250, pos.y + SUN_DIR.y * 250, tz + SUN_DIR.z * 250);
  }

  // Шағылысулар үшін қоршаған орта картасы
  makeEnv(renderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    const sc = new THREE.Scene();
    const m = this.mesh.clone();
    m.position.set(0, 0, 0);
    sc.add(m);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 16), new THREE.MeshBasicMaterial({ color: 0x5f6a48 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -20;
    sc.add(ground);
    const rt = pm.fromScene(sc, 0.02, 1, 1100);
    pm.dispose();
    return rt.texture;
  }
}
