"""Talent pipeline: postsecondary enrolments by CIP primary grouping, for a jurisdiction and its
institutions, with campus locations from the Open Database of Educational Facilities."""
import math
import re
import unicodedata
import zipfile
from functools import cache

import pandas as pd

from analysis.fetch import get
from analysis.statcan import psis, text

STOP = {"university", "universite", "college", "of", "the", "de", "du", "des", "la", "le", "and", "et",
        "campus", "institute", "institut", "inc", "ltd", "school", "ecole", "cegep", "centre", "center"}


def fold(x):
    x = unicodedata.normalize("NFKD", str(x).lower().replace("’", "'"))
    return "".join(c for c in x if not unicodedata.combining(c))


def words(x):
    """Distinctive words of a name: accent-folded, split at non-letters (so d'Ottawa → ottawa), minus STOP."""
    return {w for w in re.findall(r"[a-z0-9]+", fold(x)) if len(w) > 1} - STOP


@cache
def groups():
    """{CIP series or subseries code: (primary grouping code, title)}; series 30 is split by subseries.
    Source: Variant of CIP Canada 2021 Version 1.0 – Primary groupings."""
    D = pd.read_csv(get("cip_pg"), encoding="utf-8-sig", dtype=str)
    D.columns = [c.strip() for c in D.columns]
    G = dict(D[D["Level/Niveau"] == "1"][["Code", "Class title"]].values)
    S = D[D["Level/Niveau"] == "2"]
    return {c: (p, G[p]) for c, p in S[["Code", "Parent"]].values}, G


def by_group(F):
    """Enrolments F (rows: field of study '[NN.]' or '[30.NN]') → Series indexed by primary grouping title.
    Series 30 is taken from its subseries only, so nothing is counted twice."""
    m, _ = groups()
    code = F["Field of study"].str.extract(r"\[([\d.]+)\]$")[0]
    keep = code.notna() & (code != "30.")
    g = code[keep].map(lambda c: m[c][1] if c in m else None)
    return F[keep].assign(g=g).dropna(subset=["g"]).groupby("g").VALUE.sum()


@cache
def odef():
    with zipfile.ZipFile(get("odef")) as z:
        D = pd.read_csv(z.open("ODEF_v2.1_EN/ODEF_v2_1.csv"), encoding="latin-1", low_memory=False, dtype=str)
    D = D[D.ISCED4Plus == "1"].copy()
    D["Facility_Name"] = D.Facility_Name.map(text)
    D["lat"], D["lon"] = pd.to_numeric(D.Latitude, errors="coerce"), pd.to_numeric(D.Longitude, errors="coerce")
    return D.dropna(subset=["lat", "lon"])


def assign(names, F):
    r"""Facility names F → index into institution names, or −1. With idf(w) = log(1 + N / df(w)) over the
    N facilities (df ≥ ½), facility f goes to the institution maximising, lexicographically,
    (Σ_{w ∈ W_i ∩ W_f} idf(w), −Σ_{w ∈ W_i \ W_f} idf(w)); accepted when the first term is at least
    min(log 5, log(1 + N)): a word in at most a quarter of the facilities, or any word when N is small."""
    W, V = [words(n) for n in names], [words(f) for f in F]
    N = max(len(V), 1)
    df = {}
    for v in V:
        for w in v: df[w] = df.get(w, 0) + 1
    idf = lambda w: math.log(1 + N / df.get(w, 0.5))
    out = []
    for v in V:
        s = [(sum(idf(w) for w in Wi & v), -sum(idf(w) for w in Wi - v)) for Wi in W]
        i = max(range(len(s)), key=s.__getitem__, default=-1)
        out.append(i if i >= 0 and s[i][0] >= min(math.log(5), math.log(1 + N)) - 1e-12 else -1)
    return out


def talent(pruid, name):
    """Latest academic year: enrolments by primary grouping for the jurisdiction (its own PSIS row)
    and each institution, with campus coordinates."""
    P = psis()
    P = P[(P.GEO.str.endswith(", " + name) | (P.GEO == name)) & P.VALUE.notna()]
    y = P.REF_DATE.max(); P = P[P.REF_DATE == y]
    _, G = groups()
    order = [G[k] for k in sorted(G)]
    tot = P[P["Field of study"] == "Total, field of study"].set_index("GEO").VALUE
    pt = by_group(P[P.GEO == name]).reindex(order, fill_value=0)
    I = sorted(P[P.GEO != name].GEO.unique())
    names = [g.rsplit(", ", 1)[0] for g in I]
    C = odef(); C = C[C.PRUID == pruid]
    priv = C.Facility_Type.str.contains("Private|privé", regex=True).values
    a = [-1] * len(C)
    pub = [k for k in range(len(C)) if not priv[k]]
    for j, i in zip(pub, assign(names, C.Facility_Name.iloc[pub].tolist())):
        a[j] = i
    for j in [k for k in range(len(C)) if priv[k]]:     # private facilities: whole-name match, unmatched institutions only
        hit = [i for i, n in enumerate(names) if words(n) and words(n) <= words(C.Facility_Name.iloc[j]) and i not in a]
        a[j] = hit[0] if len(hit) == 1 else -1
    inst = []
    for k, g in enumerate(I):
        F = C.iloc[[i for i, j in enumerate(a) if j == k]]
        inst.append({"name": names[k], "total": tot.get(g), "n": by_group(P[P.GEO == g]).reindex(order, fill_value=0).values,
                     "campus": {"name": F.Facility_Name.tolist(), "city": F.City.tolist(),
                                "lat": F.lat.round(4).tolist(), "lon": F.lon.round(4).tolist()}})
    return {"year": y, "groups": order, "total": tot.get(name), "n": pt.values,
            "inst": sorted(inst, key=lambda d: -(d["total"] or 0)),
            "src": f"Statistics Canada, Postsecondary Student Information System (table 37-10-0277), {y}; fields grouped by "
                   "the CIP Canada 2021 primary-groupings variant; campuses from the Open Database of Educational Facilities "
                   "v2.1. Counts are rounded and small cells suppressed, so groups need not sum to the total."}
