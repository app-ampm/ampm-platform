import { execFileSync } from "node:child_process";
import path from "node:path";

import { z } from "zod";

/*
 * The local API as the hotel form's end-to-end tests drive it (D-189 §8): a Super Admin's development
 * token (IDENTITY_PROVIDER=local), the form's policy, and test requests whose links the tests open.
 * Synthetic data only: made-up hotels on example.test addresses, reserved test mobiles (+91 70000 1XXXX).
 * Never point these at a shared or production API: they switch the form's mode.
 */

/** Where the e2e run's API and site listen (free ports on the development machine by default). */
export const API_PORT = Number(process.env["HOTEL_FORM_E2E_API_PORT"] ?? 3921);
export const SITE_PORT = Number(process.env["HOTEL_FORM_E2E_SITE_PORT"] ?? 3431);
export const API_URL = `http://localhost:${API_PORT}`;
export const SITE_URL = `http://localhost:${SITE_PORT}`;

/** The help contact the run's policy shows on HF-01 and HF-08 (synthetic). */
export const E2E_HELP_CONTACT = "Call AMPM on +91 22 0000 0000 (e2e)";

/** The repository's root, where `pnpm --filter api …` runs (Playwright loads these files as CommonJS). */
export const REPO_ROOT = path.resolve(__dirname, "../../../..");

const envelope = <T extends z.ZodType>(data: T) => z.object({ data });
const policyAnswer = envelope(
  z.object({ key: z.string(), value: z.record(z.string(), z.unknown()) }),
);
const destinationsAnswer = envelope(z.object({ items: z.array(z.object({ id: z.string() })) }));
const destinationAnswer = envelope(z.object({ id: z.string() }));
const issuedAnswer = envelope(
  z.object({ request: z.object({ id: z.string() }), link: z.object({ url: z.string().url() }) }),
);

/** A Super Admin's development token, minted by the API's own script (never printed). */
export function mintStaffToken(): string {
  const output = execFileSync("pnpm", ["--silent", "--filter", "api", "dev:token", "local:admin"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const token = output.trim().split("\n").pop()?.trim() ?? "";
  if (token === "") throw new Error("pnpm --filter api dev:token printed no token");
  return token;
}

/** The token globalSetup minted for this run. */
export function staffToken(): string {
  const token = process.env["HOTEL_FORM_E2E_STAFF_TOKEN"];
  if (!token) throw new Error("No staff token: run the tests through playwright.config.ts");
  return token;
}

/** One staff call, its answer read through `schema`. */
async function staffCall<T>(
  path: string,
  schema: z.ZodType<T>,
  init: { readonly method?: string; readonly body?: unknown; readonly token?: string } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${init.token ?? staffToken()}`,
      "content-type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} answered ${response.status}`);
  return schema.parse(await response.json());
}

/** The form's policy as it stands. */
export async function readPolicy(token: string): Promise<Record<string, unknown>> {
  const answer = await staffCall("/admin/configurations/hotel_form.policy", policyAnswer, {
    token,
  });
  return answer.data.value;
}

/** Writes the form's policy, as a Super Admin would in the configuration screen. */
export async function writePolicy(token: string, value: Record<string, unknown>): Promise<void> {
  await staffCall("/admin/configurations/hotel_form.policy", policyAnswer, {
    method: "PUT",
    body: { value },
    token,
  });
}

/** A destination to file the test requests' proposed hotels under: the first one, or a new one. */
export async function testDestination(token: string): Promise<string> {
  const list = await staffCall("/hotels-admin/destinations", destinationsAnswer, { token });
  const first = list.data.items[0];
  if (first) return first.id;
  const created = await staffCall("/hotels-admin/destinations", destinationAnswer, {
    method: "POST",
    body: { name: "E2E Site Form Destination" },
    token,
  });
  return created.data.id;
}

/** A test request's link, as AMPM would send it, and the request's id. */
export interface TestLink {
  readonly id: string;
  /** `<site>/hotel-form#k=<secret>` */
  readonly url: string;
  readonly secret: string;
}

let requestSeq = 0;

/** A new-hotel test request (what test_only admits), with a staff label and note. */
export async function createTestLink(): Promise<TestLink> {
  requestSeq += 1;
  const tag = `${Date.now().toString(36)}-${requestSeq}`;
  const answer = await staffCall("/hotels-admin/info-requests", issuedAnswer, {
    method: "POST",
    body: {
      target: "new",
      proposedName: `E2E Site Form Hotel ${tag}`,
      proposedDestinationId: process.env["HOTEL_FORM_E2E_DESTINATION"],
      proposedWebAddress: `https://e2e-site-form-${tag}.example.test`,
      displayLabel: "E2E seasonal refresh",
      staffNote: "Synthetic request for the site's end-to-end tests.",
      isTest: true,
    },
  });
  const { url } = answer.data.link;
  return { id: answer.data.request.id, url, secret: url.slice(url.indexOf("#k=") + 3) };
}

/** Revokes a test request, ending its link; one a test already revoked stays as it is (409). */
export async function revokeTestLink(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/hotels-admin/info-requests/${id}/revoke`, {
    method: "POST",
    headers: { authorization: `Bearer ${staffToken()}`, "content-type": "application/json" },
    body: JSON.stringify({ reason: "End of the site's e2e test" }),
  });
  if (!response.ok && response.status !== 409)
    throw new Error(`revoking a test request answered ${response.status}`);
}

/** Ends a form session from outside the page, as a newer session or a sign-out elsewhere would. */
export async function endFormSession(sessionToken: string): Promise<void> {
  const response = await fetch(`${API_URL}/hotel-form/sign-out`, {
    method: "POST",
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) throw new Error(`sign-out answered ${response.status}`);
}

let mobileSeq = Math.floor(Math.random() * 9000);

/** A reserved test mobile (70000 1XXXX) no other test of this run has used, as a person types it. */
export function freshMobile(): string {
  mobileSeq = (mobileSeq + 1) % 10_000;
  return `70000 1${String(mobileSeq).padStart(4, "0")}`;
}
