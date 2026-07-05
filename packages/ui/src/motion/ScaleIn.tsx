import { Reveal, type RevealProps } from "./Reveal";

export type ScaleInProps = Omit<RevealProps, "variant">;

/** Fade + subtle scale-up (0.96 → 1). Use for modals, popovers, and highlighted callouts appearing. */
export function ScaleIn(props: ScaleInProps) {
  return <Reveal variant="scale-in" {...props} />;
}
