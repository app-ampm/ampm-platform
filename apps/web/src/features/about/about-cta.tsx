import { cn, textStyles } from "@ampm/ui/styles";

import { ButtonLink, DEMO_HREF, ENQUIRY_HREF, GlassCard } from "@/components/site";

import { ABOUT_COPY } from "./about-content";
import { ABOUT_CTA_HEADING_ID } from "./about-ids";

/**
 * The closing card (W5): gold glass with "Start with a conversation." and the two ways in, the gold
 * demo request and the pearl-outlined contact link. One row from a tablet; on a phone the heading and
 * full-width actions stack.
 */
export function AboutCta() {
  return (
    <GlassCard
      as="section"
      tone="gold"
      padding="none"
      aria-labelledby={ABOUT_CTA_HEADING_ID}
      className="gap-5 px-6 py-7 md:flex-row md:items-center md:justify-between md:gap-8 md:px-12 md:py-10"
    >
      <h2
        id={ABOUT_CTA_HEADING_ID}
        className={cn(textStyles({ variant: "title" }), "text-balance text-3xl md:text-4xl")}
      >
        {ABOUT_COPY.ctaTitle}
      </h2>
      <div className="flex shrink-0 flex-col gap-2.5 md:flex-row md:gap-3">
        <ButtonLink href={DEMO_HREF} size="lg" fullWidth>
          {ABOUT_COPY.requestDemo}
        </ButtonLink>
        <ButtonLink href={ENQUIRY_HREF} variant="secondary" size="lg" fullWidth>
          {ABOUT_COPY.contactUs}
        </ButtonLink>
      </div>
    </GlassCard>
  );
}
