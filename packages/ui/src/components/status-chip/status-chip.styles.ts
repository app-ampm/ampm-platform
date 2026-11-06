import { variants, type VariantProps } from "../../lib/variants";

/**
 * StatusChip's treatments (docs/design/peacock-night.md §8). The word carries the meaning; the
 * treatment only underlines it, so a chip is never colour alone. Every chip is a pill with a 1px
 * stroke (transparent unless the treatment draws one), so outlined and filled chips stand the same
 * height in a row.
 *
 *   success  peacock solid, midnight text     Verified 2 Nov, Ready 10 / 10
 *   info     pearl 40% outline, pearl text    Indicative, Submitted
 *   warning  gold 16% fill, gold text         Awaiting hotel, Due 15 Dec
 *   danger   gold solid, midnight text        Needs approval, 2 blocked
 *   neutral  pearl 8% fill, pearl 62% text    Stale · checked 3 Jun
 *   brand    peacock glass, pearl text        5-star, Featured (a highlight, not a status)
 *
 * The website (plain DOM) reuses the recipes, which is why the base carries `flex`:
 *
 *   <span className={chipStyles({ tone: "success" })}>
 *     <span className={chipDotStyles({ tone: "success" })} />
 *     <span className={chipTextStyles({ tone: "success" })}>Verified 2 Nov</span>
 *   </span>
 */
export const chipStyles = variants(
  "flex flex-row items-center gap-1.5 self-start rounded-full border border-transparent",
  {
    variants: {
      tone: {
        success: "bg-success",
        info: "border-primary/40 bg-transparent",
        warning: "bg-brand/16",
        danger: "bg-brand",
        neutral: "bg-primary/8",
        brand: "border-highlight/70 bg-highlight/30",
      },
      // Manrope 700 at 11 on both sizes; sm tightens the padding for dense rows and lists.
      size: { sm: "px-2.5 py-1", md: "px-3 py-1.5" },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type ChipStyleProps = VariantProps<typeof chipStyles>;
export type StatusTone = NonNullable<ChipStyleProps["tone"]>;
export type ChipSize = NonNullable<ChipStyleProps["size"]>;

/** The label: Manrope 700 at 11 in the treatment's ink (midnight on the solid fills). */
export const chipTextStyles = variants("font-sans-bold text-xs web:font-bold", {
  variants: {
    tone: {
      success: "text-highlight-ink",
      info: "text-primary",
      warning: "text-brand",
      danger: "text-brand-ink",
      neutral: "text-primary/62",
      brand: "text-primary",
    },
  },
  defaultVariants: { tone: "neutral" },
});

/** The optional leading dot ("● Verified 2 Nov"): 6px, in the label's colour. */
export const chipDotStyles = variants("h-1.5 w-1.5 rounded-full", {
  variants: {
    tone: {
      success: "bg-highlight-ink",
      info: "bg-primary",
      warning: "bg-brand",
      danger: "bg-brand-ink",
      neutral: "bg-primary/62",
      brand: "bg-primary",
    },
  },
  defaultVariants: { tone: "neutral" },
});
