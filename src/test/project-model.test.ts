import { describe, expect, it } from "vitest";
import { PROJECT_WEIGHTS, estimateProject, interpolate, parseProjectWeights } from "@/lib/project-model";

describe("project model (TS-RugPull)", () => {
  it("loads the trained weights", () => {
    expect(PROJECT_WEIGHTS).not.toBeNull();
    expect(PROJECT_WEIGHTS!.n_train).toBeGreaterThan(0);
  });

  // Reference values from scikit-learn (same fit as ml/train.py), clamped to the 2-98% display range.
  it.each([
    ["ethereum", 50, 0.98],
    ["ethereum", 1_000, 0.6667],
    ["ethereum", 20_000, 0.1667],
    ["ethereum", 500_000, 0.02],
    ["bsc", 300, 0.98],
    ["bsc", 50_000, 0.6],
  ] as const)("matches sklearn for %s with %i holders", (chain, holderCount, expected) => {
    const r = estimateProject({ chain, holderCount });
    expect(r.available).toBe(true);
    if (r.available) expect(r.estimate.probability).toBeCloseTo(expected, 2);
  });

  it("is not available for Solana or when holder count is missing", () => {
    expect(estimateProject({ chain: "solana", holderCount: 1000 })).toEqual({ available: false, reason: "unsupported_chain" });
    expect(estimateProject({ chain: "ethereum", holderCount: null })).toEqual({ available: false, reason: "missing_holders" });
  });

  it("fewer holders never looks safer", () => {
    const p = (h: number) => {
      const r = estimateProject({ chain: "ethereum", holderCount: h });
      return r.available ? r.estimate.probability : NaN;
    };
    expect(p(100)).toBeGreaterThanOrEqual(p(10_000));
    expect(p(10_000)).toBeGreaterThanOrEqual(p(1_000_000));
  });

  it("rejects weights with the wrong features", () => {
    expect(parseProjectWeights({ ...PROJECT_WEIGHTS, feature_order: ["a", "b", "c"] })).toBeNull();
    expect(parseProjectWeights(null)).toBeNull();
  });

  it("interpolates between calibration points and clips at the ends", () => {
    expect(interpolate(0.5, [0, 1], [0, 1])).toBeCloseTo(0.5);
    expect(interpolate(-1, [0, 1], [0.2, 0.8])).toBe(0.2);
    expect(interpolate(2, [0, 1], [0.2, 0.8])).toBe(0.8);
  });
});
