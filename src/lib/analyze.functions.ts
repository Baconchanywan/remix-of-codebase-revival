import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CHAIN_LABELS,
  PATTERN_LABELS,
  VERDICT_LABELS,
  scoreToken,
  type RiskResult,
  type TokenSignals,
} from "./rug-model";

const analyzeInput = z.object({
  address: z.string().trim().min(32).max(64),
  chain: z.enum(["auto", "ethereum", "bsc", "solana"]),
});

export interface AnalysisResult {
  signals: TokenSignals;
  risk: RiskResult;
  sources: string[];
  analyzedAt: string;
  creatorModelSupported: boolean;
  modelStatus: RiskResult["modelStatus"];
  modelVersion: string;
}

export const analyzeToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => analyzeInput.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; result: AnalysisResult } | { ok: false; error: string }> => {
    const { gatherTokenSignals } = await import("./token-data.server");
    try {
      const knownBadJson = (await import("./model/known-bad.json")).default as {
        creators: string[];
        funders: string[];
      };
      const knownBad = {
        creators: new Set(knownBadJson.creators.map((address) => address.toLowerCase())),
        funders: new Set(knownBadJson.funders.map((address) => address.toLowerCase())),
      };
      const { signals, sources } = await gatherTokenSignals(data.address, data.chain);
      const risk = scoreToken(signals, { knownBad });
      return {
        ok: true,
        result: {
          signals,
          risk,
          sources,
          analyzedAt: new Date().toISOString(),
          creatorModelSupported: risk.creatorModelSupported,
          modelStatus: risk.modelStatus,
          modelVersion: risk.modelVersion,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong while checking this token.";
      return { ok: false, error: message };
    }
  });

const explainInput = z.object({
  signals: z.record(z.string(), z.unknown()),
  risk: z.object({
    score: z.number(),
    verdict: z.enum(["low", "elevated", "high", "critical"]),
    redFlags: z.array(z.object({ label: z.string(), detail: z.string() })).max(40),
    greenFlags: z.array(z.object({ label: z.string(), detail: z.string() })).max(40),
    patterns: z.array(z.string()).max(20),
    matches: z.array(z.object({ name: z.string(), shared: z.array(z.string()) })).max(5),
  }),
});

export const explainRisk = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => explainInput.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    const { generateResponse, GatewayError, PaymentRequiredError, RateLimitError } = await import(
      "@lovable.dev/ai-gateway"
    );
    const s = data.signals;
    const r = data.risk;
    const chain = typeof s["chain"] === "string" && s["chain"] in CHAIN_LABELS ? CHAIN_LABELS[s["chain"] as keyof typeof CHAIN_LABELS] : "unknown chain";

    const brief = [
      `Token: ${String(s["name"] ?? "Unknown")} (${String(s["symbol"] ?? "?")}) on ${chain}`,
      `Model rug-pull probability: ${r.score}% — ${VERDICT_LABELS[r.verdict]}`,
      `Red flags: ${r.redFlags.map((f) => `${f.label} (${f.detail})`).join("; ") || "none"}`,
      `Positive signals: ${r.greenFlags.map((f) => `${f.label} (${f.detail})`).join("; ") || "none"}`,
      `Historical patterns matched: ${r.patterns.map((p) => PATTERN_LABELS[p as keyof typeof PATTERN_LABELS] ?? p).join(", ") || "none"}`,
      `Most similar past rug pulls: ${r.matches.map((m) => m.name).join(", ") || "none"}`,
      `Raw signals: ${JSON.stringify(s).slice(0, 2500)}`,
    ].join("\n");

    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "You are a blunt crypto security analyst. Explain to a non-technical investor, in plain English, why this token does or doesn't look like a rug pull. " +
          "Write 3 short paragraphs (max ~170 words total): 1) the verdict in one or two sentences, 2) the most important reasons, referencing similar historical rug pulls when relevant, 3) what to watch or check before buying. " +
          "Do not invent data not in the brief. No markdown headings, no bullet lists. End with a short reminder this is not financial advice.",
        input: brief,
        max_output_tokens: 900,
      });
      let text = "";
      for (const item of res.output ?? []) {
        if (item.type === "message") {
          for (const c of item.content) if (c.type === "output_text") text += c.text;
        }
      }
      if (!text.trim()) return { ok: false, error: "The AI analyst didn't return an explanation. Try again." };
      return { ok: true, text: text.trim() };
    } catch (err) {
      if (err instanceof PaymentRequiredError) return { ok: false, error: "AI credits have run out for this app." };
      if (err instanceof RateLimitError) return { ok: false, error: "Too many requests right now — try again in a minute." };
      if (err instanceof GatewayError) {
        console.error("AI explain failed", err.code, err.ids);
        return { ok: false, error: "The AI analyst is unavailable right now." };
      }
      console.error("AI explain failed", err);
      return { ok: false, error: "The AI analyst is unavailable right now." };
    }
  });
