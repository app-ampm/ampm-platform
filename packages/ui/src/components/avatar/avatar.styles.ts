import { variants, type VariantProps } from "../../lib/variants";

/**
 * A person as a circle of initials: gold or peacock fill with midnight initials in Manrope 700 (800
 * at the smallest size). 32, 40, 48 and 56 across.
 */
export const avatarStyles = variants("flex items-center justify-center rounded-full", {
  variants: {
    size: { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12", xl: "h-14 w-14" },
    tone: { brand: "bg-brand", highlight: "bg-highlight" },
  },
  defaultVariants: { size: "md", tone: "brand" },
});

export type AvatarStyleProps = VariantProps<typeof avatarStyles>;
export type AvatarSize = NonNullable<AvatarStyleProps["size"]>;
export type AvatarTone = NonNullable<AvatarStyleProps["tone"]>;

/** Initials grow with the circle: 11, 13, 15 and 16. */
export const avatarInitialsSize: Record<AvatarSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

/** Midnight ink on either fill. */
export const avatarInitialsTone = { brand: "onBrand", highlight: "onHighlight" } as const;

/**
 * Inside a group every circle wears a 2px midnight ring, and each after the first slides 8px under
 * its neighbour's ring. The "+3" circle is pearl 16% (opaque, so the avatar it overlaps does not show
 * through) with pearl numerals.
 */
export const avatarGroupStyles = variants("flex flex-row items-center");
export const avatarRingStyles = "border-2 border-surface";
export const avatarOverlapStyles = "-ml-2";
export const avatarOverflowStyles = "bg-subtle";

/** Gold, then peacock, then gold again: neighbours never share a fill. */
export function avatarGroupTone(index: number): AvatarTone {
  return index % 2 === 0 ? "brand" : "highlight";
}

/** The first letters of the first two words, uppercase: "Ananya Sharma" → "AS", "Eva" → "E". */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}
