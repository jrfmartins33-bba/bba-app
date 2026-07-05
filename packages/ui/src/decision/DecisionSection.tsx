import type { HTMLAttributes, ReactNode } from "react";

export interface DecisionSectionProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  /** e.g. "ONDE", "POR QUÊ", "IMPACTO", "EVIDÊNCIAS", "AÇÃO RECOMENDADA". */
  title: string;
  children: ReactNode;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * One labeled question of a decision's Full Traceability structure
 * (PRINCIPLE 001 — see `packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`).
 * Renders whatever `children` it's given — usually a `DecisionPlaceholder`
 * today, real content once an Engine feeds it. No logic, no state, no hooks.
 */
export function DecisionSection({ title, children, className, ...props }: DecisionSectionProps) {
  return (
    <div className={cx("decision-section", className)} {...props}>
      <p className="decision-section__title">{title}</p>
      <div className="decision-section__content">{children}</div>
    </div>
  );
}
