import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  History,
  Loader2,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { explainRisk, type AnalysisResult } from "@/lib/analyze.functions";
import { CHAIN_LABELS, PATTERN_LABELS, type Factor } from "@/lib/rug-model";
import {
  METRIC_INFO,
  readAge,
  readDataCompleteness,
  readHolders,
  readLiquidity,
  readLpLocked,
  readTax,
  readTopHolders,
  type Judgment,
  type MetricReading,
} from "@/lib/metric-info";
import { MetricInfo } from "./MetricInfo";
import { Button } from "@/components/ui/button";
import { RiskChart } from "./RiskChart";
import { RiskGauge } from "./RiskGauge";
import { Timeline } from "./Timeline";
import { VERDICT_STYLES } from "./verdict-styles";

const EASE = [0.2, 0.8, 0.2, 1] as const;

function fmtUsd(n: number | null) {
  if (n === null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
const fmtPct = (n: number | null) =>
  n === null ? "—" : `${n.toFixed(n >= 10 ? 0 : 1)}%`;
function fmtAge(days: number | null) {
  if (days === null) return "—";
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 60) return `${Math.round(days)}d`;
  if (days < 730) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function Panel({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE, delay }}
      className={`rounded-xl border border-border bg-card/80 p-5 backdrop-blur ${className}`}
    >
      {children}
    </motion.section>
  );
}

function PanelTitle({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <h3 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground [&_svg]:size-4 [&_svg]:text-primary">
      {icon}
      {children}
    </h3>
  );
}

const JUDGMENT_TEXT: Record<Judgment, string> = {
  good: "text-risk-low",
  watch: "text-risk-elevated",
  risk: "text-risk-critical",
  unknown: "text-muted-foreground",
};

const JUDGMENT_BAR: Record<Judgment, string> = {
  good: "bg-risk-low",
  watch: "bg-risk-elevated",
  risk: "bg-risk-critical",
  unknown: "bg-muted-foreground",
};

/** Coloured context line that says what the value means, e.g. "Low, most liquidity can be removed". */
function Context({ reading }: { reading: MetricReading }) {
  return (
    <p className={`mt-1 text-xs ${JUDGMENT_TEXT[reading.judgment]}`}>
      {reading.context}
    </p>
  );
}

/** Label row with a plain-English name and an info button. */
function LabelRow({ info }: { info: keyof typeof METRIC_INFO }) {
  const item = METRIC_INFO[info];
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {item.label}
      </span>
      <MetricInfo info={item} />
    </div>
  );
}

/** Headline figure for the most important numbers. */
function HeroMetric({
  info,
  value,
  reading,
}: {
  info: keyof typeof METRIC_INFO;
  value: string;
  reading: MetricReading;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel px-4 py-4 transition-colors duration-200 hover:border-primary/60">
      <LabelRow info={info} />
      <div className="mt-1 font-display text-2xl font-extrabold tabular-nums tracking-tight">
        {value}
      </div>
      <Context reading={reading} />
    </div>
  );
}

/** Percentage shown as a small meter, so the size is visible at a glance. */
function MeterMetric({
  info,
  value,
  pct,
  reading,
}: {
  info: keyof typeof METRIC_INFO;
  value: string;
  pct: number | null;
  reading: MetricReading;
}) {
  const width = pct === null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div className="rounded-lg border border-border bg-panel px-4 py-3 transition-colors duration-200 hover:border-primary/60">
      <div className="flex items-baseline justify-between gap-2">
        <LabelRow info={info} />
        <span className="font-mono text-sm font-semibold tabular-nums">
          {value}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={`h-full rounded-full ${JUDGMENT_BAR[reading.judgment]}`}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.3, ease: EASE }}
        />
      </div>
      <Context reading={reading} />
    </div>
  );
}

/** Compact row for secondary facts. */
function ListMetric({
  info,
  value,
  reading,
}: {
  info: keyof typeof METRIC_INFO;
  value: string;
  reading: MetricReading;
}) {
  return (
    <div className="px-1 py-2 transition-colors duration-200 hover:bg-accent/40">
      <div className="flex items-center justify-between gap-3">
        <LabelRow info={info} />
        <span className="font-mono text-sm font-semibold tabular-nums">
          {value}
        </span>
      </div>
      <Context reading={reading} />
    </div>
  );
}

/** Animated bar for one factor. Red for flags, green for reassurance. */
function FactorRow({
  f,
  max,
  tone,
  index,
}: {
  f: Factor;
  max: number;
  tone: "bad" | "good";
  index: number;
}) {
  const reduce = useReducedMotion();
  const width = Math.max(8, (Math.abs(f.weight) / max) * 100);
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, x: tone === "bad" ? -12 : 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.25,
        ease: EASE,
        delay: reduce ? 0 : 0.05 * index,
      }}
      className="py-3 first:pt-0 last:pb-0"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{f.label}</span>
        <span
          className={`font-mono text-xs tabular-nums ${tone === "bad" ? "text-risk-critical" : "text-risk-low"}`}
        >
          {tone === "bad" ? "+" : "−"}
          {Math.abs(f.weight).toFixed(1)}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{f.detail}</p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={`h-full rounded-full ${tone === "bad" ? "bg-risk-critical" : "bg-risk-low"}`}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{
            duration: 0.3,
            ease: EASE,
            delay: reduce ? 0 : 0.05 * index + 0.1,
          }}
        />
      </div>
    </motion.li>
  );
}

