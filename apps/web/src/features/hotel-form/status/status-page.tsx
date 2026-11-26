"use client";

import { useState } from "react";

import { textStyles } from "@ampm/ui/styles";

import { HelpLine } from "../form-parts";
import { HOTEL_FORM_COPY } from "../hotel-form-copy";
import { useHotelFormSite } from "../hotel-form-provider";
import { HOTEL_FORM_ROUTES } from "../hotel-form-routes";
import { LoadingStep } from "../loading-step";
import { StepShell } from "../step-shell";
import { useSignedInPage } from "../use-signed-in-page";
import { STATUS_COPY } from "./status-copy";
import { StatusScreen } from "./status-screen";

const COPY = STATUS_COPY.removed;

/**
 * The plain confirmation once the person asked for their details to be removed (D-190 §3): every consent
 * withdrawn, signed out everywhere, a Super Admin to review the removal; nothing about the hotel, and no
 * way back into the form but a new code.
 */
function RemovedStep({ helpContact }: { readonly helpContact: string | null }) {
  return (
    <StepShell
      headingId="hf-removed-heading"
      eyebrow={COPY.eyebrow}
      title={COPY.title}
      emphasis={COPY.emphasis}
    >
      <p className={textStyles({ variant: "body", tone: "body" })}>{COPY.body}</p>
      <HelpLine helpContact={helpContact} />
    </StepShell>
  );
}

/**
 * HF-07 at /hotel-form/status (D-190 §5): where the request stands once signed in; opened without a
 * session, the sign-in first, which comes back here. Once the person removed their details it stays,
 * signed out, to say what happens next.
 *
 *   <HotelFormStatusPage />
 */
export function HotelFormStatusPage() {
  const [isRemoved, setIsRemoved] = useState(false);
  const { flow } = useHotelFormSite();
  const site = useSignedInPage(HOTEL_FORM_ROUTES.status, { isLeaving: isRemoved });
  if (isRemoved) return <RemovedStep helpContact={flow.state.helpContact} />;
  if (site === null) return <LoadingStep label={HOTEL_FORM_COPY.openingForm} />;
  return <StatusScreen site={site} onRemoved={() => setIsRemoved(true)} />;
}
