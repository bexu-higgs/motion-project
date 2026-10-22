// Арал картасының орналасуы: елді мекендер, жолдар.
// Координаттар: X — шығыс, Z — оңтүстік (минус Z — солтүстік). Су деңгейі y = 0.

export const MAP = {
  size: 1000,       // жер бедері торының өлшемі (м)
  islandR: 410,     // арал радиусы
  seed: 20251016,
};

// h — тегістелген биіктік; r — радиус; tier — олжа сапасы (0..2)
export const POIS = [
  { id: 'bayterek', x: 0, z: 20, r: 85, h: 8, tier: 1 },
  { id: 'factory', x: -235, z: 130, r: 72, h: 6, tier: 1 },
  { id: 'harbor', x: 250, z: 250, r: 48, h: 2.2, tier: 0, coast: true },
  { id: 'jailau', x: -60, z: -245, r: 70, h: 14, tier: 0 },
  { id: 'military', x: 225, z: -175, r: 82, h: 10, tier: 2 },
  { id: 'fortress', x: -265, z: -165, r: 52, h: 36, tier: 2 },
  { id: 'orchard', x: 105, z: 185, r: 62, h: 6, tier: 0 },
  { id: 'windfarm', x: 300, z: 25, r: 45, h: 18, tier: 0 },
  { id: 'lighthouse', x: -257, z: 282, r: 24, h: 11, tier: 1, coast: true },
];

export const poi = (id) => POIS.find((p) => p.id === id);

// Жолдар — нүктелер тізбегі
export const ROADS = [
  [[0, 20], [-120, 70], [-235, 130]],
  [[0, 20], [60, 110], [105, 185], [190, 230], [255, 255]],
  [[0, 20], [20, -90], [-60, -245]],
  [[0, 20], [120, -60], [225, -175]],
  [[0, 20], [160, 20], [300, 25]],
  [[-235, 130], [-262, 215], [-257, 282]],
  [[-60, -245], [-170, -200], [-265, -165]],
  [[225, -175], [300, 25]],
  [[-235, 130], [-250, 0], [-265, -165]],
];

export function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + dx * t - px, z = az + dz * t - pz;
  return Math.sqrt(x * x + z * z);
}

export function roadDist(x, z) {
  let d = 1e9;
  for (const r of ROADS) {
    for (let i = 0; i < r.length - 1; i++) {
      const v = distToSeg(x, z, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]);
      if (v < d) d = v;
    }
  }
  return d;
}
