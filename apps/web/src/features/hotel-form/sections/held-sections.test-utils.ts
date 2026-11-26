import type { HotelFormSectionSaveCall } from "@ampm/api-client";
import type { HotelFormSectionSaved } from "@ampm/core";

import type { HotelFormFlow } from "../use-hotel-form-flow";
import { HeldSections } from "./held-sections";
import { formSessionOf } from "./use-held-sections";

/*
 * Held sections for a test's site, as the layout makes them, saving through the test's own `save` inside
 * the session the test's flow holds. Imported by tests only.
 */

/** A save the test never expects. */
const NEVER_SAVED = (): Promise<HotelFormSectionSaved> =>
  Promise.reject(new Error("This test saves no section"));

/**
 * Held sections saving through `save`, under whatever session `flow()` holds when a save goes.
 *
 *   const sections = heldSectionsFor(() => site.flow, api.save);
 */
export function heldSectionsFor(
  flow: () => HotelFormFlow,
  save: (call: HotelFormSectionSaveCall) => Promise<HotelFormSectionSaved> = NEVER_SAVED,
): HeldSections {
  return new HeldSections({
    save,
    session: () => formSessionOf(flow()),
    refuseSession: (error) => {
      flow().refuseSession(error);
    },
  });
}
