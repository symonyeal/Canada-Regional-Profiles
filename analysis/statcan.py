"""Readers for Statistics Canada full-table CSVs (data/fetched/<name>.zip)."""
import zipfile

import pandas as pd

from analysis.fetch import CACHE, get

NAICS = "North American Industry Classification System (NAICS)"


def text(x):
    """Repair a string read as Latin-1: the files are UTF-8 with stray cp1252 bytes."""
    try: b = x.encode("latin-1")
    except (AttributeError, UnicodeEncodeError): return x          # not a string, or already repaired
    try: return b.decode("utf-8")
    except UnicodeDecodeError: return b.decode("cp1252", errors="replace")


def repair(D):
    """Apply text() to every string column and to the column names."""
    D = D.rename(columns=text)
    for c in D.columns:
        if D[c].dtype == object or str(D[c].dtype).startswith(("str", "string")): D[c] = D[c].map(text)
    return D


def table(name, cols=None, **kw):
    """The data CSV of a full-table zip, columns `cols` (plus VALUE). The files open with a UTF-8
    byte-order mark, so REF_DATE is matched as a substring."""
    keep = cols and {*cols, "VALUE"}
    with zipfile.ZipFile(get(name)) as z:
        n = next(x for x in z.namelist() if not x.endswith("MetaData.csv"))
        D = pd.read_csv(z.open(n), usecols=keep and (lambda c: c in keep or "REF_DATE" in c), low_memory=False,
                        encoding="latin-1", **kw)
    ref = lambda d: repair(d.rename(columns=lambda k: "REF_DATE" if "REF_DATE" in k else k))
    return (ref(c) for c in D) if "chunksize" in kw else ref(D)


def census(name):
    """A Census 2021 table, rows for Canada, provinces/territories and census divisions only
    (DGUID schema 0000, 0002, 0003); streamed once and cached. Columns are cleaned of their
    dimension prefixes, e.g. 'Labour force status (8):Employed[3]' → 'Employed'."""
    p = CACHE / f"{name}_slice.csv"
    if not p.exists():
        with zipfile.ZipFile(get(name)) as z:
            n = next(x for x in z.namelist() if not x.endswith("MetaData.csv"))
            R = pd.read_csv(z.open(n), chunksize=500_000, low_memory=False, encoding="latin-1")   # repaired on read
            pd.concat(c[c.DGUID.str[:9].isin(["2021A0000", "2021A0002", "2021A0003"])] for c in R).to_csv(p, index=False)
    D = repair(pd.read_csv(p, low_memory=False))
    D.columns = ["REF_DATE", *(c.split(":")[-1].split("[")[0].strip() if ":" in c else c for c in D.columns[1:])]
    return D.assign(level=D.DGUID.str[5:9].map({"0000": "CA", "0002": "PT", "0003": "CD"}), id=D.DGUID.str[9:])


def psis():
    """Enrolments by GEO (institution, province, Canada), year and 2-digit CIP series, all other
    dimensions at their totals. The 26 GB table is streamed once and the slice cached."""
    p = CACHE / "psis_slice.csv"
    if not p.exists():
        T = {"Program type": "Total, program type", "Credential type": "Total, credential type",
             "Institution type": "Total, institution type", "Registration status": "Total, registration status",
             "Status of student in Canada": "Total, status of student in Canada", "Gender": "Total, gender"}
        out = []
        for c in table("psis", ["REF_DATE", "GEO", "DGUID", "Field of study", *T], chunksize=1_000_000):
            k = (c[list(T)] == pd.Series(T)).all(axis=1)
            f = c["Field of study"]
            out.append(c[k & (f.str.match(r".*\[\d\d\.\]$") | (f == "Total, field of study"))].drop(columns=list(T)))
        pd.concat(out).to_csv(p, index=False)
    return repair(pd.read_csv(p)).rename(columns=lambda k: "REF_DATE" if "REF_DATE" in k else k)
