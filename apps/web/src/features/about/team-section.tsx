import { cn, textStyles } from "@ampm/ui/styles";

import { PhotoPlaceholder, SectionHeading } from "@/components/site";

import { ABOUT_COPY, TEAM } from "./about-content";
import { TEAM_HEADING_ID } from "./about-ids";

/**
 * The people you'll work with (W5): four portrait placeholders labelled "Portrait", each with the
 * role in Gilda and what that team looks after. Four across from 1024, two across below.
 */
export function TeamSection() {
  return (
    <section aria-labelledby={TEAM_HEADING_ID} className="flex flex-col gap-6 md:gap-8">
      <SectionHeading id={TEAM_HEADING_ID}>{ABOUT_COPY.teamTitle}</SectionHeading>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:gap-5 lg:grid-cols-4">
        {TEAM.map((member) => (
          <li key={member.role} className="flex flex-col gap-2 md:gap-3.5">
            <PhotoPlaceholder
              label={ABOUT_COPY.portrait}
              tone={member.tone}
              className="h-56 md:h-80"
            />
            <h3 className={cn(textStyles({ variant: "heading" }), "text-xl md:text-2xl")}>
              {member.role}
            </h3>
            <p className={textStyles({ variant: "bodySmall", tone: "body" })}>{member.focus}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
