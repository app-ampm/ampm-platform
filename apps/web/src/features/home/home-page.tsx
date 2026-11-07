import { GlowOrbs, SiteContainer } from "@/components/site";

import { DestinationsSection } from "./destinations-section";
import { FinalCta } from "./final-cta";
import { Hero } from "./hero";
import { SelectedWorkSection } from "./selected-work-section";
import { StagesSection } from "./stages-section";
import { TestimonialsSection } from "./testimonials-section";

/**
 * PUB-01, the home page: W1 at 1440 and W8 at 390 in one responsive page. The hero, the three stages,
 * selected work, destinations, two testimonials and the closing call to action, 128 apart on a desktop
 * and 56 on a phone, under the page's glow. The top bar, footer and chat pill come from the layout.
 */
export function HomePage() {
  return (
    <>
      <GlowOrbs />
      <SiteContainer className="gap-14 pb-14 pt-14 md:gap-32 md:pb-20 md:pt-28">
        <Hero />
        <StagesSection />
        <SelectedWorkSection />
        <DestinationsSection />
        <TestimonialsSection />
        <FinalCta />
      </SiteContainer>
    </>
  );
}
