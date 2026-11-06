import { variants, type VariantProps } from "../../lib/variants";
import { focusRingStyles } from "../glass-panel/glass-panel.styles";

/**
 * Peacock Night's admin rail (the T artboards): a base glass panel 232 wide, inset 16 from the top,
 * bottom and left of the workspace, radius 28, 22 × 12 inside. Collapsed (768–1199) it keeps only the
 * icons, 80 wide.
 */
export const navRailStyles = variants("my-4 ml-4 flex flex-col self-stretch rounded-2xl py-5.5", {
  variants: {
    collapsed: { true: "w-20 px-2", false: "w-rail px-3" },
  },
  defaultVariants: { collapsed: false },
});

export type NavRailStyleProps = VariantProps<typeof navRailStyles>;

/** The wordmark slot (12 in, 22 above the first item) and the signed-in person below a pearl 14% rule. */
export const navRailHeaderStyles = variants("pb-5.5", {
  variants: { collapsed: { true: "items-center", false: "px-3" } },
  defaultVariants: { collapsed: false },
});

export const navRailFooterStyles = variants("border-t border-primary/14 pt-3.5", {
  variants: { collapsed: { true: "items-center", false: "px-2.5" } },
  defaultVariants: { collapsed: false },
});

/**
 * One area of the rail: a pill row at least 44 tall, icon and label (and a count) in pearl 80%; the
 * active area is a peacock pill with midnight text; hover and press add a pearl 8% fill. Collapsed, it is
 * a 44 circle around the icon. The website can reuse the recipe on a link, so it also sets `flex`.
 */
export const navRailItemStyles = variants(
  [
    "flex min-h-touch flex-row items-center rounded-full border border-transparent",
    "web:transition-colors web:duration-base",
    focusRingStyles,
  ],
  {
    variants: {
      active: {
        true: "bg-highlight",
        false: "active:bg-primary/8 web:hover:bg-primary/8",
      },
      collapsed: {
        true: "w-touch justify-center self-center",
        false: "gap-3 px-3.5",
      },
    },
    defaultVariants: { active: false, collapsed: false },
  },
);

export type NavRailItemStyleProps = VariantProps<typeof navRailItemStyles>;

/** The collapse toggle: a quiet 44 circle with a chevron. */
export const navRailToggleStyles = variants(
  [
    "mb-2 mt-2 flex h-touch w-touch items-center justify-center rounded-full border border-transparent",
    "active:bg-primary/8 web:transition-colors web:duration-base web:hover:bg-primary/8",
    focusRingStyles,
  ],
  {
    variants: { collapsed: { true: "self-center", false: "self-start" } },
    defaultVariants: { collapsed: false },
  },
);

/** A count badge on a collapsed item rides the icon's top-right corner. */
export const navRailCollapsedBadgeStyles = "absolute -right-3 -top-2.5";
