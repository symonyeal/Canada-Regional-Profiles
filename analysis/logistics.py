"""Logistics and access layers of one province or territory: boundary, roads, rail, airports,
ports, and broadband availability per household."""
import io
import json
import zipfile
from functools import cache
from itertools import pairwise

import numpy as np
import pandas as pd
import shapefile
from scipy.spatial import cKDTree

from analysis.fetch import get
from analysis.geo import ATLAS, inside, lcc_forward, lcc_inverse
from analysis.regions import PT

ROADS = ["Multi-lane Highway", "Principal Highway", "Secondary Highway", "Major Road", "Winter Road"]
RAIL = ["Mainline", "Collector/Primary Feeder", "Spur"]


def shp(name, stem):
    """pyshp Reader over member `stem` of the cached zip `name`."""
    z = zipfile.ZipFile(get(name))
    f = {x: io.BytesIO(z.read(f"{stem}.{x}")) for x in ("shp", "shx", "dbf")}
    return shapefile.Reader(**f)


def cross(a, b):
    """Planar cross product a × b = a₁b₂ − a₂b₁, broadcast over rows."""
    return a[..., 0] * b[..., 1] - a[..., 1] * b[..., 0]


def dp(V, eps):
    """Douglas–Peucker (1973): indices of the vertices of polyline V (m×2) kept at tolerance eps.
    O(m²) worst case, O(m log m) typical."""
    keep, S = {0, len(V) - 1}, [(0, len(V) - 1)]
    while S:
        i, j = S.pop()
        if j <= i + 1: continue
        d, U = V[j] - V[i], V[i + 1:j] - V[i]
        l = np.hypot(*d)
        h = np.abs(cross(d, U)) / l if l > 0 else np.hypot(*U.T)   # distance to chord; closed ring: to V_i
        k = i + 1 + int(np.argmax(h))
        if h[k - i - 1] > eps: keep.add(k); S += [(i, k), (k, j)]
    return sorted(keep)


def latlon(V):
    """Atlas Lambert (m) → (lat, lon), rounded to 1e-3° (≈ 100 m)."""
    phi, lam = lcc_inverse(V[:, 0], V[:, 1], **ATLAS)
    return np.round(phi, 3), np.round(lam, 3)


@cache
def boundaries():
    """{name: rings (projected)} for each Canadian province and territory, all parts."""
    r, B = shp("bounds", "AC_1M_BoundaryPolygons_shp/AC_1M_BoundaryPolygons"), {}
    for s, rec in zip(r.iterShapes(), r.iterRecords()):
        if rec["COUNTRY"] != "Canada": continue
        P = np.array(s.points); I = list(s.parts) + [len(P)]
        B.setdefault(rec["POL_DIV"], []).extend(P[a:b] for a, b in pairwise(I))
    return B


def locate(phi, lam):
    """Jurisdiction code of each point: the region containing it, else (a point in the water)
    the region with the nearest boundary vertex."""
    B, X = boundaries(), np.c_[lcc_forward(phi, lam, **ATLAS)]
    c = np.full(len(X), "", dtype=object)
    for k, _, n in PT:
        c[(c == "") & inside(X, B[n])] = k
    T, L = nearest_vertex()
    J = np.flatnonzero(c == "")
    c[J] = L[T.query(X[J])[1]]
    return c


@cache
def nearest_vertex():
    """k-d tree on all boundary vertices (projected), labelled by jurisdiction code."""
    B = boundaries()
    return cKDTree(np.vstack([np.vstack(B[n]) for _, _, n in PT])), np.array(
        [k for k, _, n in PT for V in B[n] for _ in range(len(V))])


def outline(name, amin=2e8, eps=2000):
    """Boundary rings of area ≥ amin m² (shoelace), simplified at eps m; Plotly None-separated."""
    y, x = [], []
    for V in boundaries()[name]:
        if abs(cross(V, np.roll(V, -1, 0)).sum()) / 2 < amin: continue
        a, b = latlon(V[dp(V, eps)]); y += [*a, None]; x += [*b, None]
    return {"lat": y, "lon": x}


