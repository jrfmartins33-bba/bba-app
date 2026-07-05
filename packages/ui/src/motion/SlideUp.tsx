import { Reveal, type RevealProps } from "./Reveal";

export type SlideUpProps = Omit<RevealProps, "variant">;

/** Fade + rise from below. Default choice for cards and sections entering the viewport. */
export function SlideUp(props: SlideUpProps) {
  return <Reveal variant="slide-up" {...props} />;
}