/** Copy the contract address, with brief confirmation. */
function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button
      type="button"
      variant="chip"
      size="sm"
      onClick={copy}
      className="transition-transform duration-200 hover:-translate-y-0.5"
      aria-label="Copy contract address"
    >
      {copied ? <Check className="text-primary" /> : <Copy />}
      {copied ? "Copied" : "Copy address"}
    </Button>
  );
}

/** Share the report via the Web Share API, falling back to copying the link. */
function ShareReportButton({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url: string;
}) {
  const [status, setStatus] = useState<"idle" | "shared" | "copied" | "error">(
    "idle",
  );
  const share = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        setStatus("shared");
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setStatus("copied");
      }
    } catch (err) {
      // The user cancelling the native share sheet is not an error.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
    } finally {
      setTimeout(() => setStatus("idle"), 2000);
    }
  };
  const label =
    status === "shared"
      ? "Shared"
      : status === "copied"
        ? "Link copied"
        : status === "error"
          ? "Couldn't share"
          : "Share report";
  return (
    <Button
      type="button"
      variant="chip"
      size="sm"
      onClick={share}
      className="transition-transform duration-200 hover:-translate-y-0.5"
    >
      {status === "shared" || status === "copied" ? (
        <Check className="text-primary" />
      ) : (
        <Share2 />
      )}
      {label}
    </Button>
  );
}

