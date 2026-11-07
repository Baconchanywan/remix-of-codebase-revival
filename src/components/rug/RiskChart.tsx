import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Factor } from "@/lib/rug-model";

/** Matches the lists below: "+" for risk-raising red flags, "−" for reassuring signals. */
const fmt = (v: number, tone: "bad" | "good") =>
  `${tone === "bad" ? "+" : "−"}${Math.abs(v).toFixed(1)}`;

/**
 * Diverging bar chart of factor impacts. Red flags push risk up and draw to the
 * left of zero; reassuring signals pull risk down and draw to the right.
 */
export function RiskChart({
  redFlags,
  greenFlags,
}: {
  redFlags: Factor[];
  greenFlags: Factor[];
}) {
  const data = [
    ...redFlags.map((f) => ({
      label: f.label,
      value: -Number(Math.abs(f.weight).toFixed(1)),
      tone: "bad" as const,
    })),
    ...greenFlags.map((f) => ({
      label: f.label,
      value: Number(Math.abs(f.weight).toFixed(1)),
      tone: "good" as const,
    })),
  ].sort((a, b) => a.value - b.value);

  if (data.length === 0) return null;

  const height = Math.max(160, data.length * 40 + 24);
  const rowHeight = (height - 8) / data.length;
  const extent = Math.max(1, ...data.map((d) => Math.abs(d.value))) + 0.8;

  return (
    <div className="flex w-full items-stretch gap-3">
      <div
        style={{ height }}
        className="min-w-0 flex-1"
        role="img"
        aria-label="Risk factor impact chart: red flags to the left, reassuring signals to the right"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 8, bottom: 4, left: 4 }}
            barCategoryGap="28%"
          >
            <XAxis type="number" hide domain={[-extent, extent]} />
            <YAxis
              type="category"
              dataKey="label"
              width={150}
              tick={{ fill: "var(--color-foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine
              x={0}
              stroke="var(--color-muted-foreground)"
              strokeOpacity={0.6}
            />
            <Tooltip
              allowEscapeViewBox={{ x: false, y: true }}
              wrapperStyle={{ zIndex: 10 }}
              cursor={{ fill: "var(--color-accent)", fillOpacity: 0.25 }}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--color-foreground)",
              }}
              labelStyle={{ color: "var(--color-foreground)" }}
              itemStyle={{ color: "var(--color-foreground)" }}
              formatter={(v: number) => [
                fmt(v, v < 0 ? "bad" : "good"),
                "Impact",
              ]}
            />
            <Bar
              dataKey="value"
              radius={4}
              isAnimationActive
              animationDuration={300}
            >
              {data.map((d) => (
                <Cell
                  key={d.label}
                  fill={
                    d.tone === "bad"
                      ? "var(--color-risk-critical)"
                      : "var(--color-risk-low)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul
        aria-hidden="true"
        className="flex w-14 shrink-0 flex-col py-1 font-mono text-xs font-semibold tabular-nums"
        style={{ height }}
      >
        {data.map((d) => (
          <li
            key={d.label}
            style={{ height: rowHeight }}
            className={`flex items-center justify-end ${d.tone === "bad" ? "text-risk-critical" : "text-risk-low"}`}
          >
            {fmt(d.value, d.tone)}
          </li>
        ))}
      </ul>
    </div>
  );
}
