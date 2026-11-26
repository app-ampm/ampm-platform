import { CODE_PACE_FILE_ENV, startCodePace } from "./support/code-pace";
import {
  E2E_HELP_CONTACT,
  mintStaffToken,
  readPolicy,
  testDestination,
  writePolicy,
} from "./support/local-api";

/**
 * Before the run: the run's file pacing code requests (so a worker started afresh keeps the count), a
 * Super Admin's development token, the form's policy kept to put back afterwards, the mode at test_only
 * (only test requests open) with a synthetic help contact, and a destination for the test requests'
 * proposed hotels. Handed to the tests through the environment.
 */
export default async function globalSetup(): Promise<void> {
  process.env[CODE_PACE_FILE_ENV] = startCodePace();
  const token = mintStaffToken();
  const before = await readPolicy(token);
  await writePolicy(token, { ...before, mode: "test_only", helpContact: E2E_HELP_CONTACT });
  process.env["HOTEL_FORM_E2E_STAFF_TOKEN"] = token;
  process.env["HOTEL_FORM_E2E_POLICY_BEFORE"] = JSON.stringify(before);
  process.env["HOTEL_FORM_E2E_DESTINATION"] = await testDestination(token);
}
