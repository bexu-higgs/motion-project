// Арал жер бедері: биіктік картасы, текстуралық араластыру (splat) шейдері.
import * as THREE from 'three';
import { Simplex, smoothstep, clamp, lerp } from '../core/rng.js';
import { MAP, POIS, roadDist } from './map.js';

export class Terrain {
  constructor(seg = 250) {
    this.size = MAP.size;
    this.half = MAP.size / 2;
    this.seg = seg;
    this.cell = this.size / seg;
    this.noise = new Simplex(MAP.seed);
    this.noise2 = new Simplex(MAP.seed + 7);
    const n = seg + 1;
    this.h = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -this.half + i * this.cell, z = -this.half + j * this.cell;
        this.h[j * n + i] = this.rawHeight(x, z);
      }
    }
  }

  // Аналитикалық биіктік (тор түйіндері үшін)
  rawHeight(x, z) {
    const N = this.noise, N2 = this.noise2;
    const d = Math.sqrt(x * x + z * z);
    const warp = N.fbm(x / 260, z / 260, 3) * 70;
    const R = MAP.islandR + warp;
    const island = smoothstep(R + 30, R - 70, d);
    let h = 7 + N.fbm(x / 340, z / 340, 4) * 9 + N2.fbm(x / 110, z / 110, 3) * 4;
    // Солтүстік-батыс таулар
    const mx = x + 280, mz = z + 190;
    const mw = Math.exp(-(mx * mx + mz * mz) / (2 * 150 * 150));
    h += mw * (34 + N.ridged(x / 120, z / 120, 4) * 50);
    // Шығыстағы төбелер
    const hx = x - 300, hz = z - 20;
    h += Math.exp(-(hx * hx + hz * hz) / (2 * 90 * 90)) * 14;
    // Жағалау
    h = lerp(-14, h, island);
    const beach = smoothstep(0.0, 0.45, island);
    if (h > 0) h = lerp(h * 0.25 + 0.6, h, beach);
    // Елді мекендерді тегістеу
    for (const p of POIS) {
      const dx = x - p.x, dz = z - p.z;
      const dd = Math.sqrt(dx * dx + dz * dz);
      const t = smoothstep(p.r + 40, p.r, dd);
      // Жағалаудағы елді мекендер теңізді толтырмайды
      if (t > 0 && (!p.coast || h > 0.4)) h = lerp(h, p.h + N2.noise(x / 60, z / 60) * 0.25, p.coast ? Math.min(t, smoothstep(0.4, 2.5, h)) : t);
    }
    // Жолдарды тегістеу
    const rd = roadDist(x, z);
    if (rd < 9 && h > 1) {
      const t = smoothstep(9, 3, rd) * 0.5;
      h = lerp(h, h * 0.97, t);
    }
    return h;
  }

  // Үшбұрыштарға дәл сәйкес биіктік
  heightAt(x, z) {
    const n = this.seg + 1;
    let fx = (x + this.half) / this.cell, fz = (z + this.half) / this.cell;
    if (fx < 0 || fz < 0 || fx >= this.seg || fz >= this.seg) return -14;
    const i = Math.floor(fx), j = Math.floor(fz);
    fx -= i; fz -= j;
    const a = this.h[j * n + i], b = this.h[j * n + i + 1], c = this.h[(j + 1) * n + i], d = this.h[(j + 1) * n + i + 1];
    if (fx + fz <= 1) return a + (b - a) * fx + (c - a) * fz;
    return d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 1.0;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  // Ғимарат астын тегістеу (құрылыс кезінде)
  flattenRect(cx, cz, w, d, h, margin = 4) {
    const n = this.seg + 1;
    const i0 = Math.max(0, Math.floor((cx - w / 2 - margin + this.half) / this.cell));
    const i1 = Math.min(this.seg, Math.ceil((cx + w / 2 + margin + this.half) / this.cell));
    const j0 = Math.max(0, Math.floor((cz - d / 2 - margin + this.half) / this.cell));
    const j1 = Math.min(this.seg, Math.ceil((cz + d / 2 + margin + this.half) / this.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = -this.half + i * this.cell, z = -this.half + j * this.cell;
      const dx = Math.max(0, Math.abs(x - cx) - w / 2), dz = Math.max(0, Math.abs(z - cz) - d / 2);
      const dd = Math.sqrt(dx * dx + dz * dz);
      const t = smoothstep(margin, 0, dd);
      this.h[j * n + i] = lerp(this.h[j * n + i], h, t);
    }
  }

  buildMesh(tex, quality) {
    const n = this.seg + 1;
    const pos = new Float32Array(n * n * 3);
    const splat = new Float32Array(n * n * 4);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = -this.half + i * this.cell, z = -this.half + j * this.cell;
      pos[k * 3] = x; pos[k * 3 + 1] = this.h[k]; pos[k * 3 + 2] = z;
    }
    const idx = new Uint32Array(this.seg * this.seg * 6);
    let o = 0;
    for (let j = 0; j < this.seg; j++) for (let i = 0; i < this.seg; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const nor = g.attributes.normal;
    const N = this.noise2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
      const ny = nor.getY(k);
      let sand = smoothstep(3.2, 1.2, y + N.noise(x / 20, z / 20) * 0.8);
      let rock = clamp(smoothstep(0.86, 0.7, ny) + smoothstep(48, 60, y), 0, 1);
      let dirt = 0;
      for (const p of POIS) {
        const dx = x - p.x, dz = z - p.z;
        const dd = Math.sqrt(dx * dx + dz * dz);
        dirt = Math.max(dirt, smoothstep(p.r * 0.9, p.r * 0.35, dd) * (0.15 + 0.55 * clamp(N.fbm(x / 22, z / 22, 3) * 1.6 + 0.4, 0, 1)));
      }
      const rd = roadDist(x, z);
      dirt = Math.max(dirt, smoothstep(6.5, 3.0, rd + N.noise(x / 6, z / 6) * 1.2));
      dirt = Math.max(dirt, clamp(N.fbm(x / 70, z / 70, 3) - 0.35, 0, 1) * 0.8);
      rock *= 1 - sand;
      dirt *= (1 - rock) * (1 - sand);
      let grass = Math.max(0, 1 - sand - rock - dirt);
      const s = grass + dirt + sand + rock + 1e-5;
      splat[k * 4] = grass / s; splat[k * 4 + 1] = dirt / s; splat[k * 4 + 2] = sand / s; splat[k * 4 + 3] = rock / s;
    }
    g.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4));
    this.splat = splat;
    g.computeBoundingSphere();

    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, color: 0xffffff });
    const uniforms = {
      tGrass: { value: tex.grass.map }, tDirt: { value: tex.dirt.map }, tSand: { value: tex.sand.map }, tRock: { value: tex.rock.map },
      tNG: { value: tex.grass.normal || null }, tNR: { value: tex.rock.normal || null }, tND: { value: tex.dirt.normal || null },
    };
    const useNormals = !!(quality.normals && tex.grass.normal && tex.rock.normal);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aSplat;\nvarying vec4 vSplat;\nvarying vec3 vWPos;\nvarying vec3 vNW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\nvSplat = aSplat;\nvNW = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D tGrass, tDirt, tSand, tRock, tNG, tNR, tND;
