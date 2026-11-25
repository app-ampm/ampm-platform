import { readPolicy, staffToken, writePolicy } from "./support/local-api";

/**
 * After the run: the form's policy as it was before, with the mode back at off, so no route of the form
 * answers on this machine until someone turns it on again.
 */
export default async function globalTeardown(): Promise<void> {
  const token = staffToken();
  const kept = process.env["HOTEL_FORM_E2E_POLICY_BEFORE"];
  const before: Record<string, unknown> = kept ? JSON.parse(kept) : await readPolicy(token);
  await writePolicy(token, { ...before, mode: "off" });
}
