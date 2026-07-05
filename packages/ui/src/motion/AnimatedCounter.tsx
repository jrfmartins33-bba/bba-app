"use client";

import { useEffect, useRef, useState } from "react";
import { MOTION_DURATION } from "./tokens";

export interface AnimatedCounterProps {
  /** Target value the counter animates up to. */
  value: number;
  /** Duration in ms. Defaults to the `reveal` motion token (800ms). */
  duration?: number;
  /** Formats the (rounded) in-progress value for display, e.g. currency or thousands separators. */
  formatter?: (value: number) => string;
  className?: string;
}

/**
 * Counts up from 0 to `value` once on mount using `requestAnimationFrame`
 * with an ease-out curve — the one Motion primitive in this module that
 * genuinely needs JavaScript (a running numeric tween can't be expressed
 * as a plain CSS animation). Intended for KPI tiles; not wired into any
 * screen yet.
 */
export function AnimatedCounter({
  value,
  duration = MOTION_DURATION.reveal,
  formatter,
  className
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(Math.round(value * eased));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration]);

  return <span className={className}>{formatter ? formatter(displayValue) : displayValue}</span>;
}
