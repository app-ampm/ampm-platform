import { opacity, spacingPx, type ColorName } from "@ampm/tokens";

import { variants, type VariantProps } from "../../lib/variants";

/**
 * The stand-in for photography until the media library supplies the picture: bands of one of the
 * four colours at 135°, alternating with nothing, as the tokens' stripe recipe draws them (glass.ts
 * `backgroundImage.stripes-*`, the website's `bg-stripes-gold` and `bg-stripes-peacock`). Size,
 * aspect and radius come from the caller (`h-40 w-full`, `aspect-video`, `rounded-2xl`); the default
 * radius is the phone card's 22.
 *
 *   gold      gold 14% bands                      the mocks' usual placeholder (palaces, décor)
 *   peacock   peacock 10% bands                   variety in a grid (lakes, gardens)
 *   midnight  pearl 6% bands on a pearl 6% well   a neutral well (maps, documents)
 */
export const photoPlaceholderStyles = variants("relative overflow-hidden rounded-lg", {
  variants: {
    tone: { gold: "", peacock: "", midnight: "bg-primary/6" },
  },
  defaultVariants: { tone: "gold" },
});

export type PhotoPlaceholderStyleProps = VariantProps<typeof photoPlaceholderStyles>;
export type PhotoPlaceholderTone = NonNullable<PhotoPlaceholderStyleProps["tone"]>;

export interface PhotoStripe {
  readonly color: ColorName;
  /** An opacity step of the tokens, as a number for the SVG band's fill. */
  readonly opacity: number;
}

/** Each tone's bands: one of the four colours at a step of the tokens' tint vocabulary. */
export const photoStripes: Readonly<Record<PhotoPlaceholderTone, PhotoStripe>> = {
  gold: { color: "brand", opacity: Number(opacity["14"]) },
  peacock: { color: "highlight", opacity: Number(opacity["10"]) },
  midnight: { color: "primary", opacity: Number(opacity["6"]) },
};

/** A band is 14 wide (spacing 3.5) and the gap after it as wide again: a 28 period. */
export const STRIPE_BAND = spacingPx["3.5"];

/** The caption: a small glass pill (midnight 50%, pearl 16% stroke) that shrinks to fit. */
export const photoCaptionStyles =
  "shrink rounded-full border border-primary/16 bg-surface/50 px-3 py-1.5";
