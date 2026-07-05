import { Reveal, type RevealProps } from "./Reveal";

export type SlideLeftProps = Omit<RevealProps, "variant">;

/** Fade + slide in from the right. Use for content following a horizontal/sequential flow (steps, timelines). */
export function SlideLeft(props: SlideLeftProps) {
  return <Reveal variant="slide-left" {...props} />;
}
