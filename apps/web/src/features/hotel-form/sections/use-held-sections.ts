import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useHotelFormForgotten, useSaveHotelFormSection } from "@ampm/api-client";

import type { HotelFormFlow } from "../use-hotel-form-flow";
import { HeldSections, type FormSession, type HeldStatuses } from "./held-sections";

/**
 * The flow's session as a save asks for it: the token, and whose it is: the code's person the moment it
 * opened the session, else (a session kept from before a reload) the person `me` names.
 *
 * @example
 * formSessionOf(flow); // { token: "hfs_…", personId: "0192f3a0-…" }
 */
export function formSessionOf(flow: HotelFormFlow): FormSession {
  return { token: flow.state.session, personId: flow.state.personId ?? flow.me.data?.personId };
}

/**
 * When the page is hidden (another tab, the phone locked) or closed, what waits is saved at once; leaving
 * the form's pages altogether saves what waits too.
 */
function usePageLeave(sections: HeldSections) {
  useEffect(() => {
    const hide = () => sections.flushAll({ keepalive: false });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hide();
    };
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", onVisibility);
      sections.flushAll({ keepalive: false });
    };
  }, [sections]);
}

/**
 * The form's held sections (D-190 §5, review fixes E1 and E4), made once by the layout: every save goes
 * through the api-client's section save inside the flow's session, a session refused on the way is handed
 * to the flow (which asks for a new code in place), and the held sections are dropped when the form is
 * forgotten (sign-out, every consent withdrawn, HF-08) or someone else signs in. The same person's new
 * code sends what waited for it.
 *
 *   const sections = useHeldSections(flow);
 */
export function useHeldSections(flow: HotelFormFlow): HeldSections {
  const { mutateAsync } = useSaveHotelFormSection();
  const live = useRef({ flow, mutateAsync });
  useEffect(() => {
    live.current = { flow, mutateAsync };
  });
  const [sections] = useState(
    () =>
      new HeldSections({
        save: (call) => live.current.mutateAsync(call),
        session: () => formSessionOf(live.current.flow),
        refuseSession: (error) => {
          live.current.flow.refuseSession(error);
        },
      }),
  );
  useHotelFormForgotten(sections.drop);
  const { token, personId } = formSessionOf(flow);
  useEffect(() => {
    sections.sessionChanged({ token, personId });
  }, [sections, token, personId]);
  usePageLeave(sections);
  return sections;
}

const NO_STATUSES: HeldStatuses = {};
const noStatuses = (): HeldStatuses => NO_STATUSES;
const listenToNothing = () => () => undefined;

/**
 * Which sections still have text not saved, for the overview's list; none without held sections (a page
 * rendered on its own, as the server sends it).
 *
 *   const pending = useHeldStatuses(site.sections);
 */
export function useHeldStatuses(sections: HeldSections | undefined): HeldStatuses {
  return useSyncExternalStore(
    sections?.subscribe ?? listenToNothing,
    sections?.statuses ?? noStatuses,
    noStatuses,
  );
}
