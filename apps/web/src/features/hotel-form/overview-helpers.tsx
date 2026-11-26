import type { HotelFormContributor } from "@ampm/core";
import { cn, flatTintStyles, textStyles } from "@ampm/ui/styles";

import { OVERVIEW_COPY } from "./overview-copy";

const COPY = OVERVIEW_COPY.helpers;

/** A person helping in words: name and designation, "(you)" for the person, a colleague unnamed. */
function helperLine(person: HotelFormContributor): string {
  if (person.fullName === null) return COPY.unnamed;
  const name = person.isYou ? COPY.you(person.fullName) : person.fullName;
  return person.designation === null ? name : COPY.person(name, person.designation);
}

/**
 * "Who is helping" (HF-04; D-190 §3): the name and designation of each person who signed in on this
 * request, the signed-in person marked as you; never a mobile, and a colleague who withdrew their consent
 * named nowhere. Alone, the person is told colleagues can help with the same link.
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
        {contributors.map((person, place) => (
          // The list is the API's, oldest first, and holds no id: two unnamed colleagues read alike.
          <li key={place} className={textStyles({ variant: "bodySmall", tone: "body" })}>
            {helperLine(person)}
          </li>
        ))}
      </ul>
      {others.length === 0 ? (
        <p className={textStyles({ variant: "bodySmall", tone: "muted" })}>{COPY.onlyYou}</p>
      ) : null}
    </section>
  );
}
