import { describe, expect, it } from "vitest";
import {
  extractAddresses,
  extractTickers,
  extractUrls,
  parseShillResponse,
  scoreManipulation,
} from "@/lib/shill-model";

const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const PEPE = "0x6982508145454Ce325dDbE47a25d4ec3d2311933";
const SHILL = `🚀 $BONK 100x GUARANTEED!! Binance listing confirmed. Only 2 hours left, don't tell anyone. CA: ${BONK} https://pump.example.com/x.`;

describe("shill extraction", () => {
  it("finds EVM and Solana addresses in order and ignores long plain words", () => {
    const text = `buy ${PEPE} or ${BONK} — supercalifragilisticexpialidociousword ${PEPE.toLowerCase()}`;
    expect(extractAddresses(text)).toEqual([PEPE, BONK]);
  });

  it("ranks the shilled ticker ahead of quote currencies", () => {
    expect(extractTickers("swap $SOL for $WIF now, $wif to the moon, $100k soon")).toEqual(["WIF", "SOL"]);
  });

  it("strips trailing punctuation from urls", () => {
    expect(extractUrls(SHILL)).toEqual(["https://pump.example.com/x"]);
  });
});

describe("LLM response validation", () => {
  it("keeps verbatim quotes and known tactics, drops hallucinations", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        summary: "Pushes BONK with fake urgency.",
        primaryTicker: "$bonk",
        primaryAddress: BONK,
        tactics: [
          { id: "guaranteed_returns", quote: "100x   guaranteed", explanation: "No one can promise this." },
          { id: "urgency", quote: "Only 2 hours left", explanation: "" },
          { id: "fake_authority", quote: "Coinbase partnership", explanation: "not in source" },
          { id: "made_up_tactic", quote: "CA:", explanation: "unknown id" },
        ],
      }) +
      "\n```";
    const p = parseShillResponse(raw, SHILL, extractAddresses(SHILL))!;
    expect(p.primaryTicker).toBe("BONK");
    expect(p.primaryAddress).toBe(BONK);
    expect(p.tactics.map((t) => t.id)).toEqual(["guaranteed_returns", "urgency"]);
    expect(p.tactics[1]!.explanation.length).toBeGreaterThan(0); // falls back to the default "why"
  });

  it("rejects an address the regex never saw", () => {
    const raw = JSON.stringify({ summary: "", primaryTicker: null, primaryAddress: PEPE, tactics: [] });
    expect(parseShillResponse(raw, SHILL, extractAddresses(SHILL))!.primaryAddress).toBeNull();
  });

  it("returns null for unparseable output", () => {
    expect(parseShillResponse("sorry, I can't help", SHILL, [])).toBeNull();
  });
});

describe("manipulation score", () => {
  it("is zero for a neutral message and stacks multiple tactics", () => {
    expect(scoreManipulation([]).score).toBe(0);
    const one = scoreManipulation([{ id: "urgency", quote: "x", explanation: "" }]);
    const many = scoreManipulation([
      { id: "urgency", quote: "x", explanation: "" },
      { id: "guaranteed_returns", quote: "y", explanation: "" },
      { id: "insider_secrecy", quote: "z", explanation: "" },
    ]);
    expect(many.score).toBeGreaterThan(one.score);
    expect(many.verdict).toBe("high");
  });

  it("counts a repeated tactic once and flags send-funds as critical with company", () => {
    const dup = scoreManipulation([
      { id: "urgency", quote: "a", explanation: "" },
      { id: "urgency", quote: "b", explanation: "" },
    ]);
    expect(dup.score).toBe(35);
    const theft = scoreManipulation([
      { id: "send_funds", quote: "a", explanation: "" },
      { id: "urgency", quote: "b", explanation: "" },
    ]);
    expect(theft.verdict).toBe("critical");
  });
});
