import numpy as np

from analysis.industry import employment, members, traded_share


def test_employment_bounds_hold():
    """Midpoint estimate lies in [N l, N u]; one location of 1–4 → 2.5 ∈ [1, 4]; 500+ → hi = ∞."""
    N = np.array([[1, 0, 0, 0, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0, 0, 1]])
    e, lo, hi = employment(N)
    assert e.tolist() == [2.5, 514.0] and lo.tolist() == [1, 510] and hi[0] == 4 and np.isinf(hi[1])
    assert np.all((lo <= e) & (e <= hi))


def test_traded_share_longest_prefix():
    """Prefix 5 matches {311111 traded, 311119 local} → ½; wholesale 41 falls back to US sector 42."""
    US, T = ["311111", "311119", "423110", "424110"], {"311111", "423110", "424110"}
    assert traded_share("311110", US, T) == 0.5 and traded_share("411110", US, T) == 1.0


def test_sector_range_members():
    assert members("31-33", ["311110", "336410", "411110"]).tolist() == [True, True, False]
