import type { HTMLAttributes } from "react";

import { cardStyles, cn, type CardPadding } from "@ampm/ui/styles";

/** The glass recipes a site card can wear (peacock-night.md §3). */
export type GlassCardTone = "glass" | "gold" | "peacock";

export interface GlassCardProps extends HTMLAttributes<HTMLElement> {
  /** glass (base, default), gold (live, key callouts), peacock (selected, verified, done). */
  readonly tone?: GlassCardTone | undefined;
  /** Phone padding 16 / 20 / 24; desktop padding comes by class (`md:p-8`). */
  readonly padding?: CardPadding | undefined;
  /** The element: a plain block, or the section, article, list item or figure it stands for. */
  readonly as?: "div" | "section" | "article" | "aside" | "li" | "figure" | undefined;
}

/**
 * A top-level glass panel on one element: the kit's `cardStyles` (fill, 1px stroke, the rim, the
 * backdrop blur, radius 22 on a phone and 24 on a desktop). No drop shadow. A panel inside a panel
 * is a flat tint, not a second GlassCard.
 *
 *   <GlassCard as="article" tone="gold" padding="lg" className="md:p-8">…</GlassCard>
 */
export function GlassCard({
  tone = "glass",
  padding = "md",
  as: Element = "div",
  className,
  ...rest
}: GlassCardProps) {
  return <Element className={cn(cardStyles({ tone, padding }), className)} {...rest} />;
}
