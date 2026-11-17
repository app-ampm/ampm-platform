import { errors } from "@ampm/core";

import type { Env } from "../env.js";

/** The part of the API config the gate reads. */
export type DevGateEnv = Pick<Env, "IDENTITY_PROVIDER" | "NODE_ENV" | "IDENTITY_LOCAL_SECRET">;

/**
 * The one gate for the API's test-build-only paths (the dev sign-ins, the dev OTP, a contact's invite
 * link): open only under the local identity provider, outside production, with the local secret set.
 * `env.ts` already refuses `IDENTITY_PROVIDER=local` in production, so this is the request-time check
 * on top of that, and a closed gate is a 404 (denial equals absence, security.md): there these
 * endpoints do not exist. Returns the local signing secret for the callers that mint tokens.
 *
 *   const secret = assertDevBuild(this.env);
 */
export function assertDevBuild(env: DevGateEnv): string {
  const secret = env.IDENTITY_LOCAL_SECRET;
  if (env.IDENTITY_PROVIDER !== "local" || env.NODE_ENV === "production" || !secret) {
    throw errors.notFound();
  }
  return secret;
}
