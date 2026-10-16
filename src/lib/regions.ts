import data from '../regions.json';

export type SourceKey = keyof typeof data.sources;
export type RegionName = keyof typeof data.regions;
export type Box = [number, number, number, number];

export const SOURCES = data.sources as Record<SourceKey, {file: string; w: number; h: number}>;
export const REGIONS = data.regions as unknown as Record<RegionName, {src: SourceKey; box: Box}>;

export const isLandscape = (src: SourceKey) => SOURCES[src].w > SOURCES[src].h;

/** Screen units: portrait screens are 1080×2400, the landscape screen is 2400×1080. */
export const unitsPerSourcePx = (src: SourceKey) => (isLandscape(src) ? 2400 : 1080) / SOURCES[src].w;

/** A region's box converted to screen units of the screen it lives on. */
export const regionBox = (name: RegionName, pad = 0): Box => {
  const r = REGIONS[name];
  const k = unitsPerSourcePx(r.src);
  const [x, y, w, h] = r.box;
  return [x * k - pad, y * k - pad, w * k + pad * 2, h * k + pad * 2];
};

export const boxCenter = (b: Box): [number, number] => [b[0] + b[2] / 2, b[1] + b[3] / 2];
