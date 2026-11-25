import { formatCountdown } from "@ampm/core";
import { cn, flatTintStyles, textStyles } from "@ampm/ui/styles";

import { FormButton, FormNotice } from "./form-parts";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { StepShell } from "./step-shell";
import { useCountdown } from "./use-countdown";

export interface LinkGoneStepProps {
  /** gone: HF-08 for a link that is not active; no_link: a page opened without its link. */
  readonly variant: "gone" | "no_link";
  /** The API's words, when it gave a reason (the link replaced, the person removed). */
  readonly message: string | null;
  readonly helpContact: string | null;
}

/** Whom to ask: AMPM's help contact, or the colleague who sent the link while AMPM has set none. */
function HelpContact({ helpContact }: { readonly helpContact: string | null }) {
  return (
    <div className={cn(flatTintStyles, "flex flex-col gap-1 rounded p-4")}>
      <p className={textStyles({ variant: "label", tone: "primary" })}>
        {HOTEL_FORM_COPY.gone.contact}
      </p>
      <p className={textStyles({ variant: "bodySmall", tone: "body" })}>
        {helpContact ?? HOTEL_FORM_COPY.helpFallback}
      </p>
    </div>
  );
}

/**
 * HF-08, Link not active (D-189 §8; plan §8): one page for an unknown, expired, revoked or replaced link,
 * a hotel AMPM deleted, a person AMPM removed, and the form switched off, with AMPM's help contact. It
 * says nothing about the hotel. A page opened without its link says how to open it.
 *
 *   <LinkGoneStep variant="gone" message={phase.message} helpContact={state.helpContact} />
 */
export function LinkGoneStep({ variant, message, helpContact }: LinkGoneStepProps) {
  const copy = variant === "gone" ? HOTEL_FORM_COPY.gone : HOTEL_FORM_COPY.noLink;
  return (
    <StepShell
      headingId="hf-gone-heading"
      eyebrow={copy.eyebrow}
      title={copy.title}
      emphasis={copy.emphasis}
    >
      <p className={textStyles({ variant: "body", tone: "body" })}>{message ?? copy.body}</p>
      <HelpContact helpContact={helpContact} />
    </StepShell>
  );
}

export interface UnreachableStepProps {
  readonly message: string;
  /** When the API said to try again (Retry-After), on this device's clock. */
  readonly retryAt: number | null;
  readonly onRetry: () => void;
}

/**
 * The link could not be opened for now (no connection, too many tries, the API failing): the reason in
 * the notice, and Try again once any wait the API asked for is over.
 *
 *   <UnreachableStep message={phase.message} retryAt={phase.retryAt} onRetry={flow.reopen} />
 */
export function UnreachableStep({ message, retryAt, onRetry }: UnreachableStepProps) {
  const left = useCountdown(retryAt);
  const copy = HOTEL_FORM_COPY.unreachable;
  return (
    <StepShell
      headingId="hf-unreachable-heading"
      eyebrow={copy.eyebrow}
      title={copy.title}
      emphasis={copy.emphasis}
    >
      <FormNotice notice={{ message, retryAt, isReload: false }} />
      <FormButton onClick={onRetry} isDisabled={left > 0}>
        {left > 0
          ? HOTEL_FORM_COPY.errors.retryIn(formatCountdown(left))
          : HOTEL_FORM_COPY.errors.retry}
      </FormButton>
    </StepShell>
  );
}
