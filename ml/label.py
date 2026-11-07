"""Apply the versioned v1 outcome rules to token history records.

Input is JSONL with launch_time, observed_days, peak_liquidity_usd and a
liquidity_or_price_history list containing {"days": number, "value": number}.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

from schema import LABEL_RULES_VERSION


@dataclass(frozen=True)
class LabelResult:
    label: int | None
    reason: str | None


def label_token(record: dict) -> LabelResult:
    if record.get("observed_days", 0) < 30:
        return LabelResult(None, "insufficient_age")
    history = record.get("liquidity_or_price_history", [])
    if not history or record.get("history_missing_fraction", 1) > 0.2:
        return LabelResult(None, "insufficient_history")
    peak = float(record.get("peak_liquidity_usd", 0))
    if peak < 5_000:
        return LabelResult(None, "below_liquidity_floor")

    values = [float(item["value"]) for item in history if "value" in item]
    if not values:
        return LabelResult(None, "insufficient_history")
    early_values = [float(item["value"]) for item in history if float(item.get("days", 999)) <= 7]
    if not early_values:
        return LabelResult(None, "insufficient_history")
    minimum_7d = min(early_values)
    rugged = minimum_7d <= max(values) * 0.1 or bool(record.get("confirmed_lp_removal"))
    survived = float(record.get("value_at_30d", 0)) >= peak * 0.5
    if rugged:
        return LabelResult(1, None)
    if survived:
        return LabelResult(0, None)
    return LabelResult(None, "ambiguous_slow_bleed")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: python ml/label.py INPUT.jsonl OUTPUT.jsonl")
    output: list[dict] = []
    for line in Path(sys.argv[1]).read_text().splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        result = label_token(record)
        output.append({**record, "label": result.label, "exclusion_reason": result.reason, "label_rules_version": LABEL_RULES_VERSION})
    Path(sys.argv[2]).write_text("\n".join(json.dumps(row) for row in output) + "\n")


if __name__ == "__main__":
    main()
