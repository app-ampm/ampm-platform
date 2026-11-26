import type { Page } from "@playwright/test";

import { expect, test, turnstileActions } from "./support/fixtures";
import {
  ACCURACY_STATEMENT,
  answerWhatSubmitNeeds,
  backToOverview,
  declare,
  expectAccessibleAtBothWidths,
  leaveAndSave,
  meStatus,
  openSection,
} from "./support/form-pages";
import { SITE_URL, freshMobile } from "./support/local-api";
import { colleagueSignedIn, sessionOf, signIn, type FormPerson } from "./support/sign-in";

/*
 * The hotel form's review, submit and status end to end (D-190 §5: HF-06 and HF-07): what is missing
 * before a submit, a submit with both declarations, the status page, a correction, removing your details,
 * and a colleague's save during the review refused as 409 sectionsChanged. Each page is checked with axe at
 * a phone's width and a desktop's.
 */

const person = (fullName: string): FormPerson => ({
  fullName,
  designation: "Chief Engineer",
  mobile: freshMobile(),
});

/** The review page from the overview, its draft read. */
async function openReview(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Review and submit" }).click();
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form/review`);
  await expect(page.getByRole("heading", { level: 1, name: "Review and submit." })).toBeVisible();
}

/** Submit pressed once the bot check has passed (the stand-in passes at once). */
async function submit(page: Page): Promise<void> {
  await expect(page.getByText("Security check passed. You can submit.")).toBeAttached();
  await page.getByRole("button", { name: "Submit to AMPM" }).click();
}

test("HF-06: what is missing, then a submit with both declarations; HF-07: the status", async ({
  page,
  formLink,
}) => {
  const asha = person("Asha Rao");
  await signIn(page, formLink.url, asha);
  await openReview(page);
  const missing = page.getByRole("region", { name: "Needed before you submit" });
  for (const item of [
    "Property and location: Enter the hotel's name",
    "Property and location: Enter the city",
    "Property and location: Choose the state",
    "Contact for weddings and events: Add a contact with an email or a phone number",
  ])
    await expect(missing.getByRole("link", { name: item })).toBeVisible();
  // Submit is never disabled for what is missing: pressed, it says what and goes to it.
  await page.getByRole("button", { name: "Submit to AMPM" }).click();
  await expect(page.getByText("Confirm that the information is correct")).toBeVisible();
  await expect(page.getByText("Answer Yes or No")).toBeVisible();
  await expect(page.getByLabel(ACCURACY_STATEMENT, { exact: false })).toBeFocused();
  await expectAccessibleAtBothWidths(page);

  await backToOverview(page);
  await answerWhatSubmitNeeds(page, asha);
  await openReview(page);
  await expect(page.getByText("Everything needed to submit is answered.")).toBeVisible();
  await expect(page.getByText("E2E Synthetic Lake Palace")).toBeVisible();
  await declare(page, "No");
  await submit(page);

  await expect(page).toHaveURL(`${SITE_URL}/hotel-form/status`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Your answers are with AMPM." }),
  ).toBeVisible();
  await expect(page.getByText(/^HIR-\d{4}-\d{4,}$/)).toBeVisible();
  await expect(
    page.getByText(/^Submitted by Asha Rao on \d{1,2} \w{3} \d{4} at \d\d:\d\d\.$/),
  ).toBeVisible();
  await expect(page.getByText("E2E Synthetic Lake Palace")).toBeVisible();
  expect(await turnstileActions(page)).toContain("hf_submit");
  await expectAccessibleAtBothWidths(page);

  // The overview leads here now, and the review sends a submitted request here too.
  await backToOverview(page);
  await page.getByRole("link", { name: "See where your request stands" }).click();
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form/status`);
  await page.goto("/hotel-form/review");
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form/status`);
});

test("HF-07: a correction, then Remove my details withdraws every consent and ends the session", async ({
  page,
  formLink,
}) => {
  const asha = person("Asha Rao");
  await signIn(page, formLink.url, asha);
  await answerWhatSubmitNeeds(page, asha);
  await openReview(page);
  await declare(page, "Yes");
  await submit(page);
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form/status`);

  await page.getByLabel("What should be corrected?").fill("E2E: the pool closes at 9 pm, not 10.");
  await expect(page.getByText("37 of 2000 characters")).toBeVisible();
  await expect(page.getByText("Security check passed. You can send your message.")).toBeAttached();
  await page.getByRole("button", { name: "Send to AMPM" }).click();
  await expect(page.getByText("Sent to AMPM's Hotel team.", { exact: false })).toBeVisible();
  await expect(page.locator("#hf-correction-notice")).toBeFocused();
  await expect(page.getByLabel("What should be corrected?")).toHaveValue("");
  expect(await turnstileActions(page)).toContain("hf_correction");

  await page.getByRole("button", { name: "Withdraw my permission to show photos" }).click();
  await expect(
    page.getByText("Your permission to show photos is withdrawn, and AMPM has been told."),
  ).toBeVisible();

  const session = await sessionOf(page);
  expect(session).toMatch(/^hfs_/);
  await page.getByRole("button", { name: "Remove my details" }).click();
  await expect(page.getByText("What happens next:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Remove your details?" })).toBeFocused();
  await expectAccessibleAtBothWidths(page);
  await page.getByRole("button", { name: "Yes, remove my details" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Your consent is withdrawn." }),
  ).toBeVisible();
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form/status`);
  // The page forgets the session once its sign-out has answered (401: the session had ended).
  await expect.poll(() => sessionOf(page)).toBeNull();
  expect(await meStatus(session ?? "")).toBe(401);
  await expectAccessibleAtBothWidths(page);
  // Opened again, the link starts from the welcome: the person is no longer signed in.
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Tell AMPM about your hotel." }),
  ).toBeVisible();
});

test("HF-06: a colleague saving during the review is a 409 sectionsChanged, marked, then submitted", async ({
  page,
  formLink,
  browser,
}) => {
  const asha = person("Asha Rao");
  await signIn(page, formLink.url, asha);
  await answerWhatSubmitNeeds(page, asha);
  await openReview(page);
  await declare(page, "Yes");

  const ravi = await colleagueSignedIn(browser, formLink.url, person("Ravi Kumar"));
  await openSection(ravi, "Rooms");
  await ravi.getByLabel("Total rooms in the hotel").fill("40");
  await leaveAndSave(ravi);
  await ravi.context().close();

  await submit(page);
  const notice = page.locator("#hf-submit-notice");
  await expect(notice).toContainText(
    "A colleague changed some answers while you were reviewing them.",
  );
  await expect(notice).toBeFocused();
  await expect(notice.getByRole("link", { name: "Rooms" })).toBeVisible();
  const rooms = page.getByRole("article", { name: "Rooms" });
  await expect(rooms).toContainText("Changed by a colleague");
  await expect(rooms).toContainText("40");
  await expect(page.getByText(/^Ravi Kumar saved Rooms at \d\d:\d\d\.$/)).toBeVisible();
  // The declarations are kept as ticked.
  await expect(
    page.getByRole("checkbox", { name: ACCURACY_STATEMENT, exact: false }),
  ).toBeChecked();
  await expect(page.getByRole("radio", { name: "Yes" })).toBeChecked();
  await expectAccessibleAtBothWidths(page);

  await submit(page);
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form/status`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Your answers are with AMPM." }),
  ).toBeVisible();
});
