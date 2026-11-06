import { variants, type VariantProps } from "../../lib/variants";

/**
 * Peacock Night's panel material as classes (the values are in @ampm/tokens glass.ts). Each recipe is
 * one of the four colours at fixed strengths: a fill, a 1px stroke, a 1px rim along the top edge, and
 * an opaque fallback for native screens that cannot blur (Android, reduce transparency).
 *
 *   base     midnight 50% · pearl 16% · rim pearl 12%    cards, panels, nav, tab bars
 *   peacock  peacock 30% · peacock 70% · rim pearl 20%   selected, verified, offline banners
 *   gold     gold 14% · gold 50% · rim gold 35%          live, needs-you, key callouts
 */
export const glassRecipes = {
  base: {
    fill: "bg-surface/50",
    stroke: "border-primary/16",
    rim: "bg-primary/12",
    webRim: "web:shadow-rim",
    fallback: "bg-surface-elevated",
  },
  peacock: {
    fill: "bg-highlight/30",
    stroke: "border-highlight/70",
    rim: "bg-primary/20",
    webRim: "web:shadow-rim-peacock",
    fallback: "bg-highlight-soft",
  },
  gold: {
    fill: "bg-brand/14",
    stroke: "border-brand/50",
    rim: "bg-brand/35",
    webRim: "web:shadow-rim-gold",
    fallback: "bg-brand-soft",
  },
} as const;

export type GlassRecipeName = keyof typeof glassRecipes;

/**
 * Glass on one element: fill, stroke, rim and (top-level panels only) the backdrop blur. This is how
 * the web draws every panel; native GlassPanel layers a BlurView under the same fill instead.
 *
 *   <View className={glassStyles({ recipe: "gold" })} />
 */
export const glassStyles = variants("border", {
  variants: {
    recipe: {
      base: "border-primary/16 bg-surface/50 web:shadow-rim",
      peacock: "border-highlight/70 bg-highlight/30 web:shadow-rim-peacock",
      gold: "border-brand/50 bg-brand/14 web:shadow-rim-gold",
    },
    blur: {
      true: "web:backdrop-blur-glass web:backdrop-saturate-glass",
      false: "",
    },
  },
  defaultVariants: { recipe: "base", blur: true },
});

export type GlassStyleProps = VariantProps<typeof glassStyles>;

/**
 * Internal-only panels (cost, margin, internal notes): a dashed gold 50% stroke on a gold 6% fill.
 * Staff screens only; a client screen never renders one (security.md: internal amounts never reach a
 * client).
 */
export const internalPanelStyles = "border border-dashed border-brand/50 bg-brand/6";

/**
 * A nested item inside a glass panel: a flat pearl tint, never a second blur, so text stays crisp.
 * Rows inside panels use radius 16.
 */
export const flatTintStyles = "border border-primary/12 bg-primary/6";

/** Every focusable control on the web: a gold border and the 4px gold 18% halo, no outline. */
export const focusRingStyles =
  "web:focus-visible:border-brand web:focus-visible:shadow-halo web:focus-visible:outline-none";
