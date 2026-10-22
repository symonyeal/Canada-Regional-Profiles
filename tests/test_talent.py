from analysis.talent import assign


def test_assign_prefers_more_specific_institution():
    """'Toronto Metropolitan University' goes to TMU, U of T campuses to U of T, an unrelated college nowhere."""
    names = ["University of Toronto", "Toronto Metropolitan University"]
    other = [f"Campus {chr(65 + k)}x{k}" for k in range(11)]        # eleven unrelated facilities
    F = ["University of Toronto Mississauga", "Toronto Metropolitan University", "Conestoga College",
         "University of Toronto Scarborough", *other]
    assert assign(names, F)[:4] == [0, 1, -1, 0]


def test_assign_single_facility():
    assert assign(["Yukon University"], ["Yukon University"]) == [0]
