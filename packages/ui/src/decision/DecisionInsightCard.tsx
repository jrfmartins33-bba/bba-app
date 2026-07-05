import type { ReactNode } from "react";
import { Card } from "../Card";

export interface DecisionInsightCardProps {
  title: string;
  children: ReactNode;
  /**
   * Purely visual — a static "not yet expanded" look while no Engine
   * has fed real data yet. This is a prop, not internal state: the
   * component itself holds no state and has no expand/collapse
   * interaction (no hooks, no onClick here).
   */
  collapsed?: boolean;
  className?: string;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * Outer wrapper for a decision's Full Traceability structure — a
 * labeled group of `DecisionSection`s (PRINCIPLE 001, see
 * `packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`). Wraps the
 * existing `Card` rather than reinventing card chrome.
 *
 * Every Engine that adopts Decision Traceability (Planning, Execution,
 * Finance, Measurement, Evidence, Geospatial, Approval), the Dashboard
 * Executivo and the BBA Advisor are expected to render one of these per
 * indicator — eventually wired to PRINCIPLE 002's mandatory drill-down.
 * No logic, no state, no hooks here.
 */
export function DecisionInsightCard({ title, children, collapsed, className }: DecisionInsightCardProps) {
  return (
    <Card
      className={cx("decision-insight-card", collapsed && "decision-insight-card--collapsed", className)}
      title={title}
    >
      {children}
    </Card>
  );
}
