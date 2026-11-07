/**
 * Rug-pull risk model.
 *
 * A logistic model over on-chain signals. Each signal's weight reflects how often
 * that red flag preceded documented rug pulls (see HISTORICAL_CASES). Pure and
 * browser-safe so it can be unit tested and shared by server + client.
 */
import modelWeightsJson from "./model/model-weights.json";

export type Chain = "ethereum" | "bsc" | "solana";

export interface CreatorFeatures {
  creator_prev_token_count: number;
  creator_prev_rug_rate: number;
  creator_prev_rug_rate_missing: number;
  creator_wallet_age_days: number;
  creator_wallet_age_missing: number;
  creator_tx_count_pre_launch: number;
  funder_is_known_bad: number;
  funder_rugged_creator_count: number;
  funder_missing: number;
  mint_authority_revoked_at_launch: number;
  mint_authority_revoked_at_launch_missing: number;
  freeze_authority_revoked_at_launch: number;
  freeze_authority_revoked_at_launch_missing: number;
  buyers_first_hour: number;
  buyer_funder_overlap: number;
  buyer_funder_overlap_missing: number;
}

export type CreatorModelConfidence = "high" | "medium" | "low";
export type ModelStatus = "trained" | "fallback";

export const CHAIN_LABELS: Record<Chain, string> = {
  ethereum: "Ethereum",
  bsc: "BNB Chain",
  solana: "Solana",
};

/** Normalised signals for one token. `null` = unknown / not reported by data sources. */
export interface TokenSignals {
  chain: Chain;
  address: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  dexUrl: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  pairAgeDays: number | null;
  priceChange24h: number | null;
  volume24hUsd: number | null;
  holderCount: number | null;
  /** % of supply held by top 10 wallets, excluding burn/locked addresses (0-100). */
  top10Pct: number | null;
  /** % of supply held by creator/owner (0-100). */
  creatorPct: number | null;
  /** % of liquidity that is locked or burned (0-100). */
  lpLockedPct: number | null;
  buyTaxPct: number | null;
  sellTaxPct: number | null;
  isHoneypot: boolean | null;
  cannotBuy: boolean | null;
  ownerCanChangeBalance: boolean | null;
  hiddenOwner: boolean | null;
  canTakeBackOwnership: boolean | null;
  mintable: boolean | null;
  transferPausable: boolean | null;
  hasBlacklist: boolean | null;
  taxModifiable: boolean | null;
  isProxy: boolean | null;
  openSource: boolean | null;
  selfDestruct: boolean | null;
  creatorPastHoneypots: boolean | null;
  freezeAuthority: boolean | null;
  closable: boolean | null;
  transferHook: boolean | null;
  metadataMutable: boolean | null;
  nonTransferable: boolean | null;
  trusted: boolean | null;
  cexListed: boolean | null;
  /** RugCheck normalised risk score (0-100, higher = riskier). Solana only. */
  externalRiskScore: number | null;
  creatorFeatures: CreatorFeatures | null;
  creatorAddress: string | null;
  funderAddress: string | null;
}

export type PatternTag =
  | "honeypot"
  | "liquidity_pull"
  | "owner_control"
  | "hidden_code"
  | "concentration"
  | "fresh_launch"
  | "thin_liquidity"
  | "tax_trap"
  | "price_collapse";

export const PATTERN_LABELS: Record<PatternTag, string> = {
  honeypot: "Can't sell",
  liquidity_pull: "Removable liquidity",
  owner_control: "Owner super-powers",
  hidden_code: "Hidden / unverified code",
  concentration: "Whale concentration",
  fresh_launch: "Brand-new launch",
  thin_liquidity: "Thin liquidity",
  tax_trap: "Tax trap",
  price_collapse: "Price collapse",
};

export interface Factor {
  id: string;
  label: string;
  detail: string;
  /** Log-odds contribution. Positive = riskier, negative = safer. */
  weight: number;
  pattern: PatternTag | null;
}

export type Verdict = "low" | "elevated" | "high" | "critical";

