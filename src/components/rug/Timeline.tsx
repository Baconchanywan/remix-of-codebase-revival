import { motion, useReducedMotion } from "motion/react";
import {
  CHAIN_LABELS,
  PATTERN_LABELS,
  type HistoricalCase,
} from "@/lib/rug-model";

export interface TimelineMatch {
  case: HistoricalCase;
  similarity: number;
  shared: string[];
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Sort key from labels like "Nov 2021" or "2021–2024" (earliest year). Unknown dates sort last. */
function dateKey(date: string): number {
  const year = Number(date.match(/\d{4}/)?.[0]);
  if (!Number.isFinite(year)) return Number.MAX_SAFE_INTEGER;
  const month = MONTHS.indexOf(date.slice(0, 3));
  return year * 12 + (month >= 0 ? month : 0);
}

/** Historical rug pulls ordered by date, with each one's match strength. */
export function Timeline({ matches }: { matches: TimelineMatch[] }) {
  const reduce = useReducedMotion();
  const ordered = [...matches].sort(
    (a, b) => dateKey(a.case.date) - dateKey(b.case.date),
  );

  return (
    <ol className="relative ml-2 space-y-5 border-l border-border pl-6">
      {ordered.map((m, i) => {
        const pct = Math.round(m.similarity * 100);
        return (
          <motion.li
            key={m.case.name}
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: reduce ? 0 : i * 0.05 }}
            className="relative"
          >
            <span className="absolute -left-[31px] top-1.5 size-2.5 rounded-full bg-risk-critical ring-4 ring-background" />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-display text-base font-bold">
                {m.case.name}
              </h4>
              <span className="font-mono text-xs text-risk-critical">
                {pct}% match
              </span>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">
              {m.case.date} · {CHAIN_LABELS[m.case.chain]} · {m.case.lossUsd}
            </p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-risk-critical"
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{
                  duration: 0.3,
                  delay: reduce ? 0 : 0.1 + i * 0.05,
                }}
              />
            </div>
            {m.shared.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Shared:{" "}
                {m.shared
                  .map(
                    (p) =>
                      PATTERN_LABELS[p as keyof typeof PATTERN_LABELS] ?? p,
                  )
                  .join(", ")}
              </p>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}
