import { describe, expect, it } from "vitest";
import { emptySignals, matchHistoricalCases, scoreToken, verdictFor } from "@/lib/rug-model";

const base = () => emptySignals("bsc", "0x0000000000000000000000000000000000000001");

describe("rug pull model", () => {
  it("flags a fresh honeypot with unlocked liquidity as a likely rug pull", () => {
    const s = { ...base(), isHoneypot: true, lpLockedPct: 0, pairAgeDays: 0.5, top10Pct: 85, liquidityUsd: 5000 };
    const r = scoreToken(s);
    expect(r.verdict).toBe("critical");
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.matches[0]?.case.symbol).toBe("SQUID");
  });

  it("rates an old, trusted, deep-liquidity token as low risk", () => {
    const s = {
      ...base(),
      trusted: true,
      cexListed: true,
      pairAgeDays: 900,
      liquidityUsd: 20_000_000,
      holderCount: 500_000,
      lpLockedPct: 95,
      openSource: true,
    };
    const r = scoreToken(s);
    expect(r.verdict).toBe("low");
    expect(r.redFlags).toHaveLength(0);
    expect(r.matches).toHaveLength(0);
  });

  it("treats a 50%+ sell tax as a tax trap red flag", () => {
    const r = scoreToken({ ...base(), sellTaxPct: 60 });
    expect(r.redFlags.map((f) => f.id)).toContain("sell_tax");
    expect(r.patterns).toContain("tax_trap");
  });

  it("uses the verdict thresholds 25 / 60 / 85", () => {
    expect(verdictFor(0.24)).toBe("low");
    expect(verdictFor(0.25)).toBe("elevated");
    expect(verdictFor(0.6)).toBe("high");
    expect(verdictFor(0.85)).toBe("critical");
  });

  it("returns no historical matches when no patterns are present", () => {
    expect(matchHistoricalCases([])).toEqual([]);
  });
});
