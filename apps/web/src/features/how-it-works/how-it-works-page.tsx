import { GlowOrbs, SiteContainer } from "@/components/site";

import { ComparisonSection } from "./comparison-section";
import { DemoSection } from "./demo-section";
import { FaqSection } from "./faq-section";
import { StagesSection } from "./stages-section";

/**
 * PUB-02 + PUB-07, How it works and plans (W2 at 1440, stacked on a phone as W8 stacks the home
 * page): the opening and the three stages, the side-by-side comparison, the demo and the questions,
 * 96 apart on a desktop and 56 on a phone, under the mirrored glow (peacock top left, as W2 draws
 * it). The top bar, footer and chat pill come from the layout.
 */
export function HowItWorksPage() {
  return (
    <>
      <GlowOrbs variant="mirrored" />
      <SiteContainer className="gap-14 pb-14 pt-14 md:gap-24 md:pb-24 md:pt-28">
        <StagesSection />
        <ComparisonSection />
        <DemoSection />
        <FaqSection />
      </SiteContainer>
    </>
  );
}
