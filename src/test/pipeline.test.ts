import { describe, expect, it } from "vitest";
import { checkPipelineAuth } from "@/lib/pipeline-auth.server";
import { snapshotRow, watchlistAlertsQuery, knownBadCandidatesQuery, labelRow } from "@/lib/pipeline-schemas";
import { CREATOR_FEATURE_ORDER } from "@/lib/rug-model";

const MINT = "So11111111111111111111111111111111111111112";

describe("pipeline endpoint auth", () => {
  it("rejects a request without a bearer token", () => {
    expect(checkPipelineAuth(null, "secret-value")?.status).toBe(401);
  });

  it("rejects a wrong token", () => {
    expect(checkPipelineAuth("Bearer wrong", "secret-value")?.status).toBe(401);
  });

  it("allows the matching token", () => {
    expect(checkPipelineAuth("Bearer secret-value", "secret-value")).toBeNull();
  });

  it("fails closed when the token is not configured", () => {
    expect(checkPipelineAuth("Bearer anything", undefined)?.status).toBe(500);
  });
});

describe("pipeline rules", () => {
  it("watchlist alerts default to a 20-point trust drop or 50% liquidity drop", () => {
    expect(watchlistAlertsQuery.parse({})).toEqual({ trust_drop: 20, liquidity_drop: 50 });
  });

  it("known-bad funders need at least 2 rugged creators by default", () => {
    expect(knownBadCandidatesQuery.parse({}).min_funder_count).toBe(2);
  });

  it("refuses snapshots that are missing a model feature", () => {
    const features = Object.fromEntries(CREATOR_FEATURE_ORDER.map((k) => [k, 0]));
    const base = { mint: MINT, decision_time: "2026-11-07T10:00:00Z", provider_observed_at: "2026-11-07T10:00:05Z" };
    expect(snapshotRow.safeParse({ ...base, features }).success).toBe(true);
    const { buyers_first_hour: _drop, ...partial } = features;
    expect(snapshotRow.safeParse({ ...base, features: partial }).success).toBe(false);
  });

  it("labels must be 0, 1 or empty", () => {
    const base = { mint: MINT, status: "labelled", label_rules_version: "v1" };
    expect(labelRow.safeParse({ ...base, label: 1 }).success).toBe(true);
    expect(labelRow.safeParse({ ...base, label: 2 }).success).toBe(false);
  });
});
