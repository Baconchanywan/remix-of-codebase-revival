"""Run Gabba's ml/train.py unchanged, but with this folder's schema.py (project features).

usage: python ml/ts_rugpull/train_project_model.py ml/data/ts_rugpull.jsonl src/lib/model/project-model-weights.json
"""

import runpy
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
sys.path.insert(0, str(here))  # our schema.py wins over ml/schema.py
sys.argv = [str(here.parent / "train.py"), *sys.argv[1:]]
runpy.run_path(str(here.parent / "train.py"), run_name="__main__")
