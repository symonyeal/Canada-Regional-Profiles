"""Build the site's data files for each province or territory:

  site/data/<CODE>.js      logistics, community profile, industries, talent        (window.DATA[CODE])
  site/data/<CODE>-csd.js  census subdivisions: explorer, market, catchment          (window.CSD[CODE])
  site/data/<CODE>-geo.js  boundaries of the jurisdiction and its subdivisions      (window.GEO[CODE])
  site/data/meta.js        census labels shared by all; site/data/index.js           (window.META, window.INDEX)

The page filters and draws; certificates are asserted before anything is written.

Usage: py -3.14 -m analysis.build_site [CODE ...]      # default: all thirteen
"""
import json
import math
import re
import sys
import unicodedata
from functools import cache

import numpy as np
import pandas as pd

from analysis.boundaries import generalised
from analysis.climate import nearest
from analysis.fetch import ROOT
from analysis.industry import counts, employment, traded, traded_share
from analysis.logistics import logistics
from analysis.profile import census_meta, communities, jurisdiction, series
from analysis.regions import CODE, PT
from analysis.statcan import NAICS, table
from analysis.talent import talent

BUILT = [c for c, _, _ in PT]       # release order: territories first, then west to east (regions.PT)
SECTOR = {"31": "31-33", "32": "31-33", "33": "31-33", "44": "44-45", "45": "44-45", "48": "48-49", "49": "48-49"}


def plain(o, nd=6):
    """JSON-native copy of o: arrays to lists, floats to nd significant digits, NaN/∞ to None."""
    if isinstance(o, dict): return {str(k): plain(v, nd) for k, v in o.items()}
    if isinstance(o, (list, tuple, np.ndarray, pd.Series)): return [plain(v, nd) for v in o]
    if isinstance(o, (float, np.floating)): return None if not math.isfinite(o) else float(f"{o:.{nd}g}")
    if isinstance(o, np.integer): return int(o)
    if isinstance(o, np.bool_): return bool(o)
    return o


# ---------- industries: SEPH employment, Business Register where SEPH is suppressed ----------

@cache
def business():
    """Business Register location counts (June 2025, June 2020) and the traded flag of every code."""
    C1, C0 = counts("bc_2506"), counts("bc_2006")
    ca = C1.xs("Canada", level="GEO").droplevel("DGUID")
    c6 = ca[ca.index.get_level_values("code").str.len() == 6]
    C6 = c6.index.get_level_values("code").to_numpy()
    E6 = employment(c6.values)[0]
    p6 = np.array([traded_share(c) for c in C6])
    codes = ca.index.get_level_values("code").unique()
    return C1, C0, dict(zip(codes, traded(codes, C6, p6, E6))), E6 @ (p6 >= 0.5) / E6.sum()


@cache
def seph():
    """SEPH (14-10-0202), all employees: {year: DataFrame GEO × 4-digit NAICS}, the industrial
    aggregate [00-91N] by GEO in the latest year y1, and y1."""
    T = table("seph", ["REF_DATE", "GEO", "Type of employee", NAICS])
    T = T[T["Type of employee"] == "All employees"]
    y1 = int(T.REF_DATE.max())
    agg = T[(T.REF_DATE == y1) & T[NAICS].str.endswith("[00-91N]")].set_index("GEO").VALUE
    T = T.assign(code=T[NAICS].str.extract(r"\[(\d{4})\]$")[0]).dropna(subset=["code"])
    return {y: T[T.REF_DATE == y].pivot_table(index="GEO", columns="code", values="VALUE") for y in (y1, y1 - 5)}, agg, y1


def industries(name):
    """Four-digit industries with published SEPH employment (all employees) in year y1, as the
    reference dashboard: e (y1), e0 (y1 − 5, None where suppressed), LQ against Canada over the
    published cells, traded flag, sector, and Business Register employer locations n (June y1)."""
    C1, _, T, _ = business()
    S, agg, y1 = seph()
    e = S[y1].loc[name].dropna()
    e = e[e > 0]
    e0 = S[y1 - 5].loc[name].reindex(e.index)
    E = S[y1].loc["Canada"]
    L = (e.values / agg[name]) / (E.reindex(e.index).values / agg["Canada"])   # totals: industrial aggregate [00-91N]
    R = C1.xs(name, level="GEO").droplevel("DGUID")
    names = dict(zip(R.index.get_level_values("code"), R.index.get_level_values("name")))
    n = R.sum(1).droplevel("name")
    title = table("seph", [NAICS]).drop_duplicates()[NAICS]
    title = dict(zip(title.str.extract(r"\[(\d{4})\]$")[0], title.str.replace(r" \[\d{4}\]$", "", regex=True)))
    return {"year": y1, "code": list(e.index), "name": [title.get(c) or names.get(c, c) for c in e.index],
            "sector": [SECTOR.get(c[:2], c[:2]) for c in e.index], "traded": [T.get(c, False) for c in e.index],
            "e": e.values, "e0": e0.values, "n": n.reindex(e.index).values, "lq": np.round(L, 2),
            "src": f"Statistics Canada, Survey of Employment, Payrolls and Hours (table 14-10-0202), all employees, {y1}; "
                   f"change since {y1 - 5}. Industries whose employment SEPH suppresses are not listed. Traded clusters of "
                   "Delgado, Porter and Stern (2016)."}


# ---------- logistics: airports ----------

STOP = {"airport", "international", "municipal", "regional", "aerodrome", "de", "du", "the"}


