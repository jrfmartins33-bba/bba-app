import type { ReactNode } from "react";
import { Card } from "../Card";

export interface DecisionInsightCardProps {
  title: string;
  children: ReactNode;
  /**
   * Purely visual — the same gold-gradient emphasis already used by
   * highlighted cards elsewhere (e.g. "BBA Advisor"). A prop, not
   * internal state: no hooks, no toggle here. UI Sprint M2.1 made this
   * the default expectation for the official pattern — an automatically
   * generated analysis is never a secondary, muted element.
   */
  highlight?: boolean;
  className?: string;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * Outer wrapper for a decision's Full Traceability structure — a
 * labeled group of `DecisionSection`s (PRINCIPLE 001, see
 * `packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`). Wraps the
 * existing `Card` rather than reinventing card chrome.
 *
 * This is the **official Decision Experience Pattern** (UI Sprint
 * M2.1, see `README.md` in this folder): the analysis is always fully
 * visible the moment its indicator is — never hidden behind a second
 * click. Every Engine that adopts Decision Traceability (Planning,
 * Execution, Finance, Measurement, Evidence, Geospatial, Approval), the
 * Dashboard Executivo and the BBA Advisor are expected to render one of
 * these per indicator — eventually wired to PRINCIPLE 002's mandatory
 * drill-down. No logic, no state, no hooks here.
 *
 * Motion (prepared, not implemented — UI Sprint M2.1): once the Motion
 * Design System (`packages/ui/src/motion/`) is wired into this
 * component, expect the card itself to use `SlideUp` on mount and its
 * `DecisionSection`s to reveal with a staggered `FadeIn` ("Progressive
 * Reveal") as real content replaces each `DecisionPlaceholder`. No
 * animation is implemented yet — this stays a Server Component.
 */
export function DecisionInsightCard({ title, children, highlight, className }: DecisionInsightCardProps) {
  return (
    <Card
      className={cx("decision-insight-card", highlight && "decision-insight-card--highlight", className)}
      title={title}
    >
      {children}
    </Card>
  );
}
