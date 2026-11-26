import { expect, test } from "./support/fixtures";
import {
  backToOverview,
  expectAccessibleAtBothWidths,
  leaveAndSave,
  openSection,
} from "./support/form-pages";
import { freshMobile } from "./support/local-api";
import { colleagueSignedIn, signIn, type FormPerson } from "./support/sign-in";

/*
 * The hotel form's overview and sections end to end (D-190 §5: HF-04 and HF-05): a real browser, the built
 * site and a local API, signed in with the code shown on screen. A section saves itself as the person
 * types and keeps its answers through a reload; two colleagues saving the same section choose which
 * version to keep. Each page is checked with axe at a phone's width and a desktop's.
 */

const person = (fullName: string): FormPerson => ({
  fullName,
  designation: "Chief Engineer",
  mobile: freshMobile(),
});

test("HF-04 and HF-05: signed in on the overview, a section saves as it is typed and keeps it after a reload", async ({
  page,
  formLink,
}) => {
  await signIn(page, formLink.url, person("Asha Rao"));
  await expect(page.getByRole("heading", { name: "Your form" })).toBeVisible();
  await expect(page.getByText("0 of 7 sections complete")).toBeVisible();
  await expectAccessibleAtBothWidths(page);

  await openSection(page, "Property and location");
  await expect(page.getByText("Your answers save as you type.")).toBeVisible();
  await page.getByLabel("Hotel name").fill("E2E Synthetic Lake Palace");
  // 1.5 seconds after typing stops, the section saves itself.
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expectAccessibleAtBothWidths(page);

  await page.reload();
  await expect(page.getByLabel("Hotel name")).toHaveValue("E2E Synthetic Lake Palace");
  await backToOverview(page);
  // The person's own save says "you", told by the API by person, never by name (review fix C4).
  await expect(page.getByRole("link", { name: /^Property and location/ })).toContainText(
    "Last saved by you",
  );
  await expect(page.getByRole("link", { name: /^Property and location/ })).toContainText(
    "In progress",
  );
});

test("HF-05: two colleagues saving one section choose which version to keep", async ({
  page,
  formLink,
  browser,
}) => {
  await signIn(page, formLink.url, person("Asha Rao"));
  await openSection(page, "Rooms");
  await expect(page.getByLabel("Total rooms in the hotel")).toHaveValue("");

  // Ravi saves the same section in a browser of his own, after Asha opened it.
  const ravi = await colleagueSignedIn(browser, formLink.url, person("Ravi Kumar"));
  await openSection(ravi, "Rooms");
  await ravi.getByLabel("Total rooms in the hotel").fill("40");
  await leaveAndSave(ravi);

  // Asha's save is on the version she opened: the page asks her to choose.
  await page.getByLabel("Total rooms in the hotel").fill("45");
  await page.keyboard.press("Tab");
  const conflict = page.getByRole("alert").filter({ hasText: "A colleague saved this section at" });
  await expect(conflict).toBeVisible();
  await expect(conflict).toContainText("Ravi Kumar saved it after you opened it.");
  await expect(page.getByText("Not saved yet", { exact: true })).toBeVisible();
  await expectAccessibleAtBothWidths(page);

  await conflict.getByRole("button", { name: "Take theirs" }).click();
  await expect(page.getByLabel("Total rooms in the hotel")).toHaveValue("40");
  await expect(conflict).toBeHidden();
  // Saving again now goes on Ravi's version.
  await page.getByLabel("Total rooms in the hotel").fill("46");
  await leaveAndSave(page);
  await ravi.reload();
  await expect(ravi.getByLabel("Total rooms in the hotel")).toHaveValue("46");
  await ravi.context().close();
});
