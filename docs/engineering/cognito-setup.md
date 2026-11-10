# Amazon Cognito — setup guide (identity service)

AMPM's identity provider is **Amazon Cognito (Mumbai, `ap-south-1`)** — locked 26 October 2026 (T‑6, R13). This is the end‑to‑end guide to standing it up and flipping the API from the development sign‑in (`IDENTITY_PROVIDER=local`) to Cognito. It supersedes the earlier short note; the D‑041 / D‑043 material is kept in §3.

> **Read this first.** The API's Cognito *verification* code is already built and tested offline. What does **not** exist yet is the AWS side (pool, app client, four Lambdas), the step that *creates* a Cognito user at invite time, the client sign‑in wiring in the apps, and the cutover. "Setting up Cognito" is therefore a small AWS job **plus a real build backlog** (§14). Do not expect a pure console click‑through to produce working sign‑in.

Every AWS specific below was web‑verified against current AWS docs (Nov 2026); load‑bearing claims cite the source inline. The design in §1 resolves three contradictions the first‑pass research left open (refresh‑token rotation, pool topology, OTP mechanism) — see the commit that introduced this revision.

---

## 0. What already exists vs what this adds

**Built and green in CI (verify‑only — no AWS SDK, no AWS credentials):**

- [`cognito.adapter.ts`](../../apps/api/src/identity/cognito.adapter.ts) — `CognitoIdentityAdapter.verifyAccessToken` verifies an **access** token with `jose`: `algorithms:['RS256']`, issuer `https://cognito-idp.<region>.amazonaws.com/<userPoolId>`, JWKS at `<issuer>/.well-known/jwks.json`, then requires `token_use==='access'`, `client_id===COGNITO_CLIENT_ID`, non‑empty `sub`/`jti`, numeric `exp`. It surfaces `email` only when `email_verified` is truthy (`true` or the string `"true"`), `phone` only when `phone_number_verified` is truthy.
- [`auth.guard.ts`](../../apps/api/src/policy/auth.guard.ts) — `Bearer` token → `verifyAccessToken` → principal (from the API's own `users` table where `users.identity_subject === sub`) → server‑side session keyed on the token's `jti` ([[D-033]]), kept until `exp` (A2).
- [`activation.controller.ts`](../../apps/api/src/modules/auth/activation.controller.ts) + [`activation.service.ts`](../../apps/api/src/identity/activation.service.ts) — `POST /auth/activate` (public): an invited user presents **{ invite token (body), Cognito access token (Bearer) }**; the API matches the provider's **verified email** to the invited email and links `users.identity_subject = sub` ([[D-041]], "link on activate").
- [`env.ts`](../../apps/api/src/env.ts) — `IDENTITY_PROVIDER∈{cognito(default),local}`; cognito **requires** `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` (startup fails otherwise); `local` is refused in production. The offline contract test [`cognito.adapter.contract.spec.ts`](../../apps/api/src/identity/cognito.adapter.contract.spec.ts) proves verification with an injected RS256 key set.

**This guide adds (none of it exists yet):**

| # | Piece | Where | Section |
|---|-------|-------|---------|
| 1 | User pool + app client (ap‑south‑1, Essentials) | AWS | §2 |
| 2 | Pre‑Token‑Generation **V2** Lambda (injects verified email/phone into the access token) | AWS Lambda + repo source | §3 |
| 3 | Staff password + TOTP config | AWS | §4 |
| 4 | Three custom‑auth challenge Lambdas + the API OTP broker (client mobile+OTP via AMPM's own DLT SMS) | AWS Lambda + API + repo | §5 |
| 5 | **Cognito user provisioning** bound to the invite flow (the #1 gap) + the AWS admin‑credential holder | API + infra | §6 |
| 6 | Apps: Amplify token acquisition, secure storage, the `/activate` first‑run screen | `apps/mobile` | §7 |
| 7 | Env/secrets, provider flip, separate staging/prod pools | SOPS + env | §8 |
| 8 | Cutover (first‑admin bootstrap, existing‑user backfill) + rollback | runbook | §9 |
| 9 | Lifecycle: deprovision, forced sign‑out, recovery | API + runbook | §10 |
| 10 | Live verification + acceptance checklist | test | §11 |
| 11 | Observability, cost, data residency | AWS | §12 |
| 12 | `infra/aws/` reproducible provisioning (IaC) | repo | §13 |

---

## 1. Decisions to lock before you touch AWS

Each has a **recommendation** (what the rest of this guide assumes). The ones marked **OPEN** need an explicit decision record (`python3 docs/tools/new_decision.py`) and, for the DLT provider, have external lead time — start them now.

1. **Pool topology — `ONE pool + ONE app client` (recommended).** It honours the already‑built single‑issuer / single‑`client_id` contract with **zero API change**. The cost: Cognito cannot *enforce* staff MFA at the pool level, because a pool that offers one‑time passwords to clients **cannot** set MFA to `REQUIRED` ("MFA can't be set to required in user pools that support one‑time passwords", [auth flow methods](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow-methods.html)). Staff MFA is therefore `OPTIONAL‑but‑enrolled` and **app‑enforced** (§4). *Alternative:* two pools (staff pool with `MFA=ON`, client pool passwordless) gives Cognito‑enforced staff TOTP but needs an **additive, verify‑only‑preserving** adapter change to accept a *set* of `{issuer, client_id}` — record it as a decision first; do not change the adapter silently.
2. **Client OTP mechanism — `CUSTOM_AUTH` with AMPM's own DLT provider (recommended).** The three challenge Lambdas (§5) let AMPM generate, store, rate‑limit and **send** the OTP through its own TRAI‑DLT‑registered SMS provider, with no Amazon SNS and one `SmsAdapter`. *Rejected:* managed `USER_AUTH` + native `SMS_OTP`, which sends through Cognito SNS (re‑introduces the ap‑south‑1 SNS/DLT setup you are avoiding) **and** rests on an unverified behaviour — whether `CustomSMSSender_Authentication` fires for the `USER_AUTH` passwordless *first factor* (AWS docs confirm it only for sign‑in SMS/MFA generically).
3. **DLT SMS provider — OPEN (start now; it is a go‑live blocker).** No provider is chosen (MSG91 / Gupshup / Kaleyra / Karix / …) and no SMS adapter exists in the repo. TRAI DLT **entity** registration + **OTP template** registration and content approval take **days to weeks**, and the OTP body must match the approved template byte‑for‑byte. This is a decision + an `SmsAdapter` build task per `api.md` (interface + sandbox + CI contract test).
4. **Cognito user provisioning — additive `identity.provisionUser` adapter method (recommended), manual runbook as the interim.** Today nothing creates a Cognito user; see §6. This needs `@aws-sdk/client-cognito-identity-provider` and scoped admin IAM credentials — a **new dependency category** (build‑decision per `code.md`) and a **new SOPS secret zone**.
5. **Staff account recovery — admin‑only (recommended interim).** Self‑service `ForgotPassword` emails are Cognito‑originated and need either an Amazon SES identity + **sandbox‑exit** (multi‑day AWS case) or a `CustomEmailSender` Lambda. Until one is chosen, recovery is a Super‑Admin action (consistent with AMPM's no‑self‑registration, own‑delivery posture). **OPEN** if self‑service reset is wanted.
6. **Sign‑in broker — yes (recommended).** Client OTP sign‑in goes through AMPM endpoints (`/auth/otp/start`, `/auth/otp/verify`) so `security.md`'s per‑IP + per‑principal limits run against the **real client IP**, and the one `SmsAdapter` is reused. These call **unauthenticated** `InitiateAuth`/`RespondToAuthChallenge` (no IAM credentials), behind an adapter per `api.md`. This is net‑new API surface on an otherwise verify‑only API — size it in (§5, §14).

> **Feature tier.** The whole design requires the Cognito **Essentials** plan (needed for V2 access‑token customization — the §3 gap fix — and refresh‑token features). Essentials is **paid**: ~10,000 free MAU/month, then ~$0.015/MAU (US list; ap‑south‑1 not separately published), **metered per environment** (staging + production). It is near‑zero at AMPM's scale but not literally zero — update the "Cognito at zero" line in [vps-setup.md](vps-setup.md) §8. Lite **cannot** inject verified email/phone into the access token, so every activation would 403 forever. [Feature plans](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-sign-in-feature-plans.html) · [pricing](https://aws.amazon.com/cognito/pricing/).

---

## 2. Provision the user pool and app client

Region is **`ap-south-1`** throughout. One pool, **Essentials** tier, admin/invite‑only, email+phone sign‑in, TOTP for staff, **one** public app client.

```bash
# 1) USER POOL — Essentials, admin-only (no self-registration), email+phone sign-in, 12-char policy.
#    MFA is set OFF here only because create-user-pool rejects ON/OPTIONAL without an SMS config;
#    TOTP is turned on in step 2 with set-user-pool-mfa-config (no SMS). --auto-verified-attributes is
#    intentionally omitted: AMPM marks email/phone verified administratively at provisioning (§6).
aws cognito-idp create-user-pool \
  --region ap-south-1 \
  --pool-name ampm-prod \
  --user-pool-tier ESSENTIALS \
  --username-attributes email phone_number \
  --username-configuration CaseSensitive=false \
  --admin-create-user-config 'AllowAdminCreateUserOnly=true' \
  --policies 'PasswordPolicy={MinimumLength=12,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=true,TemporaryPasswordValidityDays=7}' \
  --schema 'Name=email,AttributeDataType=String,Required=true,Mutable=true' \
           'Name=phone_number,AttributeDataType=String,Required=false,Mutable=true' \
  --account-recovery-setting 'RecoveryMechanisms=[{Priority=1,Name=verified_email}]' \
  --mfa-configuration OFF
# capture UserPool.Id as <USER_POOL_ID>  (e.g. ap-south-1_XXXXXXXXX)

# 2) Staff TOTP MFA, NO SMS. OPTIONAL = enforced only for users who enrol a factor (staff do, clients don't).
aws cognito-idp set-user-pool-mfa-config \
  --region ap-south-1 --user-pool-id <USER_POOL_ID> \
  --mfa-configuration OPTIONAL \
  --software-token-mfa-configuration 'Enabled=true'

# 3) ONE public app client — shared by staff (SRP+TOTP) and clients (CUSTOM_AUTH OTP).
#    --no-generate-secret: Expo/web are PUBLIC clients and cannot hold a secret; the API verifies only
#    client_id + signature + issuer + token_use, never a secret.
#    Access token 15 min (short, so a role/membership revocation takes effect fast); refresh 30 days
#    (the longest window needed). The 12h-staff / 30d-client *idle* split is enforced by AMPM's own
#    server-side session reaper (jti-keyed, D-033), NOT by Cognito token lifetime — see §11 note.
aws cognito-idp create-user-pool-client \
  --region ap-south-1 --user-pool-id <USER_POOL_ID> \
  --client-name ampm-apps \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_CUSTOM_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --access-token-validity 15 --id-token-validity 15 --refresh-token-validity 30 \
  --token-validity-units 'AccessToken=minutes,IdToken=minutes,RefreshToken=days' \
  --auth-session-validity 15 \
  --prevent-user-existence-errors ENABLED \
  --enable-token-revocation
# capture UserPoolClient.ClientId as <COGNITO_CLIENT_ID>
```

**Corrections baked in (these were wrong in the first‑pass research):**

- **Do NOT enable refresh‑token rotation together with `ALLOW_REFRESH_TOKEN_AUTH`.** AWS: *"Refresh token rotation isn't compatible with the authentication flow `REFRESH_TOKEN_AUTH` … you must disable this authentication flow and submit token‑refresh requests with `GetTokensFromRefreshToken`."* Enabling both silently breaks Amplify's silent refresh — every session would die at the 15‑minute access‑token expiry. Keep the flow, skip rotation. [refresh tokens](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-refresh-token.html)
- **Access tokens cannot exceed 24 h** (min 5 min). The "client 30‑day session" is the **refresh** token, not the access token. Under A2 that yields ≤15‑min server‑session rows refreshed until the 30‑day refresh expiry.
- **One** app client ⇒ one `client_id` ⇒ the adapter's single‑value check passes for both audiences, **no API change**. If you later split staff/clients into two clients for distinct refresh TTLs, extend the adapter to a `client_id` **allow‑list** (same shape as `CORS_ORIGINS`: `COGNITO_CLIENT_IDS` comma‑separated, membership check) — additive, verification semantics unchanged, but a recorded contract change.

Confirm the access token carries what the adapter checks:

```bash
printf '%s' "<ACCESS_TOKEN>" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null \
  | jq '{token_use, client_id, iss, sub, jti, exp, email, email_verified, phone_number, phone_number_verified}'
```

---

## 3. Close the verified‑email/phone gap — the Pre‑Token‑Generation V2 Lambda  ([[D-041]] / [[D-043]])

**The gap.** A stock Cognito **access** token carries neither `email`/`email_verified` nor `phone_number`/`phone_number_verified` — those are ID‑token / userInfo claims. The adapter reads all four **from the access token**, and `activation.service.ts:39` fails closed unless a **verified email** is present and equals the invited email. So against a real pool, **every `/auth/activate` returns 403** until this Lambda is attached. *(Confirmed feasible: `email`/`phone_number` and their `*_verified` flags are standard OIDC attributes, not in Cognito's no‑add reserved set, and arrive as the string `"true"` — which the adapter's `isVerified()` already accepts. [pre‑token‑gen](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html) · [customize access tokens](https://aws.amazon.com/blogs/security/how-to-customize-access-tokens-in-amazon-cognito-user-pools/).)*

**Resolution (D‑043):** a Pre‑Token‑Generation trigger, version **`V2_0`** (access‑token customization), that copies the pool‑**verified** email and phone onto the access token, fail‑closed. Node, zero deps, `nodejs22.x`:

```js
// infra/aws/lambda/pretoken/index.mjs  (handler = index.handler)
// Mirrors the pool-VERIFIED email/phone onto the ACCESS token so /auth/activate (D-041) can match.
// Fires on auth AND refresh (TokenGeneration_RefreshTokens). *_verified arrive as the STRING "true".
const isVerified = (v) => v === true || v === "true"; // mirrors cognito.adapter.ts isVerified()

export const handler = async (event) => {
  const a = event?.request?.userAttributes ?? {};
  const add = {};
  // Inject contact + its verified flag together, and ONLY when verified. An unverified contact is
  // omitted entirely -> adapter resolves it to null -> activation fails closed (never trusts it).
  if (typeof a.email === "string" && a.email.length > 0 && isVerified(a.email_verified)) {
    add.email = a.email;
    add.email_verified = "true";
  }
  if (typeof a.phone_number === "string" && a.phone_number.length > 0 && isVerified(a.phone_number_verified)) {
    add.phone_number = a.phone_number;
    add.phone_number_verified = "true";
  }
  event.response = {
    claimsAndScopeOverrideDetails: {
      accessTokenGeneration: { claimsToAddOrOverride: add }, // access token only; ID token untouched
    },
  };
  // NEVER log `a` or `add` — personal data (security.md).
  return event;
};
```

Attach it (and re‑pass the pool settings, because `update-user-pool` **overwrites** the whole config):

```bash
aws cognito-idp update-user-pool \
  --region ap-south-1 --user-pool-id <USER_POOL_ID> \
  --user-pool-tier ESSENTIALS \
  --admin-create-user-config 'AllowAdminCreateUserOnly=true' \
  --policies 'PasswordPolicy={MinimumLength=12,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=true,TemporaryPasswordValidityDays=7}' \
  --account-recovery-setting 'RecoveryMechanisms=[{Priority=1,Name=verified_email}]' \
  --mfa-configuration OPTIONAL \
  --lambda-config 'PreTokenGenerationConfig={LambdaVersion=V2_0,LambdaArn=<PRETOKEN_LAMBDA_ARN>}'

# Cognito must be allowed to invoke the Lambda, scoped to THIS pool (never userpool/*):
aws lambda add-permission --function-name ampm-cognito-pretoken \
  --statement-id cognito-pretoken-invoke --action lambda:InvokeFunction \
  --principal cognito-idp.amazonaws.com --source-arn <USER_POOL_ARN>
```

The Lambda makes no AWS calls — its role needs only `AWSLambdaBasicExecutionRole` (CloudWatch Logs). Pin the pool to a Lambda **version/alias** ARN (not `$LATEST`) so token behaviour is reproducible.

> ⚠️ **The single likeliest go‑live failure.** Clients sign in by **mobile+OTP** and may never type an email, yet activation matches **email only** (`activation.service.ts:39`). So the admin‑created Cognito **client** user must carry **both** a verified `phone_number` (to authenticate) **and** a verified `email` that equals `users.email` **exactly** (to pass activation) — both stamped administratively at provisioning (§6). A casing/typo mismatch between the Cognito email and `users.email` is a **permanent, silent 403**. Smoke‑test an issued token (the `jq` command in §2) before the first real invite.

---

## 4. Staff sign‑in — password + authenticator app (TOTP)

Staff enrol a TOTP authenticator; because the pool is `MFA=OPTIONAL`, TOTP is then **mandatory for them** (clients, who never enrol, are never prompted — their second step is the §5 OTP). Enforcement that TOTP is *set up* is **app‑side** (see note).

```bash
# Enrol (uses a valid access token from a prior sign-in, or the session from the MFA_SETUP challenge):
aws cognito-idp associate-software-token --access-token "$STAFF_ACCESS_TOKEN"
#   -> SecretCode; render as a QR for the authenticator app:
#      otpauth://totp/AMPM:staff@ampm.example?secret=<SecretCode>&issuer=AMPM
aws cognito-idp verify-software-token --access-token "$STAFF_ACCESS_TOKEN" --user-code 123456

# Make TOTP the preferred factor so it is challenged every sign-in:
aws cognito-idp admin-set-user-mfa-preference \
  --region ap-south-1 --user-pool-id <USER_POOL_ID> --username staff@ampm.example \
  --software-token-mfa-settings 'Enabled=true,PreferredMfa=true'

# Lost authenticator (admin-only recovery): delete the factor -> next sign-in forces MFA_SETUP again.
aws cognito-idp admin-delete-software-token \
  --region ap-south-1 --user-pool-id <USER_POOL_ID> --username staff@ampm.example
```

Sign‑in is `ALLOW_USER_SRP_AUTH` (password over SRP — the password never crosses the wire); Cognito then issues the `SOFTWARE_TOKEN_MFA` challenge automatically for enrolled staff. Cognito **groups are not used** — AMPM roles/permissions live in [`packages/policy`](../../packages/policy), resolved from the API's `users` table.

> **MFA enforcement note.** With one pool, Cognito can't force staff to *enrol* TOTP (`REQUIRED` is impossible alongside client OTP). Enforce it in AMPM: block staff activation / gate the staff workspace until `verify-software-token` has succeeded (a pre‑authentication check, or a `users` flag set when the staff account is provisioned with MFA). If **Cognito‑enforced** staff MFA is a hard requirement, take the two‑pool alternative in §1(1) and the adapter allow‑list/multi‑issuer change.

---

## 5. Client sign‑in — mobile + OTP via your own DLT provider

Flow: **Expo app → AMPM broker (`/auth/otp/start`,`/auth/otp/verify`) → Cognito `CUSTOM_AUTH` → three challenge Lambdas → AMPM OTP issue/verify (same API, one `SmsAdapter` → DLT provider) → tokens returned to the app.** The broker uses **unauthenticated** `InitiateAuth`/`RespondToAuthChallenge`, so no IAM credentials enter the API; the verify‑only `jose` adapter is unchanged and validates the minted access token on the next call.

```js
// infra/aws/lambda/define-auth-challenge/index.mjs — sequencer only; holds no secrets.
export const handler = async (event) => {
  const s = event.request.session;
  const MAX = 3;                                  // Cognito has no fixed custom-auth retry cap
  if (s.length === 0) {                           // fresh sign-in -> issue the custom challenge
    Object.assign(event.response, { challengeName: "CUSTOM_CHALLENGE", issueTokens: false, failAuthentication: false });
    return event;
  }
  const last = s[s.length - 1];
  if (last.challengeName === "CUSTOM_CHALLENGE" && last.challengeResult === true) {
    Object.assign(event.response, { issueTokens: true, failAuthentication: false });   // correct OTP -> mint JWTs
    return event;
  }
  const used = s.filter((x) => x.challengeName === "CUSTOM_CHALLENGE").length;
  Object.assign(event.response, used < MAX
    ? { challengeName: "CUSTOM_CHALLENGE", issueTokens: false, failAuthentication: false }  // retry
    : { issueTokens: false, failAuthentication: true });                                    // out of attempts
  return event;
};
```

```js
// infra/aws/lambda/create-auth-challenge/index.mjs — the OTP SEND seam. No provider SDK here.
// Delegates to AMPM's API, which owns OTP generation/storage and the ONE SmsAdapter (DLT provider).
import { signedPost } from "./ampm-internal-client.mjs"; // HMAC over a SOPS shared secret
export const handler = async (event) => {
  if (event.request.challengeName !== "CUSTOM_CHALLENGE") return event;
  const { sub, phone_number: phone } = event.request.userAttributes; // phone set at provisioning (E.164)
  const { maskedPhone, ref } = await signedPost("/_internal/auth/otp/issue", { sub, phone, purpose: "client_signin" });
  event.response.publicChallengeParameters  = { deliveryMedium: "SMS", destination: maskedPhone };
  event.response.privateChallengeParameters = { ref };   // correlation only — NEVER the code
  event.response.challengeMetadata          = "AMPM_OTP";
  return event;
};
```

```js
// infra/aws/lambda/verify-auth-challenge/index.mjs — the VERIFY seam. AMPM holds the hashed code.
import { signedPost } from "./ampm-internal-client.mjs";
export const handler = async (event) => {
  const ref = event.request.privateChallengeParameters?.ref;
  const answer = (event.request.challengeAnswer ?? "").trim();
  const { valid } = await signedPost("/_internal/auth/otp/verify", { sub: event.request.userAttributes.sub, ref, answer });
  event.response.answerCorrect = valid === true && event.request.userNotFound !== true;
  return event;
};
```

**The AMPM broker (new API surface — behind an adapter per `api.md`, unauthenticated Cognito client, no IAM creds):**

- `POST /auth/otp/start { phone }` → per‑IP + per‑principal `@RateLimit` **before** Cognito → `InitiateAuth{ AuthFlow:"CUSTOM_AUTH", ClientId:COGNITO_CLIENT_ID, AuthParameters:{ USERNAME: phone } }` → `{ session, maskedPhone }`.
- `POST /auth/otp/verify { phone, code, session }` → `RespondToAuthChallenge{ ChallengeName:"CUSTOM_CHALLENGE", Session, ChallengeResponses:{ USERNAME: phone, ANSWER: code } }` → on success return the access/id/refresh tokens.
- `POST /_internal/auth/otp/{issue,verify}` → called by the Lambdas, HMAC‑signed with `AMPM_INTERNAL_HMAC_SECRET` (SOPS); treated as a trusted internal caller, **not** a principal. `issue` generates+stores the code and sends via the `SmsAdapter`; it is idempotent within the TTL + resend cooldown.

**OTP policy** (a `configurations` row, not code — `api.md`): `OTP_LENGTH=6`, `OTP_TTL_SECONDS=300`, `OTP_RESEND_COOLDOWN_SECONDS=30`, `OTP_MAX_ATTEMPTS=3`, `OTP_DAILY_CAP_PER_PHONE`. Keep the app client's `auth-session-validity` (15 min) ≥ the OTP TTL. **DLT config** for your own provider (not SNS): `SMS_DLT_ENTITY_ID`, `SMS_DLT_TEMPLATE_ID_OTP`, `SMS_SENDER_ID` — the OTP body must match the DLT‑approved template byte‑for‑byte.

[define](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-define-auth-challenge.html) · [create](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-create-auth-challenge.html) · [verify](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-verify-auth-challenge-response.html) · [InitiateAuth](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_InitiateAuth.html)

---

## 6. Provision Cognito users at invite time — the #1 integration gap

Today's invite path ([`client-logins.service.ts`](../../apps/api/src/modules/admin/client-logins/client-logins.service.ts) `create()` and [`client-user.service.ts`](../../apps/api/src/identity/client-user.service.ts) `provisionInvitedClient()`) creates only the AMPM `users` row + a hashed invite token + an email. **Nothing touches Cognito.** Because the identity seam deliberately has no `provisionUser` ([[D-041]]), unless something creates the Cognito user **at or before invite time**, the invitee can never sign in, never gets an access token, and every `/auth/activate` dead‑ends. **This silently breaks every production invite.**

**What provisioning must do, per audience (admin control plane — needs `@aws-sdk/client-cognito-identity-provider` + scoped IAM creds):**

```bash
# CLIENT (passwordless, OTP) — email EXACTLY = users.email, both contacts stamped verified, no usable password.
aws cognito-idp admin-create-user --region ap-south-1 --user-pool-id <USER_POOL_ID> \
  --username "<client phone E.164>" --message-action SUPPRESS \
  --user-attributes Name=email,Value="<users.email>" Name=email_verified,Value=true \
                    Name=phone_number,Value="<E.164>" Name=phone_number_verified,Value=true
# move the user to CONFIRMED so CUSTOM_AUTH can run (the password is random and never used):
aws cognito-idp admin-set-user-password --region ap-south-1 --user-pool-id <USER_POOL_ID> \
  --username "<client phone E.164>" --password "$(openssl rand -base64 30)" --permanent

# STAFF (password + TOTP) — email verified; set a temporary password they change on first sign-in.
aws cognito-idp admin-create-user --region ap-south-1 --user-pool-id <USER_POOL_ID> \
  --username "staff@ampm.example" --message-action SUPPRESS \
  --user-attributes Name=email,Value="staff@ampm.example" Name=email_verified,Value=true
```

The Cognito `sub` is **not** pushed into the API here — the link happens at **activation**, when the user presents a Cognito access token and the API reads `sub` and sets `users.identity_subject`. Provisioning only needs the Cognito user to exist with the verified contacts above.

**Decisions this forces (record them):**
- **The additive adapter method** (recommended): add `provisionUser` to the identity seam, implemented by the Cognito adapter using the admin SDK, invoked inside `ClientLoginsService.create/reinvite` and `ClientUserService.provisionInvitedClient`. Interim: a manual admin runbook running the CLI above. Either way it is a **build‑decision** (new `@aws-sdk` dependency category, `code.md`).
- **Where the AWS admin credentials live.** The verify path is deliberately credential‑free; these *admin* calls are not. Decide the holder (the worker? a small admin service? a solo‑dev CLI?), scope the IAM principal to exactly `AdminCreateUser`/`AdminUpdateUserAttributes`/`AdminSetUserPassword`/`AdminDisableUser`/`AdminUserGlobalSignOut`/`AdminDeleteSoftwareToken` on this pool, and store the secret in a **new SOPS zone** ([infra/runbooks/secrets.md](../../infra/runbooks/secrets.md)). Never in the verify‑only API image.

---

## 7. The apps — token acquisition and first‑run activation

Install the native modules through Expo (not plain `pnpm add` — `code.md`). `aws-amplify` is pure JS; the rest are native, so the app leaves Expo Go for a **dev client** (`expo prebuild` / EAS Build) — confirm the team accepts that (today's flow uses Expo Go).

```bash
pnpm --filter mobile exec expo install \
  aws-amplify @aws-amplify/react-native @react-native-community/netinfo \
  @react-native-async-storage/async-storage react-native-get-random-values \
  expo-secure-store expo-dev-client
```

Store tokens in the Keychain/Keystore, never AsyncStorage (`offline.md`). SecureStore warns > ~2 KB and the V2‑enlarged JWT can approach that — keep the access token short (§2) and store the minimal set.

```ts
// apps/mobile/src/lib/amplify.ts — call ONCE at app root, storage set BEFORE configure.
import "react-native-get-random-values"; // must precede aws-amplify (SRP crypto polyfill)
import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { env } from "./env";
import { SecureStorage } from "./cognito-storage"; // KeyValueStorageInterface over expo-secure-store

cognitoUserPoolsTokenProvider.setKeyValueStorage(new SecureStorage());
Amplify.configure({ Auth: { Cognito: {
  userPoolId: env.EXPO_PUBLIC_COGNITO_USER_POOL_ID,
  userPoolClientId: env.EXPO_PUBLIC_COGNITO_CLIENT_ID, // == the API's single COGNITO_CLIENT_ID
}}});
```

```ts
// apps/mobile/src/features/auth/cognito-auth.ts — the ONLY place importing aws-amplify/auth (api.md).
import { signIn, confirmSignIn, fetchAuthSession } from "aws-amplify/auth";

// Staff: password + TOTP (SRP via Amplify).
export async function staffSignIn(email: string, password: string) {
  const { nextStep } = await signIn({ username: email, password,
    options: { authFlowType: "USER_SRP_AUTH" } });
  return nextStep; // CONFIRM_SIGN_IN_WITH_TOTP_CODE (or CONTINUE_SIGN_IN_WITH_TOTP_SETUP on first run)
}
export const confirmCode = (code: string) => confirmSignIn({ challengeResponse: code });

// Client: mobile + OTP goes through the AMPM broker (§5), NOT Amplify, so per-IP rate limits apply.
// The broker returns tokens; hand them to Amplify's token store (or keep a thin session of your own).

/** The Bearer the api-client attaches; Amplify silently refreshes an expired access token. */
export async function getCognitoAccessToken(): Promise<string | null> {
  try { return (await fetchAuthSession()).tokens?.accessToken?.toString() ?? null; }
  catch { return null; }
}
```

**First‑run activation.** Replace `use-dev-login` with `use-activate` on the first‑run seam: after the user signs in to Cognito and has an access token, the app calls `POST /auth/activate { token: <inviteToken> }` with that token as Bearer; the API links `identity_subject` and flips the account to `active`. After that, normal sign‑in resolves the principal.

```ts
// packages/api-client/src/hooks/use-activate.ts
export function useActivate() {
  const api = useApiClient();
  return useMutation<ActivateResponse, Error, ActivateRequest>({
    mutationFn: (body) => api.request("/auth/activate", { method: "POST", body, schema: activateResponse }),
  });
}
// App root: rewire the ApiProvider getter to Cognito (client.ts already awaits it — no client change):
// <ApiProvider baseUrl={env.EXPO_PUBLIC_API_URL} getAccessToken={getCognitoAccessToken}>
```

> **Decide what the invite link does.** The invite email points at `${WEB_APP_URL}/activate?token=…` (a web URL), but **no web `/activate` page exists**, and the existing `apps/mobile/.../portal/activation-view.tsx` is *plan* activation (CP‑11), not identity linking. Decide: a **deep link** into the Expo app, or a real web activation page that itself drives Cognito sign‑in. Then build the identity‑activation screen (distinct from the plan one). Choosing custom UI (no hosted UI — required to keep OTP on your own SMS) means you also build, in Peacock Night: staff password + TOTP‑enrol (render `otpauth://` as a QR) + TOTP‑verify, client OTP entry with resend/expiry/lockout, and all error/loading/offline states.

`apps/mobile/.env.example` gains public (non‑secret) values, kept in lockstep with the API: `EXPO_PUBLIC_IDENTITY_PROVIDER` (`cognito`|`local`, mirrors the API), `EXPO_PUBLIC_COGNITO_REGION=ap-south-1`, `EXPO_PUBLIC_COGNITO_USER_POOL_ID`, `EXPO_PUBLIC_COGNITO_CLIENT_ID`. The Expo **web** portal has no SecureStore — fall back to Amplify storage (localStorage/cookies); confirm that's acceptable under `security.md` or require httpOnly‑cookie handling.

---

## 8. Env, secrets, and the provider flip

The API needs **no AWS credentials** to verify — only the three public ids. The pool id and client id are **public identifiers, not secrets**, but they are environment‑specific; they live in the SOPS app zone (single assembly path) and in the Expo build profile.

```yaml
# infra/secrets/staging.app.enc.yaml  (plaintext BEFORE `sops --encrypt`)   — and production.app.enc.yaml
IDENTITY_PROVIDER: cognito
COGNITO_REGION: ap-south-1
COGNITO_USER_POOL_ID: ap-south-1_<env-specific pool>
COGNITO_CLIENT_ID:    <env-specific app client id>
AMPM_INTERNAL_HMAC_SECRET: change-me-via-sops   # signs the Lambda -> /_internal/auth/otp/* callbacks (§5)
```

- `apps/api/.env` (local dev) stays `IDENTITY_PROVIDER=local` + `IDENTITY_LOCAL_SECRET`; the `COGNITO_*` lines stay commented. Compose pins `NODE_ENV=production` on staging **and** production, so both must use `cognito` (and `env.ts` refuses `local` there).
- `env.ts` requires all three `COGNITO_*` when provider≠`local` (startup aborts non‑zero otherwise) — a half‑filled config fails fast, by design.
- **Separate pools per environment** (staging vs production). The per‑env secret files already imply it, isolation is cleaner, and each pool is separately MAU‑metered.
- Staging won't boot on identity alone: because `NODE_ENV=production` there, the stub bot‑check / stub payment / local storage are also refused. Set the real staging values (`siteverify`, `razorpay` test, `s3`) or they block the same `app.env`.

---

## 9. Cutover and rollback

- **First‑admin bootstrap (chicken‑and‑egg).** There is no admin yet to run `AdminCreateUser`. Create the first staff Cognito user with the CLI (§6), sign in once to mint an access token, and link `users.identity_subject` for the seeded Super‑Admin (via `/auth/activate` with a seeded invite, or a one‑off seed update).
- **Backfill existing users.** The platform is mid‑Horizon‑1 on dev‑login; **every `users` row with `identity_subject = NULL` is locked out the moment you flip `IDENTITY_PROVIDER=cognito`.** Before flipping: create a Cognito user for each active staff/client (verified email == `users.email`, verified phone), and either pre‑link `identity_subject` or have them re‑activate. Run it as a scripted backfill; verify counts.
- **Flip** only after the pool, the pre‑token Lambda, the broker, provisioning and the backfill are in place — staging first, then production on a release tag ([infra.md](../../.claude/rules/infra.md) deploy flow).
- **Rollback.** `IDENTITY_PROVIDER=local` is refused in production, so there is **no local fallback**. The real rollback is a **Lambda alias rollback** (pin the pool to the previous pre‑token version) + redeploying the previous API image. Decide whether a narrowly‑scoped, time‑boxed, audited **break‑glass** staff sign‑in is wanted (a new decision) or "fast alias rollback + staging‑first + CloudTrail alarms" suffices.

---

## 10. Lifecycle — deprovision, forced sign‑out, recovery

Map AMPM's user lifecycle onto Cognito at the existing call sites (otherwise you violate `security.md` "sessions revoked on role or membership change" at the identity layer):

- **Remove / reinvite.** `ClientLoginsService.remove()` revokes AMPM sessions but today leaves a fully working Cognito account + live refresh token. Add `AdminDisableUser` (and `AdminUserGlobalSignOut`) at `remove()`; re‑enable at `reinvite()`.
- **Role / membership change.** Where the API already calls `SessionService.revokeAllForUser`, also call **`AdminUserGlobalSignOut`** (admin creds) so the user can't mint fresh access tokens that still pass the offline adapter until `exp`. Note revocation/`GlobalSignOut` invalidates **refresh** tokens and Cognito's own token‑authorized calls — an already‑issued access token stays valid until `exp` (≤15 min here), which is why the short access lifetime matters. [token revocation](https://docs.aws.amazon.com/cognito/latest/developerguide/token-revocation.html)
- **Self sign‑out** (app): `signOut({ global: true })` with the user's own token. **Forced** server‑side sign‑out needs `AdminUserGlobalSignOut` (admin creds).
- **Client lost/changed mobile** (passwordless, no self‑service): admin changes `phone_number` and re‑verifies it — a Super‑Admin runbook step. **Staff lost authenticator:** `admin-delete-software-token` (§4).

---

## 11. Verify it works

Keep normal CI offline/hermetic (the existing contract spec). Add a **gated** live test and run it against a staging pool:

```ts
// apps/api/src/identity/cognito.adapter.live.spec.ts  — only when COGNITO_LIVE_TEST=1
const live = process.env.COGNITO_LIVE_TEST === "1";
(live ? describe : describe.skip)("CognitoIdentityAdapter (LIVE ap-south-1)", () => {
  const adapter = new CognitoIdentityAdapter({ region, userPoolId, clientId }); // real remote JWKS
  it("a real access token verifies AND carries verified email+phone (proves the pre-token Lambda ran)", async () => {
    const access = await signInClientViaBroker();         // CUSTOM_AUTH OTP -> tokens
    const id = await adapter.verifyAccessToken(access);
    expect(id).toMatchObject({ provider: "cognito" });
    expect(id.email).not.toBeNull();                      // the D-041/D-043 go-live assertion
    expect(id.phone).not.toBeNull();
  });
  it("protected route 200 via AuthGuard; /auth/activate links subject and is fail-closed on email mismatch");
  it("staff sign-in requires SOFTWARE_TOKEN_MFA (fails without TOTP, succeeds with)");
  it("after Cognito GlobalSignOut the access token STILL verifies until exp; after API revokeAllForUser the route is 401");
});
```

Headless OTP for the live test: an `EMAIL_OTP` to a readable mailbox, or a staging‑only sender that persists the code for the test to read. **Acceptance checklist:** real token passes `AuthGuard` end‑to‑end · access token carries verified email **and** phone · `/auth/activate` links the subject and 403s on email mismatch · staff MFA enforced · client OTP works and is rate‑limited · provisioning stamps both verified contacts.

> **Idle‑timeout caveat ([A16](build-verification-2026-10-31.md)).** Sessions are keyed by `jti`, so a refreshed access token opens a **new** session row. The staff‑12h / client‑30d **idle** rules are enforced by AMPM's server‑side session reaper, not Cognito; decide whether a refresh should reset or preserve the idle clock (cross‑`jti` idle tracking in `SessionService`), and keep the Cognito refresh validity (30d) ≥ the longest AMPM session.

---

## 12. Operations — observability, cost, residency

- **Alarms (a solo operator needs these — any one failing is a silent, total auth outage):** Pre‑Token Lambda **error rate > 0** (breaks *all* sign‑ins *and* activations → universal 403), OTP send‑failure rate, challenge‑Lambda errors, and JWKS unreachable from the VPS (no local fallback — `local` is refused in prod). CloudTrail on pool/app‑client/Lambda **config changes**. [CloudTrail](https://docs.aws.amazon.com/cognito/latest/developerguide/logging-using-cloudtrail.html)
- **Logging:** never log tokens, OTP codes, or email/phone (`security.md`). The Custom‑SMS/challenge path handles the decrypted OTP; scrub log groups and set retention.
- **Cost:** Essentials, ~10k free MAU/month then ~$0.015/MAU (US list; confirm ap‑south‑1 in the Pricing Calculator), **per environment**. The real per‑message SMS cost is the **DLT provider's**, not Cognito's.
- **Residency:** the pool, Lambdas and logs are all in `ap-south-1`; identity documents stay in the restricted Mumbai store (`security.md`), never exported.

---

## 13. Reproducibility — the `infra/aws/` module

`infra.md` requires "nothing configured by hand," but `infra/aws/` doesn't exist and Cognito lives **off** the VPS (outside the Compose/SOPS world). Create `infra/aws/` holding the pool, the app client, the four Lambdas (3 challenge + pre‑token) and their IAM/KMS/log wiring, applied per environment (separate state key).

- **Tooling (build‑decision, `code.md`):** an **idempotent AWS CLI bootstrap script** is lightest for a solo dev (no new toolchain/state); **Terraform** is the stronger choice (`plan` = drift detection) if you accept the dependency. State in the existing private Mumbai S3 bucket.
- The Lambda **source** lives in the repo (`infra/aws/lambda/*`), bundled with esbuild/`archive_file`. Pre‑token role = `AWSLambdaBasicExecutionRole` only; challenge Lambdas need outbound to the API + the HMAC secret. Pin the pool to Lambda **versions/aliases**.

---

## 14. Open items and build backlog

**Decisions to record** (`python3 docs/tools/new_decision.py`): pool topology (§1.1) · DLT SMS provider (§1.3, **has external lead time — start now**) · provisioning via additive adapter method + the `@aws-sdk` dependency category (§1.4, §6) · staff recovery channel (§1.5) · sign‑in broker as new API surface (§1.6) · IaC tool (§13) · break‑glass staff sign‑in (§9) · (if two pools) the adapter `{issuer, client_id}`‑set change.

**Build tasks, roughly in order:** `infra/aws/` module + 4 Lambdas (§13, §3, §5) → `SmsAdapter` + OTP broker + `/auth/otp/*` + `/_internal/auth/otp/*` (§5) → `identity.provisionUser` wired into the invite/remove/reinvite lifecycle + admin‑cred zone (§6, §10) → Amplify integration + the identity `/activate` screen + migration off dev‑login (§7) → cutover backfill + live contract test (§9, §11) → CloudWatch alarms (§12).

**Interim note.** Until all of the above lands, keep `IDENTITY_PROVIDER=local` (dev‑login) in development and **do not** flip staging/production — a half‑migrated flip locks out every `identity_subject = NULL` user (§9).

---

### Appendix — the exact claims the API checks

The adapter ([`cognito.adapter.ts`](../../apps/api/src/identity/cognito.adapter.ts)) accepts a token **iff**: signature verifies (RS256) against the pool JWKS · `iss` = `https://cognito-idp.ap-south-1.amazonaws.com/<USER_POOL_ID>` · `token_use` = `access` · `client_id` = `COGNITO_CLIENT_ID` · non‑empty `sub`, `jti` · numeric `exp`. It surfaces `email`/`phone` only with their `*_verified` flag truthy (`true` or `"true"`). Everything else about the caller comes from the API's own `users` table. Change any of these and you change a tested contract — do it with a decision record, never silently.
