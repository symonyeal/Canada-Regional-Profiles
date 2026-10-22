"""Build site/data/<CODE>.js for each province or territory, and site/data/index.js.

The page filters and draws; it computes nothing computed here. Certificates are asserted before
anything is written.

Usage: py -3.14 analysis/build_site.py [CODE ...]      # default: every jurisdiction built so far
"""
import json
import math
import sys
from functools import cache

import numpy as np
import pandas as pd

from analysis.fetch import ROOT
from analysis.industry import SIZE, counts, employment, growth, lq, traded, traded_share
from analysis.logistics import logistics
from analysis.regions import CODE, PT
from analysis.statcan import NAICS, census, psis, table

BUILT = ["YT", "NT", "NU"]          # release order: territories first (regions.PT)
MIN_BASE = 20                       # growth rates shown only for industries with ≥ 20 estimated jobs in 2021


def plain(o, nd=6):
    """JSON-native copy of o: arrays to lists, floats to nd significant digits, NaN/∞ to None."""
    if isinstance(o, dict): return {k: plain(v, nd) for k, v in o.items()}
    if isinstance(o, (list, tuple, np.ndarray, pd.Series)): return [plain(v, nd) for v in o]
    if isinstance(o, (float, np.floating)): return None if not math.isfinite(o) else float(f"{o:.{nd}g}")
    if isinstance(o, np.integer): return int(o)
    if isinstance(o, np.bool_): return bool(o)
    return o


# ---------- industries ----------

@cache
def business():
    """Location counts for June 2026 and June 2021, and the traded flag of every code."""
    C1, C0 = counts("bc_2606"), counts("bc_2106")
    ca = C1.xs("Canada", level="GEO").droplevel("DGUID")
    c6 = ca[ca.index.get_level_values("code").str.len() == 6]
    C6 = c6.index.get_level_values("code").to_numpy()
    E6 = employment(c6.values)[0]
    p6 = np.array([traded_share(c) for c in C6])
    codes = ca.index.get_level_values("code").unique()
    T = dict(zip(codes, traded(codes, C6, p6, E6)))
    share = E6 @ (p6 >= 0.5) / E6.sum()
    return C1, C0, T, share


def level_of(c):
    return 2 if "-" in c else len(c)


def industries(name):
    """Per NAICS level 2, 3, 4: employer locations n, estimated employment e (bounds lo, hi) in
    June 2026, e0 in June 2021, LQ against Canada, traded flag."""
    C1, C0, T, _ = business()
    r1 = C1.xs(name, level="GEO").droplevel("DGUID")
    ca = C1.xs("Canada", level="GEO").droplevel("DGUID")
    r0 = C0.xs(name, level="GEO").droplevel("DGUID").droplevel("name")
    out, tot = {}, []
    for k in (2, 3, 4):
        K = ca[[level_of(c) == k for c in ca.index.get_level_values("code")]]
        R = r1.reindex(K.index, fill_value=0)                   # region aligned to Canada's industries
        e, lo, hi = employment(R.values)
        LQ = lq(e, employment(K.values)[0])
        J = R.values.sum(1) > 0
        code = R.index.get_level_values("code")[J]
        e0 = np.array([employment(r0.loc[[c]].values)[0][0] if c in r0.index else np.nan for c in code])
        out[str(k)] = {"code": list(code), "name": list(R.index.get_level_values("name")[J]), "traded": [T[c] for c in code],
                       "n": R.values.sum(1)[J], "e": e[J], "lo": lo[J], "hi": hi[J], "lq": LQ[J], "e0": e0}
        tot.append((R.values.sum(), e.sum()))
    # certificate: each level partitions the same classified locations and employment
    assert all(np.isclose(t, tot[0]).all() for t in tot), tot
    return out


# ---------- census and LFS ----------

