import { formatDay } from "@ampm/core";
import { calloutStyles, cn, glassStyles, textStyles } from "@ampm/ui/styles";

import type { OpenedLink, StepNotice } from "./flow";
import { FormButton, FormNotice, HelpLine, QuietLine } from "./form-parts";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { PrivacyNoticeDisclosure } from "./privacy-notice-disclosure";
import { StepShell } from "./step-shell";

const COPY = HOTEL_FORM_COPY.welcome;

export const WELCOME_HEADING_ID = "hf-welcome-heading";

export interface WelcomeStepProps {
  readonly link: OpenedLink | null;
  readonly helpContact: string | null;
  /** Why the person is back here (signed out). */
  readonly notice: StepNotice | null;
  readonly onStart: () => void;
}

/** What a link that only shows its status means, plainly; nothing for a link that is open. */
function StateLine({ link }: { readonly link: OpenedLink | null }) {
  if (link === null || link.state === "ready") return null;
  const text =
    link.state === "locked" ? COPY.locked : COPY.statusOnly(formatDay(link.expiresAt ?? ""));
  return (
    <p
      className={cn(
        glassStyles({ recipe: "peacock", blur: false }),
        calloutStyles,
        textStyles({ variant: "bodySmall", tone: "primary" }),
      )}
    >
      {text}
    </p>
  );
}

/** What the form asks and how it works, as three short facts. */
function Facts() {
  return (
    <ul className="flex flex-col gap-3">
      {COPY.facts.map((fact) => (
        <li key={fact} className="flex flex-row items-start gap-3">
          <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-highlight" />
          <span className={textStyles({ variant: "bodySmall", tone: "body" })}>{fact}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * HF-01, Welcome and privacy notice (D-189 §8; plan §8): what AMPM asks and why, about 20 minutes,
 * coming back and colleagues, that anyone with the link sees what is entered, the notice itself, and a
 * hint for in-app browsers. Nothing about the hotel. A link that only shows its status says so plainly;
 * its people can still sign in to see it.
 *
 *   <WelcomeStep link={state.link} helpContact={state.helpContact} notice={state.notice} onStart={flow.start} />
 */
export function WelcomeStep({ link, helpContact, notice, onStart }: WelcomeStepProps) {
  return (
    <StepShell
      headingId={WELCOME_HEADING_ID}
      step={1}
      title={COPY.title}
      emphasis={COPY.emphasis}
      lead={COPY.lead}
    >
      {notice ? <FormNotice notice={notice} /> : null}
      <StateLine link={link} />
      <Facts />
      {link?.expiresAt ? (
        <QuietLine>{HOTEL_FORM_COPY.linkUntil(formatDay(link.expiresAt))}</QuietLine>
      ) : null}
      <PrivacyNoticeDisclosure helpContact={helpContact} />
      <QuietLine>{COPY.inAppBrowser}</QuietLine>
      <FormButton onClick={onStart}>{COPY.start}</FormButton>
      <HelpLine helpContact={helpContact} />
    </StepShell>
  );
}
