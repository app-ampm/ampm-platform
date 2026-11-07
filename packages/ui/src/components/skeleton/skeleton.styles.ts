import { variants, type VariantProps } from "../../lib/variants";

/**
 * A loading placeholder in pearl 6%: radius 16 for blocks and rows, a circle for avatars, a pill for
 * a line of text. Size comes from the caller's classes (`h-4 w-32`), so loading never changes a size.
 */
export const skeletonStyles = variants("overflow-hidden bg-primary/6", {
  variants: {
    shape: {
      rect: "rounded",
      circle: "rounded-full",
      text: "h-4 rounded-full",
    },
  },
  defaultVariants: { shape: "rect" },
});

export type SkeletonStyleProps = VariantProps<typeof skeletonStyles>;
export type SkeletonShape = NonNullable<SkeletonStyleProps["shape"]>;

/**
 * The shimmer: pearl 5% over the pearl 6% base, which together read as the guide's pearl 10%. Its
 * opacity pulses from nothing to full and back, so the placeholder breathes between the two strengths.
 */
export const shimmerStyles = "absolute inset-0 bg-primary/5";
