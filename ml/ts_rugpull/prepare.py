"""Convert the TS-RugPull (RugPull1K) dataset.xlsx into the JSONL format ml/train.py expects.

usage: python ml/ts_rugpull/prepare.py ml/data/dataset.xlsx ml/data/ts_rugpull.jsonl

Reads the spreadsheet with the standard library only (an .xlsx is a zip of XML).
Columns used (Persian headers in the source): F = chain, H = holder count,
S = class (scam/normal), T = project start date (Excel serial).
"""

from __future__ import annotations

import json
import math
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timedelta, timezone

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def read_rows(path: str) -> list[dict[str, str | None]]:
    z = zipfile.ZipFile(path)
    shared: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si"):
            shared.append("".join(t.text or "" for t in si.iter(NS + "t")))
    rows = []
    for r in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).iter(NS + "row"):
        d: dict[str, str | None] = {}
        for c in r.iter(NS + "c"):
            col = re.match(r"[A-Z]+", c.get("r", "")).group()
            v = c.find(NS + "v")
            if c.get("t") == "inlineStr":
                d[col] = "".join(x.text or "" for x in c.iter(NS + "t"))
            elif v is None:
                d[col] = None
            elif c.get("t") == "s":
                d[col] = shared[int(v.text or 0)]
            else:
                d[col] = v.text
        rows.append(d)
    return rows[1:]  # drop header row


def num(x: str | None) -> float:
    try:
        return float(str(x).replace("\xa0", "").replace(",", "").strip())
    except ValueError:
        return math.nan


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: python ml/ts_rugpull/prepare.py dataset.xlsx out.jsonl")
    out = []
    for r in read_rows(sys.argv[1]):
        cls = (r.get("S") or "").strip().lower()
        start, holders = num(r.get("T")), num(r.get("H"))
        if cls not in ("scam", "normal") or math.isnan(start) or math.isnan(holders) or holders < 0:
            continue
        chain = (r.get("F") or "").strip().upper()
        out.append({
            "name": r.get("A"),
            "launch_time": (datetime(1899, 12, 30, tzinfo=timezone.utc) + timedelta(days=start)).isoformat(),
            "label": 1 if cls == "scam" else 0,
            "features": {
                "chain_eth": 1 if chain == "ETH" else 0,
                "chain_bsc": 1 if chain == "BSC" else 0,
                "log_holder_count": math.log1p(holders),
            },
        })
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        f.write("\n".join(json.dumps(o) for o in out) + "\n")
    print(f"wrote {len(out)} labelled projects")


if __name__ == "__main__":
    main()
