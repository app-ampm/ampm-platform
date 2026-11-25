import type { Page, Request } from "@playwright/test";

import { expect, expectAccessible, test, turnstileActions } from "./support/fixtures";
import {
  API_URL,
  E2E_HELP_CONTACT,
  SITE_URL,
  endFormSession,
  freshMobile,
  revokeTestLink,
} from "./support/local-api";

/*
 * The hotel form's identity step end to end (D-189 §8; plan §8 HF-01, HF-02, HF-03, HF-08): a real
 * browser, the built site and a local API in on-screen mode with the stub bot check. Each page is checked
 * with axe as it stands.
 */

const LINK_KEY = "ampm.hotel-form.link";
const SESSION_KEY = "ampm.hotel-form.session";

/** Every request the page sent to the API, with its body. */
function apiRequests(page: Page): Request[] {
  const seen: Request[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(API_URL)) seen.push(request);
  });
  return seen;
}

function sessionStorageValue(page: Page, key: string): Promise<string | null> {
  return page.evaluate((name) => window.sessionStorage.getItem(name), key);
}

/** HF-02 filled in for a person, ready to send. */
async function fillDetails(page: Page, mobile: string): Promise<void> {
  await page.getByLabel("Your name").fill("Asha Rao");
  await page.getByLabel("Designation").selectOption("Other");
  await page.getByLabel("Your designation").fill("Chief Engineer");
  await page.getByLabel("Mobile number").fill(mobile);
  // The native checkbox is hidden for sight; a person ticks it by its row, as here.
  await page.getByText("I have read the privacy notice and accept it").click();
  await expect(page.getByLabel("I have read the privacy notice and accept it")).toBeChecked();
}