varying vec4 vSplat; varying vec3 vWPos; varying vec3 vNW;
vec4 splatW;`)
        .replace('#include <map_fragment>', `
vec2 wuv = vWPos.xz;
vec4 cg = texture2D(tGrass, wuv * 0.25);
vec3 cg2 = texture2D(tGrass, wuv * 0.043 + 0.3).rgb;
vec3 grassC = mix(cg.rgb, cg2, 0.35);
vec3 dirtC = texture2D(tDirt, wuv * 0.2).rgb;
vec3 sandC = texture2D(tSand, wuv * 0.22).rgb;
vec3 rockC = texture2D(tRock, wuv * 0.12).rgb;
vec3 rockC2 = texture2D(tRock, vec2(wuv.x, vWPos.y) * 0.1).rgb;
rockC = mix(rockC, rockC2, 0.5);
vec4 hgt = vec4(dot(grassC, vec3(0.33)), dot(dirtC, vec3(0.33)), dot(sandC, vec3(0.33)), dot(rockC, vec3(0.33)));
vec4 w = vSplat * (vec4(0.5) + hgt);
float mx = max(max(w.x, w.y), max(w.z, w.w));
w = max(w - (mx - 0.18), vec4(0.0));
w /= (w.x + w.y + w.z + w.w + 1e-4);
splatW = w;
vec3 tcol = grassC * w.x + dirtC * w.y + sandC * w.z + rockC * w.w;
float macro = texture2D(tDirt, wuv * 0.004).r;
tcol *= 0.78 + macro * 0.45;
// Су жағасы маңындағы дымқыл құм
float wet = smoothstep(1.4, 0.2, vWPos.y);
tcol *= 1.0 - wet * 0.35;
diffuseColor.rgb *= tcol;`)
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
roughnessFactor = mix(roughnessFactor, 0.55, wet * 0.8);`);
      if (useNormals) {
        sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `
vec3 ng = texture2D(tNG, wuv * 0.25).xyz * 2.0 - 1.0;
vec3 nd = texture2D(tND, wuv * 0.2).xyz * 2.0 - 1.0;
vec3 nr = texture2D(tNR, wuv * 0.12).xyz * 2.0 - 1.0;
vec3 pn = ng * splatW.x + nd * splatW.y + nr * splatW.w + vec3(0.0, 0.0, 1.0) * splatW.z;
vec3 wn = normalize(vNW + vec3(pn.x, 0.0, -pn.y) * 0.9);
normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);`);
      }
    };
    mat.customProgramCacheKey = () => 'terrain' + (useNormals ? 'N' : '');
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    this.mesh = mesh;
    return mesh;
  }

  grassWeight(x, z) {
    if (!this.splat) return 1;
    const n = this.seg + 1;
    const i = Math.round((x + this.half) / this.cell), j = Math.round((z + this.half) / this.cell);
    if (i < 0 || j < 0 || i >= n || j >= n) return 0;
    return this.splat[(j * n + i) * 4];
  }

  // Су шейдері үшін биіктік текстурасы
  heightTexture(res = 256) {
    const data = new Uint8Array(res * res * 4);
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const x = -this.half + (i + 0.5) / res * this.size, z = -this.half + (j + 0.5) / res * this.size;
      const h = this.heightAt(x, z);
      const v = clamp((h + 16) / 32, 0, 1);
      const k = (j * res + i) * 4;
      data[k] = v * 255; data[k + 1] = v * 255; data[k + 2] = v * 255; data[k + 3] = 255;
    }
    const t = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }
}
