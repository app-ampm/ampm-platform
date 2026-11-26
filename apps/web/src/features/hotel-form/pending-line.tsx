import { textStyles } from "@ampm/ui/styles";

import { OVERVIEW_COPY } from "./overview-copy";
import type { HeldPending } from "./sections/held-section";

/**
 * A section's changes not saved yet, in the overview's words (D-190 §5, review fixes E1 and F2): waiting
 * to be saved by themselves, or not saved and needing the person (in gold). The overview's list and the
 * review's summary both mark a section with it.
 *
 *   {pending ? <PendingLine pending={pending} /> : null}
 */
export function PendingLine({ pending }: { readonly pending: Exclude<HeldPending, null> }) {
  return (
    <span
      className={textStyles({ variant: "caption", tone: pending === "unsaved" ? "brand" : "body" })}
    >
      {OVERVIEW_COPY.sections[pending]}
    </span>
  );
}
