import { act } from "react";
import type { HotelFormDraftView, HotelFormPhotoPermission } from "@ampm/core";
import { mount, type Mounted } from "@ampm/web-forms/testing";

import { EDITED_AT, draftWith } from "../draft.test-fixtures";
import { HotelFormSiteContext, type HotelFormSite } from "../hotel-form-provider";
import { ME, signedInSite } from "../screen.test-utils";
import type { HotelFormFlow } from "../use-hotel-form-flow";
import { HotelFormStatusPage } from "./status-page";

/*
 * HF-07 in a browser (jsdom) for the status page's tests: a submitted request, the page mounted under the
 * form's shared state, and a person's typing. Each test file mocks the API's calls, the router and the bot
 * check itself. Imported by tests only.
 */

/** The fixture's request, submitted by Ravi Kumar at the fixture's time. */
export const SUBMITTED: HotelFormDraftView = draftWith({
  status: "submitted",
  state: "locked",
  submittedBy: "Ravi Kumar",
  submittedAt: EDITED_AT,
});

/** The status page under `site`, its effects flushed. */
export function mountStatus(site: HotelFormSite): Promise<Mounted> {
  return mount(
    <HotelFormSiteContext.Provider value={site}>
      <HotelFormStatusPage />
    </HotelFormSiteContext.Provider>,
  );
}

/**
 * The form's shared state, signed in with `draft`, the flow's calls overridable, and `me` giving the
 * person's own answer to 7.5 as `photoPermission` (Yes unless told: they submitted with Yes).
 */
export function statusSite(
  draft: HotelFormDraftView,
  overrides: Partial<HotelFormFlow> = {},
  photoPermission: HotelFormPhotoPermission = "yes",
): HotelFormSite {
  const me = { data: { ...ME, photoPermission }, isLoading: false, error: null, retry: () => {} };
  return signedInSite(draft, { me, ...overrides });
}

/** Lets a press's call settle: its answer, and what the page does with it. */
export const settle = () => act(async () => undefined);

/** Types into a text area as a person does: the input event React listens for. */
export async function typeInto(element: HTMLElement, text: string): Promise<void> {
  if (!(element instanceof HTMLTextAreaElement)) throw new Error("Not a text area");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      element,
      text,
    );
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
