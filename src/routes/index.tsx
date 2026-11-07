import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Radar } from "lucide-react";
import { AnalyzeForm, type ChainChoice } from "@/components/rug/AnalyzeForm";
import { Button } from "@/components/ui/button";
import { ResultView } from "@/components/rug/ResultView";
import { ShillForm } from "@/components/rug/ShillForm";
import { ShillReport } from "@/components/rug/ShillReport";
import { ResultSkeleton } from "@/components/rug/ResultSkeleton";
import { HowItWorks } from "@/components/rug/HowItWorks";
import { Faq } from "@/components/rug/Faq";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { analyzeToken } from "@/lib/analyze.functions";
import { analyzeShill } from "@/lib/shill.functions";
import { useState } from "react";
import { HISTORICAL_CASES } from "@/lib/rug-model";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Unruggable — Will this coin rug pull?" },
      {
        name: "description",
        content:
          "Search a token by name or contract address to get a rug pull probability based on patterns from historical scams.",
      },
      {
        property: "og:title",
        content: "Unruggable — Will this coin rug pull?",
      },
      {
        property: "og:description",
        content:
          "Rug pull risk scores for Ethereum, BNB Chain and Solana tokens, matched against historical scams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const analyze = useServerFn(analyzeToken);
  const mutation = useMutation({
    mutationFn: (v: { address: string; chain: ChainChoice }) =>
      analyze({ data: v }),
  });

  const res = mutation.data;
  const reduce = useReducedMotion();
  const fade = {
    initial: reduce ? false : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] as const },
  };

  const [mode, setMode] = useState<"shill" | "address">("shill");
  const checkShill = useServerFn(analyzeShill);
  const shill = useMutation({
    mutationFn: (text: string) => checkShill({ data: { text } }),
    onMutate: () => mutation.reset(),
    // Chain into the on-chain scan as soon as the message gives us a token.
    onSuccess: (r) => {
      if (r.ok && r.result.token) mutation.mutate({ address: r.result.token.address, chain: r.result.token.chain });
    },
  });
  const shillRes = mode === "shill" ? shill.data : undefined;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Radar className="size-5" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight">
            UNRUGGABLE
          </span>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground sm:flex">
          <span className="size-1.5 rounded-full bg-primary" />
          Live data
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <section className="pb-10 pt-10 md:pt-16">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-primary">
            Rug pull risk checker
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Check a token before you buy.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Search by name, symbol, or contract address. We pull live on-chain
            data and score it against the warning signs seen in{" "}
            {HISTORICAL_CASES.length} documented rug pulls.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <li>Live market data</li>
            <li>Contract &amp; liquidity checks</li>
            <li>Plain-English analysis</li>
          </ul>
          <div className="mt-8 max-w-3xl">
            <div className="mb-4 flex gap-1.5" role="tablist" aria-label="Input type">
              {(
                [
                  ["shill", "Paste a shill"],
                  ["address", "Contract address"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => setMode(value)}
                  className={`rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                    mode === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "shill" ? (
              <ShillForm loading={shill.isPending || mutation.isPending} onSubmit={(text) => shill.mutate(text)} />
            ) : (
              <AnalyzeForm
                loading={mutation.isPending}
                onSubmit={(address, chain) => mutation.mutate({ address, chain })}
              />
            )}
          </div>
        </section>

        {mode === "shill" && shill.isError && (
          <div className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            Something went wrong reading that message. Please try again.
          </div>
        )}
        {shillRes && !shillRes.ok && (
          <div className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{shillRes.error}</div>
        )}
        {shillRes?.ok && <ShillReport result={shillRes.result} />}

        <AnimatePresence mode="wait" initial={false}>
          {mutation.isPending && (
            <motion.div key="loading" {...fade}>
              <ResultSkeleton />
            </motion.div>
          )}
          {!mutation.isPending && (mutation.isError || (res && !res.ok)) && (
            <motion.div
              key="error"
              {...fade}
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="space-y-2">
                <p>
                  {mutation.isError
                    ? "Couldn't reach Unruggable's servers. Check your connection and try again."
                    : res && !res.ok
                      ? res.error
                      : ""}
                </p>
                <Button
                  type="button"
                  variant="chip"
                  size="sm"
                  onClick={() => mutation.reset()}
                >
                  Dismiss
                </Button>
              </div>
            </motion.div>
          )}
          {!mutation.isPending && res?.ok && (
            <motion.div key={res.result.analyzedAt} {...fade}>
              <ResultView result={res.result} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-16 space-y-16">
          <HowItWorks />
          <Faq />
        </div>

        <footer className="mt-16 grid gap-8 border-t border-border pt-8 text-sm text-muted-foreground md:grid-cols-3">
          <div className="space-y-2">
            <p className="font-display text-base font-bold text-foreground">
              UNRUGGABLE
            </p>
            <p className="leading-relaxed">
              Rug pull risk estimates to help you do your own research.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-foreground">
              Data sources
            </p>
            <p className="leading-relaxed">
              DexScreener, GoPlus Security and RugCheck.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-foreground">
              Disclaimer
            </p>
            <p className="leading-relaxed">
              Probability estimates only, not financial advice. A low score
              doesn't make a token safe; scammers adapt.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
