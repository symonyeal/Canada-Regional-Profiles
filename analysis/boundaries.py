"""2021 cartographic boundary files (Statistics Canada), as GeoJSON from its ArcGIS REST service,
generalised by the server to a maximum offset of eps degrees."""
import json
import urllib.parse
import urllib.request
import time

from analysis.fetch import CACHE, UA

REST = "https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer/{}/query?"
LAYER = {"PR": (0, "*"), "CD": (4, "CDUID,CDNAME"), "CSD": (9, "CSDUID,CSDNAME,CSDTYPE")}   # some field lists fail server-side


def geojson(level, pruid, eps=0.005):
    """FeatureCollection of `level` units in province/territory `pruid`, lon/lat to 1e-3°."""
    p = CACHE / "boundaries" / f"{level}_{pruid}_{eps}.json"
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        k, f = LAYER[level]
        for i, fields in enumerate([f, f, "*", "*", f, "*", f, "*"]):   # the service fails intermittently
            q = urllib.parse.urlencode({"where": f"PRUID='{pruid}'", "outFields": fields, "returnGeometry": "true",
                                        "maxAllowableOffset": eps, "geometryPrecision": 3, "outSR": 4326, "f": "geojson"})
            try:
                req = urllib.request.Request(REST.format(k) + q, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=600) as r:
                    p.write_bytes(r.read())
                break
            except urllib.error.HTTPError:
                time.sleep(5 * (i + 1))
    G = json.loads(p.read_text(encoding="utf-8"))
    assert "features" in G, G
    return G


def area(R):
    """Planar shoelace area of ring R in degrees², with longitude scaled by cos φ (≈ true shape)."""
    import math
    c = math.cos(math.radians(sum(y for _, y in R) / len(R)))
    return abs(sum(c * (x1 * y2 - x2 * y1) for (x1, y1), (x2, y2) in zip(R, R[1:] + R[:1]))) / 2


def prune(G, amin):
    """Drop polygon parts of area < amin deg² (small islands), keeping each feature's largest part."""
    for f in G["features"]:
        g = f["geometry"]
        if g and g["type"] == "MultiPolygon":
            P = sorted(g["coordinates"], key=lambda p: -area(p[0]))
            g["coordinates"] = P[:1] + [p for p in P[1:] if area(p[0]) >= amin]
    return G


def generalised(level, pruid, cap=2.5e6):
    """geojson() at the finest eps in 0.005 … 0.08° whose file is below cap bytes, pruning parts
    smaller than 1e-4, 1e-3, 1e-2 deg² if generalisation alone does not reach it."""
    for eps in (0.005, 0.01, 0.02, 0.04, 0.08):
        G = geojson(level, pruid, eps)
        if len(json.dumps(G, separators=(",", ":"))) < cap: return G
    for amin in (1e-4, 1e-3, 1e-2):
        G = prune(G, amin)
        if len(json.dumps(G, separators=(",", ":"))) < cap: return G
    return G
