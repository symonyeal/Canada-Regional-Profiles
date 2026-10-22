"""Download registry. Every input is a public file named here; get(name) caches it in data/fetched.

Usage: py -3.14 analysis/fetch.py            # fetch all
"""
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "fetched"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

STATCAN = "https://www150.statcan.gc.ca/n1/tbl/csv/{}-eng.zip"
ATLAS = "https://ftp.geogratis.gc.ca/pub/nrcan_rncan/vector/framework_cadre/Atlas_of_Canada_1M/"
ISED = "https://ised-isde.canada.ca/app/scr/sittibc/web/api/openData/"
SCH = ("https://egisp.dfo-mpo.gc.ca/arcgis/rest/services/open_data_donnees_ouvertes/small_craft_harbours_en/"
       "MapServer/{}/query?where=1%3D1&outFields=Harbour_Name,Province,Harbour_Type,Latitude,Longitude"
       "&returnGeometry=false&f=json")

SOURCES = {
    # Statistics Canada tables (full-table CSV)
    "bc_2606": STATCAN.format(33101174),     # Canadian Business Counts, with employees, June 2026
    "bc_2106": STATCAN.format(33100395),     # Canadian Business Counts, with employees, June 2021
    "bc_csd_2606": STATCAN.format(33101176),  # same, by CMA and CSD, June 2026
    "psis": STATCAN.format(37100277),        # postsecondary enrolments by institution and detailed field
    "pop_q": STATCAN.format(17100009),       # population estimates, quarterly
    "lfs_t": STATCAN.format(14100292),       # LFS, territories, three-month moving average
    "lfs_p": STATCAN.format(14100287),       # LFS, provinces, monthly
    "air": STATCAN.format(23100253),         # air passenger traffic at Canadian airports, annual
    # Census 2021, Canada / provinces and territories / census divisions / census subdivisions
    "c_pop": STATCAN.format(98100004),       # population and dwelling counts
    "c_age": STATCAN.format(98100022),       # age, median age
    "c_lfs": STATCAN.format(98100400),       # labour force status by highest level of education
    "c_ind": STATCAN.format(98100293),       # Indigenous identity population
    "c_inc": STATCAN.format(98100057),       # household income statistics
    "c_dwl": STATCAN.format(98100240),       # structural type of dwelling by tenure
    # spatial layers
    "roads": ATLAS + "transportation/AC_1M_Roads.shp.zip",
    "rail": ATLAS + "transportation/AC_1M_Railways.shp.zip",
    "bounds": ATLAS + "boundary/AC_1M_BoundaryPolygons.shp.zip",
    "phh": ISED + "PHH_2021_CSV.zip",
    "nbd": ISED + "NBD_PHH_Speeds.zip",
    "airports": "https://davidmegginson.github.io/ourairports-data/airports.csv",
    "wpi": "https://msi.nga.mil/api/publications/download?key=16920959/SFH00000/UpdatedPub150.csv&type=download",
    "sch0": SCH.format(0), "sch1": SCH.format(1), "sch2": SCH.format(2),
}
EXT = {"airports": ".csv", "wpi": ".csv", "sch0": ".json", "sch1": ".json", "sch2": ".json"}


def get(name):
    """Local path of source `name`, downloaded on first use."""
    p = CACHE / (name + EXT.get(name, ".zip"))
    if not p.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        q = urllib.request.Request(SOURCES[name], headers={"User-Agent": UA})
        with urllib.request.urlopen(q, timeout=1800) as r, open(p.with_suffix(".part"), "wb") as f:
            while b := r.read(1 << 20): f.write(b)
        with open(p.with_suffix(".part"), "rb") as f: head = f.read(2)
        if p.suffix == ".zip" and head != b"PK":
            raise OSError(f"{name}: not a zip (service unavailable?)")
        p.with_suffix(".part").replace(p)
    return p


if __name__ == "__main__":
    for k in sys.argv[1:] or SOURCES:
        print(k, get(k).stat().st_size)
