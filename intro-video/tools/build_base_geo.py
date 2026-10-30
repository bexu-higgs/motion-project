#!/usr/bin/env python3
"""Build scene/data/base-geo.json from Natural Earth 10m data.

Natural Earth gives the land-clipped silhouette of Kazakhstan (the OSM
country relation runs out into the Caspian), plus lakes and rivers used as
quiet map texture. Detailed administrative borders come from OpenStreetMap,
see fetch_osm_geo.py.

Usage:
    python3 tools/build_base_geo.py [natural-earth-geojson-dir]

Missing files are downloaded from the natural-earth-vector GitHub mirror.
"""
import json
import os
import sys
import urllib.request

NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/{}.geojson"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "scene", "data", "base-geo.json")

# Area that the camera can ever see: Kazakhstan plus a margin around it.
BBOX = (44.0, 37.0, 90.0, 58.0)  # lon_min, lat_min, lon_max, lat_max


def load(src_dir, name):
    path = os.path.join(src_dir, name + ".geojson")
    if not os.path.exists(path):
        print("downloading", name)
        urllib.request.urlretrieve(NE_URL.format(name), path)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def rings_of(geom):
    if geom["type"] == "Polygon":
        return geom["coordinates"]
    if geom["type"] == "MultiPolygon":
        return [r for poly in geom["coordinates"] for r in poly]
    if geom["type"] == "LineString":
        return [geom["coordinates"]]
    if geom["type"] == "MultiLineString":
        return geom["coordinates"]
    return []


def in_bbox(ring):
    lo0, la0, lo1, la1 = BBOX
    return any(lo0 <= x <= lo1 and la0 <= y <= la1 for x, y in ring[:: max(1, len(ring) // 50)])


def compact(ring, nd=3):
    out = []
    for x, y in ring:
        p = [round(x, nd), round(y, nd)]
        if not out or out[-1] != p:
            out.append(p)
    return out


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".cache", "ne")
    os.makedirs(src, exist_ok=True)

    countries = load(src, "ne_10m_admin_0_countries")
    kaz = next(f for f in countries["features"] if f["properties"]["ADM0_A3"] == "KAZ")
    # exterior rings only: Natural Earth cuts the Baikonur lease out as a hole
    g = kaz["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    kaz_rings = [compact(poly[0]) for poly in polys if len(poly[0]) > 8]

    lakes = []
    for f in load(src, "ne_10m_lakes")["features"]:
        p = f["properties"]
        if p.get("scalerank", 99) > 6:
            continue
        rings = [compact(r) for r in rings_of(f["geometry"]) if in_bbox(r)]
        if rings:
            lakes.append({"name": p.get("name") or "", "rings": rings})

    rivers = []
    for f in load(src, "ne_10m_rivers_lake_centerlines")["features"]:
        p = f["properties"]
        if p.get("scalerank", 99) > 7:
            continue
        lines = [compact(r) for r in rings_of(f["geometry"]) if in_bbox(r)]
        if lines:
            rivers.append({"name": p.get("name") or "", "lines": lines})

    data = {
        "source": "Natural Earth 10m (public domain)",
        "kaz": kaz_rings,
        "lakes": lakes,
        "rivers": rivers,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT}: {len(kaz_rings)} rings, {len(lakes)} lakes, {len(rivers)} rivers, "
          f"{os.path.getsize(OUT) // 1024} KiB")


if __name__ == "__main__":
    main()