export function ResultView({ result }: { result: AnalysisResult }) {
  const { signals: s, risk } = result;
  const style = VERDICT_STYLES[risk.verdict];
  const explain = useServerFn(explainRisk);

  const ai = useQuery({
    queryKey: ["explain", s.chain, s.address, result.analyzedAt],
    queryFn: () =>
      explain({
        data: {
          signals: s as unknown as Record<string, unknown>,
          risk: {
            score: risk.score,
            verdict: risk.verdict,
            redFlags: risk.redFlags.map(({ label, detail }) => ({
              label,
              detail,
            })),
            greenFlags: risk.greenFlags.map(({ label, detail }) => ({
              label,
              detail,
            })),
            patterns: risk.patterns,
            matches: risk.matches.map((m) => ({
              name: m.case.name,
              shared: m.shared,
            })),
          },
        },
      }),
    staleTime: Infinity,
    retry: false,
  });

  const maxWeight = Math.max(
    1,
    ...[...risk.redFlags, ...risk.greenFlags].map((f) => Math.abs(f.weight)),
  );

  const shareText = `${s.name ?? "Token"}${s.symbol ? ` ($${s.symbol})` : ""}: ${risk.score}% rug probability (${risk.verdict}) on Unruggable`;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="space-y-5">
      {/* Token header + gauge */}
      <Panel className={`relative overflow-hidden ${style.border}`}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
          <div
            className={`absolute -right-24 -top-24 size-72 rounded-full blur-3xl ${style.soft}`}
          />
        </div>
        <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              {s.imageUrl ? (
                <img
                  src={s.imageUrl}
                  alt=""
                  className="size-14 shrink-0 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-lg">
                  {(s.symbol ?? "?").slice(0, 2)}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="truncate font-display text-3xl font-extrabold tracking-tight">
                  {s.name ?? "Unknown token"}
                  {s.symbol && (
                    <span className="ml-2 text-lg font-semibold text-muted-foreground">
                      ${s.symbol}
                    </span>
                  )}
                </h2>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {CHAIN_LABELS[s.chain]} · {s.address}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <CopyAddressButton address={s.address} />
              <ShareReportButton
                title="Unruggable report"
                text={shareText}
                url={shareUrl}
              />
            </div>

            {/* Varied metric layout: headline figures, meters for percentages, and a compact list. */}
            <div className="mt-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <HeroMetric
                  info="liquidity"
                  value={fmtUsd(s.liquidityUsd)}
                  reading={readLiquidity(s.liquidityUsd)}
                />
                <HeroMetric
                  info="marketCap"
                  value={fmtUsd(s.marketCapUsd)}
                  reading={{
                    judgment: "unknown",
                    context: METRIC_INFO.marketCap.rule,
                  }}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MeterMetric
                  info="topHolders"
                  value={fmtPct(s.top10Pct)}
                  pct={s.top10Pct}
                  reading={readTopHolders(s.top10Pct)}
                />
                <MeterMetric
                  info="lpLocked"
                  value={fmtPct(s.lpLockedPct)}
                  pct={s.lpLockedPct}
                  reading={readLpLocked(s.lpLockedPct)}
                />
              </div>
              <div className="grid grid-cols-1 divide-y divide-border rounded-lg border border-border bg-panel px-3 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="sm:pr-4">
                  <ListMetric
                    info="age"
                    value={fmtAge(s.pairAgeDays)}
                    reading={readAge(s.pairAgeDays)}
                  />
                  <ListMetric
                    info="holders"
                    value={
                      s.holderCount === null
                        ? "—"
                        : s.holderCount.toLocaleString("en-US")
                    }
                    reading={readHolders(s.holderCount)}
                  />
                </div>
                <div className="sm:pl-4">
                  <ListMetric
                    info="tax"
                    value={
                      s.buyTaxPct === null && s.sellTaxPct === null
                        ? "—"
                        : `${fmtPct(s.buyTaxPct)} / ${fmtPct(s.sellTaxPct)}`
                    }
                    reading={readTax(s.buyTaxPct, s.sellTaxPct)}
                  />
                  <ListMetric
                    info="change24h"
                    value={
                      s.priceChange24h === null
                        ? "—"
                        : `${s.priceChange24h > 0 ? "+" : ""}${s.priceChange24h.toFixed(1)}%`
                    }
                    reading={{
                      judgment: "unknown",
                      context: METRIC_INFO.change24h.rule,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <span>Data: {result.sources.join(" · ")}</span>
              <span className="inline-flex items-center gap-1.5">
                Data completeness: {Math.round(risk.coverage * 100)}%
                <MetricInfo info={METRIC_INFO.dataCompleteness} />
              </span>
              <span>
                Creator analysis: {result.creatorModelSupported ? "Solana" : "unsupported for this chain"}
              </span>
              <span>Model: {result.modelStatus === "fallback" ? "prototype fallback" : result.modelVersion}</span>
              {s.dexUrl && (
                <a
                  href={s.dexUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Chart <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
          <div className="md:w-[280px]">
            <RiskGauge score={risk.score} verdict={risk.verdict} />
            {risk.confidence === "low" && (
              <p className="mt-2 text-center font-mono text-xs text-muted-foreground">
                Likely range: {Math.max(0, risk.score - 15)}–{Math.min(100, risk.score + 15)}%
              </p>
            )}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {risk.confidence === "high"
                ? "Based on the creator’s track record"
                : risk.confidence === "medium"
                  ? "Limited creator history"
                  : "New or untraceable creator: treat this score with caution"}
            </p>
          </div>
        </div>
      </Panel>

      <p className="text-center text-xs text-muted-foreground">Risk estimate from past patterns, not financial advice.</p>

      {/* AI analyst */}
      <Panel delay={0.05}>
        <PanelTitle icon={<Sparkles />}>AI analyst</PanelTitle>
        {ai.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Writing a plain-English
            explanation…
          </div>
        ) : ai.data?.ok ? (
          <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
            {ai.data.text.split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {ai.data && !ai.data.ok
              ? ai.data.error
              : "The AI analyst is unavailable right now."}
            {!(ai.data && !ai.data.ok && ai.data.notConfigured) && (
              <>
                {" "}
                <button
                  onClick={() => ai.refetch()}
                  disabled={ai.isFetching}
                  className="text-primary hover:underline disabled:opacity-50"
                >
                  {ai.isFetching ? "Trying…" : "Try again"}
                </button>
              </>
            )}
          </p>
        )}
      </Panel>

      {/* Factor impact chart */}
      {(risk.redFlags.length > 0 || risk.greenFlags.length > 0) && (
        <Panel delay={0.1}>
          <PanelTitle icon={<AlertTriangle />}>Factor impact</PanelTitle>
          <RiskChart redFlags={risk.redFlags} greenFlags={risk.greenFlags} />
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel delay={0.15}>
          <PanelTitle icon={<AlertTriangle />}>
            Red flags ({risk.redFlags.length})
          </PanelTitle>
          {risk.redFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No red flags found in the available data.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {risk.redFlags.map((f, i) => (
                <FactorRow
                  key={f.id}
                  f={f}
                  max={maxWeight}
                  tone="bad"
                  index={i}
                />
              ))}
            </ul>
          )}
        </Panel>
        <Panel delay={0.2}>
          <PanelTitle icon={<ShieldCheck />}>
            Reassuring signals ({risk.greenFlags.length})
          </PanelTitle>
          {risk.greenFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing in the data offsets the risk.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {risk.greenFlags.map((f, i) => (
                <FactorRow
                  key={f.id}
                  f={f}
                  max={maxWeight}
                  tone="good"
                  index={i}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel delay={0.25}>
        <PanelTitle icon={<History />}>Closest historical rug pulls</PanelTitle>
        {risk.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This token doesn't share warning patterns with any rug pull in our
            history set.
          </p>
        ) : (
          <Timeline matches={risk.matches} />
        )}
      </Panel>
    </div>
  );
}
