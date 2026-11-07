import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MetricInfo as MetricInfoData } from "@/lib/metric-info";

/**
 * Info button that explains a metric. Built on Radix Popover, so it opens on click,
 * tap, and Enter/Space, and closes on Escape.
 */
export function MetricInfo({ info }: { info: MetricInfoData }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`About ${info.label}`}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2 text-sm">
        <p className="font-semibold text-foreground">{info.label}</p>
        <p className="text-muted-foreground">{info.definition}</p>
        <p className="text-muted-foreground">{info.meaning}</p>
        <p className="font-mono text-[11px] uppercase tracking-wide text-primary">
          Rule of thumb: {info.rule}
        </p>
      </PopoverContent>
    </Popover>
  );
}
