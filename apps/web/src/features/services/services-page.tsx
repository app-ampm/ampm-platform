import { GlowOrbs, SiteContainer } from "@/components/site";

import { ServicesNextStep } from "./services-next-step";
import { ServicesSection } from "./services-section";

/**
 * PUB-03, Services (W3 at 1440, stacked on a phone as W8 stacks the home page): the opening and the
 * four services, then the closing card, 96 apart on a desktop and 56 on a phone, under the page glow
 * (gold top right, as W3 draws it). The top bar, footer and chat pill come from the layout.
 */
export function ServicesPage() {
  return (
    <>
      <GlowOrbs />
      <SiteContainer className="gap-14 pb-14 pt-14 md:gap-24 md:pb-24 md:pt-28">
        <ServicesSection />
        <ServicesNextStep />
      </SiteContainer>
    </>
  );
}
