import { textStyles } from "@ampm/ui/styles";

import { PhotoPlaceholder, SectionIntro } from "@/components/site";

import { SELECTED_WORK } from "./home-content";
import { SELECTED_WORK_HEADING_ID, SELECTED_WORK_ID } from "./home-ids";

/**
 * Three weddings AMPM has run (W1), each a photo placeholder over its name and its numbers. Desktop
 * and tablet only: the phone layout (W8) goes from the stages straight to the destinations.
 */
export function SelectedWorkSection() {
  return (
    <section
      id={SELECTED_WORK_ID}
      aria-labelledby={SELECTED_WORK_HEADING_ID}
      className="hidden flex-col gap-10 md:flex"
    >
      <SectionIntro
        eyebrow="Selected work"
        title="Weddings we've run"
        headingId={SELECTED_WORK_HEADING_ID}
      />
      <ul className="grid grid-cols-3 gap-5">
        {SELECTED_WORK.map((work) => (
          <li key={work.title} className="flex flex-col gap-4">
            <PhotoPlaceholder label={work.photo} className="aspect-square" />
            <div className="flex flex-col gap-1.5">
              <h3 className={textStyles({ variant: "heading" })}>{work.title}</h3>
              <p className={textStyles({ variant: "bodySmall", tone: "muted" })}>{work.meta}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
