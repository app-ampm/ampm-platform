# Cognito setup (identity service) and the D-041 activation email gap

AMPM's identity provider is Amazon Cognito (Mumbai, `ap-south-1`). The API is **verify-only** (`CognitoIdentityAdapter.verifyAccessToken`): it never provisions accounts, it links a provider account to an already-invited user at activation ([[D-041]], "link on activate"). This note records the Cognito configuration the API expects and how the **verified-email go-live gap** is closed.

## User pool and app client

- One user pool in `ap-south-1`; its id is `COGNITO_USER_POOL_ID`, region `COGNITO_REGION`.
- One app client for the apps; its id is `COGNITO_CLIENT_ID`. The API checks every token's `client_id` against it and that `token_use` is `access`.
- Verification uses the pool's public JWKS (`https://cognito-idp.<region>.amazonaws.com/<poolId>/.well-known/jwks.json`) over HTTPS, plus the issuer and expiry. **No AWS SDK and no AWS credentials** are needed to verify a token.

## The verified-email gap (close before any production invite)

Activation requires the provider's **verified** email to match the invited email and fails closed otherwise ([[D-041]]): `cognitoIdentityFromClaims` surfaces `email` only when `email_verified` is `true` (or the string `"true"`). But a **stock Cognito access token carries neither `email` nor `email_verified`** — those are ID-token / user-attribute claims. So against real Cognito every activation would return `403` until the access token carries a verified email.

**Resolution (chosen): a Pre-Token-Generation Lambda.** Attach a *Pre token generation* trigger, **version 2** (access-token customization), to the app client, adding `email` and `email_verified` to the **access** token via `claimsToAddOrOverride`, and only when the user's email is verified in the pool. This keeps the API's verify-only seam and the session binding on the access token's `jti` ([[D-033]]) unchanged — no API change beyond the `email_verified` gate shipped in feature 5.1.

- Trigger: *Pre token generation*, **V2_0** (or later), on the app client the apps use.
- Claims added: `email` (the verified address) and `email_verified` (`"true"`); omit them when the email is not verified so activation stays fail-closed.

**Alternative (not chosen):** verify the Cognito **ID** token at activation instead of the access token. Rejected — it moves identity off the access token and risks re-binding the server session ([[D-033]]) to the ID token; the Lambda is the smaller, safer change. Recorded as D-043.

## Operational note — no provisioning on the seam

Link-on-activate has **no** `provisionUser` on the identity seam ([[D-041]]), so the Cognito user must already exist when AMPM issues the invite. Creating the Cognito user is an operational/admin step today (or a later additive adapter method); the API only verifies and links.

## Local development and tests

- Dev and tests use `LocalIdentityAdapter` (`IDENTITY_PROVIDER=local`, refused in production by `env.ts`), minting HS256 tokens with the same claims via `pnpm --filter api dev:token`.
- The Cognito adapter's verification is proven offline by `apps/api/src/identity/cognito.adapter.contract.spec.ts` — a generated RS256 keypair injected as a local JWKS — which is the CI gate. A live Mumbai-sandbox contract test is deferred until the pool and a token-acquisition flow exist.
