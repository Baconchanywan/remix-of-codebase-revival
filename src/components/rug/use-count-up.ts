import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

const COUNT_MS = 300;

/** Counts from 0 to `target`. Jumps straight to the value when reduced motion is preferred. */
export function useCountUp(target: number, durationMs = COUNT_MS) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    const controls = animate(0, target, {
      duration: durationMs / 1000,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, durationMs, reduce]);

  return value;
}
