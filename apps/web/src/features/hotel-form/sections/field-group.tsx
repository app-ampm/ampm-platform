import type { ReactNode } from "react";

import { textStyles } from "@ampm/ui/styles";

/**
 * A group of a section's questions under its own heading ("Address", "Getting there"): the page's h1 is
 * the section, each group an h2, so a screen reader can move between them.
 *
 *   <FieldGroup id="hf-property-address" heading="Address">…</FieldGroup>
 */
export function FieldGroup({
  id,
  heading,
  children,
}: {
  readonly id: string;
  readonly heading: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <h2 id={id} className={textStyles({ variant: "heading" })}>
        {heading}
      </h2>
      {children}
    </section>
  );
}

/** Two short questions side by side from a tablet, stacked on a phone. */
export const PAIR_STYLES = "grid gap-4 md:grid-cols-2";

/** Three short questions side by side from a tablet, stacked on a phone. */
export const TRIO_STYLES = "grid gap-4 md:grid-cols-3";