export interface RiskResult {
  probability: number; // 0-1
  score: number; // 0-100
  verdict: Verdict;
  redFlags: Factor[];
  greenFlags: Factor[];
  patterns: PatternTag[];
  coverage: number; // 0-1 share of signals that were known
  matches: CaseMatch[];
  trust: number;
  confidence: CreatorModelConfidence;
  creatorModelSupported: boolean;
  modelStatus: ModelStatus;
  modelVersion: string;
}

export interface HistoricalCase {
  name: string;
  symbol: string;
  chain: Chain;
  date: string;
  lossUsd: string;
  summary: string;
  patterns: PatternTag[];
}

export interface CaseMatch {
  case: HistoricalCase;
  similarity: number; // 0-1
  shared: PatternTag[];
}

interface ModelWeights {
  version: string;
  label_rules_version: string;
  trained_at: string;
  n_train: number;
  n_val: number;
  n_test: number;
  feature_order: string[];
  means: number[];
  stds: number[];
  coef: number[];
  intercept: number;
  calibration: { type: "isotonic"; x: number[]; y: number[] };
  metrics: Record<string, number>;
  threshold: number;
}

export interface KnownBadAddresses {
  creators: ReadonlySet<string>;
  funders: ReadonlySet<string>;
}

export interface ScoreOptions {
  knownBad?: KnownBadAddresses;
}

export const CREATOR_FEATURE_ORDER: (keyof CreatorFeatures)[] = [
  "creator_prev_token_count",
  "creator_prev_rug_rate",
  "creator_prev_rug_rate_missing",
  "creator_wallet_age_days",
  "creator_wallet_age_missing",
  "creator_tx_count_pre_launch",
  "funder_is_known_bad",
  "funder_rugged_creator_count",
  "funder_missing",
  "mint_authority_revoked_at_launch",
  "mint_authority_revoked_at_launch_missing",
  "freeze_authority_revoked_at_launch",
  "freeze_authority_revoked_at_launch_missing",
  "buyers_first_hour",
  "buyer_funder_overlap",
  "buyer_funder_overlap_missing",
];

function isFiniteArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => typeof n === "number" && Number.isFinite(n));
}

function parseModelWeights(value: unknown): ModelWeights | null {
  if (typeof value !== "object" || value === null) return null;
  const m = value as Partial<ModelWeights>;
  if (
    typeof m.version !== "string" ||
    typeof m.label_rules_version !== "string" ||
    typeof m.trained_at !== "string" ||
    !Number.isInteger(m.n_train) ||
    !Number.isInteger(m.n_val) ||
    !Number.isInteger(m.n_test) ||
    !Array.isArray(m.feature_order) ||
    !m.feature_order.every((f) => typeof f === "string") ||
    !isFiniteArray(m.means) ||
    !isFiniteArray(m.stds) ||
    !isFiniteArray(m.coef) ||
    m.feature_order.length !== m.means.length ||
    m.feature_order.length !== m.stds.length ||
    m.feature_order.length !== m.coef.length ||
    m.stds.some((n) => n === 0) ||
    typeof m.intercept !== "number" ||
    !Number.isFinite(m.intercept) ||
    typeof m.calibration !== "object" ||
    m.calibration === null ||
    m.calibration.type !== "isotonic" ||
    !isFiniteArray(m.calibration.x) ||
    !isFiniteArray(m.calibration.y) ||
    m.calibration.x.length !== m.calibration.y.length ||
    typeof m.threshold !== "number" ||
    !Number.isFinite(m.threshold)
  ) {
    return null;
  }
  return m as ModelWeights;
}

const MODEL_WEIGHTS = parseModelWeights(modelWeightsJson);
const MODEL_IS_TRAINED =
  MODEL_WEIGHTS !== null &&
  MODEL_WEIGHTS.n_train > 0 &&
  MODEL_WEIGHTS.feature_order.length === CREATOR_FEATURE_ORDER.length &&
  MODEL_WEIGHTS.feature_order.every((f, i) => f === CREATOR_FEATURE_ORDER[i]);

