import json
import math
from pathlib import Path

import pytest

pytestmark = pytest.mark.slow     # needs data/fetched (py -3.14 analysis/fetch.py)

REF = json.loads((Path(__file__).parent / "fixtures" / "reference_mb.json").read_text())


@pytest.fixture(scope="module")
def mb():
    from analysis.build_site import build
    return build("MB")


def test_reference_industries_reproduced(mb):
    """Largest industries (SEPH 2025) and fastest (change since 2020): the reference's codes and values,
    except rail transportation (4821), which SEPH table 14-10-0202 does not publish."""
    I = mb[0]["industries"]
    e = dict(zip(I["code"], I["e"])); d = {c: a - b for c, a, b in zip(I["code"], I["e"], I["e0"]) if not math.isnan(b)}
    assert all(e[c] == v for c, v in REF["largest_all"])
    assert sorted(e, key=e.get, reverse=True)[:20] == [c for c, _ in REF["largest_all"]]
    assert {c for c, _ in REF["fastest_all"]} - set(d) == {"4821"}
    assert all(d[c] == v for c, v in REF["fastest_all"] if c != "4821")


def test_reference_census_reproduced(mb):
    """Workforce donuts (population 25 to 64) and residents' industry treemap (Census 2021)."""
    from analysis.census import ONE, groups
    v = mb[0]["profile"]["census"]["pt"]
    got = {"postsecondary-certificate-diploma-or-degree": v[ONE["postsecondary"]],
           "bachelors-degree-or-higher": v[ONE["bachelor_plus"]],
           "masters-or-higher": v[ONE["masters"]] + v[ONE["doctorate"]],
           "other-above-bachelor": v[ONE["above_bachelor_cert"]] + v[ONE["medicine"]]}
    assert got == REF["education_25_64"]
    assert sorted(v[k] for k, _ in groups()["industry"]) == REF["industry_census_2021"]


def test_reference_series_reproduced(mb):
    S = mb[0]["profile"]["series"]
    assert S["lfs"]["participation"][-2:] == REF["participation_2024_2025"]
    assert S["income"]["v"][-2:] == REF["household_median_income_2022_2023"]


@pytest.mark.parametrize("code", ["YT", "NU", "PE"])
def test_build_certificates(code):
    """build() asserts its certificates (census groups partition their parents; broadband sums)."""
    from analysis.build_site import build
    M, C, G = build(code)
    B = M["logistics"]["broadband"]
    assert 0 <= B["share50"] <= 1 and abs(sum(B["cd"]["households"]) - B["households"]) <= len(B["cd"]["id"])
    assert len(C["id"]) == len(G["csd"]["features"]) or set(C["id"]) <= {f["properties"]["CSDUID"] for f in G["csd"]["features"]}
