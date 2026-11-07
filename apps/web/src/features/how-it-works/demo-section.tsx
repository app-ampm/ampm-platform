import Link from "next/link";

import { badgeLabelStyles, badgeStyles, cn, listItemStyles, textStyles } from "@ampm/ui/styles";

import { ButtonLink, DEMO_HREF, Eyebrow, GlassCard, SectionHeading } from "@/components/site";

import {
  DEMO_DESTINATION_DETAIL,
  DEMO_DESTINATIONS,
  DEMO_SAMPLE_WEDDING,
  DEMO_STEPS,
} from "./how-it-works-content";
import { DEMO_HEADING_ID } from "./how-it-works-ids";
import { LARGE_PANEL_RADIUS, LIST_TEXT, panelEyebrowStyles } from "./how-it-works.styles";

/** "01" for the first step: the mock numbers the steps in two digits. */
function stepNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** The demo in four steps and the page's one gold action, "Request a demo" (base glass). */
function DemoStepsPanel() {
  return (
    <GlassCard
      padding="none"
      className={cn("gap-5 p-6 md:gap-6 md:p-10 xl:p-12", LARGE_PANEL_RADIUS)}
    >
      <Eyebrow size="md">The demo</Eyebrow>
      <SectionHeading id={DEMO_HEADING_ID} emphasis="before you buy.">
        Try it
      </SectionHeading>
      <ol className="flex flex-col gap-3.5">
        {DEMO_STEPS.map((step, index) => (
          <li key={step} className="flex gap-3.5">
            <span
              className={cn(textStyles({ variant: "data", tone: "brand" }), "text-base md:text-lg")}
            >
              {stepNumber(index)}
            </span>
            <span className={LIST_TEXT}>{step}</span>
          </li>
        ))}
      </ol>
      <ButtonLink href={DEMO_HREF} size="lg" className="self-stretch md:self-start">
        Request a demo
      </ButtonLink>
    </GlassCard>
  );
}

/**
 * A location inside the demo, as the kit's nested row on the peacock panel (a flat tint: a panel inside
 * a panel never takes glass). The site cannot open the demo itself (AMPM authorises each mobile number
 * first), so the row leads to the demo request.
 */
function DemoDestinationLink({ name }: { readonly name: string }) {
  return (
    <Link
      href={DEMO_HREF}
      className={cn(
        listItemStyles({ tone: "flat", pressable: true }),
        "group justify-between gap-4 p-5",
      )}
    >
      <span className="flex flex-col gap-1">
        <span className={textStyles({ variant: "heading" })}>{name}</span>
        <span className={textStyles({ variant: "bodySmall", tone: "body" })}>
          {DEMO_DESTINATION_DETAIL}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          textStyles({ tone: "primary" }),
          "text-xl transition-colors duration-base group-hover:text-brand motion-reduce:transition-none",
        )}
      >
        →
      </span>
    </Link>
  );
}

/** What the demo holds (peacock glass): the three locations and the sample wedding. */
function DemoPreviewPanel() {
  return (
    <GlassCard
      tone="peacock"
      padding="none"
      className={cn("gap-3.5 p-5 md:p-10", LARGE_PANEL_RADIUS)}
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className={panelEyebrowStyles("peacock")}>Inside the demo</h3>
        {/* The demo's own mark (W2: midnight on gold): the kit's badge, a label and not a status, so
            it never reads as "needs you". */}
        <span className={cn(badgeStyles({ tone: "brand" }), "self-center")}>
          <span className={badgeLabelStyles({ tone: "brand" })}>Demo</span>
        </span>
      </div>
      <ul className="flex flex-col gap-3.5">
        {DEMO_DESTINATIONS.map((name) => (
          <li key={name}>
            <DemoDestinationLink name={name} />
          </li>
        ))}
      </ul>
      <p
        className={cn(
          textStyles({ variant: "bodySmall", tone: "body" }),
          "rounded border border-dashed border-primary/30 px-5 py-4.5",
        )}
      >
        {DEMO_SAMPLE_WEDDING}
      </p>
    </GlassCard>
  );
}

/**
 * The demo explainer (W2): the steps and the request on the left, what is inside on the right, side
 * by side from 1280 (the mock's 1.1fr / 1fr as halves) and stacked below that.
 */
export function DemoSection() {
  return (
    <section
      aria-labelledby={DEMO_HEADING_ID}
      className="flex flex-col gap-4 md:gap-5 xl:grid xl:grid-cols-2"
    >
      <DemoStepsPanel />
      <DemoPreviewPanel />
    </section>
  );
}
