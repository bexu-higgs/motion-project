// Теңіз суы: толқын нормалдары, Френель шағылысы, күн жарқылы, жағалау көбігі.
import * as THREE from 'three';
import { SUN_DIR } from './sky.js';

export class Water {
  constructor(scene, normalTex, heightTex, terrainSize, detail) {
    normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 },
      uNormal: { value: null },
      uHeight: { value: null },
      uSun: { value: SUN_DIR.clone() },
      uSize: { value: terrainSize },
      uDeep: { value: new THREE.Color(0x0b4a6e) },
      uShallow: { value: new THREE.Color(0x2fa8b8) },
      uSky: { value: new THREE.Color(0xa9cbe6) },
    }]);
    this.uniforms.uNormal.value = normalTex;
    this.uniforms.uHeight.value = heightTex;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      fog: true,
      transparent: true,
      depthWrite: true,
      vertexShader: `
        #include <common>
        #include <fog_pars_vertex>
        varying vec3 vW;
        uniform float uTime;
        void main() {
          vec3 p = position;
          vec4 w = modelMatrix * vec4(p, 1.0);
          w.y += sin(w.x * 0.05 + uTime * 0.8) * 0.12 + cos(w.z * 0.04 + uTime * 0.6) * 0.1;
          vW = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <fog_pars_fragment>
        uniform float uTime, uSize;
        uniform sampler2D uNormal, uHeight;
        uniform vec3 uSun, uDeep, uShallow, uSky;
        varying vec3 vW;
        void main() {
          vec2 uv = vW.xz;
          vec3 n1 = texture2D(uNormal, uv * 0.031 + vec2(uTime * 0.012, uTime * 0.008)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(uNormal, uv * 0.017 - vec2(uTime * 0.007, -uTime * 0.011)).xyz * 2.0 - 1.0;
          ${detail ? 'vec3 n3 = texture2D(uNormal, uv * 0.11 + vec2(uTime * 0.03, 0.0)).xyz * 2.0 - 1.0;' : 'vec3 n3 = vec3(0.0, 0.0, 1.0);'}
          vec3 nn = normalize(vec3(n1.xy + n2.xy + n3.xy * 0.4, 2.6));
          vec3 N = normalize(vec3(nn.x, nn.z, nn.y));
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
          fres = mix(0.04, 1.0, fres);
          vec2 huv = (vW.xz / uSize) + 0.5;
          float th = texture2D(uHeight, huv).r * 32.0 - 16.0;
          float depth = clamp(-th, 0.0, 16.0);
          vec3 water = mix(uShallow, uDeep, smoothstep(0.3, 9.0, depth));
          vec3 R = reflect(-V, N);
          vec3 sky = mix(uSky * 0.85, uSky * 1.15, clamp(R.y, 0.0, 1.0));
          vec3 col = mix(water, sky, fres * 0.85);
          vec3 H = normalize(uSun + V);
          float spec = pow(max(dot(N, H), 0.0), 220.0) * 6.0 + pow(max(dot(N, H), 0.0), 30.0) * 0.25;
          col += vec3(1.0, 0.95, 0.85) * spec;
          // Жағалау көбігі
          float foamBand = smoothstep(1.4, 0.0, depth);
          float fn = texture2D(uNormal, uv * 0.2 + vec2(uTime * 0.05, uTime * 0.03)).r;
          float wave = sin(depth * 4.0 - uTime * 2.2) * 0.5 + 0.5;
          float foam = foamBand * smoothstep(0.35, 0.75, fn * 0.7 + wave * 0.5);
          col = mix(col, vec3(0.95, 0.98, 1.0), foam * 0.85);
          float alpha = mix(0.55, 0.96, smoothstep(0.0, 2.5, depth));
          alpha = max(alpha, foam);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    const geo = new THREE.PlaneGeometry(3000, 3000, 60, 60);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = 0;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }
  update(dt) { this.uniforms.uTime.value += dt; }
}
