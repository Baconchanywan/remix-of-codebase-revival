import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radar } from "lucide-react";
import { AnalyzeForm, type ChainChoice } from "@/components/rug/AnalyzeForm";
import { ResultView } from "@/components/rug/ResultView";
import { analyzeToken } from "@/lib/analyze.functions";
import { HISTORICAL_CASES } from "@/lib/rug-model";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rugscope — Will this coin rug pull?" },
      {
        name: "description",
        content:
          "Paste an Ethereum, BNB Chain or Solana token address to get a rug pull probability based on patterns from historical scams.",
      },
      { property: "og:title", content: "Rugscope — Will this coin rug pull?" },
      {
        property: "og:description",
        content: "Rug pull risk scores for Ethereum, BNB Chain and Solana tokens, matched against historical scams.",
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
    mutationFn: (v: { address: string; chain: ChainChoice }) => analyze({ data: v }),
  });

  const res = mutation.data;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Radar className="size-5" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight">RUGSCOPE</span>
        </div>
        <span className="hidden font-mono text-[11px] uppercase tracking-widest text-muted-foreground sm:block">
          ETH · BNB · SOL
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <section className="pb-10 pt-8 md:pt-16">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-primary">
            Rug pull forensics
          </p>
          <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
            Will it rug?
            <span className="block text-muted-foreground">Check before you ape.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Paste a token contract. We pull live on-chain data and score it against the warning signs seen in{" "}
            {HISTORICAL_CASES.length} documented rug pulls.
          </p>
          <div className="mt-8 max-w-3xl">
            <AnalyzeForm
              loading={mutation.isPending}
              onSubmit={(address, chain) => mutation.mutate({ address, chain })}
            />
          </div>
        </section>

        {mutation.isError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            Something went wrong reaching the data sources. Please try again.
          </div>
        )}
        {res && !res.ok && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{res.error}</div>
        )}
        {res?.ok && <ResultView key={res.result.analyzedAt} result={res.result} />}

        <footer className="mt-16 border-t border-border pt-6 font-mono text-[11px] leading-relaxed text-muted-foreground">
          Probability estimates only — not financial advice. A low score doesn't make a token safe; scammers adapt.
          Data from DexScreener, GoPlus Security and RugCheck.
        </footer>
      </main>
    </div>
  );
}
