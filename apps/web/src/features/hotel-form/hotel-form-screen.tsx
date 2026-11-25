import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { IdentityStepView } from "./identity-step";
import { LinkGoneStep, UnreachableStep } from "./link-gone-step";
import { LoadingStep } from "./loading-step";
import { SignedInStep } from "./signed-in-step";
import type { HotelFormFlow } from "./use-hotel-form-flow";
import { WelcomeStep } from "./welcome-step";

export interface HotelFormScreenProps {
  readonly flow: HotelFormFlow;
  /** The Turnstile widget's site key (NEXT_PUBLIC_TURNSTILE_SITE_KEY). */
  readonly siteKey: string;
}

/**
 * The step the flow is on, drawn from its state alone, so each state renders (and is tested) without the
 * API: opening, HF-01, HF-02, HF-03, signed in, HF-08, a page without its link, and a link that could
 * not be opened for now.
 *
 *   <HotelFormScreen flow={useHotelFormFlow()} siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
 */
export function HotelFormScreen({ flow, siteKey }: HotelFormScreenProps) {
  const { state } = flow;
  const { phase } = state;
  switch (phase.kind) {
    case "opening":
      return <LoadingStep label={HOTEL_FORM_COPY.loading} />;
    case "no_link":
      return <LinkGoneStep variant="no_link" message={null} helpContact={state.helpContact} />;
    case "gone":
      return (
        <LinkGoneStep variant="gone" message={phase.message} helpContact={state.helpContact} />
      );
    case "unreachable":
      return (
        <UnreachableStep message={phase.message} retryAt={phase.retryAt} onRetry={flow.reopen} />
      );
    case "welcome":
      return (
        <WelcomeStep
          link={state.link}
          helpContact={state.helpContact}
          notice={state.notice}
          onStart={flow.start}
        />
      );
    case "identity":
      return <IdentityStepView flow={flow} identity={phase.identity} siteKey={siteKey} />;
    case "signed_in":
      return <SignedInStep flow={flow} siteKey={siteKey} />;
  }
}
