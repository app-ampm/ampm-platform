import { variants, type VariantProps } from "../../lib/variants";

/**
 * The count badge ("Approvals 2", docs/design/peacock-night.md §6): a pill at least 20 high and
 * wide, gold with midnight numerals for needs-you counts, or peacock with midnight for a highlight.
 * It grows with large type rather than clipping it. The website uses the same recipes on two spans:
 *
 *   <span className={badgeStyles()}>
 *     <span className={badgeLabelStyles()}>2</span>
 *   </span>
 */
export const badgeStyles = variants(
  "flex min-h-5 min-w-5 flex-row items-center justify-center self-start rounded-full px-1.5",
  {
    variants: {
      tone: { brand: "bg-brand", highlight: "bg-highlight" },
    },
    defaultVariants: { tone: "brand" },
  },
);

export type BadgeStyleProps = VariantProps<typeof badgeStyles>;
export type BadgeTone = NonNullable<BadgeStyleProps["tone"]>;

/** The numerals: Manrope 700 at 10, tabular, midnight on either fill. */
export const badgeLabelStyles = variants(
  "text-center font-sans-bold text-2xs tabular-nums web:font-bold",
  {
    variants: {
      tone: { brand: "text-brand-ink", highlight: "text-highlight-ink" },
    },
    defaultVariants: { tone: "brand" },
  },
);