def fold(x):
    """Lower case without accents or periods: 'St. John's, Montréal' → 'st john's, montreal'."""
    x = x.lower().replace(".", "").replace("’", "'")
    return "".join(c for c in unicodedata.normalize("NFKD", x) if not unicodedata.combining(c))


def words(x):
    return set(re.findall(r"[\w']+", fold(x))) - STOP


def match_airport(g, A):
    """Index into OurAirports A of the StatCan airport 'Place/Qualifier' g, or None. Candidates
    are airports whose city or name contains the place; without a qualifier a single candidate is
    taken; with one, the candidate sharing most qualifier words (place words excluded), if unique."""
    place, _, qual = g.partition("/")
    place = fold(re.sub(r" \(.*\)$", "", place).strip())
    C = [i for i, (c, n) in enumerate(zip(A["city"], A["name"])) if place == fold(c) or place in fold(n)]
    if not qual:
        E = [i for i in C if words(A["name"][i]) == words(place)]         # exact name breaks a tie
        return C[0] if len(C) == 1 else E[0] if len(E) == 1 else None
    q = words(qual) - words(place)
    score = {i: len(q & words(A["name"][i])) for i in C}
    best = max(score.values(), default=0)
    top = [i for i in C if score[i] == best]
    return top[0] if best > 0 and len(top) == 1 else None


SECTORS = {"Domestic sector": "domestic", "Transborder sector": "transborder", "Other International sector": "international"}


def airports_pax(L, name):
    """Passengers enplaned and deplaned, latest published year per airport (many years are
    suppressed), split by sector, matched to OurAirports by match_airport; and the jurisdiction total."""
    T = table("air", ["REF_DATE", "GEO", "Air passenger traffic"])
    T = T[T.VALUE.notna() & (T.GEO.str.endswith(", " + name) | (T.GEO == name))]
    K = T.pivot_table(index=["GEO", "REF_DATE"], columns="Air passenger traffic", values="VALUE").reset_index()
    tk = "Total, passengers enplaned and deplaned"
    K = K[K[tk] > 0].sort_values("REF_DATE")
    tot = K[K.GEO == name].iloc[-1]
    last = K[K.GEO != name].groupby("GEO").last()
    A = L["airports"]
    n = len(A["name"])
    for k in ("pax", "pax_year", *SECTORS.values()): A[k] = [None] * n
    for g, r in last.iterrows():
        i = match_airport(g.rsplit(", ", 1)[0], A)
        if i is None or A["pax"][i] is not None: continue
        A["pax"][i], A["pax_year"][i] = r[tk], r.REF_DATE
        for s, k in SECTORS.items(): A[k][i] = r.get(s)
    L["air_total"] = {"pax": tot[tk], "year": tot.REF_DATE, **{k: tot.get(s) for s, k in SECTORS.items()}}


SRC_LOGISTICS = {
    "airports": "OurAirports (scheduled service); Statistics Canada, air passenger traffic by sector (table 23-10-0253), "
                "latest year published per airport; blank where suppressed. The reference dashboard shows OAG route "
                "counts, which are proprietary.",
    "roads": "Natural Resources Canada, Atlas of Canada 1:1,000,000, Roads (2017).",
    "ports": "NGA World Port Index (Pub. 150); Fisheries and Oceans Canada, Small Craft Harbours. Neither lists every "
             "northern marine facility.",
    "rail": "Natural Resources Canada, Atlas of Canada 1:1,000,000, Railways (2017).",
    "broadband": "ISED, National Broadband Data (current, May 2026) over the 2021 pseudo-household distribution; "
                 "terrestrial wired and wireless service, satellite excluded.",
}


# ---------- assembly ----------

def build(code):
    pruid, name = CODE[code]
    L = logistics(code, name)
    airports_pax(L, name)
    L["src"] = SRC_LOGISTICS
    J = jurisdiction(pruid)
    C = communities(pruid)
    big = int(np.nanargmax([v if v is not None else -1 for v in C["census"]["1"]]))
    main = {"code": code, "pruid": pruid, "name": name, "logistics": L,
            "profile": {"census": J, "series": series(pruid, name), "climate": nearest(pruid, C["lat"][big], C["lon"][big]),
                        "anchor": C["name"][big]},
            "industries": industries(name), "talent": talent(pruid, name)}
    geo = {"pr": generalised("PR", pruid, cap=5e5), "csd": generalised("CSD", pruid, cap=1.5e6)}   # page weight caps (bytes)
    return main, C, geo


def write(path, var, code, obj):
    body = json.dumps(plain(obj), separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    path.write_text(f"window.{var} = window.{var} || {{}};\nwindow.{var}[{json.dumps(code)}] = {body};\n", encoding="utf-8")
    return path.stat().st_size / 1e6


def main(codes):
    out = ROOT / "site" / "data"; out.mkdir(parents=True, exist_ok=True)
    (out / "meta.js").write_text("window.META = " + json.dumps(census_meta(), ensure_ascii=False) + ";\n", encoding="utf-8")
    for c in codes:
        M, C, G = build(c)
        sizes = [write(out / f"{c}{s}.js", v, c, o) for s, v, o in (("", "DATA", M), ("-csd", "CSD", C), ("-geo", "GEO", G))]
        print(c, " ".join(f"{s:.2f}" for s in sizes), "MB")
    order = [[c, n] for c, _, n in PT]
    (out / "index.js").write_text("window.INDEX = " + json.dumps({"built": BUILT, "order": order}) + ";\n", encoding="utf-8")
    print("traded share of Canadian employment (Business Register estimate):", round(business()[3], 3))


if __name__ == "__main__":
    main(sys.argv[1:] or BUILT)
