import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
};

const cx = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ");

export function Card({ action, children, className, title, ...props }: CardProps) {
  return (
    <section className={cx("bba-card", className)} {...props}>
      {title || action ? (
        <div className="bba-card__header">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
