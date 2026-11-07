import { describe, expect, it } from "vitest";
import {
  METRIC_INFO,
  UNKNOWN,
  readAge,
  readDataCompleteness,
  readHolders,
  readLiquidity,
  readLpLocked,
  readRugProbability,
  readTax,
  readTopHolders,
} from "@/lib/metric-info";

describe("metric judgments", () => {
  it("judges liquidity by depth", () => {
    expect(readLiquidity(10_000).judgment).toBe("risk");
    expect(readLiquidity(100_000).judgment).toBe("watch");
    expect(readLiquidity(2_000_000).judgment).toBe("good");
  });

  it("judges top-10 concentration (higher is worse)", () => {
    expect(readTopHolders(70).judgment).toBe("risk");
    expect(readTopHolders(35).judgment).toBe("watch");
    expect(readTopHolders(10).judgment).toBe("good");
  });

  it("judges LP locked (higher is better)", () => {
    expect(readLpLocked(0).judgment).toBe("risk");
    expect(readLpLocked(60).judgment).toBe("watch");
    expect(readLpLocked(95).judgment).toBe("good");
  });

  it("judges age", () => {
    expect(readAge(2).judgment).toBe("risk");
    expect(readAge(30).judgment).toBe("watch");
    expect(readAge(400).judgment).toBe("good");
  });

  it("judges holder count", () => {
    expect(readHolders(40).judgment).toBe("risk");
    expect(readHolders(500).judgment).toBe("watch");
    expect(readHolders(50_000).judgment).toBe("good");
  });

  it("judges tax by the worse of buy and sell", () => {
    expect(readTax(1, 15).judgment).toBe("risk");
    expect(readTax(7, 2).judgment).toBe("watch");
    expect(readTax(0, 0).judgment).toBe("good");
  });

  it("maps rug probability to the same bands as the verdict", () => {
    expect(readRugProbability(90).context).toBe("Critical");
    expect(readRugProbability(70).context).toBe("High");
    expect(readRugProbability(30).context).toBe("Elevated");
    expect(readRugProbability(5).context).toBe("Low");
  });

  it("flags data completeness below 60% as less certain", () => {
    expect(readDataCompleteness(0.5).judgment).toBe("watch");
    expect(readDataCompleteness(0.9).judgment).toBe("good");
  });
});

describe("missing data", () => {
  it("returns UNKNOWN for null values instead of guessing", () => {
    expect(readLiquidity(null)).toEqual(UNKNOWN);
    expect(readTopHolders(null)).toEqual(UNKNOWN);
    expect(readLpLocked(null)).toEqual(UNKNOWN);
    expect(readAge(null)).toEqual(UNKNOWN);
    expect(readHolders(null)).toEqual(UNKNOWN);
    expect(readTax(null, null)).toEqual(UNKNOWN);
    expect(readRugProbability(Number.NaN)).toEqual(UNKNOWN);
  });

  it("still judges tax when only one side is known", () => {
    expect(readTax(null, 12).judgment).toBe("risk");
  });
});

describe("metric definitions", () => {
  it("gives every metric a label, definition, meaning and rule", () => {
    for (const info of Object.values(METRIC_INFO)) {
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.definition.length).toBeGreaterThan(10);
      expect(info.meaning.length).toBeGreaterThan(10);
      expect(info.rule.length).toBeGreaterThan(5);
    }
  });
});
