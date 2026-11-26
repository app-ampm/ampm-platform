import { expect, type Page } from "@playwright/test";

import { expectAccessible } from "./fixtures";
import { API_URL, SITE_URL } from "./local-api";
import type { FormPerson } from "./sign-in";

/*
 * Moving around the hotel form's pages behind the sign-in (D-190 §5: HF-04 to HF-07) as a person does:
 * a section from the overview, answers typed and saved, the declarations, and each page checked with axe
 * at a phone's width and a desktop's. Synthetic answers only.
 */

/** The 7.4 statement, ticked by its row as a person does (core's HOTEL_FORM_ACCURACY_DECLARATION). */
export const ACCURACY_STATEMENT =
  "I confirm that the information in this form is correct to the best of my knowledge.";

/** 7.5's question, the name of its Yes or No (core's HOTEL_FORM_DISPLAY_AUTHORISATION). */
export const DISPLAY_QUESTION = "May AMPM show your hotel's details to its clients?";

/** The page passes axe at the phone's width it runs at, and at a desktop's 1440; the size is put back. */
export async function expectAccessibleAtBothWidths(page: Page): Promise<void> {
  const phone = page.viewportSize();
  await expectAccessible(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectAccessible(page);
  if (phone) await page.setViewportSize(phone);
}

/** Back to the overview by its link, once it has arrived. */
export async function backToOverview(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Back to the overview" }).click();
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form/overview`);
  await expect(page.getByRole("heading", { name: "Your form" })).toBeVisible();
}

/** A section's page from the overview's list, by its title. */
export async function openSection(page: Page, title: string): Promise<void> {
  await page.getByRole("link", { name: new RegExp(`^${title}`) }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

/** Leaves the field just typed in, which saves the section at once, and waits for "Saved". */
export async function leaveAndSave(page: Page): Promise<void> {
  await page.keyboard.press("Tab");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

/** What a new hotel needs before it can be submitted: its name, city and state, and a contact. */
export async function answerWhatSubmitNeeds(page: Page, person: FormPerson): Promise<void> {
  await openSection(page, "Property and location");
  await page.getByLabel("Hotel name").fill("E2E Synthetic Lake Palace");
  await page.getByLabel("City or town").fill("Udaipur");
  await page.getByLabel("State or union territory").selectOption("Rajasthan");
  await leaveAndSave(page);
  await page.getByRole("link", { name: "Next: Contact for weddings and events" }).click();
  await page.getByLabel("Name", { exact: true }).fill(person.fullName);
  await page.getByLabel("Email").fill("events@e2e-hotel.example");
  await leaveAndSave(page);
  await backToOverview(page);
}

/** 7.4 ticked and 7.5 answered, as a person does: by the words beside each. */
export async function declare(page: Page, answer: "Yes" | "No"): Promise<void> {
  await page.getByText(ACCURACY_STATEMENT).click();
  await page
    .getByRole("group", { name: DISPLAY_QUESTION })
    .getByText(answer, { exact: true })
    .click();
  await expect(page.getByRole("radio", { name: answer })).toBeChecked();
}

/** What `GET /hotel-form/me` answers a session now: 200 while it lives, 401 once it ended. */
export async function meStatus(sessionToken: string): Promise<number> {
  const response = await fetch(`${API_URL}/hotel-form/me`, {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  return response.status;
}
