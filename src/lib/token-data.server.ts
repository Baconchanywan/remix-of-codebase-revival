import {
  EVM_ADDRESS,
  SOLANA_ADDRESS,
  emptySignals,
  type Chain,
  type TokenSignals,
} from "./rug-model";
import {
  normalizeSearchResults,
  type SearchPairInput,
  type TokenSearchResult,
} from "./token-search";

const TIMEOUT_MS = 9000;
const DEAD = new Set([
  "0x000000000000000000000000000000000000dead",
  "0x0000000000000000000000000000000000000000",
  "0xdead000000000000000042069420694206942069",
  "1nc1nerator11111111111111111111111111111111",
]);

type Json = Record<string, unknown>;

async function getJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn("token data fetch failed", url, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("token data fetch error", url, err);
    return null;
  }
}

const isObj = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const flag = (v: unknown): boolean | null => {
  if (v === "1" || v === 1 || v === true) return true;
  if (v === "0" || v === 0 || v === false) return false;
  return null;
};
const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

interface DexPair {
  chainId: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  info?: { imageUrl?: string };
}

async function fetchDexPairs(address: string): Promise<DexPair[]> {
  const data = await getJson(
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`,
  );
  if (!isObj(data) || !Array.isArray(data["pairs"])) return [];
  return (data["pairs"] as DexPair[]).filter(
    (p) => p.baseToken?.address?.toLowerCase() === address.toLowerCase(),
  );
}

/** Search DexScreener by token name or symbol. Solana only for now. */
export async function searchTokens(
  query: string,
): Promise<TokenSearchResult[]> {
  const data = await getJson(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
  );
  if (!isObj(data) || !Array.isArray(data["pairs"])) {
    throw new Error("Token search is unavailable right now.");
  }
  return normalizeSearchResults(data["pairs"] as SearchPairInput[]);
}

/** Pick the chain where this token has the most liquidity. */
export async function detectChain(
  address: string,
): Promise<{ chain: Chain; pairs: DexPair[] }> {
  if (!EVM_ADDRESS.test(address))
    return { chain: "solana", pairs: await fetchDexPairs(address) };
  const pairs = await fetchDexPairs(address);
  const liq: Record<"ethereum" | "bsc", number> = { ethereum: 0, bsc: 0 };
  for (const p of pairs) {
    if (p.chainId === "ethereum" || p.chainId === "bsc")
      liq[p.chainId] += p.liquidity?.usd ?? 0;
  }
  return { chain: liq.bsc > liq.ethereum ? "bsc" : "ethereum", pairs };
}

function applyDex(s: TokenSignals, pairs: DexPair[]) {
  const allPairs = pairs.filter((p) => p.chainId === s.chain);
  if (allPairs.length === 0) return [];
  // Drop mispriced pools (bad quote-token pricing inflates liquidity / market cap).
  const prices = allPairs
    .map((p) => num(p.priceUsd))
    .filter((n): n is number => n !== null && n > 0)
    .sort((a, b) => a - b);
  const median =
    prices.length > 0 ? prices[Math.floor(prices.length / 2)]! : null;
  const chainPairs =
    median === null
      ? allPairs
      : allPairs.filter((p) => {
          const pr = num(p.priceUsd);
          return pr === null || (pr / median < 3 && median / pr < 3);
        });
  const sorted = [...chainPairs].sort(
    (a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0),
  );
  const top = sorted[0]!;
  s.name = top.baseToken?.name ?? s.name;
  s.symbol = top.baseToken?.symbol ?? s.symbol;
  s.imageUrl = top.info?.imageUrl ?? null;
  s.dexUrl = top.url ?? null;
  s.priceUsd = num(top.priceUsd);
  s.liquidityUsd = chainPairs.reduce(
    (sum, p) => sum + (p.liquidity?.usd ?? 0),
    0,
  );
  s.marketCapUsd = num(top.marketCap) ?? num(top.fdv);
  s.priceChange24h = num(top.priceChange?.h24);
  s.volume24hUsd = chainPairs.reduce((sum, p) => sum + (p.volume?.h24 ?? 0), 0);
  const created = chainPairs
    .map((p) => p.pairCreatedAt)
    .filter((t): t is number => typeof t === "number");
  if (created.length > 0)
    s.pairAgeDays = (Date.now() - Math.min(...created)) / 86_400_000;
  return chainPairs
    .map((p) => p.pairAddress?.toLowerCase())
    .filter((a): a is string => !!a);
}

function topHolderPct(holders: unknown, exclude: Set<string>): number | null {
  if (!Array.isArray(holders) || holders.length === 0) return null;
  let total = 0;
  for (const h of holders.slice(0, 10)) {
    if (!isObj(h)) continue;
    const addr = (str(h["address"]) ?? str(h["account"]) ?? "").toLowerCase();
    if (
      h["is_locked"] === 1 ||
      DEAD.has(addr) ||
      exclude.has(addr) ||
      str(h["tag"])
    )
      continue;
    total += (num(h["percent"]) ?? 0) * 100;
  }
  return Math.min(100, total);
}

async function applyGoPlusEvm(s: TokenSignals, pairAddrs: string[]) {
  const chainId = s.chain === "bsc" ? 56 : 1;
  const data = await getJson(
    `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${s.address}`,
  );
  if (!isObj(data) || !isObj(data["result"])) return false;
  const result = data["result"] as Json;
  const t = result[s.address.toLowerCase()];
  if (!isObj(t)) return false;

  s.name = s.name ?? str(t["token_name"]);
  s.symbol = s.symbol ?? str(t["token_symbol"]);
  s.holderCount = num(t["holder_count"]);
  const buy = num(t["buy_tax"]);
  const sell = num(t["sell_tax"]);
  s.buyTaxPct = buy === null ? null : buy * 100;
  s.sellTaxPct = sell === null ? null : sell * 100;
  s.isHoneypot =
    flag(t["is_honeypot"]) || flag(t["cannot_sell_all"])
      ? true
      : flag(t["is_honeypot"]);
  s.cannotBuy = flag(t["cannot_buy"]);
  s.ownerCanChangeBalance = flag(t["owner_change_balance"]);
  s.hiddenOwner = flag(t["hidden_owner"]);
  s.canTakeBackOwnership = flag(t["can_take_back_ownership"]);
  const owner = (str(t["owner_address"]) ?? "").toLowerCase();
  const renounced = owner === "" || DEAD.has(owner);
  const mintable = flag(t["is_mintable"]);
  s.mintable = mintable === null ? null : mintable && !renounced;
  s.transferPausable = flag(t["transfer_pausable"]);
  s.hasBlacklist = flag(t["is_blacklisted"]);
  s.taxModifiable =
    flag(t["slippage_modifiable"]) || flag(t["personal_slippage_modifiable"])
      ? true
      : flag(t["slippage_modifiable"]);
  s.isProxy = flag(t["is_proxy"]);
  s.openSource = flag(t["is_open_source"]);
  s.selfDestruct = flag(t["selfdestruct"]);
  s.creatorPastHoneypots = flag(t["honeypot_with_same_creator"]);
  s.trusted = flag(t["trust_list"]);
  const cex = t["is_in_cex"];
  s.cexListed = isObj(cex) ? flag(cex["listed"]) : null;
  const creatorPct = num(t["creator_percent"]);
  const ownerPct = num(t["owner_percent"]);
  if (creatorPct !== null || ownerPct !== null)
    s.creatorPct = Math.max(creatorPct ?? 0, ownerPct ?? 0) * 100;

  const dexAddrs = Array.isArray(t["dex"])
    ? (t["dex"] as unknown[])
        .map((d) => (isObj(d) ? (str(d["pair"]) ?? "").toLowerCase() : ""))
        .filter(Boolean)
    : [];
  s.top10Pct = topHolderPct(t["holders"], new Set([...pairAddrs, ...dexAddrs]));

  const lp = t["lp_holders"];
  if (Array.isArray(lp) && lp.length > 0) {
    let locked = 0;
    for (const h of lp) {
      if (!isObj(h)) continue;
      const addr = (str(h["address"]) ?? "").toLowerCase();
      if (
        h["is_locked"] === 1 ||
        DEAD.has(addr) ||
        addr === s.address.toLowerCase()
      ) {
        locked += (num(h["percent"]) ?? 0) * 100;
      }
    }
    s.lpLockedPct = Math.min(100, locked);
  }
  return true;
}

async function applyGoPlusSolana(s: TokenSignals) {
  const data = await getJson(
    `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${s.address}`,
  );
  if (!isObj(data) || !isObj(data["result"])) return false;
  const t = (data["result"] as Json)[s.address];
  if (!isObj(t)) return false;
  const status = (k: string) => {
    const v = t[k];
    return isObj(v) ? flag(v["status"]) : null;
  };
  const meta = t["metadata"];
  if (isObj(meta)) {
    s.name = s.name ?? str(meta["name"]);
    s.symbol = s.symbol ?? str(meta["symbol"]);
  }
  s.holderCount = num(t["holder_count"]);
  s.mintable = status("mintable");
  s.freezeAuthority = status("freezable");
  s.ownerCanChangeBalance = status("balance_mutable_authority");
  s.closable = status("closable");
  s.metadataMutable = status("metadata_mutable");
  s.nonTransferable = flag(t["non_transferable"]);
  s.transferHook = Array.isArray(t["transfer_hook"])
    ? t["transfer_hook"].length > 0
    : null;
  s.trusted =
    t["trusted_token"] === 1 ? true : t["trusted_token"] === 0 ? false : null;
  s.openSource = true; // SPL tokens use the audited token program.
  const fee = t["transfer_fee"];
  if (isObj(fee)) {
    const current = isObj(fee["current_fee_rate"])
      ? (fee["current_fee_rate"] as Json)
      : fee;
    const bps =
      num(current["fee_rate"]) ?? num(current["transfer_fee_basis_points"]);
    s.sellTaxPct =
      Object.keys(fee).length === 0 ? 0 : bps === null ? null : bps / 100;
    s.buyTaxPct = s.sellTaxPct;
  }
  s.top10Pct = topHolderPct(t["holders"], new Set());
  return true;
}

async function applyRugCheck(s: TokenSignals) {
  const data = await getJson(
    `https://api.rugcheck.xyz/v1/tokens/${s.address}/report/summary`,
  );
  if (!isObj(data)) return;
  s.externalRiskScore = num(data["score_normalised"]);
  const lp = num(data["lpLockedPct"]);
  if (lp !== null) s.lpLockedPct = lp;
}

