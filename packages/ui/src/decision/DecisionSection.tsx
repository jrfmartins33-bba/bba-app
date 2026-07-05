import type { HTMLAttributes, ReactNode } from "react";

export interface DecisionSectionProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  /**
   * e.g. "ONDE ESTÁ O DESVIO?", "O QUE ESTÁ CAUSANDO?", "QUAL O
   * IMPACTO?", "QUAIS EVIDÊNCIAS SUPORTAM?", "QUAL A AÇÃO
   * RECOMENDADA?", "NÍVEL DE CONFIANÇA".
   */
  title: string;
  children: ReactNode;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * One labeled question of a decision's Full Traceability structure
 * (PRINCIPLE 001 — see `packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`).
 * Renders whatever `children` it's given — usually a `DecisionPlaceholder`
 * today, real content once an Engine feeds it. No logic, no state, no hooks.
 *
 * Since UI Sprint M2.2, `DecisionInsightCard` renders these internally
 * from its `sections` prop (only while expanded) — pages consuming the
 * official BBA Advisor Decision Panel no longer compose `DecisionSection`
 * directly. It stays exported for any case that needs the bare building
 * block.
 *
 * Motion (prepared, not implemented): as each section's
 * `DecisionPlaceholder` is replaced by real content, expect a staggered
 * `FadeIn` per section ("Progressive Reveal", `packages/ui/src/motion/`)
 * rather than the whole card appearing at once.
 */
export function DecisionSection({ title, children, className, ...props }: DecisionSectionProps) {
  return (
    <div className={cx("decision-section", className)} {...props}>
      <p className="decision-section__title">{title}</p>
      <div className="decision-section__content">{children}</div>
    </div>
  );
}
