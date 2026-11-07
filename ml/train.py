"""Train the time-split logistic creator model and export its JSON artifact."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, precision_score, recall_score, roc_auc_score
from sklearn.preprocessing import StandardScaler

from schema import FEATURE_ORDER, LABEL_RULES_VERSION


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: python ml/train.py LABELLED.jsonl src/lib/model/model-weights.json")
    rows = [json.loads(line) for line in Path(sys.argv[1]).read_text().splitlines() if line.strip()]
    rows = sorted((row for row in rows if row.get("label") in (0, 1)), key=lambda row: row["launch_time"])
    if len(rows) < 20:
        raise SystemExit("at least 20 labelled rows are required before training")

    x = np.array([[float(row["features"][name]) for name in FEATURE_ORDER] for row in rows])
    y = np.array([int(row["label"]) for row in rows])
    n_train = int(len(rows) * 0.70)
    n_val = int(len(rows) * 0.15)
    train_end, val_end = n_train, n_train + n_val
    scaler = StandardScaler().fit(x[:train_end])
    model = LogisticRegression(class_weight="balanced", max_iter=2000).fit(scaler.transform(x[:train_end]), y[:train_end])
    val_raw = model.predict_proba(scaler.transform(x[train_end:val_end]))[:, 1]
    calibrator = IsotonicRegression(out_of_bounds="clip").fit(val_raw, y[train_end:val_end])
    test_raw = model.predict_proba(scaler.transform(x[val_end:]))[:, 1]
    test_probability = calibrator.predict(test_raw)
    threshold = 0.5
    for candidate in np.linspace(0.05, 0.95, 181):
        if recall_score(y[train_end:val_end], calibrator.predict(val_raw) >= candidate, zero_division=0) >= 0.70:
            threshold = float(candidate)
            break
    artifact = {
        "version": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "label_rules_version": LABEL_RULES_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_train": train_end,
        "n_val": n_val,
        "n_test": len(rows) - val_end,
        "feature_order": list(FEATURE_ORDER),
        "means": scaler.mean_.tolist(),
        "stds": scaler.scale_.tolist(),
        "coef": model.coef_[0].tolist(),
        "intercept": float(model.intercept_[0]),
        "calibration": {"type": "isotonic", "x": calibrator.X_thresholds_.tolist(), "y": calibrator.y_thresholds_.tolist()},
        "metrics": {
            "roc_auc": float(roc_auc_score(y[val_end:], test_probability)),
            "brier": float(brier_score_loss(y[val_end:], test_probability)),
            "precision_at_threshold": float(precision_score(y[val_end:], test_probability >= threshold, zero_division=0)),
            "recall_at_threshold": float(recall_score(y[val_end:], test_probability >= threshold, zero_division=0)),
        },
        "threshold": threshold,
    }
    Path(sys.argv[2]).write_text(json.dumps(artifact, indent=2) + "\n")


if __name__ == "__main__":
    main()
