import Link from "next/link";

import type { HotelFormSectionKey } from "@ampm/core";
import { cn, linkLabelStyles, linkStyles } from "@ampm/ui/styles";

import { sectionPath } from "./hotel-form-routes";
import { SECTION_TITLES } from "./sections-copy";

/**
 * Sections by name, in the order given, each a link to its page (D-190 §5): the way on from a notice that
 * names sections (a colleague's change, changes not saved yet) and from the sign-out's question.
 *
 *   <SectionLinks sections={["rooms", "venues"]} />
 */
export function SectionLinks({ sections }: { readonly sections: readonly HotelFormSectionKey[] }) {
  return (
    <ul className="flex flex-col">
      {sections.map((key) => (
        <li key={key}>
          <Link
            href={sectionPath(key)}
            className={cn(
              linkStyles({ variant: "standalone" }),
              linkLabelStyles({ variant: "standalone" }),
            )}
          >
            {SECTION_TITLES[key].title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
