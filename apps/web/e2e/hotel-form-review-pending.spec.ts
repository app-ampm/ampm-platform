import type { Request } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import {
  answerWhatSubmitNeeds,
  backToOverview,
  declare,
  expectAccessibleAtBothWidths,
  openSection,
} from "./support/form-pages";
import { SITE_URL, freshMobile } from "./support/local-api";
import { signIn } from "./support/sign-in";

/*
 * Submitting with a section's changes not saved yet (D-190 §5, review fix F2), end to end: the section's
 * saves fail on the way, so its changes are not saved; the review marks it in the overview's words, and
 * Submit saves it first, says which section, takes focus and sends nothing. Once the save has landed,
 * Submit sends the form with that save in it. Synthetic answers only.
 */

const ROOMS_SAVE = "**/hotel-form/draft/sections/rooms";
const NOT_SAVED = "Changes not saved: open the section to see why";

test("HF-06: Submit saves a section's changes first, sends nothing, then submits them", async ({
  page,
  formLink,
}) => {
  const asha = { fullName: "Asha Rao", designation: "Chief Engineer", mobile: freshMobile() };
  await signIn(page, formLink.url, asha);
  await answerWhatSubmitNeeds(page, asha);
  const submits: Request[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/hotel-form/submit"))
      submits.push(request);
  });

  // The connection drops on every Rooms save: what is typed there is not saved.
  await page.route(ROOMS_SAVE, (route) => route.abort("failed"));
  await openSection(page, "Rooms");
  await page.getByLabel("Total rooms in the hotel").fill("45");
  await page.keyboard.press("Tab");
  await expect(page.getByText("Not saved –", { exact: false })).toBeVisible();
  await backToOverview(page);
  await expect(page.getByRole("link", { name: /^Rooms/ })).toContainText(NOT_SAVED);

  await page.getByRole("link", { name: "Review and submit" }).click();
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form/review`);
  const rooms = page.getByRole("article", { name: "Rooms" });
  await expect(rooms).toContainText(NOT_SAVED);
  await expectAccessibleAtBothWidths(page);
  await declare(page, "No");

  // The connection is back. Submit saves Rooms first, says so, and sends nothing.
  await page.unroute(ROOMS_SAVE);
  await expect(page.getByText("Security check passed. You can submit.")).toBeAttached();
  await page.getByRole("button", { name: "Submit to AMPM" }).click();
  const notice = page.locator("#hf-submit-notice");
  await expect(notice).toContainText(
    "Some of your changes aren't saved yet, so nothing was submitted.",
  );
  await expect(notice).toBeFocused();
  await expect(notice.getByRole("link", { name: "Rooms" })).toBeVisible();
  await expect(rooms).not.toContainText("Changes not saved");
  await expect(rooms).toContainText("45");
  expect(submits).toHaveLength(0);
  await expectAccessibleAtBothWidths(page);

  // Saved: Submit sends the form, Rooms at the version that save made (else a 409 would keep it here).
  await page.getByRole("button", { name: "Submit to AMPM" }).click();
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form/status`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Your answers are with AMPM." }),
  ).toBeVisible();
  await expect(page.getByRole("article", { name: "Rooms" })).toContainText("45");
  expect(submits).toHaveLength(1);
});
