"""Canadian Climate Normals (ECCC, api.weather.gc.ca, collection climate-normals): monthly means at the
station nearest a point among stations with all twelve months of mean temperature and precipitation."""
import json
import urllib.parse
import urllib.request
from functools import cache

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

from analysis.fetch import CACHE, UA

API = "https://api.weather.gc.ca/collections/climate-normals/items?"
ELEMENT = {1: "mean", 5: "max", 8: "min", 52: "rain", 54: "snow", 56: "precip"}
PROV = {"10": "NL", "11": "PE", "12": "NS", "13": "NB", "24": "QC", "35": "ON", "46": "MB", "47": "SK", "48": "AB",
        "59": "BC", "60": "YT", "61": "NT", "62": "NU"}


@cache
def normals(pruid):
    """Long table: station, lat, lon, element, month (1-12), value."""
    rows = []
    for k, e in ELEMENT.items():
        p = CACHE / "climate" / f"{PROV[pruid]}_{k}.json"
        if not p.exists():
            p.parent.mkdir(parents=True, exist_ok=True)
            q = urllib.parse.urlencode({"f": "json", "limit": 10000, "PROVINCE_CODE": PROV[pruid], "NORMAL_ID": k,
                                        "properties": "STN_ID,STATION_NAME,MONTH,VALUE"})
            with urllib.request.urlopen(urllib.request.Request(API + q, headers={"User-Agent": UA}), timeout=600) as r:
                p.write_bytes(r.read())
        for f in json.loads(p.read_text(encoding="utf-8"))["features"]:
            a, (x, y) = f["properties"], f["geometry"]["coordinates"]
            rows.append((a["STN_ID"], a["STATION_NAME"], y, x, e, a["MONTH"], a["VALUE"]))
    D = pd.DataFrame(rows, columns=["stn", "name", "lat", "lon", "element", "month", "value"])
    return D[D.month.between(1, 12)]


@cache
def stations(pruid):
    """Stations with twelve months of mean temperature and of precipitation; k-d tree on unit-sphere xyz."""
    D = normals(pruid)
    ok = D.dropna(subset=["value"]).groupby(["stn", "element"]).month.nunique().unstack()
    S = ok[(ok.get("mean") == 12) & (ok.get("precip") == 12)].index
    St = D[D.stn.isin(S)].drop_duplicates("stn").set_index("stn")[["name", "lat", "lon"]]
    return St, cKDTree(xyz(St.lat.values, St.lon.values))


def xyz(phi, lam):
    p, l = np.radians(phi), np.radians(lam)
    return np.c_[np.cos(p) * np.cos(l), np.cos(p) * np.sin(l), np.sin(p)]


def nearest(pruid, lat, lon):
    """{station, km, element: [12 monthly values]} for the nearest complete station."""
    St, T = stations(pruid)
    if not len(St): return None
    d, i = T.query(xyz([lat], [lon])[0])
    s = St.index[i]
    D = normals(pruid)
    D = D[D.stn == s].pivot_table(index="month", columns="element", values="value").reindex(range(1, 13))
    return {"station": St.name.iloc[i].title(), "km": round(float(2 * 6371 * np.arcsin(d / 2))),
            **{e: [None if pd.isna(v) else round(float(v), 1) for v in D[e]] for e in ELEMENT.values() if e in D}}
