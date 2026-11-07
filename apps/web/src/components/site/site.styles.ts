import {
  cn,
  focusRingStyles,
  linkLabelStyles,
  linkStyles,
  textStyles,
  type LinkTone,
  type TextVariant,
} from "@ampm/ui/styles";

import type { GlassCardTone } from "./glass-card";

/**
 * The site's own recipes, built from the kit's (`@ampm/ui/styles`) so the website and the apps match.
 * Everything here is DOM classes for the Next.js site; nothing imports React Native.
 */

/**
 * The tone of quiet text (labels, metadata) on a glass recipe: pearl 58% on the canvas and on base
 * glass, pearl 80% on gold and peacock glass, where the tokens' contrast gate clears only pearl and
 * pearl 80% for text (packages/tokens/src/colors.ts `contrastPairs`).
 */
export function quietToneOn(tone: GlassCardTone): "muted" | "body" {
  return tone === "glass" ? "muted" : "body";
}

/**
 * Small uppercase metadata ("Subscription · one month", "The bride's family · Udaipur"): Manrope 600
 * at 11 with the label tracking (0.16em), in the quiet tone of the glass it sits on.
 */
export function metaStylesOn(tone: GlassCardTone): string {
  return cn(
    textStyles({ variant: "caption", tone: quietToneOn(tone), weight: "semibold" }),
    "uppercase tracking-label",
  );
}

/** Metadata on the canvas or on base glass: pearl 58%. */
export const metaStyles = metaStylesOn("glass");

/** The page column: the phone gutter (16), 40 on a tablet, 80 on a desktop, centred at 1280. */
export const siteGutterStyles = "w-full px-4 md:px-10 lg:px-20";
export const siteColumnStyles = "mx-auto flex w-full max-w-7xl flex-col";

export interface NavLinkStyleOptions {
  /** The page on screen: pearl with a gold underline (W2), never colour alone. */
  readonly isCurrent?: boolean | undefined;
  readonly tone?: LinkTone | undefined;
  readonly textVariant?: TextVariant | undefined;
}

/**
 * A navigation link on one DOM element: the kit's `nav` link (pearl 80%, gold on hover, 44px target,
 * the focus halo), and for the current page pearl 100% with a gold underline as the mock draws it.
 */
export function navLinkStyles({
  isCurrent = false,
  tone = "body",
  textVariant,
}: NavLinkStyleOptions = {}): string {
  return cn(
    linkStyles({ variant: "nav" }),
    linkLabelStyles({ variant: "nav", tone: isCurrent ? "primary" : tone, textVariant }),
    isCurrent && "underline decoration-brand underline-offset-8",
  );
}

/** A gold standalone link ("How it works →"): the kit's `standalone` link on one element. */
export const standaloneLinkStyles = cn(
  linkStyles({ variant: "standalone" }),
  linkLabelStyles({ variant: "standalone" }),
);

/**
 * The phone bar's round MENU and CLOSE buttons (W8): a 44px circle with a pearl 24% stroke, the word
 * in Manrope 600 at 10, a pearl 8% fill under the pointer and the gold focus halo.
 */
export const roundButtonStyles = cn(
  "flex h-touch w-touch shrink-0 items-center justify-center rounded-full border border-primary/24",
  "transition-colors duration-base hover:bg-primary/8 active:bg-primary/12 motion-reduce:transition-none",
  textStyles({ variant: "caption", tone: "primary", weight: "semibold" }),
  "text-2xs uppercase",
  focusRingStyles,
);