/** Documented rug pulls and the red flags they showed before collapsing. Losses approximate. */
export const HISTORICAL_CASES: HistoricalCase[] = [
  {
    name: "Squid Game",
    symbol: "SQUID",
    chain: "bsc",
    date: "Nov 2021",
    lossUsd: "~$3.4M",
    summary:
      "Contract blocked holders from selling while price soared, then developers drained the pool.",
    patterns: ["honeypot", "fresh_launch", "concentration", "liquidity_pull", "price_collapse"],
  },
  {
    name: "AnubisDAO",
    symbol: "ANKH",
    chain: "ethereum",
    date: "Oct 2021",
    lossUsd: "~$60M",
    summary: "Raised funds from an anonymous team; the liquidity pool was emptied within a day of launch.",
    patterns: ["fresh_launch", "liquidity_pull", "owner_control"],
  },
  {
    name: "Meerkat Finance",
    symbol: "MKAT",
    chain: "bsc",
    date: "Mar 2021",
    lossUsd: "~$31M",
    summary: "Upgradeable contract was swapped for a malicious version a day after launch, draining vaults.",
    patterns: ["owner_control", "fresh_launch", "hidden_code"],
  },
  {
    name: "Turtledex",
    symbol: "TTDX",
    chain: "bsc",
    date: "Mar 2021",
    lossUsd: "~$2.5M",
    summary: "Developers pulled liquidity days after the presale and deleted all socials.",
    patterns: ["liquidity_pull", "fresh_launch", "concentration", "price_collapse"],
  },
  {
    name: "Compounder Finance",
    symbol: "CP3R",
    chain: "ethereum",
    date: "Dec 2020",
    lossUsd: "~$10.8M",
    summary: "Owner swapped strategy contracts to ones that let them withdraw all user funds.",
    patterns: ["owner_control", "hidden_code"],
  },
  {
    name: "Luna Yield",
    symbol: "LYIELD",
    chain: "solana",
    date: "Aug 2021",
    lossUsd: "~$6.7M",
    summary: "Unaudited project removed liquidity right after launch and vanished.",
    patterns: ["liquidity_pull", "fresh_launch", "hidden_code", "price_collapse"],
  },
  {
    name: "Solfire Finance",
    symbol: "FIRE",
    chain: "solana",
    date: "Jan 2022",
    lossUsd: "~$4.8M",
    summary: "Team withdrew deposited funds and took the website and socials offline.",
    patterns: ["owner_control", "liquidity_pull", "concentration"],
  },
  {
    name: "LIBRA",
    symbol: "LIBRA",
    chain: "solana",
    date: "Feb 2025",
    lossUsd: "~$100M+",
    summary: "Insiders held most of the supply and extracted liquidity within hours, crashing price ~90%.",
    patterns: ["concentration", "fresh_launch", "thin_liquidity", "price_collapse", "liquidity_pull"],
  },
  {
    name: "Tax-trap memecoins",
    symbol: "VARIOUS",
    chain: "bsc",
    date: "2021–2024",
    lossUsd: "Many small losses",
    summary: "Owner raises sell tax to near 100% after buyers pile in, trapping funds.",
    patterns: ["tax_trap", "owner_control", "honeypot", "fresh_launch"],
  },
];

const BIAS = -2.2;

const SIGNAL_KEYS: (keyof TokenSignals)[] = [
  "liquidityUsd",
  "pairAgeDays",
  "holderCount",
  "top10Pct",
  "lpLockedPct",
  "sellTaxPct",
  "isHoneypot",
  "mintable",
  "openSource",
  "ownerCanChangeBalance",
  "freezeAuthority",
  "creatorPct",
];

