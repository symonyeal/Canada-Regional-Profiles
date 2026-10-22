from analysis.build_site import match_airport

A = {"city": ["Toronto", "Toronto", "Ottawa", "Ottawa", "Whitehorse", "Hay River", "Montreal", "Montréal"],
     "name": ["Billy Bishop Toronto City Airport", "Toronto Pearson International Airport", "Ottawa / Rockcliffe Airport",
              "Ottawa Macdonald-Cartier International Airport", "Whitehorse / Erik Nielsen International Airport",
              "Hay River / Merlyn Carter Airport", "Montreal / Pierre Elliott Trudeau International Airport",
              "Montréal-Mirabel International Airport"]}


def test_qualifier_resolves_shared_city():
    """Several airports in one city: the qualifier decides; an unlisted one stays unmatched."""
    m = lambda g: match_airport(g, A)
    toronto = ["Toronto/Billy Bishop Toronto City", "Toronto/Lester B Pearson International", "Toronto/Downsview"]
    assert [m(g) for g in toronto] == [0, 1, None]
    assert [m("Ottawa/Macdonald-Cartier International"), m("Whitehorse/Cousins"), m("Hay River")] == [3, None, 5]
    assert [m("Montréal/Mirabel International"), m("Montréal/Pierre Elliott Trudeau International")] == [7, 6]


def test_exact_name_breaks_tie():
    B = {"city": ["Vancouver", "Vancouver"], "name": ["Vancouver International Airport", "Vancouver International Water Airport"]}
    assert match_airport("Vancouver International", B) == 0
    C = {"city": ["St. John's"], "name": ["St. John's International Airport"]}
    assert match_airport("St John's International", C) == 0
