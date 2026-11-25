"use client";

import { ApiProvider } from "@ampm/api-client";

import { env } from "@/env";

import { HotelFormScreen } from "./hotel-form-screen";
import { useHotelFormFlow } from "./use-hotel-form-flow";

/** The flow and the step it is on. */
function HotelFormFlowView() {
  const flow = useHotelFormFlow();
  return <HotelFormScreen flow={flow} siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />;
}

/**
 * The hotel form's identity step in the browser (D-189 §8), wired to the API through a provider of its
 * own: no staff or client token exists on the site, and the form's calls pass their session explicitly.
 * The server renders the opening card; the link is read, moved out of the address bar and opened once the
 * page runs in the browser.
 *
 *   <HotelFormApp />
 */
export function HotelFormApp() {
  return (
    <ApiProvider baseUrl={env.NEXT_PUBLIC_API_URL}>
      <HotelFormFlowView />
    </ApiProvider>
  );
}
