import { describe, expect, it } from "vitest";
import { classifyTokenInput } from "@/lib/token-search";

const PEPE = "0x6982508145454Ce325dDbE47a25d4ec3d2311933";
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const ZWSP = String.fromCharCode(0x200b);

describe("classifyTokenInput", () => {
  it("accepts plain addresses", () => {
    expect(classifyTokenInput(PEPE)).toEqual({ kind: "address", address: PEPE, extracted: false });
    expect(classifyTokenInput(`  ${BONK}  `)).toEqual({ kind: "address", address: BONK, extracted: false });
  });

  it("pulls the address out of pasted links longer than 64 characters", () => {
    const links = [
      `https://dexscreener.com/ethereum/${PEPE.toLowerCase()}`,
      `https://etherscan.io/token/${PEPE}`,
      `https://pump.fun/coin/${BONK}`,
      `https://solscan.io/token/${BONK}?cluster=mainnet`,
    ];
    for (const link of links) {
      const r = classifyTokenInput(link);
      expect(r.kind).toBe("address");
      if (r.kind === "address") expect(r.extracted).toBe(true);
    }
  });

  it("ignores invisible characters, quotes and trailing punctuation", () => {
    expect(classifyTokenInput(`${ZWSP}${PEPE}${ZWSP}`)).toMatchObject({ kind: "address", address: PEPE });
    expect(classifyTokenInput(`"${PEPE}".`)).toMatchObject({ kind: "address", address: PEPE });
    expect(classifyTokenInput(`CA: ${BONK}`)).toMatchObject({ kind: "address", address: BONK });
  });

  it("gives a hint instead of name-searching a half-typed address", () => {
    expect(classifyTokenInput("0x6982508145")).toMatchObject({ kind: "partial" });
    expect(classifyTokenInput(`${PEPE}9`)).toMatchObject({ kind: "partial" });
    expect(classifyTokenInput("0x69825081zz")).toMatchObject({ kind: "partial" });
    expect(classifyTokenInput(BONK.slice(0, 28))).toMatchObject({ kind: "partial" });
    expect(classifyTokenInput(`${PEPE} ${PEPE.replace("69", "70")}`)).toMatchObject({ kind: "partial" });
  });

  it("still name-searches words and tickers", () => {
    expect(classifyTokenInput("dog wif hat")).toEqual({ kind: "search", query: "dog wif hat" });
    expect(classifyTokenInput("$BONK")).toEqual({ kind: "search", query: "$BONK" });
    expect(classifyTokenInput(" ")).toEqual({ kind: "empty" });
    expect(classifyTokenInput("a")).toEqual({ kind: "empty" });
  });
});
