import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  iconOnly?: boolean;
};

const cx = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ");

export function Button({
  children,
  className,
  icon,
  iconOnly = false,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "bba-button",
        `bba-button--${variant}`,
        `bba-button--${size}`,
        iconOnly && "bba-button--icon-only",
        className
      )}
      type={type}
      {...props}
    >
      {icon ? <span className="bba-button__icon">{icon}</span> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}
