import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@ampm/ui/styles";

import { Eyebrow } from "./eyebrow";
import { SectionHeading } from "./section-heading";
import { standaloneLinkStyles } from "./site.styles";

export interface SectionIntroAction {
  readonly href: string;
  /** With the arrow the design draws ("How it works →"). */
  readonly label: string;
}

export interface SectionIntroProps {
  /** The heading's words; a part only the desktop shows can sit in a `hidden md:inline` span. */
  readonly title: ReactNode;
  /** The gold word at the end of the heading. */
  readonly emphasis?: ReactNode;
  readonly eyebrow?: string | undefined;
  /** The heading's id, for the section's `aria-labelledby`. */
  readonly headingId?: string | undefined;
  /** A gold link at the far end of the row ("All destinations →"). */
  readonly action?: SectionIntroAction | undefined;
  /** The phone layout (W8) keeps only the heading: the eyebrow and the link show from a tablet. */
  readonly compactOnPhone?: boolean | undefined;
  readonly className?: string | undefined;
}

interface IntroActionProps {
  readonly action: SectionIntroAction;
  readonly compactOnPhone: boolean;
}

/** The gold link at the row's far end, kept on one line with its arrow. */
function IntroAction({ action, compactOnPhone }: IntroActionProps) {
  return (
    <Link
      href={action.href}
      className={cn(
        standaloneLinkStyles,
        compactOnPhone && "hidden md:flex",
        "shrink-0 whitespace-nowrap md:self-end",
      )}
    >
      {action.label}
    </Link>
  );
}

/**
 * The opening of a page section (W1): an eyebrow over a Gilda heading on the left and a gold link on
 * the right, the two aligned on their last line.
 *
 *   <SectionIntro eyebrow="Destinations" title="Where we plan" headingId="destinations-heading"
 *     action={{ href: "/destinations", label: "All destinations →" }} compactOnPhone />
 */
export function SectionIntro({
  title,
  emphasis,
  eyebrow,
  headingId,
  action,
  compactOnPhone = false,
  className,
}: SectionIntroProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-12",
        className,
      )}
    >
      <div className="flex flex-col gap-3">
        {eyebrow ? (
          <Eyebrow size="md" className={cn(compactOnPhone && "hidden md:block")}>
            {eyebrow}
          </Eyebrow>
        ) : null}
        <SectionHeading id={headingId} emphasis={emphasis}>
          {title}
        </SectionHeading>
      </div>
      {action ? <IntroAction action={action} compactOnPhone={compactOnPhone} /> : null}
    </div>
  );
}
