import { AlertTriangle, Copy, Link2, MessageSquareWarning } from "lucide-react";
import type { ShillResult } from "@/lib/shill.functions";
import { MANIPULATION_LABELS, TACTICS } from "@/lib/shill-model";
import { VERDICT_STYLES } from "./verdict-styles";

export function ShillReport({ result }: { result: ShillResult }) {
  const { manipulation: m, tactics, token } = result;
  const style = VERDICT_STYLES[m.verdict];

  return (
    <section className={`animate-rise mb-5 rounded-xl border bg-card/80 p-5 backdrop-blur ${style.border}`}>
      <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
        <div className="text-center md:w-44">
          <div className={`font-display text-6xl font-extrabold leading-none tabular-nums ${style.text}`}>{m.score}</div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">pressure score</div>
          <span
            className={`mt-3 inline-block rounded-full border px-3 py-1 font-mono text-xs font-semibold uppercase tracking-widest ${style.border} ${style.soft} ${style.text}`}
          >
            {MANIPULATION_LABELS[m.verdict]}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground [&_svg]:size-4">
            <MessageSquareWarning />
            How this pitch works on you
          </h3>
          {result.summary ? (
            <p className="text-[15px] leading-relaxed text-foreground/90">{result.summary}</p>
          ) : !result.aiOk ? (
            <p className="text-sm text-muted-foreground">The AI reader is unavailable, so we only pulled out the token.</p>
          ) : null}

          {tactics.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {tactics.map((t, i) => (
                <li key={`${t.id}-${i}`} className="rounded-lg border border-border bg-panel p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{TACTICS[t.id].label}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-risk-critical">
                      +{Math.round(TACTICS[t.id].weight * 100)}
                    </span>
                  </div>
                  <blockquote className="mt-1 border-l-2 border-risk-critical/60 pl-2 font-mono text-sm text-foreground">
                    “{t.quote}”
                  </blockquote>
                  <p className="mt-1 text-sm text-muted-foreground">{t.explanation}</p>
                </li>
              ))}
            </ul>
          ) : (
            result.aiOk && <p className="mt-3 text-sm text-muted-foreground">No pressure tactics spotted in this message.</p>
          )}

          {token?.foundBy === "ticker" && (
            <div className="mt-4 flex gap-2 rounded-lg border border-risk-high/50 bg-risk-high/10 p-3 text-sm">
              <Copy className="mt-0.5 size-4 shrink-0 text-risk-high" />
              <p>
                The message only names <b>${token.symbol}</b>, with no contract address.{" "}
                {token.sameTickerCount && token.sameTickerCount > 1 ? (
                  <>
                    <b>{token.sameTickerCount} different contracts</b> use that ticker. We checked the most liquid one,
                    but if the sender gives you a different address, it may be a copycat.
                  </>
                ) : (
                  <>We checked the only matching contract we could find. Always confirm the address with the official project.</>
                )}
              </p>
            </div>
          )}
          {!token && (
            <div className="mt-4 flex gap-2 rounded-lg border border-border bg-panel p-3 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              No token contract found in this message, so there's nothing on-chain to check.
            </div>
          )}

          {result.pages.length > 0 && (
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <Link2 className="size-3" />
              Read linked page{result.pages.length > 1 ? "s" : ""}:
              {result.pages.map((p) => (
                <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {p.title || new URL(p.url).hostname}
                </a>
              ))}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
