import { cn, textStyles } from "@ampm/ui/styles";

import { GlassCard, SectionIntro, metaStylesOn } from "@/components/site";

import { STAGES, type Stage } from "./home-content";
import { STAGES_HEADING_ID } from "./home-ids";

const SUMMARY = textStyles({ variant: "body", tone: "body" });

/**
 * One stage: its number in gold, its name in Gilda and what it covers. On a phone (W8) the number sits
 * beside a one-line summary; a tablet keeps that row with the full description and the terms; on a
 * desktop (W1) the card stands 320 tall in a row of three with its terms at the foot, in pearl 80% on
 * the gold and peacock cards (the contrast gate's floor there).
 */
function StageCard({ stage }: { readonly stage: Stage }) {
  return (
    <GlassCard
      as="li"
      tone={stage.tone}
      padding="none"
      className="gap-6 p-5.5 md:p-8 lg:min-h-80 lg:justify-between lg:gap-8"
    >
      <div className="flex flex-row gap-4 md:gap-6 lg:flex-col lg:gap-3.5">
        <p className={cn(textStyles({ variant: "data", tone: "brand" }), "text-xs md:text-sm")}>
          {stage.number}
        </p>
        <div className="flex flex-col gap-1.5 md:gap-3.5">
          <h3 className={cn(textStyles({ variant: "heading" }), "md:text-3xl")}>{stage.title}</h3>
          <p className={cn(SUMMARY, "text-sm md:hidden")}>{stage.summaryShort}</p>
          <p className={cn(SUMMARY, "hidden md:block")}>{stage.summary}</p>
        </div>
      </div>
      <p className={cn(metaStylesOn(stage.tone), "hidden md:block")}>{stage.terms}</p>
    </GlassCard>
  );
}

/** The three stages (W1 glass, gold glass, peacock glass), with the link to How it works. */
export function StagesSection() {
  return (
    <section aria-labelledby={STAGES_HEADING_ID} className="flex flex-col gap-3 md:gap-10">
      <SectionIntro
        eyebrow="How it works"
        headingId={STAGES_HEADING_ID}
        title={
          <>
            Three stages<span className="hidden md:inline">. Start with the first.</span>
          </>
        }
        action={{ href: "/how-it-works", label: "How it works →" }}
        compactOnPhone
        className="px-1.5 pb-1.5 md:p-0"
      />
      <ol className="flex flex-col gap-3 md:gap-5 lg:grid lg:grid-cols-3">
        {STAGES.map((stage) => (
          <StageCard key={stage.number} stage={stage} />
        ))}
      </ol>
    </section>
  );
}
