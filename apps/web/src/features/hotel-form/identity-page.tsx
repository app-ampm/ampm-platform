"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { HotelFormScreen } from "./hotel-form-screen";
import { useHotelFormSite } from "./hotel-form-provider";

/**
 * Sends a signed-in person on from the sign-in: to the page they were sent here from, else the overview
 * (HF-04), replacing the sign-in in the tab's history so Back does not return to it.
 */
function useLandAfterSignIn() {
  const { flow, landing } = useHotelFormSite();
  const router = useRouter();
  const isSignedIn = flow.state.phase.kind === "signed_in";
  useEffect(() => {
    if (isSignedIn) router.replace(landing());
  }, [isSignedIn, landing, router]);
}

/**
 * The hotel form's sign-in at /hotel-form (D-189 §8, D-190 §5): opening the link, HF-01 Welcome, HF-02
 * Your details, HF-03 Enter your code, and HF-08 for a link that is not active, drawn from the flow the
 * layout holds. Once signed in, the person goes on to the form's pages.
 *
 *   <HotelFormIdentityPage />
 */
export function HotelFormIdentityPage() {
  const { flow, siteKey } = useHotelFormSite();
  useLandAfterSignIn();
  return <HotelFormScreen flow={flow} siteKey={siteKey} />;
}
