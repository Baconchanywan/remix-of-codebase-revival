/**
 * "Paste the shill" model.
 *
 * Turns a pasted hype message (Telegram / Discord / X post, plus any scraped linked page) into:
 *  - candidate token addresses + tickers (regex only — the LLM is never trusted to produce an address)
 *  - manipulation tactics (labelled by the LLM, but every quote must literally appear in the source)
 *  - a deterministic manipulation score computed from those tactics
 *
 * Pure and browser-safe (no fetch/IO) so it stays unit-testable in src/test/shill-model.test.ts.
 */
import { z } from "zod";
import { EVM_ADDRESS, SOLANA_ADDRESS, type Chain, type Verdict } from "./rug-model";

export type TacticId =
  | "guaranteed_returns"
  | "urgency"
  | "fake_authority"
  | "fake_social_proof"
  | "profit_flexing"
  | "insider_secrecy"
  | "send_funds"
  | "impersonation";

export const TACTIC_IDS: TacticId[] = [
  "guaranteed_returns",
  "urgency",
  "fake_authority",
  "fake_social_proof",
  "profit_flexing",
  "insider_secrecy",
  "send_funds",
  "impersonation",
];

/** weight = how strongly the tactic signals a scam pitch (0-1). */
export const TACTICS: Record<TacticId, { label: string; weight: number; why: string }> = {
  guaranteed_returns: {
    label: "Guaranteed returns",
    weight: 0.45,
    why: "Nobody can guarantee a price. Promises like \"100x\" are there to switch off your caution.",
  },
  urgency: {
    label: "Artificial urgency",
    weight: 0.35,
    why: "Countdowns and \"last chance\" lines rush you into buying before you check anything.",
  },
  fake_authority: {
    label: "Unverified endorsement",
    weight: 0.4,
    why: "Claimed exchange listings, celebrity backing or partnerships that you can't verify are a common lure.",
  },
  fake_social_proof: {
    label: "Manufactured hype",
    weight: 0.25,
    why: "\"Everyone's buying\" and holder-count brags are easy to fake with bots and fresh wallets.",
  },
  profit_flexing: {
    label: "Profit flexing",
    weight: 0.25,
    why: "Screenshots of past gains say nothing about this token. They're bait.",
  },
  insider_secrecy: {
    label: "Insider / secret alpha",
    weight: 0.35,
    why: "\"Don't tell anyone\" makes you feel early. Usually the insiders are the ones selling to you.",
  },
  send_funds: {
    label: "Asks you to send funds",
    weight: 0.8,
    why: "Sending crypto straight to a wallet or a \"presale\" DM is the most common outright theft.",
  },
  impersonation: {
    label: "Impersonates a known project",
    weight: 0.5,
    why: "Copycat tokens borrow a famous name or ticker so that you buy the fake.",
  },
};

export interface DetectedTactic {
  id: TacticId;
  quote: string;
  explanation: string;
}

export interface ManipulationScore {
  score: number; // 0-100
  verdict: Verdict;
}

/** Quote currencies / majors that appear in shills but are almost never the token being pushed. */
const NOT_THE_SHILLED_TOKEN = new Set(["USD", "USDT", "USDC", "SOL", "ETH", "BNB", "BTC", "WETH", "WBNB", "WSOL", "DAI"]);

