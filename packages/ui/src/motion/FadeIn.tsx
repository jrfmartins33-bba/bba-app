import { Reveal, type RevealProps } from "./Reveal";

export type FadeInProps = Omit<RevealProps, "variant">;

/** Opacity-only entrance. Use for content that shouldn't shift position — status text, badges, secondary copy. */
export function FadeIn(props: FadeInProps) {
  return <Reveal variant="fade-in" {...props} />;
}
