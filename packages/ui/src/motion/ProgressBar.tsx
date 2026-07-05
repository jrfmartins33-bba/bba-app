import type { CSSProperties } from "react";

export type ProgressBarColor = "gold" | "green" | "amber" | "red";

export interface ProgressBarProps {
  /** Current value. */
  value: number;
  /** Value representing 100%. Defaults to 100. */
  max?: number;
  color?: ProgressBarColor;
  /** Reveal the fill from 0 to `value` on mount (pure CSS, ~800ms). Defaults to true. */
  animated?: boolean;
  /** Optional caption rendered below the track, e.g. "82% concluído". */
  label?: string;
  className?: string;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * Reusable progress indicator — Planejamento, Financeiro, Dashboard,
 * Score BBA and Aprovações all read the same value/max/color/label shape.
 * The fill's reveal is a pure CSS `@keyframes` animation driven by the
 * `--motion-progress-value` custom property (see `.motion-progress-bar__fill`
 * in `bba-globals.css`) — no JavaScript, no client component required.
 */
export function ProgressBar({
  value,
  max = 100,
  color = "gold",
  animated = true,
  label,
  className
}: ProgressBarProps) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  const fillStyle = {
    "--motion-progress-value": `${percent}%`
  } as CSSProperties;

  return (
    <div className={cx("motion-progress-bar", className)}>
      <div className="motion-progress-bar__track">
        <div
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(percent)}
          className={cx(
            "motion-progress-bar__fill",
            `motion-progress-bar__fill--${color}`,
            animated && "motion-progress-bar__fill--animated"
          )}
          role="progressbar"
          style={fillStyle}
        />
      </div>
      {label ? <span className="motion-progress-bar__label">{label}</span> : null}
    </div>
  );
}
