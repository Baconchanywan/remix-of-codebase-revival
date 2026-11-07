/** Pure, browser-safe normalization for DexScreener search results. */

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
