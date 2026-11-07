import { cn, textStyles } from "@ampm/ui/styles";

import { ButtonLink, GlassCard } from "@/components/site";

import { SERVICES_NEXT_STEP_HEADING_ID } from "./services-ids";

/**
 * The closing card (W3): gold glass with the question and a line on the left and the page's one gold
 * action, "See how it works", on the right; on a phone the button stretches beneath, as W8's closing
 * card stacks.
 */
export function ServicesNextStep() {
  return (
    <GlassCard
      as="section"
      aria-labelledby={SERVICES_NEXT_STEP_HEADING_ID}
      tone="gold"
      padding="none"
      className="gap-4 px-6 py-7 md:flex-row md:items-center md:justify-between md:gap-10 md:px-12 md:py-10"
    >
      <div className="flex flex-col gap-2">
        <h2
          id={SERVICES_NEXT_STEP_HEADING_ID}
          className={cn(textStyles({ variant: "title" }), "text-3xl md:text-4xl")}
        >
          Not sure which you need?
        </h2>
        <p className={cn(textStyles({ variant: "body", tone: "body" }), "md:text-lg")}>
          Start with hotel discovery. Everything else can follow.
        </p>
      </div>
      <ButtonLink
        href="/how-it-works"
        size="lg"
        className="self-stretch md:shrink-0 md:self-center"
      >
        See how it works
      </ButtonLink>
    </GlassCard>
  );
}
