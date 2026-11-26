"use client";

import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { HOTEL_FORM_ROUTES } from "./hotel-form-routes";
import { LoadingStep } from "./loading-step";
import { OverviewScreen } from "./overview-screen";
import { useSignedInPage } from "./use-signed-in-page";

/**
 * HF-04 at /hotel-form/overview (D-190 §5): the overview once signed in; opened without a session, the
 * sign-in first, which comes back here.
 *
 *   <HotelFormOverviewPage />
 */
export function HotelFormOverviewPage() {
  const site = useSignedInPage(HOTEL_FORM_ROUTES.overview);
  if (site === null) return <LoadingStep label={HOTEL_FORM_COPY.openingForm} />;
  return <OverviewScreen flow={site.flow} siteKey={site.siteKey} />;
}
