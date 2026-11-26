"use client";

import { ButtonLink } from "@/components/site/button-link";

import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { HOTEL_FORM_ROUTES } from "./hotel-form-routes";
import { StepShell } from "./step-shell";

const COPY = HOTEL_FORM_COPY.notFound;

/**
 * The form's not-found page: a mistyped section's address, inside the form's frame, with the overview as
 * the one way on (nothing leads away from the form).
 *
 *   <HotelFormNotFound />
 */
export function HotelFormNotFound() {
  return (
    <StepShell
      headingId="hf-not-found-heading"
      eyebrow={COPY.eyebrow}
      title={COPY.title}
      emphasis={COPY.emphasis}
      lead={COPY.body}
    >
      <ButtonLink href={HOTEL_FORM_ROUTES.overview} size="lg" fullWidth>
        {COPY.back}
      </ButtonLink>
    </StepShell>
  );
}
