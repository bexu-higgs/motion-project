#!/usr/bin/env python3
"""Fetch current administrative borders from OpenStreetMap (Overpass API)
and write scene/data/osm-geo.json for the map sequence.

What it collects (all © OpenStreetMap contributors, ODbL):
  * all 20 first-level units of Kazakhstan (17 oblasts incl. the 2022 ones,
    plus Almaty, Astana, Shymkent cities) - faint context lines;
  * Almaty oblast (rel 215718) - highlighted region;
  * Kegen district (rel 9159398, created 2018) - highlighted district;
  * Kegen settlement outline (way 38804393) and its place node;
  * main roads and rivers inside the district, streets/buildings in the village.

Pure standard library, so it runs anywhere with Python 3.8+.

Usage:
    python3 tools/fetch_osm_geo.py [--cache DIR]
"""
import argparse
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "scene", "data", "osm-geo.json")

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
UA = "motion-project-intro/1.0 (personal intro video map)"

ALMATY_OBLAST = 215718
KEGEN_DISTRICT = 9159398
KEGEN_OUTLINE_WAY = 38804393
KEGEN_PLACE_NODE = 243723775


def overpass(query, cache_dir, name):
    path = os.path.join(cache_dir, name + ".json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    body = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for attempt in range(4):
        for ep in ENDPOINTS:
            try:
                req = urllib.request.Request(ep, data=body, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=180) as r:
                    raw = r.read()
                data = json.loads(raw)
                if "elements" not in data:
                    raise ValueError("no elements")
                with open(path, "wb") as f:
                    f.write(raw)
                print(f"  {name}: {len(data['elements'])} elements from {ep}", file=sys.stderr)
                return data
            except Exception as e:  # busy servers answer 429/504 or HTML errors
                last = e
                print(f"  {name}: {ep} failed: {str(e)[:90]}", file=sys.stderr)
        time.sleep(10 * (attempt + 1))
    raise RuntimeError(f"overpass query {name} failed: {last}")


# --- geometry helpers -------------------------------------------------------

def stitch(ways):
    """Join way polylines that share end nodes into closed rings."""
    segs = [list(w) for w in ways if len(w) > 1]
    rings = []
    while segs:
        ring = segs.pop()
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += s[-2::-1]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = s[:0:-1] + ring
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if len(ring) > 3:
            rings.append(ring)
    return rings


def simplify(points, tol):
    """Douglas-Peucker in degrees (longitude scaled by cos(lat))."""
    if len(points) < 4 or tol <= 0:
        return points
    k = math.cos(math.radians(points[0][1]))
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a][0] * k, points[a][1]
        bx, by = points[b][0] * k, points[b][1]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i][0] * k, points[i][1]
            if L < 1e-12:  # closed ring: first and last points coincide
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, f in zip(points, keep) if f]


def rnd(points, nd):
    out = []
    for x, y in points:
        p = [round(x, nd), round(y, nd)]
        if not out or out[-1] != p:
            out.append(p)
    return out


def coords(geom):
    return [(g["lon"], g["lat"]) for g in geom]


def relation_rings(rel, tol, nd):
    outer = [coords(m["geometry"]) for m in rel.get("members", [])
             if m["type"] == "way" and m.get("role") in ("outer", "") and "geometry" in m]
    inner = [coords(m["geometry"]) for m in rel.get("members", [])
             if m["type"] == "way" and m.get("role") == "inner" and "geometry" in m]
    pack = lambda rings: [rnd(simplify(r, tol), nd) for r in stitch(rings)]
    return {"outer": pack(outer), "inner": pack(inner)}


def bbox(rings):
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    return [min(xs), min(ys), max(xs), max(ys)]


def lines_of(elements, tol, nd, keep):
    out = []
    for e in elements:
        if e["type"] != "way" or "geometry" not in e:
            continue
        cls = keep(e.get("tags", {}))
        if cls:
            out.append({"k": cls, "p": rnd(simplify(coords(e["geometry"]), tol), nd)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=os.path.join(HERE, "..", ".cache", "osm"))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)

    core = overpass(f"""[out:json][timeout:120];
        (relation({ALMATY_OBLAST}); relation({KEGEN_DISTRICT});
         way({KEGEN_OUTLINE_WAY}); node({KEGEN_PLACE_NODE}););
        out geom;""", args.cache, "core")
    by_id = {(e["type"], e["id"]): e for e in core["elements"]}

    oblast = relation_rings(by_id[("relation", ALMATY_OBLAST)], 0.002, 4)
    district = relation_rings(by_id[("relation", KEGEN_DISTRICT)], 0.0003, 5)
    village_way = by_id[("way", KEGEN_OUTLINE_WAY)]
    village = [rnd(coords(village_way["geometry"]), 5)]
    node = by_id[("node", KEGEN_PLACE_NODE)]

    regions = []
    try:
        lvl4 = overpass("""[out:json][timeout:170];
            relation["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^KZ-"];
            out geom;""", args.cache, "regions")
        for e in lvl4["elements"]:
            t = e.get("tags", {})
            r = relation_rings(e, 0.01, 3)
            regions.append({"iso": t.get("ISO3166-2", ""), "name": t.get("name", ""),
                            "outer": r["outer"]})
    except RuntimeError as e:
        print("warning: region outlines skipped:", e, file=sys.stderr)

    db = bbox(district["outer"])
    south, west, north, east = db[1], db[0], db[3], db[2]
    dfeat = overpass(f"""[out:json][timeout:120];
        (way["highway"~"^(trunk|primary|secondary|tertiary)$"]({south},{west},{north},{east});
         way["waterway"="river"]({south},{west},{north},{east}););
        out geom;""", args.cache, "district_features")

    def district_class(t):
        if t.get("waterway") == "river":
            return "river"
        return {"trunk": "major", "primary": "major", "secondary": "minor", "tertiary": "minor"}.get(t.get("highway"))

    vb = bbox(village)
    pad = 0.02
    vs, vw, vn, ve = vb[1] - pad, vb[0] - pad * 1.4, vb[3] + pad, vb[2] + pad * 1.4
    vfeat = overpass(f"""[out:json][timeout:120];
        (way["highway"]({vs},{vw},{vn},{ve});
         way["waterway"]({vs},{vw},{vn},{ve});
         way["building"]({vs},{vw},{vn},{ve}););
        out geom;""", args.cache, "village_features")

    def village_class(t):
        if "building" in t:
            return "building"
        if "waterway" in t:
            return "water"
        hw = t.get("highway")
        if hw in ("trunk", "primary", "secondary", "tertiary"):
            return "major"
        if hw in ("residential", "unclassified", "living_street", "service", "road"):
            return "street"
        return None

    data = {
        "source": "© OpenStreetMap contributors (ODbL)",
        "regions": regions,
        "almatyOblast": oblast,
        "kegenDistrict": district,
        "kegenVillage": {"outer": village, "place": [node["lon"], node["lat"]]},
        "districtLines": lines_of(dfeat["elements"], 0.0003, 5, district_class),
        "villageLines": lines_of(vfeat["elements"], 0.00002, 5, village_class),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    count = lambda rs: sum(len(r) for r in rs)
    print(f"wrote {OUT} ({os.path.getsize(OUT) // 1024} KiB): regions={len(regions)} "
          f"oblast pts={count(oblast['outer'])} district pts={count(district['outer'])} "
          f"village pts={count(village)} districtLines={len(data['districtLines'])} "
          f"villageLines={len(data['villageLines'])}")


if __name__ == "__main__":
    main()
