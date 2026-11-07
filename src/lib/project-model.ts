/**
 * Research "second opinion" model trained on the TS-RugPull (RugPull1K) dataset:
 * 1,000 manually labelled EVM projects. Trained with ml/train.py (see ml/ts_rugpull/).
 *
 * Pure and browser-safe, like rug-model.ts. It only uses inputs the live app already
 * has (chain + holder count), so it mostly measures how established a project is.
 * It is shown alongside the main score and never replaces it.
 */
import weightsJson from "./model/project-model-weights.json";
import { verdictFor, type TokenSignals, type Verdict } from "./rug-model";

export const PROJECT_FEATURE_ORDER = ["chain_eth", "chain_bsc", "log_holder_count"] as const;

export interface ProjectModelWeights {
  n_train: number;
  n_val: number;
  n_test: number;
  feature_order: string[];
  means: number[];
  stds: number[];
  coef: number[];
  intercept: number;
  calibration: { type: "isotonic"; x: number[]; y: number[] };
  metrics: { roc_auc: number };
}

export interface ProjectEstimate {
  /** Calibrated probability (0-1) that a project with these traits was labelled a scam. */
  probability: number;
  score: number; // 0-100
  verdict: Verdict;
  holderCount: number;
  testAuc: number;
  nTrain: number;
}

export type ProjectModelResult =
  | { available: true; estimate: ProjectEstimate }
  | { available: false; reason: "unsupported_chain" | "missing_holders" | "model_invalid" };

/** Displayed probabilities are kept away from 0/100% — the calibration set is only 150 projects. */
const MIN_P = 0.02;
const MAX_P = 0.98;

const finite = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === "number" && Number.isFinite(n));

export function parseProjectWeights(value: unknown): ProjectModelWeights | null {
  if (typeof value !== "object" || value === null) return null;
  const m = value as Partial<ProjectModelWeights>;
  const n = PROJECT_FEATURE_ORDER.length;
  if (
    !Array.isArray(m.feature_order) ||
    m.feature_order.length !== n ||
    !m.feature_order.every((f, i) => f === PROJECT_FEATURE_ORDER[i]) ||
    !finite(m.means) || m.means.length !== n ||
    !finite(m.stds) || m.stds.length !== n || m.stds.some((s) => s === 0) ||
    !finite(m.coef) || m.coef.length !== n ||
    typeof m.intercept !== "number" || !Number.isFinite(m.intercept) ||
    !m.calibration || !finite(m.calibration.x) || !finite(m.calibration.y) ||
    m.calibration.x.length !== m.calibration.y.length ||
    !Number.isInteger(m.n_train) || (m.n_train ?? 0) <= 0 ||
    typeof m.metrics?.roc_auc !== "number"
  ) {
    return null;
  }
  return m as ProjectModelWeights;
}

/** Linear interpolation between isotonic points, clipped at the ends (matches sklearn's predict). */
export function interpolate(raw: number, xs: number[], ys: number[]): number {
  if (xs.length === 0) return raw;
  if (raw <= xs[0]!) return ys[0]!;
  for (let i = 1; i < xs.length; i += 1) {
    if (raw <= xs[i]!) {
      const x0 = xs[i - 1]!, x1 = xs[i]!, y0 = ys[i - 1]!, y1 = ys[i]!;
      return x1 === x0 ? y1 : y0 + ((raw - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return ys[ys.length - 1]!;
}

export const PROJECT_WEIGHTS = parseProjectWeights(weightsJson);

export function estimateProject(
  s: Pick<TokenSignals, "chain" | "holderCount">,
  weights: ProjectModelWeights | null = PROJECT_WEIGHTS,
): ProjectModelResult {
  if (!weights) return { available: false, reason: "model_invalid" };
  if (s.chain !== "ethereum" && s.chain !== "bsc") return { available: false, reason: "unsupported_chain" };
  if (s.holderCount === null || !Number.isFinite(s.holderCount) || s.holderCount < 0) {
    return { available: false, reason: "missing_holders" };
  }
  const values = [s.chain === "ethereum" ? 1 : 0, s.chain === "bsc" ? 1 : 0, Math.log1p(s.holderCount)];
  const logit = values.reduce(
    (sum, v, i) => sum + ((v - weights.means[i]!) / weights.stds[i]!) * weights.coef[i]!,
    weights.intercept,
  );
  const raw = 1 / (1 + Math.exp(-logit));
  const calibrated = interpolate(raw, weights.calibration.x, weights.calibration.y);
  const probability = Math.min(MAX_P, Math.max(MIN_P, calibrated));
  return {
    available: true,
    estimate: {
      probability,
      score: Math.round(probability * 100),
      verdict: verdictFor(probability),
      holderCount: s.holderCount,
      testAuc: weights.metrics.roc_auc,
      nTrain: weights.n_train,
    },
  };
}
