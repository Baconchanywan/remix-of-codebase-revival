/** Pure, browser-safe normalization for DexScreener search results. */

import { EVM_ADDRESS, SOLANA_ADDRESS } from "./rug-model";
import { extractAddresses } from "./shill-model";

export const SEARCHABLE_CHAINS = ["solana"] as const;
export const SEARCH_RESULT_LIMIT = 8;

export interface SearchPairInput {
  chainId?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  info?: { imageUrl?: string };
}

export interface TokenSearchResult {
  chain: "solana";
  address: string;
  name: string;
  symbol: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  imageUrl: string | null;
}

const finiteOrNull = (v: unknown): number | null => {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v !== ""
        ? Number(v)
        : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Keep Solana pairs only, dedupe by token address (keeping the most liquid pool),
 * sort by liquidity, and cap the list.
 */
export function normalizeSearchResults(
  pairs: SearchPairInput[],
  limit = SEARCH_RESULT_LIMIT,
): TokenSearchResult[] {
  const byAddress = new Map<string, TokenSearchResult>();

  for (const p of pairs) {
    if (!SEARCHABLE_CHAINS.includes(p.chainId as "solana")) continue;
    const address = p.baseToken?.address;
    if (!address) continue;

    const candidate: TokenSearchResult = {
      chain: "solana",
      address,
      name: p.baseToken?.name?.trim() || "Unknown",
      symbol: p.baseToken?.symbol?.trim() || "?",
      priceUsd: finiteOrNull(p.priceUsd),
      liquidityUsd: finiteOrNull(p.liquidity?.usd),
      volume24hUsd: finiteOrNull(p.volume?.h24),
      imageUrl: p.info?.imageUrl ?? null,
    };

    const existing = byAddress.get(address);
    if (
      !existing ||
      (candidate.liquidityUsd ?? 0) > (existing.liquidityUsd ?? 0)
    ) {
      byAddress.set(address, candidate);
    }
  }

  return [...byAddress.values()]
    .sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))
    .slice(0, limit);
}

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 64;

/**
 * Clean a user-typed token query before sending it upstream. DexScreener rejects
 * some characters (e.g. %, em dashes, leading spaces) with HTTP 400, so anything
 * outside letters, digits, whitespace, and common name punctuation is replaced.
 */
export function normalizeSearchQuery(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}\s$._-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_LENGTH)
    .trim();
}

export type TokenInput =
  | { kind: "empty" }
  /** A contract address, possibly pulled out of a pasted link or sentence. */
  | { kind: "address"; address: string; extracted: boolean }
  /** Looks like an address but isn't a complete, valid one — don't name-search it. */
  | { kind: "partial"; message: string }
  | { kind: "search"; query: string };

const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

/**
 * Decide what the user typed into the token box. Pasted links (DexScreener, Etherscan,
 * Solscan, pump.fun…), stray quotes/punctuation and invisible characters still resolve
 * to the address, and half-typed addresses get a hint instead of a failing name search.
 */
export function classifyTokenInput(raw: string): TokenInput {
  const cleaned = raw
    .replace(INVISIBLE, "")
    .trim()
    .replace(/^["'`<([{]+/, "")
    .replace(/["'`>)\]}.,;:!?]+$/, "")
    .trim();
  if (!cleaned) return { kind: "empty" };
  if (EVM_ADDRESS.test(cleaned) || SOLANA_ADDRESS.test(cleaned)) {
    return { kind: "address", address: cleaned, extracted: cleaned !== raw.trim() };
  }
  // A single 0x… word is only ever an Ethereum/BNB address attempt. Check it before the
  // general extractor, which could otherwise read the tail of a mistyped one as a Solana mint.
  if (/^0x[0-9a-fA-F]*$/.test(cleaned)) {
    const n = cleaned.length - 2;
    return {
      kind: "partial",
      message: `Ethereum and BNB Chain addresses are 0x followed by 40 characters. This has ${n}.`,
    };
  }
  if (/^0x[^\s/]+$/.test(cleaned)) {
    return { kind: "partial", message: "After 0x, an address only uses the characters 0–9 and a–f." };
  }
  const found = extractAddresses(cleaned);
  if (found.length === 1) return { kind: "address", address: found[0]!, extracted: true };
  if (found.length > 1) {
    return { kind: "partial", message: "That contains more than one address. Paste just the token's contract address." };
  }
  if (/^[1-9A-HJ-NP-Za-km-z]{25,}$/.test(cleaned)) {
    return { kind: "partial", message: `Solana addresses are 32–44 characters. This has ${cleaned.length}.` };
  }
  const query = normalizeSearchQuery(cleaned);
  return query.length >= SEARCH_MIN_LENGTH ? { kind: "search", query } : { kind: "empty" };
}
