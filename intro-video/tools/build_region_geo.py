#!/usr/bin/env python3
"""Offline fallback for scene/data/region-geo.json (used when osm-geo.json
from fetch_osm_geo.py is not available).

Source: geoBoundaries gbOpen KAZ ADM2 (OSM-derived, 2017 district layout).
  * Almaty oblast (2022 borders) = union of the districts that stayed in it
    after Jetisu oblast was split off - exact, since the split followed
    district lines.
  * Kegen district was cut out of the old Raiymbek district in 2018, and the
    2017 layer has no line between them. We keep the real outer border of the
    old district and fade the highlight out towards the east instead of
    inventing the internal border (fadeEast).

Usage: python3 tools/build_region_geo.py [geoboundaries-dir]
Needs: shapely
"""
import json
import os
import sys
import urllib.request

from shapely.geometry import shape, mapping
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "scene", "data", "region-geo.json")
GB = "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/KAZ/ADM2/geoBoundaries-KAZ-ADM2_simplified.geojson"

ALMATY_OBLAST_2022 = [
    "Balkhashskiy", "Enbekshikazakhskiy", "Iliyskiy", "Karasayskiy",
    "Raiymbekskiy", "Talgarskiy", "Uygurskiy", "Zhambylskiy",
]
KEGEN_PLACE = [79.2230, 43.0220]  # OSM node 243723775 (Кеген)
KEGEN_FADE_EAST = 79.62           # highlight fades out east of here


def rings(geom, tol, nd=4):
    g = geom.simplify(tol, preserve_topology=True)
    polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
    outer, inner = [], []
    for p in polys:
        outer.append([[round(x, nd), round(y, nd)] for x, y in p.exterior.coords])
        inner += [[[round(x, nd), round(y, nd)] for x, y in r.coords] for r in p.interiors]
    return {"outer": outer, "inner": inner}


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".cache", "gb")
    os.makedirs(src, exist_ok=True)
    path = os.path.join(src, "KAZ-ADM2.geojson")
    if not os.path.exists(path):
        urllib.request.urlretrieve(GB, path)
    with open(path, encoding="utf-8") as f:
        adm2 = {ft["properties"]["shapeName"]: shape(ft["geometry"]) for ft in json.load(f)["features"]}

    oblast = unary_union([adm2[n].buffer(0.002) for n in ALMATY_OBLAST_2022]).buffer(-0.002)
    old_raiymbek = adm2["Raiymbekskiy"]
    x0, y0, x1, y1 = old_raiymbek.bounds

    data = {
        "source": "geoBoundaries gbOpen KAZ ADM2 (OSM/Wambacher, 2017), CC BY 4.0 / ODbL",
        "regions": [],
        "almatyOblast": rings(oblast, 0.004),
        "kegenDistrict": dict(rings(old_raiymbek, 0.0005, 5),
                              fadeEast=KEGEN_FADE_EAST,
                              focusBox=[x0, y0, KEGEN_FADE_EAST + 0.1, y1]),
        "kegenVillage": {"outer": [], "place": KEGEN_PLACE},
        "districtLines": [],
        "villageLines": [],
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT} ({os.path.getsize(OUT) // 1024} KiB)")


if __name__ == "__main__":
    main()
