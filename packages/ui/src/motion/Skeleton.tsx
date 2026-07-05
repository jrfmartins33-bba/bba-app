import type { CSSProperties, HTMLAttributes } from "react";

type SkeletonBaseProps = HTMLAttributes<HTMLDivElement>;

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * Placeholder shapes shown while real content loads. Pure CSS shimmer
 * (reuses the existing `goldShimmer` keyframe from `bba-globals.css`) —
 * no JavaScript, Server Component friendly. Not wired into any screen
 * yet; ready for the day a workspace page fetches real data and needs a
 * loading state.
 */
export function SkeletonCard({ className, ...props }: SkeletonBaseProps) {
  return (
    <div aria-hidden="true" className={cx("motion-skeleton motion-skeleton--card", className)} {...props}>
      <div className="motion-skeleton__line motion-skeleton__line--title" />
      <div className="motion-skeleton__line" />
      <div className="motion-skeleton__line motion-skeleton__line--short" />
    </div>
  );
}

export function SkeletonMetric({ className, ...props }: SkeletonBaseProps) {
  return (
    <div aria-hidden="true" className={cx("motion-skeleton motion-skeleton--metric", className)} {...props}>
      <div className="motion-skeleton__icon" />
      <div className="motion-skeleton__line motion-skeleton__line--short" />
    </div>
  );
}

export interface SkeletonTableProps extends SkeletonBaseProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 5, columns = 4, className, ...props }: SkeletonTableProps) {
  const rowStyle = { "--motion-skeleton-columns": columns } as CSSProperties;

  return (
    <div aria-hidden="true" className={cx("motion-skeleton motion-skeleton--table", className)} {...props}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div className="motion-skeleton__row" key={rowIndex} style={rowStyle}>
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <div className="motion-skeleton__cell" key={columnIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}