def cd_names(pruid):
    """CD id → census name; a generic name ('Region 1') is completed by its most populous subdivision."""
    W = table("c_pop")
    pop = next(c for c in W.columns if "Population, 2021" in c)
    lvl = W.DGUID.str[:9]
    cds = W[(lvl == "2021A0003") & W.DGUID.str[9:].str.startswith(pruid)]
    csd = W[lvl == "2021A0005"].assign(cd=lambda d: d.DGUID.str[9:13]).sort_values(pop, ascending=False)
    top = csd.drop_duplicates("cd").set_index("cd").GEO
    return {d[9:]: f"{g} ({top[d[9:]]} area)" if g.startswith("Region") else g for d, g in zip(cds.DGUID, cds.GEO)}


def workforce(pruid, name, names):
    """Census 2021 indicators for the jurisdiction and each census division; LFS latest for the jurisdiction."""
    ids = [pruid, *names]
    A, L, I = census("c_age"), census("c_lfs"), census("c_ind")
    age, edu = "Age (in single years), average age and median age (128)", "Highest certificate, diploma or degree (16)"
    A = A[A["Census year (2)"] == 2021].set_index(["id", age])["Total - Gender"]
    L = L[(L["Statistics (3)"] == "Count") & (L["Gender (3)"] == "Total - Gender")]
    lt = L[(L["Age (15A)"] == "Total - Age") & L[edu].str.startswith("Total")].set_index("id")
    l2 = L[L["Age (15A)"] == "25 to 64 years"].set_index(["id", edu])["Total - Labour force status"]
    I = I[(I["Gender (3a)"] == "Total - Gender") & (I["Age (8G)"] == "Total - Age")
          & (I["Statistics (5)"] == "% distribution (2021)")].set_index("id")
    tot = "Total - Highest certificate, diploma or degree"
    post = "Postsecondary certificate, diploma or degree"
    f = {
        "Median age, 2021": ("yrs", lambda g: A[g, "Median age"]),
        "Aged 15 to 64, 2021": ("%", lambda g: A[g, "15 to 64 years"] / A[g, "Total - Age"]),
        "Participation rate, 2021": ("%", lambda g: lt.loc[g, "Participation rate"] / 100),
        "Employment rate, 2021": ("%", lambda g: lt.loc[g, "Employment rate"] / 100),
        "Unemployment rate, 2021": ("%", lambda g: lt.loc[g, "Unemployment rate"] / 100),
        "Aged 25 to 64 with a postsecondary credential": ("%", lambda g: l2[g, post] / l2[g, tot]),
        "Indigenous identity": ("%", lambda g: I.loc[g, "Indigenous identity"] / 100),
    }
    ind = [{"label": k, "unit": u, "v": {g: fn(g) for g in ids}, "ca": fn("11124")} for k, (u, fn) in f.items()]
    lfs = lfs_latest(pruid, name)
    if lfs:
        ind.insert(0, {"label": f"Unemployment rate, {lfs['month']} (LFS)", "unit": "%", "v": {pruid: lfs["u"]},
                       "ca": None, "note": "three-month moving average, seasonally adjusted"})
        ind.insert(0, {"label": f"Employed, {lfs['month']} (LFS)", "unit": "n", "v": {pruid: lfs["emp"]}, "ca": None})
    return {"regions": [{"id": pruid, "name": name}] + [{"id": k, "name": v} for k, v in names.items()],
            "ind": ind, "src": "Statistics Canada, Census of Population 2021 (tables 98-10-0022, 98-10-0400, "
                              "98-10-0293); Labour Force Survey (table 14-10-0292)."}