function fmtPct(n: number) {
  return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}%`;
}

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/** Collect every factor that applies to the token. */
export function extractFactors(s: TokenSignals): Factor[] {
  const f: Factor[] = [];
  const add = (id: string, label: string, detail: string, weight: number, pattern: PatternTag | null) =>
    f.push({ id, label, detail, weight, pattern });

  // --- Can holders actually sell? ---
  if (s.isHoneypot) add("honeypot", "Honeypot detected", "Simulated sells fail — buyers may never get out.", 4.5, "honeypot");
  if (s.nonTransferable) add("non_transferable", "Token can't be transferred", "Holders cannot move or sell the token.", 4, "honeypot");
  if (s.cannotBuy) add("cannot_buy", "Buying is blocked", "The contract currently refuses purchases.", 1.2, "honeypot");

  // --- Taxes ---
  if (s.sellTaxPct !== null) {
    if (s.sellTaxPct >= 50) add("sell_tax", "Extreme sell tax", `${fmtPct(s.sellTaxPct)} of every sale is taken.`, 3.5, "tax_trap");
    else if (s.sellTaxPct >= 10) add("sell_tax", "High sell tax", `${fmtPct(s.sellTaxPct)} of every sale is taken.`, 1.5, "tax_trap");
  }
  if (s.buyTaxPct !== null && s.buyTaxPct >= 10) add("buy_tax", "High buy tax", `${fmtPct(s.buyTaxPct)} taken on every buy.`, 0.8, "tax_trap");
  if (s.taxModifiable) add("tax_modifiable", "Owner can change taxes", "Taxes can be raised at any time — a classic trap.", 1.3, "tax_trap");

  // --- Owner powers ---
  if (s.ownerCanChangeBalance) add("balance_mod", "Owner can edit balances", "Wallet balances can be changed by the owner.", 2.8, "owner_control");
  if (s.hiddenOwner) add("hidden_owner", "Hidden owner", "Ownership looks renounced but control remains.", 1.8, "owner_control");
  if (s.canTakeBackOwnership) add("reclaim_owner", "Ownership can be reclaimed", "A 'renounced' owner can come back.", 1.6, "owner_control");
  if (s.mintable) add("mintable", "New tokens can be minted", "Supply can be inflated and dumped on holders.", 1.2, "owner_control");
  if (s.freezeAuthority) add("freeze", "Wallets can be frozen", "The authority can freeze any holder's tokens.", 1.6, "owner_control");
  if (s.transferPausable) add("pausable", "Trading can be paused", "The owner can halt all transfers.", 1.1, "owner_control");
  if (s.hasBlacklist) add("blacklist", "Blacklist function", "Specific wallets can be blocked from selling.", 0.8, "owner_control");
  if (s.closable) add("closable", "Token accounts closable", "The authority can close token accounts.", 1.0, "owner_control");
  if (s.transferHook) add("transfer_hook", "Custom transfer hook", "Extra code runs on every transfer.", 0.9, "owner_control");
  if (s.isProxy) add("proxy", "Upgradeable contract", "Code can be swapped after you buy.", 0.9, "owner_control");
  if (s.selfDestruct) add("selfdestruct", "Self-destruct function", "The contract can be wiped out.", 1.5, "owner_control");
  if (s.metadataMutable) add("metadata", "Editable metadata", "Name, logo and links can be changed.", 0.3, null);

  // --- Code transparency ---
  if (s.openSource === false) add("closed_source", "Unverified code", "Contract source isn't published — can't be audited.", 2.2, "hidden_code");
  if (s.creatorPastHoneypots) add("serial", "Creator made honeypots before", "Same deployer launched known scam tokens.", 2.8, "honeypot");

  // --- Liquidity ---
  if (s.lpLockedPct !== null) {
    if (s.lpLockedPct < 20) add("lp_unlocked", "Liquidity not locked", `Only ${fmtPct(s.lpLockedPct)} of liquidity is locked or burned.`, 1.7, "liquidity_pull");
    else if (s.lpLockedPct < 80) add("lp_partial", "Liquidity partly locked", `${fmtPct(s.lpLockedPct)} locked — the rest can be pulled.`, 0.6, "liquidity_pull");
    else add("lp_locked", "Liquidity locked", `${fmtPct(s.lpLockedPct)} of liquidity is locked or burned.`, -1.0, null);
  }
  if (s.liquidityUsd !== null) {
    if (s.liquidityUsd < 10_000) add("liq_tiny", "Tiny liquidity", `${fmtUsd(s.liquidityUsd)} in the pool — easily drained.`, 1.5, "thin_liquidity");
    else if (s.liquidityUsd < 75_000) add("liq_low", "Low liquidity", `${fmtUsd(s.liquidityUsd)} in the pool.`, 0.7, "thin_liquidity");
    else if (s.liquidityUsd > 1_000_000) add("liq_deep", "Deep liquidity", `${fmtUsd(s.liquidityUsd)} in the pool.`, -1.0, null);
  }

  // --- Age ---
  if (s.pairAgeDays !== null) {
    if (s.pairAgeDays < 1) add("age", "Launched today", "Most rug pulls happen within the first days.", 1.6, "fresh_launch");
    else if (s.pairAgeDays < 7) add("age", "Under a week old", `${s.pairAgeDays.toFixed(0)} days since launch.`, 1.1, "fresh_launch");
    else if (s.pairAgeDays < 30) add("age", "Under a month old", `${s.pairAgeDays.toFixed(0)} days since launch.`, 0.5, "fresh_launch");
    else if (s.pairAgeDays > 365) add("age", "Trading for over a year", `${(s.pairAgeDays / 365).toFixed(1)} years of history.`, -1.6, null);
  }

  // --- Holders ---
  if (s.top10Pct !== null) {
    if (s.top10Pct > 70) add("top10", "Extreme whale concentration", `Top 10 wallets hold ${fmtPct(s.top10Pct)}.`, 1.8, "concentration");
    else if (s.top10Pct > 40) add("top10", "High whale concentration", `Top 10 wallets hold ${fmtPct(s.top10Pct)}.`, 0.9, "concentration");
    else if (s.top10Pct < 20) add("top10", "Well distributed", `Top 10 wallets hold ${fmtPct(s.top10Pct)}.`, -0.6, null);
  }
  if (s.creatorPct !== null && s.creatorPct > 10) add("creator_pct", "Creator holds a big bag", `Creator/owner holds ${fmtPct(s.creatorPct)} of supply.`, 1.2, "concentration");
  if (s.holderCount !== null) {
    if (s.holderCount < 100) add("holders", "Very few holders", `${s.holderCount} holders.`, 0.9, "fresh_launch");
    else if (s.holderCount > 20_000) add("holders", "Large holder base", `${s.holderCount.toLocaleString("en-US")} holders.`, -1.0, null);
  }

  // --- Market behaviour ---
  if (s.priceChange24h !== null && s.priceChange24h <= -70)
    add("collapse", "Price collapsed", `${s.priceChange24h.toFixed(0)}% in 24h — may already be rugged.`, 2.5, "price_collapse");

  // --- Reputation ---
  if (s.trusted) add("trusted", "On trusted token lists", "Recognised by security databases.", -2.5, null);
  if (s.cexListed) add("cex", "Listed on major exchanges", "Centralised exchanges vet listings.", -1.5, null);
  if (s.externalRiskScore !== null) {
    if (s.externalRiskScore >= 60) add("ext_score", "Flagged by RugCheck", `RugCheck risk score ${s.externalRiskScore.toFixed(0)}/100.`, 1.4, null);
    else if (s.externalRiskScore <= 10) add("ext_score", "Clean RugCheck report", `RugCheck risk score ${s.externalRiskScore.toFixed(0)}/100.`, -0.5, null);
  }

  return f;
}

export function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

export function verdictFor(probability: number): Verdict {
  if (probability >= 0.85) return "critical";
  if (probability >= 0.6) return "high";
  if (probability >= 0.25) return "elevated";
  return "low";
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  low: "Low risk",
  elevated: "Elevated risk",
  high: "High risk",
  critical: "Likely rug pull",
};

export function matchHistoricalCases(patterns: PatternTag[], limit = 3): CaseMatch[] {
  if (patterns.length === 0) return [];
  const set = new Set(patterns);
  return HISTORICAL_CASES.map((c) => {
    const shared = c.patterns.filter((p) => set.has(p));
    const union = new Set([...c.patterns, ...patterns]).size;
    return { case: c, shared, similarity: union === 0 ? 0 : shared.length / union };
  })
    .filter((m) => m.shared.length > 0)
    .sort((a, b) => b.similarity - a.similarity || b.shared.length - a.shared.length)
    .slice(0, limit);
}

function calibratedProbability(raw: number, calibration: ModelWeights["calibration"]) {
  if (calibration.x.length === 0) return raw;
  for (let i = 0; i < calibration.x.length; i += 1) {
    if (raw <= calibration.x[i]!) return calibration.y[i]!;
  }
  return calibration.y[calibration.y.length - 1]!;
}

function creatorProbability(features: CreatorFeatures, weights: ModelWeights) {
  const values = CREATOR_FEATURE_ORDER.map((key) => features[key]);
  const logit = weights.intercept + values.reduce((sum, value, i) => {
    const standardized = (value - weights.means[i]!) / weights.stds[i]!;
    return sum + standardized * weights.coef[i]!;
  }, 0);
  return calibratedProbability(sigmoid(logit), weights.calibration);
}

function creatorConfidence(features: CreatorFeatures): CreatorModelConfidence {
  if (features.creator_prev_token_count >= 5 && features.creator_prev_rug_rate_missing === 0) return "high";
  if (features.creator_prev_token_count > 0) return "medium";
  return "low";
}

export function scoreToken(s: TokenSignals, options: ScoreOptions = {}): RiskResult {
  const factors = extractFactors(s);
  const logit = BIAS + factors.reduce((sum, f) => sum + f.weight, 0);
  const heuristicProbability = sigmoid(logit);
  const creatorModelSupported = s.chain === "solana";
  const modelStatus: ModelStatus = creatorModelSupported && MODEL_IS_TRAINED ? "trained" : "fallback";
  const probability =
    creatorModelSupported && MODEL_IS_TRAINED && s.creatorFeatures
      ? creatorProbability(s.creatorFeatures, MODEL_WEIGHTS!)
      : heuristicProbability;

  const overrideFactors: Factor[] = [];
  let trust = Math.round((1 - probability) * 100);
  if (options.knownBad?.creators.has(s.creatorAddress?.toLowerCase() ?? "")) {
    trust = Math.min(trust, 10);
    overrideFactors.push({
      id: "known_bad_creator",
      label: "Creator linked to collapsed tokens",
      detail: "This creator wallet launched previous tokens that collapsed.",
      weight: 5,
      pattern: null,
    });
  }
  if (options.knownBad?.funders.has(s.funderAddress?.toLowerCase() ?? "")) {
    trust = Math.min(trust, 20);
    overrideFactors.push({
      id: "known_bad_funder",
      label: "Funding wallet linked to collapsed tokens",
      detail: "The creator was funded by a wallet linked to previous collapsed tokens.",
      weight: 4,
      pattern: null,
    });
  }

  const redFlags = [...factors.filter((f) => f.weight > 0), ...overrideFactors].sort((a, b) => b.weight - a.weight);
  const greenFlags = factors.filter((f) => f.weight < 0).sort((a, b) => a.weight - b.weight);
  const patterns = [...new Set(redFlags.map((f) => f.pattern).filter((p): p is PatternTag => p !== null))];
  const known = SIGNAL_KEYS.filter((k) => s[k] !== null).length;

  return {
    probability,
    score: Math.round(probability * 100),
    verdict: verdictFor(probability),
    redFlags,
    greenFlags,
    patterns,
    coverage: known / SIGNAL_KEYS.length,
    matches: matchHistoricalCases(patterns),
    trust,
    confidence: creatorModelSupported && s.creatorFeatures ? creatorConfidence(s.creatorFeatures) : "low",
    creatorModelSupported,
    modelStatus,
    modelVersion: MODEL_WEIGHTS?.version ?? "unavailable",
  };
}

export function emptySignals(chain: Chain, address: string): TokenSignals {
  return {
    chain,
    address,
    name: null,
    symbol: null,
    imageUrl: null,
    dexUrl: null,
    priceUsd: null,
    liquidityUsd: null,
    marketCapUsd: null,
    pairAgeDays: null,
    priceChange24h: null,
    volume24hUsd: null,
    holderCount: null,
    top10Pct: null,
    creatorPct: null,
    lpLockedPct: null,
    buyTaxPct: null,
    sellTaxPct: null,
    isHoneypot: null,
    cannotBuy: null,
    ownerCanChangeBalance: null,
    hiddenOwner: null,
    canTakeBackOwnership: null,
    mintable: null,
    transferPausable: null,
    hasBlacklist: null,
    taxModifiable: null,
    isProxy: null,
    openSource: null,
    selfDestruct: null,
    creatorPastHoneypots: null,
    freezeAuthority: null,
    closable: null,
    transferHook: null,
    metadataMutable: null,
    nonTransferable: null,
    trusted: null,
    cexListed: null,
    externalRiskScore: null,
    creatorFeatures: null,
    creatorAddress: null,
    funderAddress: null,
  };
}

export const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
export const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
