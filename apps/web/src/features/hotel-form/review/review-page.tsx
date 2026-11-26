"use client";

import { HOTEL_FORM_COPY } from "../hotel-form-copy";
import { HOTEL_FORM_ROUTES } from "../hotel-form-routes";
import { LoadingStep } from "../loading-step";
import { useSignedInPage } from "../use-signed-in-page";
import { ReviewScreen } from "./review-screen";

/**
 * HF-06 at /hotel-form/review (D-190 §5): Review and submit once signed in; opened without a session, the
 * sign-in first, which comes back here.
 *
 *   <HotelFormReviewPage />
 */
export function HotelFormReviewPage() {
  const site = useSignedInPage(HOTEL_FORM_ROUTES.review);
  if (site === null) return <LoadingStep label={HOTEL_FORM_COPY.openingForm} />;
  return <ReviewScreen site={site} />;
}
