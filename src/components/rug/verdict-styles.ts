import type { Verdict } from "@/lib/rug-model";

export const VERDICT_STYLES: Record<Verdict, { text: string; bg: string; border: string; stroke: string; soft: string }> = {
  low: {
    text: "text-risk-low",
    bg: "bg-risk-low",
    border: "border-risk-low/50",
    stroke: "stroke-risk-low",
    soft: "bg-risk-low/10",
  },
  elevated: {
    text: "text-risk-elevated",
    bg: "bg-risk-elevated",
    border: "border-risk-elevated/50",
    stroke: "stroke-risk-elevated",
    soft: "bg-risk-elevated/10",
  },
  high: {
    text: "text-risk-high",
    bg: "bg-risk-high",
    border: "border-risk-high/50",
    stroke: "stroke-risk-high",
    soft: "bg-risk-high/10",
  },
  critical: {
    text: "text-risk-critical",
    bg: "bg-risk-critical",
    border: "border-risk-critical/50",
    stroke: "stroke-risk-critical",
    soft: "bg-risk-critical/10",
  },
};
