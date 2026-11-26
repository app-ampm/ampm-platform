import type { HotelFormContributor } from "@ampm/core";
import { cn, flatTintStyles, textStyles } from "@ampm/ui/styles";

import { OVERVIEW_COPY } from "./overview-copy";

const COPY = OVERVIEW_COPY.helpers;

/**
 * "Who is helping" (HF-04; D-190 §3): the name and designation of each person who signed in on this
 * request, the signed-in person marked as you; never a mobile. Alone, the person is told colleagues can
 * help with the same link.
 *
 *   <Helpers contributors={draft.contributors} />
 */
export function Helpers({
  contributors,
}: {
  readonly contributors: readonly HotelFormContributor[];
}) {
  const others = contributors.filter((person) => !person.isYou);
  return (
    <section
      aria-labelledby="hf-helpers"
      className={cn(flatTintStyles, "flex flex-col gap-2 rounded p-4")}
    >
      <h2 id="hf-helpers" className={textStyles({ variant: "label", tone: "primary" })}>
        {COPY.heading}
      </h2>
      <ul className="flex flex-col gap-1">
        {contributors.map((person) => (
          <li
            key={`${person.fullName}·${person.designation}`}
            className={textStyles({ variant: "bodySmall", tone: "body" })}
          >
            {COPY.person(
              person.isYou ? COPY.you(person.fullName) : person.fullName,
              person.designation,
            )}
          </li>
        ))}
      </ul>
      {others.length === 0 ? (
        <p className={textStyles({ variant: "bodySmall", tone: "muted" })}>{COPY.onlyYou}</p>
      ) : null}
    </section>
  );
}
