# TS-RugPull project model (research second opinion)

A small logistic model trained on the [TS-RugPull / RugPull1K dataset](https://huggingface.co/datasets/fati-80-Sho/RugPull1K):
1,000 Ethereum, BNB Chain, Polygon, Arbitrum and Fantom projects, manually labelled scam or normal by security analysts.

It uses Gabba's `ml/train.py` unchanged (time-ordered 70/15/15 split, standardisation, balanced logistic
regression, isotonic calibration). Only the feature list differs (`schema.py`): **chain + log holder count**,
the inputs the live app already gets from GoPlus. The app shows it as a "second opinion" panel for Ethereum
and BNB Chain tokens (`src/lib/project-model.ts`). It never replaces the main score.

## Retrain

```bash
pip install -r ml/requirements.txt
# download dataset.xlsx from the Hugging Face page into ml/data/ (git-ignored)
python ml/ts_rugpull/prepare.py ml/data/dataset.xlsx ml/data/ts_rugpull.jsonl
python ml/ts_rugpull/train_project_model.py ml/data/ts_rugpull.jsonl src/lib/model/project-model-weights.json
```

`train.py` overwrites the file, so re-add the `model`, `description`, `dataset`, `license` and `citation`
fields at the top afterwards.

## Results (2026-11-07)

- Test ROC-AUC **0.90** on the 150 newest projects (trained on the oldest 700, calibrated on the next 150).
- Fewer holders → more scam-like; BNB Chain slightly more scam-like than Ethereum.
- With richer features (transactions, early X/Google activity) an offline model reached ~0.93 AUC, but the app
  can't fetch those yet.
- `train.py`'s automatic threshold (0.05) is not used; the app uses the normal verdict bands.

## Limitations

- It mostly measures how established a project is. New legitimate tokens with few holders will score high.
- Holder counts in the dataset were probably collected after the fact, not at launch.
- The calibration set is only 150 projects, so probabilities are coarse; the app clamps them to 2–98%.

## Licence

The dataset is **CC BY-NC 4.0**: non-commercial use only, with attribution. Cite: Shoaei, Pishdar,
Bag-Mohammadi, Karami. *TS-RugPull: A Temporally Sound, Multimodal Dataset for Early Detection of Rug Pulls
Across the Tokenized Ecosystem.* Preprint, 2026.
