import { cn, textStyles } from "@ampm/ui/styles";

import { GlassCard, type GlassCardTone } from "@/components/site";

import type { StagePlan } from "./how-it-works-content";
import {
  BODY_TEXT,
  LARGE_PANEL_RADIUS,
  LIST_TEXT,
  panelEyebrowStyles,
} from "./how-it-works.styles";

interface StageSummaryProps {
  readonly stage: StagePlan;
  /** The catalogue price, when the stage has one and the API could say. */
  readonly price: string | null | undefined;
}

/** The stage's number in gold Gilda, its name, the price where it has one and how it is paid for. */
function StageSummary({ stage, price }: StageSummaryProps) {
  return (
    <div className="flex flex-col gap-3 md:col-span-2 md:gap-3.5 xl:col-span-1">
      <p
        className={cn(
          textStyles({ variant: "stat", tone: "brand" }),
          "text-5xl md:text-6xl xl:text-7xl",
        )}
      >
        {stage.number}
      </p>
      <h2 className={cn(textStyles({ variant: "title" }), "text-3xl md:text-4xl")}>
        {stage.title}
      </h2>
      {price ? (
        <p className={cn(textStyles({ variant: "data", tone: "primary" }), "text-xl md:text-2xl")}>
          {price}
        </p>
      ) : null}
      <p className={cn(BODY_TEXT, "md:max-w-xl")}>{stage.terms}</p>
    </div>
  );
}

interface StageListProps {
  readonly title: string;
  readonly items: readonly string[];
  readonly tone: GlassCardTone;
}

/** "What you get" or "What AMPM does": a label over lines parted by hairlines. */
function StageList({ title, items, tone }: StageListProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <h3 className={panelEyebrowStyles(tone)}>{title}</h3>
      <ul className="flex flex-col gap-3.5">
        {items.map((item) => (
          <li
            key={item}
            className={cn(LIST_TEXT, "border-b border-primary/16 pb-3 last:border-b-0 last:pb-0")}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One stage of the plan (W2): base, gold or peacock glass. Desktop from 1280: three columns, the
 * summary then the two lists (the mock's 0.9fr / 1fr / 1fr as thirds). Tablet and small desktop: the
 * summary across the top and the two lists side by side. Phone: one column, as the W8 cards stack.
 */
export function StagePanel({ stage, price }: StageSummaryProps) {
  return (
    <GlassCard
      as="li"
      tone={stage.tone}
      padding="none"
      className={cn(
        "gap-7 p-5.5 md:grid md:grid-cols-2 md:gap-x-10 md:gap-y-9 md:p-10 xl:grid-cols-3 xl:gap-12 xl:p-12",
        LARGE_PANEL_RADIUS,
      )}
    >
      <StageSummary stage={stage} price={price} />
      <StageList title="What you get" items={stage.youGet} tone={stage.tone} />
      <StageList title="What AMPM does" items={stage.ampmDoes} tone={stage.tone} />
    </GlassCard>
  );
}