/** From the link to the signed-in page, entering the code shown on screen. */
async function signIn(page: Page, url: string, mobile: string): Promise<void> {
  await page.goto(url);
  await page.getByRole("button", { name: "Start" }).click();
  await fillDetails(page, mobile);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await page.getByRole("button", { name: "Use this code" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E seasonal refresh" })).toBeVisible();
}

test("HF-01 to HF-03: the link opens the welcome, the details ask for a code, the code signs in", async ({
  page,
  formLink,
}) => {
  const sent = apiRequests(page);
  await page.goto(formLink.url);

  // The secret leaves the address bar at once and stays with the tab.
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form`);
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  expect(await sessionStorageValue(page, LINK_KEY)).toBe(formLink.secret);

  // HF-01
  await expect(
    page.getByRole("heading", { level: 1, name: "Tell AMPM about your hotel." }),
  ).toBeVisible();
  await expect(page.getByText("about 20 minutes")).toBeVisible();
  await expect(page.getByText(`Need help? ${E2E_HELP_CONTACT}`)).toBeVisible();
  await page.getByText("Read the privacy notice").click();
  await expect(page.getByText("Cloudflare runs the security check")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Start" }).click();

  // HF-02: every answer is checked before anything is sent.
  await expect(page.getByRole("heading", { level: 1, name: "Your details" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send me a code" })).toBeEnabled();
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await expect(page.getByText("Tick the box to accept the privacy notice")).toBeVisible();
  await expectAccessible(page);
  const mobile = freshMobile();
  await fillDetails(page, mobile);
  await page.getByRole("button", { name: "Send me a code" }).click();

  // HF-03: the code on screen, the resend held back, a wrong code refused in the API's words.
  await expect(page.getByRole("heading", { level: 1, name: "Enter your code" })).toBeVisible();
  await expect(page.getByText(`Your code for +91 ••••• •${mobile.slice(-4)}`)).toBeVisible();
  await expect(page.getByRole("button", { name: /Send a new code in 0:[0-3]\d/ })).toBeDisabled();
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That code didn't work or has expired.")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Use this code" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Signed in: AMPM's label, note and status, the person's own details.
  await expect(page.getByRole("heading", { level: 1, name: "E2E seasonal refresh" })).toBeVisible();
  await expect(page.getByText("Synthetic request for the site's end-to-end tests.")).toBeVisible();
  await expect(page.getByText("Asha Rao · Chief Engineer")).toBeVisible();
  expect(await sessionStorageValue(page, SESSION_KEY)).toMatch(/^hfs_[\w-]{43}$/);
  await expectAccessible(page);

  // The bot check ran for hf_code; the secret went in POST bodies only, never in an address or a
  // Referer, and the page sent no referrer at all.
  expect(await turnstileActions(page)).toContain("hf_code");
  expect(sent.length).toBeGreaterThan(0);
  for (const request of sent) {
    expect(request.url()).not.toContain(formLink.secret);
    expect(await request.headerValue("referer")).toBeNull();
    if ((request.postData() ?? "").includes(formLink.secret)) expect(request.method()).toBe("POST");
  }
});

test("a reload keeps the tab signed in, and Sign out returns to the welcome", async ({
  page,
  formLink,
}) => {
  await signIn(page, formLink.url, freshMobile());
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "E2E seasonal refresh" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("You're signed out.")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Tell AMPM about your hotel." }),
  ).toBeVisible();
  expect(await sessionStorageValue(page, SESSION_KEY)).toBeNull();
});

test("an ended session asks for a new code in place, keeping what was typed, and counts down a 429", async ({
  page,
  formLink,
}) => {
  await signIn(page, formLink.url, freshMobile());
  await page.getByRole("button", { name: "Edit your details" }).click();
  await page.locator("#hf-edit-name").fill("Asha R. (e2e)");

  // The session ends elsewhere; the next call is refused with session_ended.
  const session = await sessionStorageValue(page, SESSION_KEY);
  await endFormSession(session ?? "");
  await page.getByRole("button", { name: "Save" }).click();
  const panel = page.getByRole("region", { name: "Enter a new code to continue" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("You were signed out. Enter a new code to continue.")).toBeVisible();
  await expect(page.locator("#hf-edit-name")).toHaveValue("Asha R. (e2e)");
  await expect(panel.getByLabel("Your name")).toHaveValue("Asha Rao");
  // Checked once the panel's own bot check has passed and its gold button has settled.
  await expect(panel.getByRole("button", { name: "Send me a code" })).toBeEnabled();
  await expectAccessible(page);

  // The same mobile within 30 seconds of its last code: the API's 429, counted down on the button.
  await panel.getByRole("button", { name: "Send me a code" }).click();
  await expect(
    panel.getByText("Please wait a few seconds before asking for another code."),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: /Try again in 0:\d\d/ })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Send me a code" })).toBeEnabled({
    timeout: 45_000,
  });
  await panel.getByRole("button", { name: "Send me a code" }).click();
  await panel.getByRole("button", { name: "Use this code" }).click();
  await panel.getByRole("button", { name: "Continue" }).click();
  await expect(panel).toBeHidden();

  // The edit kept its words through the new code, and saves now.
  await expect(page.locator("#hf-edit-name")).toHaveValue("Asha R. (e2e)");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Asha R. (e2e) · Chief Engineer")).toBeVisible();
});

test("HF-08: a link that is not active, and a page opened without its link", async ({
  page,
  formLink,
}) => {
  await page.goto(`/hotel-form#k=hfl_${"z".repeat(43)}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "This link isn't active." }),
  ).toBeVisible();
  await expect(page.getByText(E2E_HELP_CONTACT)).toBeVisible();
  await expect(page).toHaveURL(`${SITE_URL}/hotel-form`);
  await expectAccessible(page);

  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto("/hotel-form");
  await expect(
    page.getByRole("heading", { level: 1, name: "This page needs your link." }),
  ).toBeVisible();
  await expectAccessible(page);

  // A link that worked a moment ago, then revoked by AMPM: the same page on the next open.
  await page.goto(formLink.url);
  await expect(
    page.getByRole("heading", { level: 1, name: "Tell AMPM about your hotel." }),
  ).toBeVisible();
  await revokeTestLink(formLink.id);
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "This link isn't active." }),
  ).toBeVisible();
});

test("the welcome reads well at 768 and 1440 wide too", async ({ page, formLink }) => {
  for (const width of [768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(formLink.url);
    await expect(
      page.getByRole("heading", { level: 1, name: "Tell AMPM about your hotel." }),
    ).toBeVisible();
    await expectAccessible(page);
  }
});

test("HF-G10: /hotel-form sends its own headers by GET, none of them twice", async ({
  request,
}) => {
  const response = await request.get("/hotel-form");
  expect(response.status()).toBe(200);
  const lines = response.headersArray().map(({ name, value }) => [name.toLowerCase(), value]);
  const valuesOf = (name: string) =>
    lines.filter(([key]) => key === name).map(([, value]) => value);
  expect(valuesOf("referrer-policy")).toEqual(["no-referrer"]);
  expect(valuesOf("x-robots-tag")).toEqual(["noindex, nofollow, noarchive"]);
  expect(valuesOf("cache-control")).toEqual(["no-store"]);
  const [csp] = valuesOf("content-security-policy");
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).toContain(`img-src 'self' data: blob: ${API_URL}`);
  expect(csp).toContain(`connect-src 'self' ${API_URL}`);
  expect(valuesOf("content-security-policy-report-only")).toEqual([]);
});
