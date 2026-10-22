"""Planar geometry for the map layers: the inverse Lambert conformal conic projection of the
Atlas of Canada, and point-in-polygon tests that assign features to a jurisdiction."""
import numpy as np

# GRS 1980 (NAD83); Atlas of Canada Lambert: φ1 = 49°, φ2 = 77°, φ0 = 49°, λ0 = −95°.
GRS80 = (6378137.0, 0.00669438002290)
ATLAS = {"a": GRS80[0], "e2": GRS80[1], "phi1": 49.0, "phi2": 77.0, "phi0": 49.0, "lam0": -95.0}


def lcc_constants(a, e2, phi1, phi2, phi0):
    """n, F, ρ0 of the two-parallel ellipsoidal LCC (Snyder 15-8, 15-10, 15-7)."""
    e, r = np.sqrt(e2), np.radians
    m = lambda p: np.cos(p) / np.sqrt(1 - e2 * np.sin(p) ** 2)                                # 14-15
    t = lambda p: np.tan(np.pi / 4 - p / 2) / ((1 - e * np.sin(p)) / (1 + e * np.sin(p))) ** (e / 2)  # 15-9
    p1, p2 = r(phi1), r(phi2)
    n = (np.log(m(p1)) - np.log(m(p2))) / (np.log(t(p1)) - np.log(t(p2)))
    F = m(p1) / (n * t(p1) ** n)
    return n, F, a * F * t(r(phi0)) ** n, t


def lcc_forward(phi, lam, a, e2, phi1, phi2, phi0, lam0):
    """(φ, λ) in degrees ↦ (x, y). Snyder 15-1 to 15-3."""
    n, F, rho0, t = lcc_constants(a, e2, phi1, phi2, phi0)
    rho, theta = a * F * t(np.radians(phi)) ** n, n * np.radians(np.asarray(lam, float) - lam0)
    return rho * np.sin(theta), rho0 - rho * np.cos(theta)


def lcc_inverse(x, y, a, e2, phi1, phi2, phi0, lam0, eps=1e-12):
    """(x, y) ↦ (φ, λ) in degrees for the ellipsoidal Lambert conformal conic with two standard
    parallels. Snyder, Map Projections: A Working Manual (USGS PP 1395, 1987), eqs. 14-15,
    15-7 to 15-11, 7-9; worked example pp. 296-297."""
    e = np.sqrt(e2)
    n, F, rho0, _ = lcc_constants(a, e2, phi1, phi2, phi0)
    x, y = np.asarray(x, float), np.asarray(y, float)
    rho = np.sign(n) * np.hypot(x, rho0 - y)
    tt = (rho / (a * F)) ** (1 / n)
    theta = np.arctan2(np.sign(n) * x, np.sign(n) * (rho0 - y))
    phi, d = np.pi / 2 - 2 * np.arctan(tt), np.inf                                           # 7-9 start
    while d > eps:
        s = e * np.sin(phi)
        phi_ = np.pi / 2 - 2 * np.arctan(tt * ((1 - s) / (1 + s)) ** (e / 2))
        d, phi = np.max(np.abs(phi_ - phi), initial=0.0), phi_
    return np.degrees(phi), np.degrees(theta / n) + lam0


def inside(P, R):
    """Even-odd rule: P (k×2) ∈ region R, a list of rings (each m×2, closed or not).
    Ray casting, O(k·Σm)."""
    P, z = np.asarray(P, float), np.zeros(len(P), bool)
    for V in R:
        V = np.asarray(V, float)
        lo, hi = V.min(0), V.max(0)
        J = np.flatnonzero((P[:, 0] >= lo[0]) & (P[:, 0] <= hi[0]) & (P[:, 1] >= lo[1]) & (P[:, 1] <= hi[1]))
        if not len(J): continue
        x, y = P[J, 0, None], P[J, 1, None]
        (x1, y1), (x2, y2) = V.T, np.roll(V, -1, 0).T
        with np.errstate(divide="ignore", invalid="ignore"):
            c = ((y1 > y) != (y2 > y)) & (x < x1 + (y - y1) * (x2 - x1) / (y2 - y1))
        z[J] ^= c.sum(1) % 2 == 1
    return z