@cache
def parts(name, stem, field):
    """Every polyline part of a layer: (class, vertices), and the middle vertex of each part."""
    r, Q = shp(name, stem), []
    for s, rec in zip(r.iterShapes(), r.iterRecords()):
        P = np.array(s.points); I = list(s.parts) + [len(P)]
        Q += [(rec[field], P[a:b]) for a, b in pairwise(I)]
    return Q, np.array([V[len(V) // 2] for _, V in Q])


def lines(name, stem, field, keep, R, eps=500):
    """Polylines of class ∈ keep whose middle vertex lies in region R; {class: {lat, lon, km}}."""
    Q, M = parts(name, stem, field)
    out = {k: {"lat": [], "lon": [], "km": 0.0} for k in keep}
    for i in np.flatnonzero(inside(M, R)):
        k, V = Q[i]
        if k not in out: continue
        o = out[k]
        o["km"] += np.hypot(*np.diff(V, axis=0).T).sum() / 1e3
        y, x = latlon(V[dp(V, eps)]); o["lat"] += [*y, None]; o["lon"] += [*x, None]
    return {k: v | {"km": round(v["km"])} for k, v in out.items() if v["km"]}


def airports(code):
    """Airports with scheduled passenger service (OurAirports)."""
    A = pd.read_csv(get("airports"), keep_default_na=False)
    A = A[(A.iso_region == "CA-" + code) & (A.scheduled_service == "yes")]
    return {"name": A.name.tolist(), "iata": A.iata_code.tolist(), "city": A.municipality.tolist(),
            "lat": A.latitude_deg.round(3).tolist(), "lon": A.longitude_deg.round(3).tolist()}


@cache
def all_ports():
    """World Port Index (Canada) ∪ DFO small craft harbours, each labelled with its jurisdiction."""
    W = pd.read_csv(get("wpi"), encoding="utf-8-sig")
    W = W[W["Country Code"] == "Canada"]
    W = pd.DataFrame({"name": W["Main Port Name"], "kind": "Port, " + W["Harbor Size"].fillna("size n/a").str.lower(),
                      "lat": W.Latitude, "lon": W.Longitude})
    H = pd.DataFrame([f["attributes"] for k in ("sch0", "sch1", "sch2")
                      for f in json.loads(get(k).read_text(encoding="utf-8"))["features"]])
    H = pd.DataFrame({"name": H.Harbour_Name, "kind": "Small craft harbour, " + H.Harbour_Type.str.lower(),
                      "lat": H.Latitude, "lon": H.Longitude})
    P = pd.concat([W, H], ignore_index=True).dropna(subset=["lat", "lon"])
    P["pt"] = locate(P.lat.values, P.lon.values)
    return P


def ports(code):
    P = all_ports(); P = P[P.pt == code]
    return {"name": P.name.tolist(), "kind": P.kind.tolist(), "lat": P.lat.round(3).tolist(), "lon": P.lon.round(3).tolist()}


def broadband(code):
    """Share of households (dwellings occupied by usual residents, PHH 2021) where 50/10 Mbps
    is available over any wired or wireless technology (ISED NBD, current), by census
    division and by hexagon (≈ 25 km²)."""
    with zipfile.ZipFile(get("phh")) as z:
        P = pd.read_csv(z.open(f"PHH_2021_CSV/PHH-{code}.csv"), encoding="utf-8-sig",
                        usecols=["PHH_ID", "URDwell2021_RH2021", "DBUID_Ididu", "HEXUID_IdUHEX", "Latitude", "Longitude"])
    with zipfile.ZipFile(get("nbd")) as z:
        N = pd.read_csv(z.open(f"PHH_Speeds_Current-PHH_Vitesses_Actuelles_{code}.csv"),
                        usecols=["PHH_ID", "Combined_50_10_Combine", "Avail_LTE_Mobile_Dispo"])
    D = P.merge(N, on="PHH_ID", how="left").fillna({"Combined_50_10_Combine": 0, "Avail_LTE_Mobile_Dispo": 0})
    D = D[D.URDwell2021_RH2021 > 0]
    w = D.URDwell2021_RH2021
    D = D.assign(w=w, w50=w * D.Combined_50_10_Combine, wlte=w * D.Avail_LTE_Mobile_Dispo,
                 wy=w * D.Latitude, wx=w * D.Longitude, cd=D.DBUID_Ididu.astype(str).str[:4])
    H = D.groupby("HEXUID_IdUHEX", dropna=False)[["w", "w50", "wy", "wx"]].sum()
    C = D.groupby("cd")[["w", "w50", "wlte"]].sum()
    assert np.isclose(C.w.sum(), D.w.sum()) and np.isclose(H.w.sum(), D.w.sum())  # partitions of one total
    return {"households": round(D.w.sum()), "share50": D.w50.sum() / D.w.sum(), "shareLTE": D.wlte.sum() / D.w.sum(),
            "cd": {"id": C.index.tolist(), "households": C.w.round().astype(int).tolist(),
                   "share50": (C.w50 / C.w).round(3).tolist()},
            "hex": {"lat": (H.wy / H.w).round(3).tolist(), "lon": (H.wx / H.w).round(3).tolist(),
                    "households": H.w.round(1).tolist(), "share50": (H.w50 / H.w).round(3).tolist()}}


def logistics(code, name):
    R = boundaries()[name]
    return {"outline": outline(name),
            "roads": lines("roads", "AC_1M_Roads_shp/AC_1M_Roads", "CARTO", ROADS, R),
            "rail": lines("rail", "AC_1M_Railways_shp/AC_1M_Railways", "TYPE", RAIL, R),
            "airports": airports(code), "ports": ports(code), "broadband": broadband(code)}
