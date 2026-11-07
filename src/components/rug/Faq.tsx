import {
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

const ITEMS: { icon: LucideIcon; q: string; a: string }[] = [
  {
    icon: AlertTriangle,
    q: "What is a red flag?",
    a: "A red flag is a signal that matches how past rug pulls looked before they collapsed, such as a large share of supply held by a few wallets, unlocked liquidity, or a contract that can block sales. The longer the bar, the more it pushes the score up.",
  },
  {
    icon: ShieldCheck,
    q: "What is a reassuring signal?",
    a: "A reassuring signal is something that usually looks healthier, such as a long trading history, deep liquidity, a large holder base, or a clean security report. These pull the score down, but they don't guarantee safety.",
  },
  {
    icon: HelpCircle,
    q: "Does a low score mean a token is safe?",
    a: "No. The score only reflects the data available and known patterns. Scammers adapt, and a token can still lose value for reasons the model can't see. Always do your own research.",
  },
];

export function Faq() {
  return (
    <section aria-labelledby="faq" className="pt-16">
      <h2
        id="faq"
        className="mb-6 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
      >
        FAQ
      </h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-card/60">
        {ITEMS.map((item) => (
          <details
            key={item.q}
            className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold transition-colors hover:text-primary">
              <span className="flex items-center gap-3">
                <item.icon className="size-4 text-primary" />
                {item.q}
              </span>
              <span className="font-mono text-primary transition-transform duration-200 group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 pl-7 text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
