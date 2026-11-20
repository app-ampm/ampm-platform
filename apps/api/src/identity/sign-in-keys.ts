import type { Env } from "../env.js";
import { AMPM_ISSUER, LocalIdentityAdapter } from "./local.adapter.js";
import { deriveKey, keyFromBase64, SecretBox } from "./secret-box.js";

/**
 * What AMPM's own sign-in (D-142) signs and seals with: the token signer whose tokens the identity
 * adapter accepts, the box that encrypts authenticator secrets at rest, and the key that HMACs the
 * recovery codes (derived from the encryption key, so it needs no secret of its own). Production (`ampm`) uses
 * its two dedicated secrets; the development provider derives both from its local secret, so the real
 * flow also runs on the test stack and in the tests. Null under Cognito, where the provider signs people
 * in, so the in-app sign-in routes answer 404 there.
 *
 *   const keys = signInKeysFor(env); // keys?.tokens.mint(subject, { email })
 */
export interface SignInKeys {
  readonly tokens: LocalIdentityAdapter;
  readonly box: SecretBox;
  readonly recoveryKey: Buffer;
}

export const SIGN_IN_KEYS = Symbol("SIGN_IN_KEYS");

export type SignInKeysEnv = Pick<
  Env,
  "IDENTITY_PROVIDER" | "IDENTITY_LOCAL_SECRET" | "AUTH_TOKEN_SECRET" | "AUTH_ENCRYPTION_KEY"
>;

export function signInKeysFor(env: SignInKeysEnv): SignInKeys | null {
  if (env.IDENTITY_PROVIDER === "ampm") {
    if (!env.AUTH_TOKEN_SECRET || !env.AUTH_ENCRYPTION_KEY) {
      throw new Error("AUTH_TOKEN_SECRET and AUTH_ENCRYPTION_KEY are required for ampm sign-in");
    }
    return {
      tokens: new LocalIdentityAdapter(env.AUTH_TOKEN_SECRET, {
        issuer: AMPM_ISSUER,
        provider: "ampm",
      }),
      box: new SecretBox(keyFromBase64(env.AUTH_ENCRYPTION_KEY)),
      recoveryKey: deriveKey(env.AUTH_ENCRYPTION_KEY, "ampm/recovery-codes"),
    };
  }
  if (env.IDENTITY_PROVIDER === "local" && env.IDENTITY_LOCAL_SECRET) {
    return {
      tokens: new LocalIdentityAdapter(env.IDENTITY_LOCAL_SECRET),
      box: new SecretBox(deriveKey(env.IDENTITY_LOCAL_SECRET, "ampm/totp-secrets")),
      recoveryKey: deriveKey(env.IDENTITY_LOCAL_SECRET, "ampm/recovery-codes"),
    };
  }
  return null;
}
