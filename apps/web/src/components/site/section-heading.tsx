import type { ReactNode } from "react";

import { cn, textStyles } from "@ampm/ui/styles";

export interface SectionHeadingProps {
  /** The heading's words before the gold one. */
  readonly children: ReactNode;
  /** The one emphasised word or phrase at the end, in gold ("end to end."). At most one per heading. */
  readonly emphasis?: ReactNode;
  /** h2 for a section (default); h1 for the page's own heading; h3 inside a section. */
  readonly as?: "h1" | "h2" | "h3" | undefined;
  readonly id?: string | undefined;
  /** Size changes by class: the hero takes `text-5xl md:text-6xl lg:text-7xl`. */
  readonly className?: string | undefined;
}

/**
 * A Gilda Display heading with an optional gold trailing word (peacock-night.md §4): the kit's
 * `title` type, 36 on a phone and 44 from a tablet, balanced across its lines.
 *
 *   <SectionHeading as="h1" emphasis="end to end." className="text-5xl md:text-6xl lg:text-7xl">
 *     Weddings, planned
 *   </SectionHeading>
 */
export function SectionHeading({
  children,
  emphasis,
  as: Heading = "h2",
  id,
  className,
}: SectionHeadingProps) {
  return (
    <Heading
      id={id}
      className={cn(textStyles({ variant: "title" }), "text-balance md:text-5xl", className)}
    >
      {children}
      {emphasis ? (
        <>
          {" "}
          <span className="text-brand">{emphasis}</span>
        </>
      ) : null}
    </Heading>
  );
}
