import type { HTMLAttributes, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface DecisionSectionProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  /**
   * e.g. "Onde está o desvio?", "O que está causando?", "Qual o
   * impacto?", "Quais evidências suportam?", "Qual a ação
   * recomendada?", "Nível de confiança".
   */
  title: string;
  children: ReactNode;
  /** Whether this section's content is the one currently open in the accordion. */
  isOpen: boolean;
  /** Toggles this section open/closed. Accordion exclusivity (only one open at a time) is enforced by the caller. */
  onToggle: () => void;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * One accordion item of a decision's Full Traceability structure
 * (PRINCIPLE 001 — see `packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`).
 * Renders whatever `children` it's given — usually a `DecisionPlaceholder`
 * today, real content once an Engine feeds it. No state of its own: `isOpen`
 * and `onToggle` are controlled by `DecisionInsightCard`, the only
 * component in this module that holds state (Release 1.1 — accordion,
 * only one section open at a time, replacing the M2.2 "all sections
 * visible together" layout to keep the expanded panel compact).
 */
export function DecisionSection({ title, children, isOpen, onToggle, className, ...props }: DecisionSectionProps) {
  return (
    <div className={cx("decision-section", isOpen && "decision-section--open", className)} {...props}>
      <button aria-expanded={isOpen} className="decision-section__header" onClick={onToggle} type="button">
        <span className="decision-section__title">{title}</span>
        <ChevronRight aria-hidden="true" className="decision-section__chevron" size={14} />
      </button>
      {isOpen && <div className="decision-section__content">{children}</div>}
    </div>
  );
}
