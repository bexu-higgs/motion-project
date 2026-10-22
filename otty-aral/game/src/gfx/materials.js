// Ортақ материалдар кітапханасы.
import * as THREE from 'three';

export const MAT_TILE = {
  plaster: 2.5, brick: 2.2, concrete: 3, wood: 2.2, crate: 1.2, metal: 3, paint: 2, roof: 2.5,
  felt: 2.2, ornament: 1, kerege: 1.6, uyk: 1, carpet: 1, stone: 3, burlap: 1, hay: 1.5, camo: 2, fabric: 1, asphalt: 6,
  rock: 4, dirt: 4, bark: 1.2, birch: 1.5, glass: 1,
};

export function makeMaterials(tex) {
  const M = {};
  const std = (name, o = {}) => {
    const t = tex[o.tex || name] || {};
    const m = new THREE.MeshStandardMaterial({
      map: t.map || null,
      normalMap: o.noNormal ? null : (t.normal || null),
      roughness: o.roughness ?? 0.85,
      metalness: o.metalness ?? 0,
      vertexColors: o.vertexColors ?? true,
      color: o.color ?? 0xffffff,
      side: o.side ?? THREE.FrontSide,
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      envMapIntensity: o.env ?? 1,
      alphaTest: o.alphaTest ?? 0,
      depthWrite: o.depthWrite ?? true,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 1,
    });
    if (m.normalMap) m.normalScale.set(o.ns ?? 1, o.ns ?? 1);
    m.name = name;
    M[o.key || name] = m;
    return m;
  };
  std('plaster', { roughness: 0.92 });
  std('brick', { roughness: 0.9 });
  std('concrete', { roughness: 0.95 });
  std('wood', { roughness: 0.8 });
  std('crate', { roughness: 0.8 });
  std('metal', { roughness: 0.55, metalness: 0.45 });
  std('paint', { roughness: 0.5, metalness: 0.25 });
  std('roof', { roughness: 0.82 });
  std('felt', { roughness: 0.97 });
  std('ornament', { roughness: 0.9, noNormal: true });
  std('kerege', { roughness: 0.95, side: THREE.DoubleSide });
  std('uyk', { roughness: 0.9, side: THREE.DoubleSide });
  std('carpet', { roughness: 0.98, noNormal: true });
  std('stone', { roughness: 0.92 });
  std('burlap', { roughness: 0.97 });
  std('hay', { roughness: 0.95 });
  std('camo', { roughness: 0.9 });
  std('fabric', { roughness: 0.9, side: THREE.DoubleSide });
  std('asphalt', { roughness: 0.93 });
  std('rock', { roughness: 0.9, ns: 1.2 });
  std('dirt', { roughness: 0.96 });
  std('bark', { roughness: 0.95 });
  std('birch', { roughness: 0.85 });
  std('leaves', { roughness: 0.85, ns: 0.6 });
  std('flat', { tex: '_none', roughness: 0.75 });
  std('flatMetal', { tex: '_none', roughness: 0.35, metalness: 0.85, key: 'flatMetal' });
  std('gold', { tex: '_none', roughness: 0.22, metalness: 1, color: 0xffffff, key: 'gold', env: 1.6 });
  std('glass', { roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.45, depthWrite: false, noNormal: true, env: 1.5 });
  std('lamp', { tex: '_none', roughness: 0.4, emissive: 0xfff2c0, emissiveIntensity: 2.5, key: 'lamp' });
  std('emissiveRed', { tex: '_none', roughness: 0.4, emissive: 0xff2020, emissiveIntensity: 3, key: 'emissiveRed' });
  return M;
}
