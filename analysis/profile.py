"""Community profile, community explorer, market and workforce data: Census Profile values for Canada,
the jurisdiction, its census divisions and subdivisions; time series for the jurisdiction; business
counts and climate normals by subdivision."""
import html
import re
import urllib.request
from functools import cache

import numpy as np
import pandas as pd

from analysis.boundaries import generalised
from analysis.census import GROUP, ONE, groups, profile, wanted
from analysis.climate import nearest
from analysis.fetch import CACHE, UA
from analysis.industry import SIZE
from analysis.statcan import NAICS, table, text

SGC_B = "https://www.statcan.gc.ca/en/subjects/standard/sgc/2021/tablef"
BC_JUNE = [f"bc_{y}06" for y in range(16, 27)]                  # Business Register, June 2016 … June 2026


@cache
def csd_types():
    """{abbreviation: English title}, SGC 2021 Appendix B (census subdivision types)."""
    p = CACHE / "sgc_tablef.html"
    if not p.exists():
        with urllib.request.urlopen(urllib.request.Request(SGC_B, headers={"User-Agent": UA}), timeout=120) as r:
            p.write_bytes(r.read())
    h = p.read_bytes().decode("utf-8", errors="replace")
    out = {}
    for r in re.findall(r"<tr[^>]*>(.*?)</tr>", h, re.DOTALL):
        c = [html.unescape(re.sub("<[^>]+>", "", x)).strip() for x in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.DOTALL)]
        if len(c) >= 3 and c[0] in ("Bilingual", "English only", "French only"): out[c[1]] = c[2]
    return out


def certify_groups(row):
    """Children of each census group sum to their parent within random rounding (to 5 per cell)."""
    for g, k in GROUP.items():
        kids = [c for c, _ in groups()[g]]
        if pd.isna(row.get(k)) or any(pd.isna(row.get(c)) for c in kids): continue
        assert abs(sum(row[c] for c in kids) - row[k]) <= 5 * len(kids) + 1e-6 * row[k], (g, row[k], sum(row[c] for c in kids))


def series(pruid, name):
    """Annual series: LFS participation, unemployment rate, employment (14-10-0464); population on
    July 1 (17-10-0005); median total income of families (11-10-0009); employer locations in June."""
    L = table("lfs_er", ["REF_DATE", "GEO", "Labour force characteristics"])
    L = L[L.GEO == name].pivot_table(index="REF_DATE", columns="Labour force characteristics", values="VALUE")
    P = table("pop_a", ["REF_DATE", "GEO", "Gender", "Age group"])
    P = P[(P.GEO == name) & (P.Gender == "Total - gender") & (P["Age group"] == "All ages")].set_index("REF_DATE").VALUE
    I = table("inc_fam", ["REF_DATE", "GEO", "Family characteristics"])
    I = I[(I.GEO == name) & (I["Family characteristics"] == "Median total income, all families")].set_index("REF_DATE").VALUE
    E = {}
    for k in BC_JUNE:
        B = table(k, ["REF_DATE", "GEO", "Employment size", NAICS])
        v = B[(B.GEO == name) & (B["Employment size"] == "Total, with employees") & (B[NAICS] == "Total, all industries [1]")]
        E[str(B.REF_DATE.iloc[0])[:4]] = float(v.VALUE.iloc[0])
    yr = lambda s: [str(x)[:4] for x in s.index]
    return {"lfs": {"year": yr(L), "participation": L["Participation rate"].tolist(),
                    "unemployment": L["Unemployment rate"].tolist(), "employment": (L["Employment"] * 1000).tolist()},
            "population": {"year": yr(P), "v": P.tolist()}, "income": {"year": yr(I), "v": I.tolist()},
            "establishments": {"year": list(E), "v": list(E.values())},
            "src": {"lfs": "Statistics Canada, Labour Force Survey, table 14-10-0464 (annual)",
                    "population": "Statistics Canada, population estimates on July 1, table 17-10-0005",
                    "income": "Statistics Canada, median total income of census families, table 11-10-0009",
                    "establishments": "Statistics Canada, Canadian Business Counts with employees, June of each year"}}


