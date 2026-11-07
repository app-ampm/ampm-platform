import { cn } from "@ampm/ui/styles";

import { GlassCard, SectionHeading } from "@/components/site";

import { ComparisonTable } from "./comparison-table";
import { COMPARISON_HEADING_ID } from "./how-it-works-ids";
import { LARGE_PANEL_RADIUS } from "./how-it-works.styles";

/** "Side by side" (PUB-07, W2): the heading over the comparison in one base glass panel. */
export function ComparisonSection() {
  return (
    <section aria-labelledby={COMPARISON_HEADING_ID} className="flex flex-col gap-5 md:gap-8">
      <SectionHeading id={COMPARISON_HEADING_ID} className="px-1.5 md:px-0">
        Side by side
      </SectionHeading>
      <GlassCard
        padding="none"
        className={cn("px-4 pb-1 pt-4 md:px-10 md:py-4", LARGE_PANEL_RADIUS)}
      >
        <ComparisonTable labelledBy={COMPARISON_HEADING_ID} />
      </GlassCard>
    </section>
  );
}
