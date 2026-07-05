/**
 * Motion Design Tokens — BBA Platform.
 *
 * Single source of truth for animation timing, referenced both from
 * TypeScript (e.g. `AnimatedCounter`'s default duration) and — mirrored
 * by hand, since this package ships raw source with no CSS pipeline —
 * from the `--motion-duration-*` / `--motion-ease-*` custom properties
 * in `apps/web/app/bba-globals.css`. Keep the two in sync when either
 * changes.
 *
 * These are deliberately separate from the pre-existing, informal
 * `--fast` / `--medium` / `--ease` custom properties already used across
 * the app (sidebar hovers, card hovers, etc.) — this sprint does not
 * touch that legacy layer to avoid regressing anything already shipped.
 * Consolidating the two is a future opportunity, not part of this one.
 */

export const MOTION_DURATION = {
  /** Micro-interactions: hover states, small icon transitions. */
  fast: 150,
  /** Default for most enter/exit reveals (FadeIn, SlideUp, SlideLeft, ScaleIn). */
  normal: 250,
  /** Larger surface transitions (panels, modals appearing). */
  slow: 450,
  /**
   * Data-reveal animations (ProgressBar, AnimatedCounter). Deliberately
   * longer than `slow` — revealing a value benefits from being clearly
   * perceptible, unlike a UI micro-interaction.
   */
  reveal: 800
} as const;

export type MotionDurationToken = keyof typeof MOTION_DURATION;

/**
 * Standard Material-style easing triad: `standard` for state changes that
 * both start and end on-screen, `enter` for things arriving (starts slow,
 * ends fast — feels responsive), `exit` for things leaving (starts fast,
 * ends slow — feels like it's clearing out of the way).
 */
export const MOTION_EASING = {
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  enter: "cubic-bezier(0, 0, 0.2, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)"
} as const;

export type MotionEasingToken = keyof typeof MOTION_EASING;