def lfs_latest(pruid, name):
    """Latest LFS month for a territory (three-month moving average, seasonally adjusted)."""
    if pruid not in ("60", "61", "62"): return None
    T = table("lfs_t", ["REF_DATE", "GEO", "Labour force characteristics", "Gender", "Age group", "Statistics", "Data type"])
    T = T[(T.GEO == name) & (T.Gender == "Total - Gender") & (T["Age group"] == "15 years and over")
          & (T.Statistics == "Estimate") & (T["Data type"] == "Seasonally adjusted")]
    t = T.REF_DATE.max()
    v = T[T.REF_DATE == t].set_index("Labour force characteristics").VALUE
    return {"month": pd.Timestamp(t).strftime("%B %Y"), "u": v["Unemployment rate"] / 100, "emp": v["Employment"] * 1000}


# ---------- talent ----------

def talent(name):
    P = psis()
    P = P[P.GEO.str.endswith(", " + name) & P.VALUE.notna()]
    if P.empty: return {"inst": [], "fields": [], "n": {"All": []}, "year": None, "src": SRC_PSIS}
    y = P.REF_DATE.max(); P = P[P.REF_DATE == y]
    F = P[P["Field of study"] != "Total, field of study"]
    fields = sorted(F["Field of study"].str.replace(r" \[\d\d\.\]$", "", regex=True).unique())
    F = F.assign(f=F["Field of study"].str.replace(r" \[\d\d\.\]$", "", regex=True))
    X = F.pivot_table(index="GEO", columns="f", values="VALUE", aggfunc="sum", fill_value=0).reindex(columns=fields, fill_value=0)
    tot = P[P["Field of study"] == "Total, field of study"].set_index("GEO").VALUE
    inst = [{"name": g.rsplit(", ", 1)[0], "total": tot.get(g, X.loc[g].sum())} for g in X.index]
    n = {"All": X.sum(0).values, **{g.rsplit(", ", 1)[0]: X.loc[g].values for g in X.index}}
    return {"inst": sorted(inst, key=lambda d: -d["total"]), "fields": fields, "n": n, "year": y,
            "src": SRC_PSIS + f" Academic year {y}."}


SRC_PSIS = ("Statistics Canada, Postsecondary Student Information System (table 37-10-0277), fields at 2-digit CIP 2021. "
            "Counts are rounded and small cells suppressed, so fields need not sum to the total.")


# ---------- market ----------

def market(pruid, name):
    W = census("c_pop").set_index("id")
    H = census("c_inc")
    H = H[H["Household size (7)"].str.startswith("Total")
          & H["Household type including census family structure  (11)"].str.startswith("Total")].set_index("id")
    D = census("c_dwl")
    D = D[D["Household size (8)"].str.startswith("Total") & D["Number of bedrooms (6)"].str.startswith("Total")
          & (D["Statistics (3C)"] == "Number of private households")].set_index(["id", "Structural type of dwelling (10)"])
    Q = table("pop_q", ["REF_DATE", "GEO"]); Q = Q[Q.GEO == name].set_index("REF_DATE").VALUE
    t = Q.index.max(); t5 = str(int(t[:4]) - 5) + t[4:]
    B1, B0 = (table(k, ["GEO", "Employment size", NAICS]) for k in ("bc_2606", "bc_2106"))
    b = {k: B[(B.GEO == name) & (B[NAICS] == "Total, all industries [1]")].set_index("Employment size").VALUE
         for k, B in (("1", B1), ("0", B0))}
    pop = Q[t]
    g = lambda i, c: D.loc[(i, c), "Total - Tenure"]
    inc, occ, dw = ("Median household total income (2020) (2020 constant dollars)",
                    "Private dwellings occupied by usual residents, 2021", "Total private dwellings, 2021")
    n1, n0 = b["1"]["Total, with employees"], b["0"]["Total, with employees"]
    tot = "Total - Structural type of dwelling"
    groups = {
        "Consumers": [
            {"v": pop, "unit": "n", "label": f"Population, {pd.Timestamp(t).strftime('%B %Y')}"},
            {"v": pop / Q[t5] - 1, "unit": "%", "label": "Population growth over five years"},
            {"v": H.loc[pruid, "Number of households (2021)"], "unit": "n", "label": "Households, 2021"},
            {"v": H.loc[pruid, inc], "unit": "$", "label": "Median household income, 2020",
             "note": f"Canada ${H.loc['11124', inc]:,.0f}"},
        ],
        "Dwellings": [
            {"v": W.loc[pruid, dw], "unit": "n", "label": "Private dwellings, 2021"},
            {"v": W.loc[pruid, occ] / W.loc[pruid, dw], "unit": "%", "label": "Occupied by usual residents"},
            {"v": D.loc[(pruid, tot), "Owner"] / g(pruid, tot), "unit": "%", "label": "Households that own their dwelling",
             "note": f"Canada {100 * D.loc[('11124', tot), 'Owner'] / g('11124', tot):.1f}%"},
            {"v": g(pruid, "Single-detached house") / g(pruid, tot), "unit": "%", "label": "Single-detached houses",
             "note": f"Canada {100 * g('11124', 'Single-detached house') / g('11124', tot):.1f}%"},
        ],
        "Businesses": [
            {"v": n1, "unit": "n", "label": "Employer business locations, June 2026"},
            {"v": n1 / n0 - 1, "unit": "%", "label": "Change since June 2021"},
            {"v": 1000 * n1 / pop, "unit": "yrs", "label": "Employer locations per 1,000 residents"},
            {"v": b["1"][["100 to 199 employees", "200 to 499 employees", "500 plus employees"]].sum(), "unit": "n",
             "label": "Locations with 100 or more employees"},
        ],
    }
    assert np.isclose(b["1"][SIZE].sum(), b["1"]["Total, with employees"])   # size classes partition the total
    return {"groups": groups, "src": "Statistics Canada, population estimates (table 17-10-0009); Census of Population 2021 "
            "(tables 98-10-0004, 98-10-0057, 98-10-0240); Canadian Business Counts (tables 33-10-1174, 33-10-0395)."}


