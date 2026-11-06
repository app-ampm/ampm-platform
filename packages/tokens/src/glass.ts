/**
 * Glass: the Peacock Night panel material, and the glow orbs it refracts.
 *
 * Three recipes. Only top-level panels blur; anything nested inside a panel uses a flat tint
 * (`bg-surface-inset`, `bg-primary/6`) so text stays crisp. As classes (packages/ui `glassStyles`):
 *   base     `bg-surface/50 border-primary/16`   + rim pearl 12%   cards, panels, nav, tab bars
 *   peacock  `bg-highlight/30 border-highlight/70` + rim pearl 20%  selected, verified, offline
 *   gold     `bg-brand/14 border-brand/50`        + rim gold 35%    live, needs-you, key callouts
 * The web blurs the backdrop (`backdrop-blur-glass backdrop-saturate-glass`); native puts an expo-blur
 * BlurView (`nativeBlur`) under the fill, or the opaque `fallback` on Android and when reduce
 * transparency is on. The values below are for code that needs a colour in JavaScript (BlurView, the
 * SVG orbs); styling uses the classes.
 */
export const glass = {
  base: {
    fill: "rgba(14, 21, 52, 0.5)",
    stroke: "rgba(241, 235, 221, 0.16)",
    rim: "rgba(241, 235, 221, 0.12)",
    fallback: "#1D2440",
  },
  peacock: {
    fill: "rgba(19, 138, 133, 0.3)",
    stroke: "rgba(19, 138, 133, 0.7)",
    rim: "rgba(241, 235, 221, 0.2)",
    fallback: "#0F4157",
  },
  gold: {
    fill: "rgba(221, 184, 97, 0.14)",
    stroke: "rgba(221, 184, 97, 0.5)",
    rim: "rgba(221, 184, 97, 0.35)",
    fallback: "#2A2D3A",
  },
} as const;

export type GlassRecipe = keyof typeof glass;

/** `backdrop-blur-glass` and `backdrop-saturate-glass` on the web: blur 24 with saturate 150%. */
export const backdropBlur = { glass: "24px" } as const;
export const backdropSaturate = { glass: "1.5" } as const;

/** expo-blur settings under a native glass panel. */
export const nativeBlur = { tint: "dark", intensity: 40 } as const;

/**
 * Glow orbs: radial gradients behind the content that give the glass something to refract. Peacock
 * at 55% and gold at 30%, each fading to nothing at 66% of the radius.
 */
export const glow = {
  peacock: { color: "#138A85", opacity: 0.55, fadeAt: 0.66 },
  gold: { color: "#DDB861", opacity: 0.3, fadeAt: 0.66 },
} as const;

export type GlowTone = keyof typeof glow;

/**
 * The same light as CSS backgrounds, for the web (`bg-glow-peacock`, `bg-glow-gold`) and the striped
 * photo placeholders (`bg-stripes-peacock`, `bg-stripes-gold`: 14px bands at 135 degrees). Native draws
 * orbs and stripes with react-native-svg from `glow` instead; background images do nothing there.
 */
export const backgroundImage = {
  "glow-peacock": "radial-gradient(circle, rgba(19, 138, 133, 0.55) 0%, rgba(19, 138, 133, 0) 66%)",
  "glow-gold": "radial-gradient(circle, rgba(221, 184, 97, 0.3) 0%, rgba(221, 184, 97, 0) 66%)",
  "stripes-peacock":
    "repeating-linear-gradient(135deg, rgba(19, 138, 133, 0.1) 0 14px, rgba(19, 138, 133, 0) 14px 28px)",
  "stripes-gold":
    "repeating-linear-gradient(135deg, rgba(221, 184, 97, 0.14) 0 14px, rgba(221, 184, 97, 0) 14px 28px)",
} as const;
