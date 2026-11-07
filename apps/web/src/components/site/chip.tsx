import type { ReactNode } from "react";

import {
  chipDotStyles,
  chipStyles,
  chipTextStyles,
  cn,
  type ChipSize,
  type StatusTone,
} from "@ampm/ui/styles";

export interface ChipProps {
  /** The word that carries the meaning ("Verified", "Indicative"); never colour alone. */
  readonly children: ReactNode;
  /**
   * success (peacock solid), info (pearl outline), warning (gold soft), danger (gold solid),
   * neutral (pearl 8%, default), brand (peacock glass: a highlight such as "Featured").
   */
  readonly tone?: StatusTone | undefined;
  readonly size?: ChipSize | undefined;
  /** A leading dot in the label's colour ("● Verified 2 Nov"). */
  readonly dot?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * The kit's StatusChip on the DOM (peacock-night.md §8): a pill in Manrope 700 at 11.
 *
 *   <Chip tone="success" dot>Verified 2 Nov</Chip>
 *   <Chip tone="brand">Featured</Chip>
 */
export function Chip({
  children,
  tone = "neutral",
  size = "md",
  dot = false,
  className,
}: ChipProps) {
  return (
    <span className={cn(chipStyles({ tone, size }), className)}>
      {dot ? <span aria-hidden className={chipDotStyles({ tone })} /> : null}
      <span className={chipTextStyles({ tone })}>{children}</span>
    </span>
  );
}
