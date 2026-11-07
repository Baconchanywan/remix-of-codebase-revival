import { describe, expect, it } from "vitest";
import {
  normalizeSearchQuery,
  normalizeSearchResults,
} from "@/lib/token-search";

describe("normalizeSearchResults", () => {
  it("keeps only Solana pairs", () => {
    const out = normalizeSearchResults([
      {
        chainId: "ethereum",
        baseToken: { address: "0xabc", name: "Pepe", symbol: "PEPE" },
        liquidity: { usd: 1e6 },
      },
      {
        chainId: "bsc",
        baseToken: { address: "0xdef", name: "Cake", symbol: "CAKE" },
        liquidity: { usd: 1e6 },
      },
      {
        chainId: "solana",
        baseToken: { address: "So1", name: "Bonk", symbol: "BONK" },
        liquidity: { usd: 500 },
      },
    ]);
    expect(out.map((r) => r.address)).toEqual(["So1"]);
  });

  it("dedupes by token address, keeping the most liquid pool", () => {
    const out = normalizeSearchResults([
      {
        chainId: "solana",
        baseToken: { address: "A", name: "X", symbol: "X" },
        liquidity: { usd: 100 },
        priceUsd: "1",
      },
      {
        chainId: "solana",
        baseToken: { address: "A", name: "X", symbol: "X" },
        liquidity: { usd: 900 },
        priceUsd: "2",
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.liquidityUsd).toBe(900);
    expect(out[0]?.priceUsd).toBe(2);
  });

  it("sorts by liquidity and caps the list", () => {
    const pairs = Array.from({ length: 12 }, (_, i) => ({
      chainId: "solana",
      baseToken: { address: `T${i}`, name: `T${i}`, symbol: `T${i}` },
      liquidity: { usd: i },
    }));
    const out = normalizeSearchResults(pairs);
    expect(out).toHaveLength(8);
    expect(out[0]?.address).toBe("T11");
    expect(out.map((r) => r.liquidityUsd)).toEqual(
      [...out.map((r) => r.liquidityUsd)].sort((a, b) => (b ?? 0) - (a ?? 0)),
    );
  });

  it("skips pairs without a base token address and handles missing numbers", () => {
    const out = normalizeSearchResults([
      { chainId: "solana", baseToken: { name: "NoAddr" } },
      {
        chainId: "solana",
        baseToken: { address: "B", name: "", symbol: "" },
        priceUsd: "not-a-number",
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: "Unknown",
      symbol: "?",
      priceUsd: null,
      liquidityUsd: null,
    });
  });
});

describe("normalizeSearchQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSearchQuery("  dog   wif  hat ")).toBe("dog wif hat");
  });

  it("replaces characters DexScreener rejects", () => {
    expect(normalizeSearchQuery("100% bonk")).toBe("100 bonk");
    expect(normalizeSearchQuery("bonk—coin")).toBe("bonk coin");
  });

  it("keeps common token-name punctuation", () => {
    expect(normalizeSearchQuery("$WIF")).toBe("$WIF");
    expect(normalizeSearchQuery("pepe-2.0_x")).toBe("pepe-2.0_x");
  });

  it("keeps accented letters", () => {
    expect(normalizeSearchQuery("été")).toBe("été");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(normalizeSearchQuery("%%%")).toBe("");
  });

  it("caps length", () => {
    expect(normalizeSearchQuery("a".repeat(100))).toHaveLength(64);
  });
});
