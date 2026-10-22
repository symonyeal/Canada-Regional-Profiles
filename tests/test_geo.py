import numpy as np

from analysis.geo import lcc_forward, lcc_inverse, inside


def test_snyder_worked_example():
    """Snyder (1987) pp. 296-297: Clarke 1866, φ1 = 33°, φ2 = 45°, φ0 = 23°, λ0 = −96°;
    x = 1,894,410.9 m, y = 1,564,649.5 m ↦ φ = 35°, λ = −75°."""
    phi, lam = lcc_inverse(1894410.9, 1564649.5, 6378206.4, 0.00676866, 33, 45, 23, -96)
    assert abs(phi - 35) < 1e-6 and abs(lam + 75) < 1e-6


def test_forward_inverts_inverse():
    """Snyder forward example: (35°, −75°) ↦ (1,894,410.9, 1,564,649.5) m, to 0.1 m."""
    x, y = lcc_forward(35, -75, 6378206.4, 0.00676866, 33, 45, 23, -96)
    assert abs(x - 1894410.9) < 0.1 and abs(y - 1564649.5) < 0.1


def test_origin_maps_to_origin():
    phi, lam = lcc_inverse(0.0, 0.0, 6378137.0, 0.0066943800229, 49, 77, 49, -95)
    assert abs(phi - 49) < 1e-9 and abs(lam + 95) < 1e-9


def test_even_odd_rule():
    """Unit square with a hole [¼, ¾]²: centre outside, (0.1, 0.1) inside, (2, 2) outside."""
    R = [np.array([[0, 0], [1, 0], [1, 1], [0, 1]]), np.array([[.25, .25], [.75, .25], [.75, .75], [.25, .75]])]
    assert inside([[.5, .5], [.1, .1], [2, 2]], R).tolist() == [False, True, False]
