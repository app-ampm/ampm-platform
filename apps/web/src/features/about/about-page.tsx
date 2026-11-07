import { GlowOrbs, SiteContainer } from "@/components/site";

import { AboutCta } from "./about-cta";
import { AboutHero } from "./about-hero";
import { PrinciplesList } from "./principles-list";
import { TeamSection } from "./team-section";

/**
 * PUB-05, the about page (W5): the story, the three principles, the team by role and the closing
 * call to action, 96 apart on a desktop and 56 on a phone, under the page's mirrored glow.
 */
export function AboutPage() {
  return (
    <>
      <GlowOrbs variant="mirrored" />
      <SiteContainer className="gap-14 pb-14 pt-14 md:gap-24 md:pb-24 md:pt-28">
        <AboutHero />
        <PrinciplesList />
        <TeamSection />
        <AboutCta />
      </SiteContainer>
    </>
  );
}
