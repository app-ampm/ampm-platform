import { cn, textStyles } from "@ampm/ui/styles";

import { Eyebrow, SectionHeading } from "@/components/site";

import { ABOUT_COPY } from "./about-content";
import { ABOUT_HEADING_ID } from "./about-ids";

const STORY = cn(textStyles({ variant: "body", tone: "body" }), "text-lg md:max-w-xl");

/**
 * The opening of the about page (W5): the eyebrow and the Gilda heading with its gold close on the
 * left, AMPM's two-paragraph story on the right, the two aligned on their last line. Desktop is the
 * mock's 1.3fr / 1fr (five ninths and four); tablets and phones stack them.
 */
export function AboutHero() {
  return (
    <section
      aria-labelledby={ABOUT_HEADING_ID}
      className="flex flex-col gap-6 md:gap-10 lg:grid lg:grid-cols-9 lg:items-end lg:gap-16"
    >
      <div className="flex flex-col gap-4 md:gap-6 lg:col-span-5">
        <Eyebrow size="md">{ABOUT_COPY.eyebrow}</Eyebrow>
        <SectionHeading
          as="h1"
          id={ABOUT_HEADING_ID}
          emphasis={ABOUT_COPY.emphasis}
          className="text-5xl tracking-tight md:text-6xl xl:text-7xl"
        >
          {ABOUT_COPY.title}
        </SectionHeading>
      </div>
      <div className="flex flex-col gap-4.5 lg:col-span-4">
        {ABOUT_COPY.story.map((paragraph) => (
          <p key={paragraph} className={STORY}>
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
