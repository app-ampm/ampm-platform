import { glow, type GlowTone } from "@ampm/tokens";

import { variants } from "../../lib/variants";

/**
 * The night sky behind a screen's content. The layer fills its container and clips the orbs that
 * reach past the edges, so they never widen a page or catch a touch or a scroll.
 */
export const glowBackdropStyles = variants("absolute inset-0 overflow-hidden");

/** Where the orbs go: two corners (default), a hero's top, behind the middle, or none at all. */
export type GlowVariant = "corners" | "top" | "center" | "none";

/** One orb: its centre as fractions of the container's width and height, its size as a multiple. */
export interface GlowOrb {
  readonly tone: GlowTone;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/**
 * An orb's full radius against the container's shorter side; the glow fades out at 66% of it
 * (`glow.*.fadeAt`). On a 390 phone that is the mocks' 460px orb, on a 1440 desktop their 900px one.
 */
export const ORB_RADIUS_RATIO = 0.85;

/**
 * The orbs of each variant, read from the mocks: peacock beside the title, gold low in the far
 * corner, and neither under small muted text (§3: behind headings and whitespace).
 */
export const glowOrbs: Record<Exclude<GlowVariant, "none">, readonly GlowOrb[]> = {
  // Peacock off the left edge, gold bottom-right (DS Components, C1, C4, T1). The peacock orb's centre
  // sits beside and below the header, not on it: ScreenHeader's eyebrow (pearl 58%, 10px) keeps 25%
  // glow or less under it, with or without a back button above it, on a phone and a desktop (4.5:1),
  // while the left of the title still catches the glow.
  corners: [
    { tone: "peacock", x: -0.22, y: 0.28, scale: 1.1 },
    { tone: "gold", x: 0.94, y: 0.9, scale: 0.9 },
  ],
  // Hero layouts: a large peacock orb top-centre-left and a gold one in the top-right corner.
  top: [
    { tone: "peacock", x: 0.3, y: 0, scale: 1.3 },
    { tone: "gold", x: 0.98, y: 0.08, scale: 0.85 },
  ],
  // One peacock orb behind the middle (confirmations, empty states) and gold low beneath it.
  center: [
    { tone: "peacock", x: 0.5, y: 0.45, scale: 1.15 },
    { tone: "gold", x: 0.62, y: 1.02, scale: 0.9 },
  ],
};

export interface OrbCircle {
  readonly tone: GlowTone;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/** The circles a variant draws in a measured container, in its own coordinates. */
export function orbCircles(variant: GlowVariant, width: number, height: number): OrbCircle[] {
  if (variant === "none") return [];
  const radius = ORB_RADIUS_RATIO * Math.min(width, height);
  return glowOrbs[variant].map((orb) => ({
    tone: orb.tone,
    cx: orb.x * width,
    cy: orb.y * height,
    r: orb.scale * radius,
  }));
}

/**
 * How strong the glow is at a point of a measured container, from 0 to 1: every orb's gradient there,
 * layered as the drawn orbs are. Small muted text needs it at 0.25 or less to keep 4.5:1.
 */
export function glowOpacityAt(
  variant: GlowVariant,
  width: number,
  height: number,
  point: { readonly x: number; readonly y: number },
): number {
  const clear = orbCircles(variant, width, height).reduce((through, orb) => {
    const { opacity, fadeAt } = glow[orb.tone];
    const distance = Math.hypot(point.x - orb.cx, point.y - orb.cy) / (fadeAt * orb.r);
    return through * (1 - opacity * Math.max(0, 1 - distance));
  }, 1);
  return 1 - clear;
}

export interface GlowStop {
  readonly offset: number;
  readonly opacity: number;
}

/** A tone's radial gradient, from the tokens: full strength at the centre, nothing from `fadeAt`. */
export function glowStops(tone: GlowTone): readonly GlowStop[] {
  const { opacity, fadeAt } = glow[tone];
  return [
    { offset: 0, opacity },
    { offset: fadeAt, opacity: 0 },
  ];
}