export function extractUrls(text: string): string[] {
  const urls = text.match(/https?:\/\/[^\s<>"'`)\]]+/gi) ?? [];
  return [...new Set(urls.map((u) => u.replace(/[.,!?;:]+$/, "")))];
}

/** Every EVM / Solana-looking address in the text, in order of first appearance. */
export function extractAddresses(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (a: string) => {
    const key = a.startsWith("0x") ? a.toLowerCase() : a;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(a);
    }
  };
  // Single pass so ordering reflects position in the text.
  const re = /0x[a-fA-F0-9]{40}(?![a-fA-F0-9])|(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{32,44}(?![1-9A-HJ-NP-Za-km-z])/g;
  for (const m of text.matchAll(re)) {
    const a = m[0];
    if (EVM_ADDRESS.test(a)) push(a);
    // Real Solana mints are random base58: require digits plus mixed case to skip long words.
    else if (SOLANA_ADDRESS.test(a) && /\d/.test(a) && /[a-z]/.test(a) && /[A-Z]/.test(a)) push(a);
  }
  return out;
}

/** $TICKER mentions, most-mentioned first, with quote currencies pushed to the end. */
export function extractTickers(text: string): string[] {
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/\$([A-Za-z][A-Za-z0-9]{1,9})\b/g)) {
    const t = m[1]!.toUpperCase();
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => {
      const qa = NOT_THE_SHILLED_TOKEN.has(a[0]) ? 1 : 0;
      const qb = NOT_THE_SHILLED_TOKEN.has(b[0]) ? 1 : 0;
      return qa - qb || b[1] - a[1];
    })
    .map(([t]) => t);
}

export function addressChainHint(address: string): Chain | "auto" {
  return EVM_ADDRESS.test(address) ? "auto" : "solana";
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Noisy-OR over distinct tactics: several weak tactics add up, one strong one dominates. */
export function scoreManipulation(tactics: DetectedTactic[]): ManipulationScore {
  const ids = new Set(tactics.map((t) => t.id));
  let clean = 1;
  for (const id of ids) clean *= 1 - TACTICS[id].weight;
  const score = Math.round((1 - clean) * 100);
  const verdict: Verdict = score >= 80 ? "critical" : score >= 55 ? "high" : score >= 25 ? "elevated" : "low";
  return { score, verdict };
}

export const MANIPULATION_LABELS: Record<Verdict, string> = {
  low: "Low pressure",
  elevated: "Pushy pitch",
  high: "Manipulative pitch",
  critical: "Textbook scam pitch",
};

// ---------- LLM output parsing ----------

const llmSchema = z.object({
  summary: z.string().max(1200).catch(""),
  primaryTicker: z.string().max(20).nullable().catch(null),
  primaryAddress: z.string().max(64).nullable().catch(null),
  tactics: z
    .array(
      z.object({
        id: z.string(),
        quote: z.string().max(300),
        explanation: z.string().max(400).catch(""),
      }),
    )
    .max(20)
    .catch([]),
});

export interface ParsedShill {
  summary: string;
  primaryTicker: string | null;
  primaryAddress: string | null;
  tactics: DetectedTactic[];
}

/** Pull the first JSON object out of model text (tolerates ```json fences and chatter). */
function firstJsonObject(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Validate the LLM's answer against the source text so it can't hallucinate:
 *  - unknown tactic ids are dropped
 *  - quotes that don't appear in the source are dropped
 *  - the address must be one the regex actually found
 */
export function parseShillResponse(raw: string, source: string, candidates: string[]): ParsedShill | null {
  const parsed = llmSchema.safeParse(firstJsonObject(raw));
  if (!parsed.success) return null;
  const d = parsed.data;
  const src = norm(source);

  const tactics: DetectedTactic[] = [];
  const seen = new Set<string>();
  for (const t of d.tactics) {
    if (!(TACTIC_IDS as string[]).includes(t.id)) continue;
    const q = t.quote.trim();
    if (q.length < 2 || !src.includes(norm(q))) continue;
    const key = `${t.id}:${norm(q)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tactics.push({ id: t.id as TacticId, quote: q, explanation: t.explanation.trim() || TACTICS[t.id as TacticId].why });
  }

  const addr = d.primaryAddress?.trim() ?? null;
  const match = addr ? candidates.find((c) => c === addr || c.toLowerCase() === addr.toLowerCase()) ?? null : null;
  const ticker = d.primaryTicker?.replace(/^\$/, "").trim().toUpperCase() || null;

  return { summary: d.summary.trim(), primaryTicker: ticker, primaryAddress: match, tactics };
}
