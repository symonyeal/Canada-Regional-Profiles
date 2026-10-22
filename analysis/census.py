"""Census of Population 2021, Census Profile, through Statistics Canada's SDMX API.

Characteristics are numbered as in codelist CL_CHARACTERISTIC. A group is a parent and its children,
which partition it (the certificate in `groups`); the reference dashboard's filters sum children.
"""
import io
import json
import urllib.request
import xml.etree.ElementTree as ET
from functools import cache

import pandas as pd

from analysis.fetch import CACHE, UA

API = "https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/"
FLOW = {"PR": "DF_PR", "CD": "DF_CD", "CSD": "DF_CSD"}

# group -> parent characteristic; its children are the bins
GROUP = {
    "age": "8", "household_type": "100", "individual_income": "150", "household_income": "246",
    "household_income_top": "262", "household_size": "50", "structure": "41", "tenure": "1400", "bedrooms": "1407",
    "period": "1426",
    "education": "2014", "occupation": "2248", "industry": "2261", "commute_mode": "2603", "commute_time": "2611",
}
# single values
ONE = {"population": "1", "population_2016": "2", "dwellings": "4", "occupied": "5", "density": "6", "area": "7",
       "median_age": "40", "household_avg_size": "56", "individual_median_income": "113",
       "household_median_income": "229", "owner_cost": "1473", "renter_cost": "1481",
       "participation": "2228", "employment_rate": "2229", "unemployment": "2230",
       # education, population aged 25 to 64 (the reference's donuts reproduce exactly on this universe)
       "edu_total": "2014", "postsecondary": "2017", "bachelor_plus": "2024", "above_bachelor_cert": "2026",
       "medicine": "2027", "masters": "2028", "doctorate": "2029"}


def get(url, path):
    p = CACHE / "census" / path
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=900) as r:
            p.write_bytes(r.read())
    return p


@cache
def codes():
    """{id: (parent, English name)} of CL_CHARACTERISTIC."""
    p = get(API + "codelist/STC_CP/CL_CHARACTERISTIC/latest", "codelist.xml")
    s, c = "{http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure}", "{http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common}"
    out = {}
    for e in ET.parse(p).getroot().iter(s + "Code"):
        n = next(x.text for x in e.findall(c + "Name") if x.get("{http://www.w3.org/XML/1998/namespace}lang") == "en")
        r = e.find(s + "Parent/Ref")
        out[e.get("id")] = (r.get("id") if r is not None else "", n.replace("’", "'"))
    return out


def children(k):
    return [c for c, (p, _) in codes().items() if p == k]


@cache
def groups():
    """{group: [(id, label)]}, the bins of each filter dimension."""
    C = codes()
    return {g: [(c, C[c][1]) for c in children(k)] for g, k in GROUP.items()}


def wanted():
    return sorted({*ONE.values(), *GROUP.values(), *(c for b in groups().values() for c, _ in b),
                   *(g for c in children("8") for g in children(c))}, key=int)   # age: five-year groups too


@cache
def profile(level):
    """Wide table: rows REF_AREA (DGUID), columns characteristic ids, values OBS_VALUE; plus PROV_TERR."""
    ids, out = wanted(), []
    for i in range(0, len(ids), 40):
        b = ids[i:i + 40]
        p = get(f"{API}data/STC_CP,{FLOW[level]}/A5..1.{'+'.join(b)}.1?format=csv", f"{level}_{b[0]}-{b[-1]}_{len(b)}.csv")
        out.append(pd.read_csv(io.BytesIO(p.read_bytes()), dtype={"CHARACTERISTIC": str, "REF_AREA": str},
                               usecols=["REF_AREA", "CHARACTERISTIC", "OBS_VALUE", "ALT_GEO_CODE"]))
    D = pd.concat(out)
    W = D.pivot_table(index="REF_AREA", columns="CHARACTERISTIC", values="OBS_VALUE", aggfunc="first")
    W["code"] = D.groupby("REF_AREA").ALT_GEO_CODE.first().astype(str)
    return W


def labels():
    return json.loads(json.dumps({g: [n for _, n in b] for g, b in groups().items()}))