def centroid(g):
    """Mean of the exterior vertices of the largest polygon (a display anchor, not a centre of mass)."""
    P = g["coordinates"] if g["type"] == "Polygon" else max(g["coordinates"], key=lambda p: len(p[0]))
    V = np.array(P[0])
    return round(float(V[:, 1].mean()), 3), round(float(V[:, 0].mean()), 3)


def communities(pruid):
    """Census subdivisions: id, name, type, population 2021, anchor, census matrix, population series
    (17-10-0155), employer locations by sector and size (33-10-1176), nearest climate normals station."""
    G = generalised("CSD", pruid)
    T = csd_types()
    ids = list(profile("CSD").code[lambda c: c.str.startswith(pruid)])
    f = {x["properties"]["CSDUID"]: x for x in G["features"]}
    ids = [i for i in ids if i in f]
    W = profile("CSD").set_index("code").loc[ids]
    lat, lon = zip(*(centroid(f[i]["geometry"]) for i in ids))
    # population series by CSD
    S = table("pop_csd", ["REF_DATE", "GEO", "DGUID"])
    S = S[S.DGUID.str[9:].isin(ids)]
    S = S.assign(id=S.DGUID.str[9:]).pivot_table(index="id", columns="REF_DATE", values="VALUE")
    years = [str(y)[:4] for y in S.columns]
    # business counts by CSD: sector (2-digit, or range) and size class
    B = table("bc_csd_2606", ["DGUID", "Employment size", NAICS])
    B = B[B.DGUID.str.startswith("2021A0005") & B.DGUID.str[9:].isin(ids)]
    code = B[NAICS].str.extract(r"\[([\d-]+)\]$")[0]
    sec = B[(code.str.len() == 2) | code.str.contains("-", na=False)]
    sec = sec.assign(c=code, id=sec.DGUID.str[9:])
    bs = sec[sec["Employment size"] == "Total, with employees"]
    bs = bs.pivot_table(index="id", columns="c", values="VALUE", aggfunc="sum")
    tot = B[B[NAICS] == "Total, all industries [1]"].assign(id=lambda d: d.DGUID.str[9:])
    bz = tot[tot["Employment size"].isin(SIZE)].pivot_table(index="id", columns="Employment size", values="VALUE", aggfunc="sum")
    bz = bz.reindex(columns=SIZE)
    clim, stn = [], {}
    for a, b in zip(lat, lon):
        c = nearest(pruid, a, b)
        if c is None: clim.append(-1); continue
        stn.setdefault(c["station"], c); clim.append(list(stn).index(c["station"]))
    return {"id": ids, "name": [text(f[i]["properties"]["CSDNAME"]) for i in ids],
            "type": [T.get(text(f[i]["properties"].get("CSDTYPE", "")), f[i]["properties"].get("CSDTYPE", "")) for i in ids],
            "lat": list(lat), "lon": list(lon), "census": {c: W[c].round(1).tolist() for c in wanted() if c in W},
            "pop_series": {"year": years, "v": S.reindex(ids).round(0).values.tolist()},
            "biz_sector": {"code": list(bs.columns), "v": bs.reindex(ids).fillna(0).astype(int).values.tolist()},
            "biz_size": {"code": SIZE, "v": bz.reindex(ids).fillna(0).astype(int).values.tolist()},
            "climate": clim, "stations": list(stn.values())}


def census_meta():
    """Labels of the census characteristics the site uses: group bins and single values."""
    from analysis.census import codes
    C = codes()
    return {"group": {g: {"parent": k, "bins": [c for c, _ in groups()[g]]} for g, k in GROUP.items()},
            "one": ONE, "label": {c: C[c][1] for c in wanted()},
            "age5": [g for c in ("9", "13", "24") for g in [x for x, (p, _) in C.items() if p == c]]}


def jurisdiction(pruid):
    """Census values for Canada, the jurisdiction and its census divisions (same keys as the matrix)."""
    W = profile("PR").set_index("code")
    D = profile("CD")
    D = D[D.code.str.startswith(pruid)].set_index("code")
    row = W.loc[pruid]
    certify_groups(row)
    pick = lambda R: {c: (None if pd.isna(R[c]) else round(float(R[c]), 1)) for c in wanted() if c in R}
    return {"ca": pick(W.loc["1"]), "pt": pick(row),
            "cd": {k: pick(r) for k, r in D.iterrows()}}
