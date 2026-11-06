import { variants, type VariantProps } from "../../lib/variants";
import { focusRingStyles } from "../glass-panel/glass-panel.styles";

/**
 * Peacock Night's tab bar (client and team apps): a base glass pill, 6 inside, whose tabs share the
 * width. The active tab is a peacock pill with a midnight label, the others pearl 80%, locked tabs pearl
 * 32% with a lock. Floating, it sits 14 from the sides and 26 above the bottom safe area (the bottom
 * offset is a run-time style because the inset is).
 */
export const tabBarStyles = variants("rounded-full p-1.5", {
  variants: {
    floating: {
      // Absolute: the bar floats over the screen's content instead of taking a row of the layout.
      true: "absolute inset-x-3.5 z-sticky",
      false: "self-stretch",
    },
  },
  defaultVariants: { floating: true },
});

export type TabBarStyleProps = VariantProps<typeof tabBarStyles>;

/** The row inside the bar: the tabs, and the sliding pill measured against it. */
export const tabBarRowStyles = "relative flex flex-row";

/** The peacock pill behind the active tab; it slides when the tab changes. */
export const tabBarIndicatorStyles = "absolute inset-y-0 left-0 rounded-full bg-highlight";

/**
 * One tab: at least 44 tall, an equal share of the bar, centred content. `filled` paints the peacock
 * pill on the tab itself until the sliding pill has measured the tabs (first frame, server render).
 */
export const tabBarItemStyles = variants(
  [
    "flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5",
    "rounded-full border border-transparent px-1 py-0.5",
    "web:transition-colors web:duration-base",
    focusRingStyles,
  ],
  {
    variants: {
      state: {
        active: "",
        inactive: "active:bg-primary/8 web:hover:bg-primary/8",
        locked: "active:bg-primary/8 web:hover:bg-primary/8",
      },
      filled: { true: "bg-highlight", false: "" },
    },
    defaultVariants: { state: "inactive", filled: false },
  },
);

export type TabBarItemStyleProps = VariantProps<typeof tabBarItemStyles>;
export type TabBarItemState = NonNullable<TabBarItemStyleProps["state"]>;

/** The label's tone per state; a locked label has no tone of its own and takes `tabBarLockedText`. */
export const tabBarLabelTone = {
  active: "onHighlight",
  inactive: "body",
  locked: "inherit",
} as const satisfies Record<TabBarItemState, "onHighlight" | "body" | "inherit">;

/** Pearl 32%: a locked tab's label. */
export const tabBarLockedText = "text-primary/32";

/** Pearl 32% for a locked tab's icon (a pearl icon at 32% opacity). */
export const tabBarLockedIcon = "opacity-32";

/**
 * Where a count or a lock rides on a tab: the top-right corner of the icon, or of the label in a bar
 * without icons. Absolute so the marker never widens its tab and five tabs keep equal shares.
 */
export const tabBarMarkerStyles = {
  badgeOnIcon: "absolute -right-3 -top-2",
  badgeOnLabel: "absolute -right-3 -top-4",
  lockOnLabel: "absolute -right-2.5 -top-3",
} as const;

/** The small lock on a locked tab's label, three quarters of the smallest icon. */
export const tabBarLockMarkerStyles = "scale-75";