# ---------- assembly ----------

def airports_pax(L, name):
    """Passengers enplaned and deplaned, latest published year per airport (many years are
    suppressed), joined to OurAirports by the place name before '/'; and the jurisdiction total."""
    T = table("air", ["REF_DATE", "GEO", "Air passenger traffic"])
    T = T[(T["Air passenger traffic"] == "Total, passengers enplaned and deplaned") & T.VALUE.notna()
          & (T.GEO.str.endswith(", " + name) | (T.GEO == name))].sort_values("REF_DATE")
    tot = T[T.GEO == name].iloc[-1]
    last = T[T.GEO != name].groupby("GEO").last()
    key = lambda g: g.rsplit(", ", 1)[0].split("/")[0].strip().lower()
    p = {key(g): (r.VALUE, r.REF_DATE) for g, r in last.iterrows() if r.VALUE > 0}
    A = L["airports"]
    alt = lambda n: n.split(" / ")[0].replace(" Airport", "").strip().lower()
    hit = [p.get(c.lower(), p.get(alt(n))) for c, n in zip(A["city"], A["name"])]
    A["pax"] = [h and h[0] for h in hit]; A["pax_year"] = [h and h[1] for h in hit]
    L["air_total"] = {"pax": tot.VALUE, "year": tot.REF_DATE}
    return tot.REF_DATE


