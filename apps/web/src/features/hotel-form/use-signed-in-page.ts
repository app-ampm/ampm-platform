import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { Phase } from "./flow";
import { HOTEL_FORM_ROUTES } from "./hotel-form-routes";
import { useHotelFormSite, type HotelFormSite } from "./hotel-form-provider";

/**
 * What a page behind the sign-in does in each phase of the flow: wait while the link opens, show itself
 * once signed in (a new code asked for in place included), and otherwise go to the sign-in, which shows
 * the welcome, a new code, or why the link cannot be used.
 *
 * @example
 * innerPageStep({ kind: "welcome" }); // "sign_in"
 */
export function innerPageStep(phase: Phase): "wait" | "show" | "sign_in" {
  if (phase.kind === "opening") return "wait";
  return phase.kind === "signed_in" ? "show" : "sign_in";
}

/** How a page behind the sign-in takes a session that ends. */
export interface SignedInPageOptions {
  /**
   * The page signed its person out itself and stays to say what happens next (HF-07 after "Remove my
   * details"): it is neither remembered nor left for the sign-in.
   */
  readonly isLeaving?: boolean | undefined;
}

/**
 * A page behind the sign-in (HF-04 to HF-07, D-190 §5): opened without a session (a deep link, a reload
 * after signing out, a session AMPM ended) it remembers itself and goes to the sign-in, which sends the
 * person back here once they are in, unless it is leaving. Gives the form's shared state once signed in,
 * else null while the page waits or leaves.
 *
 *   const site = useSignedInPage(sectionPath("rooms"));
 *   if (site === null) return <LoadingStep label={COPY.loading} />;
 */
export function useSignedInPage(
  path: string,
  { isLeaving = false }: SignedInPageOptions = {},
): HotelFormSite | null {
  const site = useHotelFormSite();
  const { rememberReturn, arrived } = site;
  const router = useRouter();
  const step = innerPageStep(site.flow.state.phase);
  useEffect(() => {
    if (step !== "sign_in" || isLeaving) return;
    rememberReturn(path);
    router.replace(HOTEL_FORM_ROUTES.identity);
  }, [step, path, rememberReturn, router, isLeaving]);
  useEffect(() => {
    if (step === "show") arrived(path);
  }, [step, path, arrived]);
  return step === "show" ? site : null;
}
