"""Industry structure from the Business Register: employment estimated from size classes (used to weight
the traded share of a code), and the traded/local split of Delgado, Porter and Stern (2016).

Let N ∈ ℕ^{k×s} count employer locations of k industries in s employment-size classes [l_j, u_j].
Employment is bounded by N l ≤ e ≤ N u and estimated by the class midpoints, e = N m; the open
class 500+ enters at its lower bound, so e is a lower estimate wherever that class is non-empty.
"""
import numpy as np

from analysis.fetch import ROOT

# Business Register employment-size classes (employees per location)
SIZE = ["1 to 4 employees", "5 to 9 employees", "10 to 19 employees", "20 to 49 employees",
        "50 to 99 employees", "100 to 199 employees", "200 to 499 employees", "500 plus employees"]
l = np.array([1, 5, 10, 20, 50, 100, 200, 500], float)
u = np.array([4, 9, 19, 49, 99, 199, 499, np.inf])
m = np.r_[(l[:-1] + u[:-1]) / 2, l[-1]]


def employment(N):
    """e = N m with bounds N l ≤ e ≤ N u (u = ∞ where the 500+ class is non-empty)."""
    N = np.asarray(N, float)
    hi = np.where(N[:, -1] > 0, np.inf, N[:, :-1] @ u[:-1])
    return N @ m, N @ l, hi


def lines(name):
    return [x for x in (ROOT / "data" / name).read_text().split() if not x.startswith("#") and x.isdigit()]


# NAICS Canada sectors numbered differently from NAICS US: wholesale 41 ↔ 42, public administration 91 ↔ 92.
US_SECTOR = {"41": "42", "91": "92"}


def traded_share(c, US=None, T=None):
    """p(c) ∈ [0, 1]: share of the NAICS US 2017 6-digit codes sharing the longest prefix (5, 4, 3
    digits, else the sector) with Canadian code c that lie in a DPS traded cluster."""
    US = np.array(US if US is not None else lines("naics_us2017_6digit.txt"), dtype=str)
    T = set(T if T is not None else lines("dps_traded_naics_us2017.txt"))
    for p in (c[:5], c[:4], c[:3], US_SECTOR.get(c[:2], c[:2])):
        J = US[np.char.startswith(US, p)]
        if len(J): return np.mean([j in T for j in J])
    return np.nan


def members(code, C):
    """Mask of 6-digit codes C inside `code` (a prefix, or a sector range such as '31-33')."""
    a, _, b = code.partition("-")
    s = np.array([c[:2] for c in C])
    return (s >= a) & (s <= b) if b else np.char.startswith(np.array(C, dtype=str), code)


def traded(codes, C6, p6, E6):
    """Industry `code` is traded iff its national-employment-weighted traded share
    Σ_{c ∈ code} E_c p(c) / Σ E_c ≥ ½ (unweighted mean where Σ E_c = 0)."""
    out = []
    for k in codes:
        J = members(k, C6)
        w = E6[J] if E6[J].sum() > 0 else np.ones(J.sum())
        out.append(bool(w @ p6[J] / w.sum() >= 0.5) if J.any() else False)
    return np.array(out)


def counts(name):
    """Business Register table → DataFrame indexed (DGUID, GEO, code, name), columns SIZE.
    Codes are the bracketed NAICS codes; sector ranges such as '31-33' are kept as written."""
    from analysis.statcan import NAICS, table
    T = table(name, ["GEO", "DGUID", "Employment size", NAICS])
    T = T[T["Employment size"].isin(SIZE)]
    k = T[NAICS].str.extract(r"^(.*) \[([\d-]+)\]$")
    T = T.assign(name=k[0], code=k[1]).dropna(subset=["code"])
    T = T[T.code.str.len() >= 2]                       # drops totals [1], [2], [3]
    return T.pivot_table(index=["DGUID", "GEO", "code", "name"], columns="Employment size", values="VALUE",
                         aggfunc="sum", fill_value=0)[SIZE]
