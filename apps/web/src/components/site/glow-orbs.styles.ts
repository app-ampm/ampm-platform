/**
 * Where the glow orbs sit, read from the website mocks (W1–W8) and moved to keep small muted text
 * legible (peacock-night.md §3: orbs behind headings and whitespace). Each orb is a square box whose
 * radial gradient (`bg-glow-*`, peacock 55% or gold 30%, gone at 66% of the radius) draws the light;
 * positions and sizes are fractions of the layer, so they follow the page's width and length.
 *
 * Peacock is the strong one: its centre stays off the canvas, so the text column never gets more than
 * a quarter of its light (the kit's 4.5:1 limit for pearl 58% text); gold may come closer. Phone
 * orbs are the width of the screen, desktop orbs two thirds of it (gold) or all of it (peacock).
 *
 *   page      gold top right, peacock left, gold right, peacock left    W1, W3, W8
 *   mirrored  peacock top left, gold right, gold left, peacock right    W2, W5
 *   card      one gold orb in a card's top-right corner                 W1's closing card
 */
export type GlowOrbsVariant = "page" | "mirrored" | "card";

export const glowLayerStyles = "pointer-events-none absolute inset-0 overflow-hidden";

export const glowOrbStyles = "absolute aspect-square";

const GOLD_RIGHT = "-right-1/2 w-full bg-glow-gold md:-right-1/4 md:w-2/3";
const GOLD_LEFT = "-left-1/2 w-full bg-glow-gold md:-left-1/4 md:w-2/3";
const PEACOCK_LEFT = "-left-2/3 w-full bg-glow-peacock";
const PEACOCK_RIGHT = "-right-2/3 w-full bg-glow-peacock";
const TOP = "-top-32 md:-top-72";

export const glowOrbPlacements: Readonly<Record<GlowOrbsVariant, readonly string[]>> = {
  page: [
    `${GOLD_RIGHT} ${TOP}`,
    `${PEACOCK_LEFT} top-1/4`,
    `${GOLD_RIGHT} top-1/2`,
    `${PEACOCK_LEFT} top-3/4`,
  ],
  mirrored: [
    `${PEACOCK_LEFT} ${TOP}`,
    `${GOLD_RIGHT} top-1/4`,
    `${GOLD_LEFT} top-1/2`,
    `${PEACOCK_RIGHT} top-3/4`,
  ],
  card: ["-right-24 -top-40 w-96 bg-glow-gold md:w-2/5"],
};
