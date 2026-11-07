/**
 * Plain-English definitions and rules-of-thumb for every number on the result page.
 * Pure and browser-safe. Thresholds are heuristics, not facts, and are labelled that way in the UI.
 */

export type Judgment = "good" | "watch" | "risk" | "unknown";

export interface MetricInfo {
  label: string;
  definition: string;
  /** What the value means for a buyer. */
  meaning: string;
  /** The rule of thumb used to judge the value. */
  rule: string;
}

export interface MetricReading {
  judgment: Judgment;
  /** Short context shown next to the value, e.g. "Low — most liquidity can be removed". */
  context: string;
}

export const UNKNOWN: MetricReading = {
  judgment: "unknown",
  context: "Not available for this token",
};

export const METRIC_INFO = {
  liquidity: {
    label: "Liquidity",
    definition:
      "Money in the trading pool that lets people buy and sell this token.",
    meaning:
      "Thin liquidity means a small sale can move the price a lot, or leave you unable to sell.",
    rule: "Under $50K is risky, $50K–$500K is watch, over $500K is healthier.",
  },
  marketCap: {
    label: "Market cap",
    definition: "Total value of all tokens, at the current price.",
    meaning:
      "Shows the size of the project. Very small caps are easier to move by a few traders.",
    rule: "Context only, not scored on its own.",
  },
  topHolders: {
    label: "Top 10 holders own",
    definition:
      "Share of the supply held by the 10 largest wallets, excluding burned and locked tokens.",
    meaning:
      "If a few wallets hold most of the supply, they can sell and crash the price.",
    rule: "Over 50% is high concentration, 25–50% is watch, under 25% is spread out.",
  },
  lpLocked: {
    label: "Liquidity locked",
    definition: "Share of the liquidity-pool tokens that are locked or burned.",
    meaning:
      "If liquidity isn't locked, the team can withdraw it and leave holders unable to sell.",
    rule: "Under 50% is risky, 50–80% is watch, over 80% is locked.",
  },
  age: {
    label: "Age",
    definition: "How long the token has been trading.",
    meaning:
      "Brand-new tokens carry more risk, because rug pulls often happen soon after launch.",
    rule: "Under 7 days is risky, under 60 days is watch, older is more established.",
  },
  holders: {
    label: "Holders",
    definition: "Number of wallets that hold this token.",
    meaning:
      "More holders usually means the token is spread across more people.",
    rule: "Under 100 is risky, under 1,000 is watch, more is healthier.",
  },
  tax: {
    label: "Buy / sell tax",
    definition:
      "Fee taken from each buy and each sell by the token's contract.",
    meaning:
      "High or hidden taxes can make it hard to profit, and some contracts use them to trap sellers.",
    rule: "Over 10% is risky, 5–10% is watch, under 5% is normal.",
  },
  change24h: {
    label: "24h change",
    definition: "Price change over the last 24 hours.",
    meaning:
      "A big drop can mean holders are selling or that the price is already collapsing.",
    rule: "Context only, not scored on its own.",
  },
  dataCompleteness: {
    label: "Data completeness",
    definition: "Share of the safety checks that had data for this token.",
    meaning:
      "This is about how much we could check, not how safe the token is. Low completeness means less certainty.",
    rule: "Under 60% means treat the score as less certain.",
  },
  rugProbability: {
    label: "Estimated rug-pull probability",
    definition:
      "A model's estimate of how likely this token is to be a rug pull, based on the signals above.",
    meaning:
      "It's an estimate built from patterns in past scams, not a guarantee in either direction.",
    rule: "Under 25% low, 25–60% elevated, 60–85% high, over 85% critical.",
  },
} as const satisfies Record<string, MetricInfo>;

export type MetricKey = keyof typeof METRIC_INFO;

/** Returns a judgment and short context for a value, given the rule for that metric. */
function band(
  value: number | null,
  risky: number,
  watch: number,
  higherIsBetter: boolean,
  labels: [string, string, string],
): MetricReading {
  if (value === null || !Number.isFinite(value)) return UNKNOWN;
  const [bad, mid, good] = labels;
  if (higherIsBetter) {
    if (value < risky) return { judgment: "risk", context: bad };
    if (value < watch) return { judgment: "watch", context: mid };
    return { judgment: "good", context: good };
  }
  if (value > risky) return { judgment: "risk", context: bad };
  if (value > watch) return { judgment: "watch", context: mid };
  return { judgment: "good", context: good };
}

export function readLiquidity(usd: number | null): MetricReading {
  return band(usd, 50_000, 500_000, true, [
    "Low, a sell could move the price a lot",
    "Moderate, watch the depth",
    "Healthy depth",
  ]);
}

export function readTopHolders(pct: number | null): MetricReading {
  return band(pct, 50, 25, false, [
    "High concentration, a few wallets hold most supply",
    "Moderate concentration",
    "Supply is spread out",
  ]);
}

export function readLpLocked(pct: number | null): MetricReading {
  if (pct === null || !Number.isFinite(pct)) return UNKNOWN;
  if (pct < 50)
    return { judgment: "risk", context: "Low, most liquidity can be removed" };
  if (pct < 80) return { judgment: "watch", context: "Partly locked" };
  return { judgment: "good", context: "Mostly locked or burned" };
}

export function readAge(days: number | null): MetricReading {
  if (days === null || !Number.isFinite(days)) return UNKNOWN;
  if (days < 7) return { judgment: "risk", context: "Very new, higher risk" };
  if (days < 60) return { judgment: "watch", context: "Still new" };
  return { judgment: "good", context: "Established" };
}

export function readHolders(count: number | null): MetricReading {
  if (count === null || !Number.isFinite(count)) return UNKNOWN;
  if (count < 100) return { judgment: "risk", context: "Very few holders" };
  if (count < 1000) return { judgment: "watch", context: "Small holder base" };
  return { judgment: "good", context: "Broad holder base" };
}

export function readTax(
  buy: number | null,
  sell: number | null,
): MetricReading {
  if (buy === null && sell === null) return UNKNOWN;
  const worst = Math.max(buy ?? 0, sell ?? 0);
  if (worst > 10) return { judgment: "risk", context: "High tax on trades" };
  if (worst > 5) return { judgment: "watch", context: "Noticeable tax" };
  return { judgment: "good", context: "Normal tax" };
}

export function readDataCompleteness(coverage: number): MetricReading {
  if (!Number.isFinite(coverage)) return UNKNOWN;
  if (coverage < 0.6)
    return { judgment: "watch", context: "Limited data, less certain" };
  return { judgment: "good", context: "Most checks had data" };
}

/** Maps a probability in percent (0–100) to the same band the verdict uses. */
export function readRugProbability(percent: number): MetricReading {
  if (!Number.isFinite(percent)) return UNKNOWN;
  if (percent >= 85) return { judgment: "risk", context: "Critical" };
  if (percent >= 60) return { judgment: "risk", context: "High" };
  if (percent >= 25) return { judgment: "watch", context: "Elevated" };
  return { judgment: "good", context: "Low" };
}
