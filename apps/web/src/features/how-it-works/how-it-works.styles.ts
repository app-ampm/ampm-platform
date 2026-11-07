import { cn, textStyles } from "@ampm/ui/styles";

import { quietToneOn, type GlassCardTone } from "@/components/site";

/**
 * The How it works page's shared classes (W2), built from the kit's type recipes.
 */

/** The page's large glass panels: radius 28 from a tablet, the mock's 36 on the token scale. */
export const LARGE_PANEL_RADIUS = "md:rounded-2xl";

/** A line in a panel's lists and steps: Manrope 15 in pearl, 16 from a tablet. */
export const LIST_TEXT = cn(textStyles({ variant: "body", tone: "primary" }), "md:text-lg");

/** A paragraph in pearl 80%. */
export const BODY_TEXT = textStyles({ variant: "body", tone: "body" });

/**
 * A panel's small label ("What you get") in the quiet tone of its glass (`quietToneOn`): pearl 58% on
 * base glass, pearl 80% on gold and peacock glass.
 */
export function panelEyebrowStyles(tone: GlassCardTone): string {
  return cn(textStyles({ variant: "eyebrow", tone: quietToneOn(tone) }), "md:text-xs");
}
