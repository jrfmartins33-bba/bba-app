import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type RevealVariant = "fade-in" | "slide-up" | "slide-left" | "scale-in";

export type RevealProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  variant: RevealVariant;
  /** Delay before the animation starts, in ms — useful for staggering a list. */
  delay?: number;
};

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * Shared implementation behind `FadeIn`/`SlideUp`/`SlideLeft`/`ScaleIn` —
 * a pure CSS `@keyframes` animation (`.motion-{variant}` in
 * `bba-globals.css`) that plays once on mount. No JavaScript timers, no
 * client-side state: this stays a Server Component.
 */
export function Reveal({ children, className, variant, delay, style, ...props }: RevealProps) {
  const revealStyle: CSSProperties | undefined =
    delay !== undefined ? { animationDelay: `${delay}ms`, ...style } : style;

  return (
    <div className={cx(`motion-${variant}`, className)} style={revealStyle} {...props}>
      {children}
    </div>
  );
}