export interface TickerMatch {
  address: string;
  chain: Chain;
  name: string | null;
  liquidityUsd: number;
  /** How many distinct contracts on supported chains use this exact ticker (copycat signal). */
  sameTickerCount: number;
}

/**
 * Resolve a bare $TICKER to the most liquid contract using it on a supported chain.
 * Returns null if nothing matches exactly.
 */
export async function searchTicker(ticker: string): Promise<TickerMatch | null> {
  const data = await getJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(ticker)}`);
  if (!isObj(data) || !Array.isArray(data["pairs"])) return null;
  const supported = new Set<string>(["ethereum", "bsc", "solana"]);
  const byToken = new Map<string, TickerMatch>();
  for (const p of data["pairs"] as DexPair[]) {
    const addr = p.baseToken?.address;
    if (!addr || !supported.has(p.chainId)) continue;
    if ((p.baseToken?.symbol ?? "").toUpperCase() !== ticker.toUpperCase()) continue;
    const key = `${p.chainId}:${addr.toLowerCase()}`;
    const prev = byToken.get(key);
    const liq = p.liquidity?.usd ?? 0;
    if (prev) prev.liquidityUsd += liq;
    else byToken.set(key, { address: addr, chain: p.chainId as Chain, name: p.baseToken?.name ?? null, liquidityUsd: liq, sameTickerCount: 0 });
  }
  const all = [...byToken.values()].sort((a, b) => b.liquidityUsd - a.liquidityUsd);
  const top = all[0];
  return top ? { ...top, sameTickerCount: all.length } : null;
}

export interface GatheredToken {
  signals: TokenSignals;
  sources: string[];
}

export async function gatherTokenSignals(
  address: string,
  chainHint: Chain | "auto",
): Promise<GatheredToken> {
  const isEvm = EVM_ADDRESS.test(address);
  const isSol = SOLANA_ADDRESS.test(address);
  if (!isEvm && !isSol)
    throw new Error("That doesn't look like a valid contract address.");
  if (chainHint === "solana" && isEvm)
    throw new Error("That's an Ethereum/BNB address, not a Solana one.");
  if (chainHint !== "auto" && chainHint !== "solana" && !isEvm)
    throw new Error("Ethereum and BNB Chain addresses start with 0x.");

  let chain: Chain;
  let pairs: DexPair[];
  if (chainHint === "auto") {
    ({ chain, pairs } = await detectChain(address));
  } else {
    chain = chainHint;
    pairs = await fetchDexPairs(address);
  }

  const s = emptySignals(chain, isEvm ? address.toLowerCase() : address);
  const sources: string[] = [];
  const pairAddrs = applyDex(s, pairs);
  if (pairAddrs.length > 0) sources.push("DexScreener");

  if (chain === "solana") {
    const [gp] = await Promise.all([applyGoPlusSolana(s), applyRugCheck(s)]);
    if (gp) sources.push("GoPlus Security");
    if (s.externalRiskScore !== null) sources.push("RugCheck");
  } else if (await applyGoPlusEvm(s, pairAddrs)) {
    sources.push("GoPlus Security");
  }

  if (sources.length === 0) {
    throw new Error(
      "No trading or contract data found for this address on that chain. Check the address and chain, or search by name.",
    );
  }
  return { signals: s, sources };
}
