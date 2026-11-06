import { cn } from "../../lib/cn";
import { variants, type VariantProps } from "../../lib/variants";
import {
  flatTintStyles,
  focusRingStyles,
  glassStyles,
  internalPanelStyles,
  type GlassRecipeName,
} from "../glass-panel/glass-panel.styles";

/** Glass cards: radius 22 on a phone, 24 on a desktop. */
const GLASS_SHAPE = "rounded-lg md:rounded-xl";
/** Cards nested in a panel are rows: radius 16. */
const NESTED_SHAPE = "rounded";

const PRESSABLE = cn(
  "web:cursor-pointer web:transition-colors web:duration-base web:motion-reduce:transition-none",
  focusRingStyles,
);

/**
 * The card's frame: shape, stroke, padding and, when pressable, the web hover and focus states (the
 * stroke rises on hover, pearl 16% to 24% on base glass; focus is the gold border plus halo). The glass
 * tones carry only their stroke here: Card draws the fill, rim and blur with a GlassPanel behind the
 * content, and `cardStyles` adds them for one-element surfaces. No drop shadows (Peacock Night).
 */
export const cardFrameStyles = variants("flex flex-col overflow-hidden", {
  variants: {
    tone: {
      glass: `${GLASS_SHAPE} border border-primary/16`,
      peacock: `${GLASS_SHAPE} border border-highlight/70`,
      gold: `${GLASS_SHAPE} border border-brand/50`,
      flat: `${NESTED_SHAPE} ${flatTintStyles}`,
      internal: `${NESTED_SHAPE} ${internalPanelStyles}`,
    },
    // Phone padding; desktop callers add more by class (`md:p-7`, `md:p-9`).
    padding: { none: "p-0", sm: "p-4", md: "p-5", lg: "p-6" },
    pressable: { true: PRESSABLE, false: "" },
  },
  compoundVariants: [
    { pressable: true, tone: ["glass", "flat"], class: "web:hover:border-primary/24" },
    { pressable: true, tone: "peacock", class: "web:hover:border-highlight" },
    { pressable: true, tone: ["gold", "internal"], class: "web:hover:border-brand/70" },
  ],
  defaultVariants: { tone: "glass", padding: "md", pressable: false },
});

export type CardFrameStyleProps = VariantProps<typeof cardFrameStyles>;
export type CardTone = NonNullable<CardFrameStyleProps["tone"]>;
export type CardPadding = NonNullable<CardFrameStyleProps["padding"]>;

/** The glass recipe behind each tone; flat and internal are flat tints, never blurred. */
export const cardGlassRecipe: Readonly<Record<CardTone, GlassRecipeName | null>> = {
  glass: "base",
  peacock: "peacock",
  gold: "gold",
  flat: null,
  internal: null,
};

export interface CardStyleOptions {
  readonly tone?: CardTone | undefined;
  readonly padding?: CardPadding | undefined;
  /** Glass tones only: false for a card inside another panel (only top-level panels blur). */
  readonly blur?: boolean | undefined;
  readonly pressable?: boolean | undefined;
}

/**
 * The whole card on one element, for DOM surfaces such as the public website: the frame plus the
 * glass fill, rim and backdrop blur, and a pressed state for clickable cards.
 *
 *   <article className={cardStyles({ tone: "gold", padding: "lg" })}>…</article>
 *   <a href="/destinations/udaipur" className={cardStyles({ pressable: true })}>…</a>
 */
export function cardStyles({
  tone = "glass",
  padding = "md",
  blur = true,
  pressable = false,
}: CardStyleOptions = {}): string {
  const recipe = cardGlassRecipe[tone];
  return cn(
    cardFrameStyles({ tone, padding, pressable }),
    recipe ? glassStyles({ recipe, blur }) : null,
    pressable && "active:opacity-90",
  );
}
