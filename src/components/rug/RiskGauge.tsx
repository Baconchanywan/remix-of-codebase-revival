import { useCountUp } from "./use-count-up";
import { VERDICT_LABELS, type Verdict } from "@/lib/rug-model";
import { METRIC_INFO } from "@/lib/metric-info";
import { MetricInfo } from "./MetricInfo";
import { VERDICT_STYLES } from "./verdict-styles";

export function RiskGauge({
  score,
  verdict,
}: {
  score: number;
  verdict: Verdict;
}) {
  const r = 84;
  const circumference = Math.PI * r; // half circle
  const style = VERDICT_STYLES[verdict];
  const displayed = useCountUp(score);
  const offset = circumference * (1 - displayed / 100);

  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="relative">
        <svg viewBox="0 0 200 116" className="w-full">
          <path
            d="M 16 100 A 84 84 0 0 1 184 100"
            fill="none"
            className="stroke-muted"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M 16 100 A 84 84 0 0 1 184 100"
            fill="none"
            className={style.stroke}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
          {[0, 25, 50, 75, 100].map((t) => {
            const a = Math.PI * (1 - t / 100);
            const x1 = 100 + Math.cos(a) * 66;
            const y1 = 100 - Math.sin(a) * 66;
            const x2 = 100 + Math.cos(a) * 72;
            const y2 = 100 - Math.sin(a) * 72;
            return (
              <line
                key={t}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="stroke-muted-foreground/50"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span
            className={`font-display text-6xl font-extrabold leading-none tabular-nums ${style.text}`}
          >
            {displayed}
            <span className="text-2xl">%</span>
          </span>
        </div>
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        Estimated rug-pull probability
        <MetricInfo info={METRIC_INFO.rugProbability} />
      </p>
      <div className="mt-4 flex justify-center">
        <span
          className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold uppercase tracking-widest ${style.border} ${style.soft} ${style.text}`}
        >
          {VERDICT_LABELS[verdict]}
        </span>
      </div>
    </div>
  );
}
