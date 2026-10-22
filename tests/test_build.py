import pytest

pytestmark = pytest.mark.slow     # needs data/fetched (py -3.14 analysis/fetch.py)


@pytest.mark.parametrize("code", ["YT", "NT", "NU"])
def test_build_certificates(code):
    """build() asserts its certificates: industry levels partition one total; size classes partition
    the business total; broadband CD and hexagon sums equal the household total."""
    from analysis.build_site import build
    D = build(code)
    B = D["logistics"]["broadband"]
    assert 0 <= B["share50"] <= 1 and abs(sum(B["cd"]["households"]) - B["households"]) <= len(B["cd"]["id"])