def build(code):
    pruid, name = CODE[code]
    names = cd_names(pruid)
    L = logistics(code, name)
    airports_pax(L, name)
    L["src"] = {
        "airports": "OurAirports (scheduled service); Statistics Canada, air passenger traffic (table 23-10-0253), "
                    "latest year published per airport; blank where suppressed.",
        "roads": "Natural Resources Canada, Atlas of Canada 1:1,000,000, Roads (2017); lengths are of features in the region.",
        "ports": "NGA World Port Index (Pub. 150); Fisheries and Oceans Canada, Small Craft Harbours. "
                 "Neither lists every northern marine facility.",
        "rail": "Natural Resources Canada, Atlas of Canada 1:1,000,000, Railways (2017).",
        "broadband": "ISED, National Broadband Data (current, May 2026) over the 2021 pseudo-household distribution; "
                     "terrestrial wired and wireless service, satellite excluded.",
    }
    I = industries(name)
    W = workforce(pruid, name, names)
    P = talent(name)
    M = market(pruid, name)
    four = I["4"]
    j = int(np.argmax(four["e"])); jt = max((i for i in range(len(four["e"])) if four["traded"][i]), key=lambda i: four["e"][i])
    dg, _ = growth(np.array(four["e"]), np.array(four["e0"]))
    jg = int(np.nanargmax(dg))
    B = L["broadband"]; pop = M["groups"]["Consumers"][0]["v"]
    ur = next(x for x in W["ind"] if x["label"].startswith("Participation"))
    claims = {
        "logistics": f"{len(L['airports']['name'])} airports with scheduled service connect {name}; "
                     f"{100 * B['share50']:.0f}% of households can get 50/10 Mbps internet",
        "workforce": f"{100 * ur['v'][pruid]:.1f}% of residents aged 15 and over were in the labour force in 2021, "
                     f"against {100 * ur['ca']:.1f}% in Canada",
        "largest": f"{four['name'][j]} is the largest industry group by estimated employment; "
                   f"the largest traded one is {four['name'][jt]}",
        "growing": f"{four['name'][jg]} added the most estimated jobs between 2021 and 2026 ({dg[jg]:+,.0f})",
        "talent": (f"{P['inst'][0]['name']} enrolled {P['inst'][0]['total']:,.0f} students in {P['year']}" if P["inst"]
                   else f"No postsecondary institution in {name} reports to the PSIS table"),
        "market": f"{pop:,.0f} residents, {M['groups']['Consumers'][2]['v']:,.0f} households and "
                  f"{M['groups']['Businesses'][0]['v']:,.0f} employer business locations",
    }
    facts = [[f"{pop:,.0f}", "residents"], [f"{M['groups']['Businesses'][0]['v']:,.0f}", "employer business locations"],
             [f"{100 * B['share50']:.0f}%", "households with 50/10 Mbps"],
             [f"{len(L['airports']['name'])}", "airports with scheduled service"]]
    return {"code": code, "name": name, "h1": f"Why {name}",
            "lede": f"The logistics, workforce, industries, talent and market of {name}, from public data, "
                    "in the layout of a regional investment-attraction dashboard.",
            "facts": facts, "claims": claims, "cdnames": names, "logistics": L, "workforce": W, "industries": I,
            "min_base": MIN_BASE, "talent": P, "market": M,
            "ind_src": "Statistics Canada, Canadian Business Counts with employees, June 2026 (33-10-1174) and June 2021 "
                       "(33-10-0395); traded clusters of Delgado, Porter and Stern (2016) mapped from NAICS US 2017."}


def main(codes):
    out = ROOT / "site" / "data"; out.mkdir(parents=True, exist_ok=True)
    for c in codes:
        D = build(c)
        p = out / f"{c}.js"
        p.write_text(f"window.DATA = window.DATA || {{}};\nwindow.DATA[{json.dumps(c)}] = "
                     + json.dumps(plain(D), separators=(",", ":"), ensure_ascii=False, allow_nan=False) + ";\n", encoding="utf-8")
        print(f"{p}  {p.stat().st_size / 1e6:.2f} MB")
    built = sorted({*BUILT, *codes}, key=[c for c, _, _ in PT].index)
    order = [[c, n] for c, _, n in PT[:3]] + [["|", ""]] + [[c, n] for c, _, n in PT[3:]]
    (out / "index.js").write_text("window.INDEX = " + json.dumps({"built": built, "order": order}) + ";\n", encoding="utf-8")
    print("traded share of Canadian employment:", round(business()[3], 3))


if __name__ == "__main__":
    main(sys.argv[1:] or BUILT)
