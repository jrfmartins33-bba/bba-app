import type { HTMLAttributes, ReactNode } from "react";

export interface DecisionPlaceholderProps extends Omit<HTMLAttributes<HTMLParagraphElement>, "children"> {
  children: ReactNode;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * Marks a `DecisionSection`'s content as "not yet available" — e.g.
 * "Aguardando dados do Planning Engine." Purely presentational: no
 * logic, no state, no hooks. See PRINCIPLE 001 (Full Traceability) in
 * `packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`.
 */
export function DecisionPlaceholder({ children, className, ...props }: DecisionPlaceholderProps) {
  return (
    <p className={cx("decision-placeholder", className)} {...props}>
      {children}
    </p>
  );
}
