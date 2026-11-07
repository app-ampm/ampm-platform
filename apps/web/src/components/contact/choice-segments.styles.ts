import { cn, segmentLabelStyles, segmentStyles, segmentedTrackStyles } from "@ampm/ui/styles";

import { peerFocusRingStyles } from "./contact.styles";

/**
 * The pill choices of the enquiry form (W6), from the kit's SegmentedControl recipes on DOM radios:
 *
 *   solid  the request switch: the chosen segment is a peacock pill with a midnight label, the two
 *          segments share the width (the kit's segmented control).
 *   soft   a field's value ("Best way to reach you"): the chosen pill is peacock glass with a pearl
 *          label, each pill as wide as its word, so a value never shouts louder than the switch.
 */
export type ChoiceLook = "solid" | "soft";

/** The track: midnight 50% with a pearl 16% stroke and 4 inside, across the field. */
export const choiceTrackStyles = segmentedTrackStyles({ fullWidth: true });

/** The label around a pill: the hover and press group, sharing the track's width by look. */
export function choiceTargetStyles(look: ChoiceLook): string {
  return cn("group relative flex min-w-0", look === "solid" ? "flex-1" : "flex-auto");
}

/**
 * The visible pill, a 44px target with the kit's segment hover and press (through the label) and the
 * focus ring of the hidden radio before it. A soft pill paints its own peacock glass, so it asks the
 * kit for no solid fill (`indicator`, as when the app's sliding pill paints the choice).
 */
export function choicePillStyles(look: ChoiceLook, isChecked: boolean): string {
  return cn(
    segmentStyles({
      selected: isChecked,
      indicator: look === "soft",
      nested: true,
      fullWidth: true,
    }),
    "min-h-touch px-3",
    look === "soft" && isChecked && "border-highlight/70 bg-highlight/30",
    peerFocusRingStyles,
  );
}

/** The word: midnight on the solid pill, pearl on the soft one, pearl 80% when not chosen. */
export function choiceLabelStyles(look: ChoiceLook, isChecked: boolean): string {
  if (!isChecked) return cn(segmentLabelStyles({ state: "default" }), "whitespace-nowrap");
  return cn(
    segmentLabelStyles({ state: look === "solid" ? "selected" : "default" }),
    look === "soft" && "text-primary",
    "whitespace-nowrap",
  );
}
