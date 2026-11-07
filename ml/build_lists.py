"""Build known-bad creator/funder lists from labelled training records only."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from schema import LABEL_RULES_VERSION


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: python ml/build_lists.py TRAIN.jsonl ml/exchange-allowlist.json src/lib/model/known-bad.json")
    records = [json.loads(line) for line in Path(sys.argv[1]).read_text().splitlines() if line.strip()]
    allowlist = {entry["address"].lower() for entry in json.loads(Path(sys.argv[2]).read_text())}
    rugged_creators = {r["creator_address"].lower() for r in records if r.get("label") == 1 and r.get("creator_address")}
    counts: dict[str, set[str]] = {}
    for record in records:
        funder = str(record.get("funder_address") or "").lower()
        creator = str(record.get("creator_address") or "").lower()
        if record.get("label") == 1 and funder and creator and funder not in allowlist:
            counts.setdefault(funder, set()).add(creator)
    funders = sorted(funder for funder, creators in counts.items() if len(creators) >= 2)
    result = {
        "creators": sorted(rugged_creators),
        "funders": funders,
        "generated_from": LABEL_RULES_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    Path(sys.argv[3]).write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
