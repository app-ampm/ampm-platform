import { expect, type Browser, type Page } from "@playwright/test";

import { reserveCodeRequests } from "./code-pace";
import { standInTurnstile } from "./fixtures";
import { SITE_URL } from "./local-api";

/*
 * Signing in to the hotel form as a person does (D-189 §8, D-190 §5): the link, the welcome, the details,
 * the code shown on screen, then the overview (HF-04), where signing in lands. Synthetic people only.
 */

/** A synthetic person helping with the form. */
export interface FormPerson {
  readonly fullName: string;
  readonly designation: string;
  /** A reserved test mobile, as a person types it (`freshMobile()`). */
  readonly mobile: string;
}

/** The tab's session key in sessionStorage (hotel-form-link.ts). */
export const SESSION_KEY = "ampm.hotel-form.session";

/** HF-02 filled in for a person, ready to send. */
export async function fillDetails(page: Page, person: FormPerson): Promise<void> {
  await page.getByLabel("Your name").fill(person.fullName);
  await page.getByLabel("Designation").selectOption("Other");
  await page.getByLabel("Your designation").fill(person.designation);
  await page.getByLabel("Mobile number").fill(person.mobile);
  // The native checkbox is hidden for sight; a person ticks it by its row, as here.
  await page.getByText("I have read the privacy notice and accept it").click();
  await expect(page.getByLabel("I have read the privacy notice and accept it")).toBeChecked();
}

/**
 * From the link to the overview (HF-04), entering the code shown on screen. The code requests are paced
 * (code-pace.ts): this sign-in's own, and `extraCodes` more the test asks for afterwards.
 */
export async function signIn(
  page: Page,
  url: string,
  person: FormPerson,
  { extraCodes = 0 }: { readonly extraCodes?: number } = {},
): Promise<void> {
  await reserveCodeRequests(1 + extraCodes);
  await page.goto(url);
  await page.getByRole("button", { name: "Start" }).click();
  await fillDetails(page, person);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await page.getByRole("button", { name: "Use this code" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form/overview`);
  await expect(page.getByRole("heading", { level: 1, name: "E2E seasonal refresh" })).toBeVisible();
}

/**
 * A colleague in a browser of their own (a second context: its own storage and session), Turnstile
 * stood in for as in the main page, signed in on the same link.
 */
export async function colleagueSignedIn(
  browser: Browser,
  url: string,
  person: FormPerson,
): Promise<Page> {
  const context = await browser.newContext({ baseURL: SITE_URL });
  const page = await context.newPage();
  await standInTurnstile(page);
  await signIn(page, url, person);
  return page;
}

/** The tab's form session, as the page keeps it. */
export function sessionOf(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.sessionStorage.getItem(key), SESSION_KEY);
}
