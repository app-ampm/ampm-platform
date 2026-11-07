import { cn, textStyles } from "@ampm/ui/styles";

import { ButtonLink, DEMO_HREF, Eyebrow, SectionHeading, metaStyles } from "@/components/site";

import { HeroShowcase } from "./hero-showcase";
import { HERO_HEADING_ID } from "./home-ids";

const LEAD = cn(textStyles({ variant: "body", tone: "body" }), "text-lg md:max-w-xl md:text-xl");

/**
 * The opening of the home page. Desktop (W1): a 1.25fr / 1fr grid (five ninths and four) with the
 * headline, the two actions and the demo note on the left and the photo on the right. Tablet: the
 * same pieces stacked, the photo full width beneath. Phone (W8): the headline, a shorter lead and
 * the two actions stacked full width, no photo.
 */
export function Hero() {
  return (
    <section
      aria-labelledby={HERO_HEADING_ID}
      className="flex flex-col md:gap-10 lg:grid lg:grid-cols-9 lg:items-end lg:gap-16"
    >
      <div className="flex flex-col gap-5 px-1.5 md:gap-7 md:px-0 lg:col-span-5">
        <Eyebrow size="md">Destination weddings · India</Eyebrow>
        <SectionHeading
          as="h1"
          id={HERO_HEADING_ID}
          emphasis="end to end."
          className="text-5xl tracking-tight md:text-6xl lg:text-7xl"
        >
          Weddings, planned
        </SectionHeading>
        <p className={cn(LEAD, "md:hidden")}>
          Find the right hotel with rates we've checked ourselves, then let one team run every
          function.
        </p>
        <p className={cn(LEAD, "hidden md:block")}>
          Find the right hotel with rates we've checked ourselves, hand over the details, and let
          one team run every function, from the first enquiry to the last departure.
        </p>
        <div className="flex flex-col gap-2.5 md:flex-row md:gap-3">
          <ButtonLink href={DEMO_HREF} size="lg" fullWidth>
            Request a demo
          </ButtonLink>
          <ButtonLink href="/destinations" variant="secondary" size="lg" fullWidth>
            Explore destinations
          </ButtonLink>
        </div>
        <p className={cn(metaStyles, "hidden md:block")}>Demo by mobile number · No sign-up form</p>
      </div>
      <HeroShowcase className="hidden md:flex lg:col-span-4" />
    </section>
  );
}
