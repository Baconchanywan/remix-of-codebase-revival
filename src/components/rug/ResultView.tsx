import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ExternalLink, History, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { explainRisk, type AnalysisResult } from "@/lib/analyze.functions";
import { CHAIN_LABELS, PATTERN_LABELS, type Factor } from "@/lib/rug-model";
import { RiskGauge } from "./RiskGauge";
import { VERDICT_STYLES } from "./verdict-styles";

function fmtUsd(n: number | null) {
  if (n === null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
const fmtPct = (n: number | null) => (n === null ? "—" : `${n.toFixed(n >= 10 ? 0 : 1)}%`);
function fmtAge(days: number | null) {
  if (days === null) return "—";
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 60) return `${Math.round(days)}d`;
  if (days < 730) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-card/80 p-5 backdrop-blur ${className}`}>{children}</section>;
}

function PanelTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground [&_svg]:size-4">
      {icon}
      {children}
    </h3>
  );
}

function FactorRow({ f, max, tone }: { f: Factor; max: number; tone: "bad" | "good" }) {
  const width = Math.max(8, (Math.abs(f.weight) / max) * 100);
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{f.label}</span>
        <span className={`font-mono text-xs ${tone === "bad" ? "text-risk-critical" : "text-risk-low"}`}>
          {tone === "bad" ? "+" : "−"}
          {Math.abs(f.weight).toFixed(1)}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{f.detail}</p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${tone === "bad" ? "bg-risk-critical" : "bg-risk-low"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </li>
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
            redFlags: risk.redFlags.map(({ label, detail }) => ({ label, detail })),
            greenFlags: risk.greenFlags.map(({ label, detail }) => ({ label, detail })),
            patterns: risk.patterns,
            matches: risk.matches.map((m) => ({ name: m.case.name, shared: m.shared })),
          },
        },
      }),
    staleTime: Infinity,
    retry: false,
  });

  const maxWeight = Math.max(1, ...[...risk.redFlags, ...risk.greenFlags].map((f) => Math.abs(f.weight)));

  const stats: [string, string][] = [
    ["Liquidity", fmtUsd(s.liquidityUsd)],
    ["Market cap", fmtUsd(s.marketCapUsd)],
    ["Age", fmtAge(s.pairAgeDays)],
    ["Holders", s.holderCount === null ? "—" : s.holderCount.toLocaleString("en-US")],
    ["Top 10 hold", fmtPct(s.top10Pct)],
    ["LP locked", fmtPct(s.lpLockedPct)],
    ["Buy / sell tax", s.buyTaxPct === null && s.sellTaxPct === null ? "—" : `${fmtPct(s.buyTaxPct)} / ${fmtPct(s.sellTaxPct)}`],
    ["24h change", s.priceChange24h === null ? "—" : `${s.priceChange24h > 0 ? "+" : ""}${s.priceChange24h.toFixed(1)}%`],
  ];

  return (
    <div className="animate-rise space-y-5">
      {/* Token header + gauge */}
      <Panel className={`relative overflow-hidden ${style.border}`}>
        <div className={`pointer-events-none absolute -right-24 -top-24 size-72 rounded-full blur-3xl ${style.soft}`} />
        <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center gap-4">
              {s.imageUrl ? (
                <img src={s.imageUrl} alt="" className="size-14 rounded-full border border-border object-cover" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-full border border-border bg-muted font-mono text-lg">
                  {(s.symbol ?? "?").slice(0, 2)}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="truncate font-display text-3xl font-extrabold tracking-tight">
                  {s.name ?? "Unknown token"}
                  {s.symbol && <span className="ml-2 text-lg font-semibold text-muted-foreground">${s.symbol}</span>}
                </h2>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {CHAIN_LABELS[s.chain]} · {s.address}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
              {stats.map(([k, v]) => (
                <div key={k} className="bg-panel px-3 py-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
                  <div className="mt-1 font-mono text-base font-semibold tabular-nums">{v}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <span>Data: {result.sources.join(" · ")}</span>
              <span>Signal coverage: {Math.round(risk.coverage * 100)}%</span>
              <span>
                Creator analysis: {result.creatorModelSupported ? "Solana" : "unsupported for this chain"}
              </span>
              <span>Model: {result.modelStatus === "fallback" ? "prototype fallback" : result.modelVersion}</span>
              {s.dexUrl && (
                <a href={s.dexUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  Chart <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
          <div className="md:w-[280px]">
            <RiskGauge score={risk.trust} verdict={risk.verdict} />
            <p className="mt-2 text-center font-mono text-xs text-muted-foreground">
              Trust estimate: {risk.confidence === "low" ? `${Math.max(0, risk.trust - 15)}–${Math.min(100, risk.trust + 15)}` : risk.trust}%
            </p>
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

      {/* AI explanation */}
      <Panel>
        <PanelTitle icon={<Sparkles />}>Analyst read</PanelTitle>
        {ai.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Writing a plain-English explanation…
          </div>
        ) : ai.data?.ok ? (
          <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
            {ai.data.text.split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {ai.data && !ai.data.ok ? ai.data.error : "The AI analyst is unavailable right now."}{" "}
            <button onClick={() => ai.refetch()} className="text-primary hover:underline">
              Try again
            </button>
          </p>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelTitle icon={<AlertTriangle />}>Red flags ({risk.redFlags.length})</PanelTitle>
          {risk.redFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No red flags found in the available data.</p>
          ) : (
            <ul className="divide-y divide-border">
              {risk.redFlags.map((f) => (
                <FactorRow key={f.id} f={f} max={maxWeight} tone="bad" />
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelTitle icon={<ShieldCheck />}>Reassuring signals ({risk.greenFlags.length})</PanelTitle>
          {risk.greenFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in the data offsets the risk.</p>
          ) : (
            <ul className="divide-y divide-border">
              {risk.greenFlags.map((f) => (
                <FactorRow key={f.id} f={f} max={maxWeight} tone="good" />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelTitle icon={<History />}>Closest historical rug pulls</PanelTitle>
        {risk.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This token doesn't share warning patterns with any rug pull in our history set.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {risk.matches.map((m) => (
              <article key={m.case.name} className="rounded-lg border border-border bg-panel p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="font-display text-lg font-bold">{m.case.name}</h4>
                  <span className="font-mono text-xs text-risk-critical">{Math.round(m.similarity * 100)}% match</span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  ${m.case.symbol} · {CHAIN_LABELS[m.case.chain]} · {m.case.date} · {m.case.lossUsd}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{m.case.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.case.patterns.map((p) => (
                    <span
                      key={p}
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                        m.shared.includes(p)
                          ? "border-risk-critical/50 bg-risk-critical/10 text-risk-critical"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {PATTERN_LABELS[p]}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
