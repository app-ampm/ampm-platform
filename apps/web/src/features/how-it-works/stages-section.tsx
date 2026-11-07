import { cn } from "@ampm/ui/styles";

import { Eyebrow, SectionHeading } from "@/components/site";

import { STAGE_PLANS, type StagePlan } from "./how-it-works-content";
import { HOW_IT_WORKS_HEADING_ID } from "./how-it-works-ids";
import { BODY_TEXT } from "./how-it-works.styles";
import { StagePanel } from "./stage-panel";

/**
 * The page's opening (W2): the eyebrow, the hero heading with its gold trailing words and the lead
 * in a column about 900 wide on a desktop (the mock's 1100 less its padding), then the three stages,
 * 96 below on a desktop and 56 on a phone. The heading names both, so the stages' list is labelled
 * "Three stages. Pay for the one you need."
 */
export interface StagesSectionProps {
  /** Catalogue prices by plan type, read when the page renders; a missing one hides that line. */
  readonly planPrices?: Partial<Record<NonNullable<StagePlan["planType"]>, string | null>>;
}

export function StagesSection({ planPrices = {} }: StagesSectionProps) {
  return (
    <section aria-labelledby={HOW_IT_WORKS_HEADING_ID} className="flex flex-col gap-14 md:gap-24">
      <div className="flex flex-col gap-5 px-1.5 md:max-w-4xl md:gap-6 md:px-0">
        <Eyebrow size="md">How it works</Eyebrow>
        <SectionHeading
          as="h1"
          id={HOW_IT_WORKS_HEADING_ID}
          emphasis="the one you need."
          className="text-5xl tracking-tight md:text-6xl lg:text-7xl"
        >
          Three stages. Pay for
        </SectionHeading>
        <p className={cn(BODY_TEXT, "text-lg md:max-w-2xl md:text-xl")}>
          Hotel discovery is a subscription on its own. Hotel assistance and complete management
          come after, only if you want them.
        </p>
      </div>
      <ol aria-labelledby={HOW_IT_WORKS_HEADING_ID} className="flex flex-col gap-4 md:gap-5">
        {STAGE_PLANS.map((stage) => (
          <StagePanel
            key={stage.number}
            stage={stage}
            price={stage.planType ? planPrices[stage.planType] : undefined}
          />
        ))}
      </ol>
    </section>
  );
}
