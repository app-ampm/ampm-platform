import { variants, type VariantProps } from "../../lib/variants";

/** A stat's column: eyebrow label, big Gilda number, caption, 8 apart, left or centred. */
export const statStyles = variants("flex flex-col gap-2", {
  variants: {
    align: { left: "items-start", center: "items-center" },
  },
  defaultVariants: { align: "left" },
});

export type StatStyleProps = VariantProps<typeof statStyles>;
export type StatAlign = NonNullable<StatStyleProps["align"]>;

/** md 44 for KPI cards (T1), lg 64 for the countdowns and days-left meters (C1, D4, P5). */
export type StatSize = "md" | "lg";
export const statValueSize: Record<StatSize, string> = { md: "text-5xl", lg: "text-6xl" };

/**
 * The number's colour: pearl for counts, gold for countdowns, peacock for done and ready totals
 * (display size only: peacock is never small text).
 */
export type StatTone = "primary" | "brand" | "highlight";

/**
 * The label and caption: pearl 58% on midnight and base glass; pearl 80% (`body`) on peacock glass,
 * where pearl 58% falls under 4.5:1 (only pearl 100% and 80% are approved there, tokens
 * `contrastPairs`); gold when the stat sits on gold glass (needs-you KPIs).
 */
export type StatDetailTone = "muted" | "body" | "brand";
