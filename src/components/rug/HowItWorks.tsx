import { Database, GitCompare, Gauge, type LucideIcon } from "lucide-react";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Database,
    title: "Collect data",
    body: "We pull live market, liquidity, holder and contract-security data from DexScreener, GoPlus and RugCheck.",
  },
  {
    icon: GitCompare,
    title: "Compare patterns",
    body: "Each signal is checked against the warning signs seen in documented rug pulls, like thin liquidity or a removable LP.",
  },
  {
    icon: Gauge,
    title: "Score risk",
    body: "The signals are weighted into a single rug-pull probability, with the reasons shown so you can judge for yourself.",
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="pt-16">
      <h2
        id="how-it-works"
        className="mb-6 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
      >
        How it works
      </h2>
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="group rounded-xl border border-border bg-card/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[var(--glow-primary)]"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <step.icon className="size-5" />
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                0{i + 1}
              </span>
            </div>
            <h3 className="font-display text-lg font-bold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
