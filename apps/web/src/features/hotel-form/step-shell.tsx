import { useEffect, useRef, type ReactNode } from "react";

import { cn, progressSegmentStyles, progressSegmentsStyles, textStyles } from "@ampm/ui/styles";

import { Eyebrow } from "@/components/site/eyebrow";
import { GlassCard } from "@/components/site/glass-card";

import { HOTEL_FORM_COPY as COPY } from "./hotel-form-copy";

/** The identity step's three steps: welcome, your details, your code. */
export const IDENTITY_STEP_COUNT = 3;

export interface StepShellProps {
  /** The heading's id; the card is the region it names. */
  readonly headingId: string;
  readonly title: string;
  /** The heading's one gold ending, if any. */
  readonly emphasis?: string | undefined;
  /** The line above the heading when there is no step to show ("Signed in as Asha Rao"). */
  readonly eyebrow?: string | undefined;
  /** 1 to 3: the identity step on screen, drawn as the RSVP wizard's segmented bar (G2). */
  readonly step?: number | undefined;
  readonly lead?: string | undefined;
  /**
   * Moves focus to the heading when the step appears, so a screen reader starts at the new step; false
   * where a field takes focus instead (the code field, for the phone's SMS code autofill).
   */
  readonly isFocusedOnShow?: boolean | undefined;
  /** step: the identity steps' 576 column (default); form: the 768 column of a page of questions. */
  readonly width?: "step" | "form" | undefined;
  readonly children: ReactNode;
}

/** "Step 2 of 3" over the segments; the segments are for sight only, the words say it. */
function StepProgress({ step }: { readonly step: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden className={progressSegmentsStyles}>
        {Array.from({ length: IDENTITY_STEP_COUNT }, (_, index) => (
          <div
            key={index}
            className={progressSegmentStyles({ size: "sm", filled: index < step })}
          />
        ))}
      </div>
      <Eyebrow>{COPY.step(step, IDENTITY_STEP_COUNT)}</Eyebrow>
    </div>
  );
}

/** The page's one h1, Gilda with its gold ending, focusable by the page only. */
function StepHeading({
  id,
  title,
  emphasis,
  isFocusedOnShow,
}: {
  readonly id: string;
  readonly title: string;
  readonly emphasis: string | undefined;
  readonly isFocusedOnShow: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (isFocusedOnShow) heading.current?.focus();
  }, [id, isFocusedOnShow]);
  return (
    <h1
      ref={heading}
      id={id}
      tabIndex={-1}
      className={cn(textStyles({ variant: "title" }), "text-balance outline-none md:text-5xl")}
    >
      {title}
      {emphasis ? (
        <>
          {" "}
          <span className="text-brand">{emphasis}</span>
        </>
      ) : null}
    </h1>
  );
}

/**
 * One step of the hotel form on its glass card (the Guest RSVP boards' card, G2 and G9): where the person
 * is, the page's one h1 with its gold ending, a lead line, then the step. One centred column at every
 * width, 576 wide at most (768 for a page of questions, peacock-night.md §6 `Screen` content), so a phone
 * and a laptop read the same card.
 *
 *   <StepShell headingId="hf-details" step={2} title="Your details" lead="…">…</StepShell>
 */
export function StepShell({
  headingId,
  title,
  emphasis,
  eyebrow,
  step,
  lead,
  isFocusedOnShow = true,
  width = "step",
  children,
}: StepShellProps) {
  return (
    <GlassCard
      as="section"
      aria-labelledby={headingId}
      padding="lg"
      className={cn("w-full gap-5 md:p-9", width === "form" ? "max-w-3xl" : "max-w-xl")}
    >
      {step === undefined ? (
        eyebrow ? (
          <Eyebrow>{eyebrow}</Eyebrow>
        ) : null
      ) : (
        <StepProgress step={step} />
      )}
      <StepHeading
        id={headingId}
        title={title}
        emphasis={emphasis}
        isFocusedOnShow={isFocusedOnShow}
      />
      {lead ? <p className={textStyles({ variant: "body", tone: "body" })}>{lead}</p> : null}
      {children}
    </GlassCard>
  );
}
