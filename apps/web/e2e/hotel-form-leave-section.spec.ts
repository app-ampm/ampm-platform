import { expect, test } from "./support/fixtures";
import { backToOverview, openSection } from "./support/form-pages";
import { freshMobile } from "./support/local-api";
import { signIn } from "./support/sign-in";

/*
 * Leaving a section before its save lands (D-190 §5, review fixes E1 and E4), end to end: the form's
 * layout holds each section's typing and autosave, so the save still lands after the page has gone, the
 * overview says the section is waiting to be saved, and the section opens again on what was typed, never
 * on the draft from before its save. Synthetic answers only.
 */

const ROOMS_SAVE = "**/hotel-form/draft/sections/rooms";

test("HF-05: a section left before its save lands opens again on what was typed, and saves it", async ({
  page,
  formLink,
}) => {
  await signIn(page, formLink.url, {
    fullName: "Asha Rao",
    designation: "Chief Engineer",
    mobile: freshMobile(),
  });
  await openSection(page, "Rooms");

  // The section's save is held on its way, as on a slow connection, until the test lets it go.
  let release: () => void = () => undefined;
  const isHeld = new Promise<void>((resolve) => (release = resolve));
  let saves = 0;
  await page.route(ROOMS_SAVE, async (route) => {
    saves += 1;
    await isHeld;
    await route.continue();
  });

  await page.getByLabel("Total rooms in the hotel").fill("45");
  // Next: leaving the field sends the save, and the page goes before it lands.
  await page.getByRole("link", { name: "Next: Venues" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Venues" })).toBeVisible();
  await expect.poll(() => saves).toBe(1);

  await backToOverview(page);
  const rooms = page.getByRole("link", { name: /^Rooms/ });
  await expect(rooms).toContainText("Changes waiting to be saved");

  // Back in Rooms before the save lands: what was typed, still saving, not the draft from before it.
  await openSection(page, "Rooms");
  await expect(page.getByLabel("Total rooms in the hotel")).toHaveValue("45");
  await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
  release();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect(saves).toBe(1);

  // Kept by the API: a reload reads it back, and the overview says it is saved, by you.
  await page.unroute(ROOMS_SAVE);
  await page.reload();
  await expect(page.getByLabel("Total rooms in the hotel")).toHaveValue("45");
  await backToOverview(page);
  await expect(rooms).not.toContainText("Changes");
  await expect(rooms).toContainText("Last saved by you");
});
