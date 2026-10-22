"""The thirteen provinces and territories, in release order: territories first, then west to east.
PRUID is the Statistics Canada province/territory code; NAME matches the GEO column of StatCan
tables and the POL_DIV field of the Atlas of Canada."""
PT = [  # (code, PRUID, NAME)
    ("YT", "60", "Yukon"), ("NT", "61", "Northwest Territories"), ("NU", "62", "Nunavut"),
    ("BC", "59", "British Columbia"), ("AB", "48", "Alberta"), ("SK", "47", "Saskatchewan"),
    ("MB", "46", "Manitoba"), ("ON", "35", "Ontario"), ("QC", "24", "Quebec"),
    ("NB", "13", "New Brunswick"), ("NS", "12", "Nova Scotia"), ("PE", "11", "Prince Edward Island"),
    ("NL", "10", "Newfoundland and Labrador"),
]
CODE = {c: (u, n) for c, u, n in PT}
