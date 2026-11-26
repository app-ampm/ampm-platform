import { act } from "react";
import type { HotelFormDraftView } from "@ampm/core";
import { buttonNamed, byId, mount, press, type Mounted } from "@ampm/web-forms/testing";

import { DRAFT, EDITED_AT } from "../draft.test-fixtures";
import { HotelFormSiteContext, type HotelFormSite } from "../hotel-form-provider";
import { signedInSite } from "../screen.test-utils";
import { HotelFormReviewPage } from "./review-page";

/*
 * HF-06 in a browser (jsdom) for the review page's tests: a signed-in site holding a draft, the page
 * mounted under it, and a person's steps on it. Each test file mocks the API's submit, the router and
 * the bot check itself. Imported by tests only.
 */

/** A minute after the fixture's saves: Ravi Kumar's are a colleague's recent ones. */
export const NOW = Date.parse(EDITED_AT) + 60_000;

/** The fixture's draft with the answers a new hotel needs before it can be submitted. */
export const READY: HotelFormDraftView = {
  ...DRAFT,
  sections: {
    ...DRAFT.sections,
    property: {
      ...DRAFT.sections.property,
      answers: { name: "Synthetic Lake Palace", city: "Udaipur", state: "Rajasthan" },
    },
    contact: {
      ...DRAFT.sections.contact,
      answers: { contacts: [{ name: "Synthetic Contact", email: "events@hotel.example" }] },
    },
  },
};

/** The form's shared state, signed in with `draft`; the return page and notice calls are spies. */
export function reviewSite(
  draft: HotelFormDraftView,
  refuseSession: (error: unknown) => boolean = () => false,
): HotelFormSite {
  return signedInSite(draft, { refuseSession });
}

/** The review page under `site`, its effects flushed. */
export function mountReview(site: HotelFormSite): Promise<Mounted> {
  return mount(
    <HotelFormSiteContext.Provider value={site}>
      <HotelFormReviewPage />
    </HotelFormSiteContext.Provider>,
  );
}

/** Lets a press's call settle: its answer, and what the page does with it. */
export const settle = () => act(async () => undefined);

/** Ticks 7.4 and answers 7.5, as a person does. */
export async function declare(host: HTMLElement, answer: "yes" | "no" = "no"): Promise<void> {
  await press(byId("hf-accuracy"));
  const radio = host.querySelector<HTMLInputElement>(`input[name="hf-display"][value="${answer}"]`);
  if (radio === null) throw new Error("No 7.5 answer");
  await press(radio);
}

/** Presses Submit and lets its call settle. */
export async function pressSubmit(host: HTMLElement): Promise<void> {
  await press(buttonNamed(host, "Submit to AMPM"));
  await settle();
}

/** The words of each link to `href`. */
export function linksTo(host: HTMLElement, href: string): (string | null)[] {
  return [...host.querySelectorAll(`a[href="${href}"]`)].map((link) => link.textContent);
}
