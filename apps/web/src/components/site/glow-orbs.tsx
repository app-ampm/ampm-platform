import { cn } from "@ampm/ui/styles";

import {
  glowLayerStyles,
  glowOrbPlacements,
  glowOrbStyles,
  type GlowOrbsVariant,
} from "./glow-orbs.styles";

export interface GlowOrbsProps {
  /** page (default) and mirrored for a whole page, card for one orb inside a card. */
  readonly variant?: GlowOrbsVariant | undefined;
  /** Extra classes for the layer, such as `hidden md:block` to drop it on a phone. */
  readonly className?: string | undefined;
}

/**
 * The glow behind a page or a card (peacock-night.md §3), the website's counterpart of the kit's
 * GlowBackdrop. It is decoration, hidden from screen readers and from the pointer.
 *
 * Absolute: the layer covers its nearest positioned ancestor and paints under whatever comes after
 * it, so the light sits behind the content without taking part in the layout, and its overflow is
 * clipped so an orb past the edge never widens the page. A page puts it first, directly in the page
 * (the root layout's frame is the positioned ancestor, so the light runs from the top bar to the
 * footer), and its content in a `relative` element after it; a card is `relative overflow-hidden`.
 *
 *   <>
 *     <GlowOrbs />
 *     <div className="relative flex flex-col">…</div>
 *   </>
 *   <section className="relative overflow-hidden …"><GlowOrbs variant="card" /><div className="relative">…</div></section>
 */
export function GlowOrbs({ variant = "page", className }: GlowOrbsProps) {
  return (
    <div aria-hidden className={cn(glowLayerStyles, className)}>
      {glowOrbPlacements[variant].map((placement) => (
        <div key={placement} className={cn(glowOrbStyles, placement)} />
      ))}
    </div>
  );
}
