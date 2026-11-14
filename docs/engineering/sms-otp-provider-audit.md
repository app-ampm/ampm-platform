# Audit — free & low-cost SMS services for client login (OTP)

_Audited 13 November 2026. Feeds open question **Q11 / R15** (channels and providers) and the client-OTP
launch dependency recorded in [[D-041]] / `cognito-setup.md`. Prices are indicative, vendor-quoted and move
often — treat every figure as "verify against the live rate card", and add 18% GST to all Indian rates._

> **Decision — 13 November 2026:** Phase 1 is **SMS-only**; WhatsApp is **deferred** to a later slice (this
> supersedes the WhatsApp-first channel order in §4/§7 for now). With WhatsApp deferred, MSG91's multi-channel
> edge is moot, so the phase-1 SMS vendor is **2Factor.in** — cheapest (₹0.12) + **free DLT onboarding** — and
> `api.md`'s one-adapter-per-provider rule keeps a later WhatsApp vendor a clean, separate add. **DLT
> registration starts now** (§6 — the 2–4 week long pole); code proceeds on the sandbox adapter at ₹0.
> _Formal D-record to be cut from the main checkout._

## At a glance — the pick-from table

Per-SMS = one delivered transactional OTP to an Indian number, **+18% GST**, indicative (verify live rate cards).
"Free to start" is a **one-time** credit unless noted. 🟢 recommended · 🟡 usable · 🔴 avoid for AMPM.

| # | Service | What's free | Per-SMS after free | Key extra features | Call |
| --- | --- | --- | --- | --- | --- |
| 1 | **MSG91** | Trial credits + startup-India perk | **~₹0.15** | SMS **+ WhatsApp + email + voice + OTP widget** in one vendor/dashboard; good REST + SDKs; DLT support | 🟢 **Lead pick** — one vendor behind our adapter |
| 2 | **2Factor.in** | Free test credits **+ free DLT onboarding** | **from ₹0.12** (cheapest) | SMS + WhatsApp + voice OTP; managed-OTP option; dead-simple REST; hands you through DLT | 🟢 **Fallback** — cheapest SMS + DLT help |
| 3 | WhatsApp auth _(channel, via MSG91/2Factor/Gupshup)_ | None | **~₹0.115** | Richer UX, template-based; **WABA must be India-based** (else ~22× cross-border) | 🟢 Use as **primary channel → SMS fallback** |
| 4 | **Local sandbox adapter** _(not a vendor)_ | **Unlimited ₹0** | n/a (dev/CI only) | Logs/returns a fixed OTP; no vendor, no DLT; the CI contract-test double | 🟢 **Build the whole flow on this now** |
| 5 | Fast2SMS | **₹50** signup credit | ₹0.35 OTP route (↓ at high top-up) | Simplest REST + wallet; DLT route + a no-DLT "quick" route (₹5) | 🟡 Easiest start, higher OTP rate |
| 6 | Gupshup | Trial | ~₹0.17 | Top-tier WhatsApp BSP, RCS, chatbot/conversational; DLT | 🟡 If WhatsApp-heavy; heavier onboarding |
| 7 | Kaleyra / Tanla | Trial | ~₹0.18 | Enterprise CPaaS, high deliverability, SMS/WhatsApp/voice | 🟡 Overkill at our scale |
| 8 | Message Central (VerifyNow) | **₹500** credits | ₹0.12–0.30 | Managed Verify API; markets a **"no-DLT" international route** | 🔴 Avoid the no-DLT route (compliance/deliverability) |
| 9 | Plivo Verify | Trial | ~₹0.46 ($0.0055) | Global CPaaS, good SDKs, Verify product; **USD-billed**; needs DLT | 🟡 Dearer than local aggregators |
| 10 | Twilio Verify | ~$15 (~₹1,250) credit | ~₹0.45 (3×, **USD**) | Best-in-class DX/SDKs; Verify (SMS/WhatsApp/email/TOTP); needs DLT | 🔴 Best DX, worst India price |
| 11 | **AWS SNS / End User Messaging** | **None for India** (100/mo free is **US-only**) | ₹0.25–0.42 local DLT route · **₹5.8** intl ILDO (**USD**) | Native AWS, Mumbai region; sandbox; **same DLT burden**, no feature win for `CUSTOM_AUTH` | 🔴 Excluded (guardrail; pricier than aggregators) — §8 |
| 12 | Firebase Phone Auth | **10 SMS/day** free | ~₹5/verification | Client-SDK managed phone auth — but it's a **competing IdP**, not a send-API | 🔴 Excluded (breaks the Cognito design) |

_Separate line item, not SMS:_ **Amazon Cognito** auth itself is **free ≤10,000 MAU** (Essentials), then $0.015/MAU
— that's the "₹0 under 10k users" lever (§8), independent of whichever SMS provider sends the code.

**Which is actually free?** For **production SMS in India, none** — DLT + carrier cost make every delivered OTP
cost money. Genuinely ₹0 is only: the **sandbox adapter** (rows 4 — unlimited, for the whole build), **one-time
trial credits** (rows 1, 2, 5, 8, 10), Firebase's 10/day (row 12, wrong architecture), and **Cognito's 10k-MAU
auth tier** (not SMS).

**Recommendation:** build now on the **sandbox adapter** (₹0); for production go **WhatsApp-first (~₹0.115) →
SMS fallback** with **MSG91** (🟢 one vendor for both channels behind our adapter) and **2Factor** documented as
the contained fallback. Start **DLT registration this sprint** — it's the 2–4 week long pole (§6), not the code.

## What we actually need (the shape of the requirement)

Clients sign in with **mobile number + one-time code**. Per the Cognito design this runs as **`CUSTOM_AUTH`**,
not Cognito's managed `USER_AUTH` SMS, and **not** Amazon SNS/Cognito SMS (excluded by the AWS cost guardrail).
So the SMS provider's only job in the login path is: **a `CreateAuthChallenge` Lambda makes one HTTPS call to
send a templated OTP message.** AMPM generates and verifies the code itself; the provider is a dumb pipe.

That constrains the search to providers that are:

1. **India DLT-registered** (TRAI mandate for transactional/OTP SMS to Indian numbers). This is a **2–4 week,
   launch-blocking** dependency — see §6.
2. Reachable by a **plain REST "send SMS" call** from a Node Lambda (no heavy SDK; adapter-wrappable per
   `.claude/rules/api.md`: _one adapter interface per provider, one impl, a sandbox config, a contract test in CI;
   business logic never imports a provider SDK_).
3. Able to send with **our own DLT sender-ID + template** (templates live as `configurations` rows, not code).
4. Ideally the **same vendor can also do WhatsApp**, since the `notification` channel enum
   (`in_app | email | whatsapp | sms | push`) and the assumed design use **WhatsApp-primary + SMS-fallback**.

## 1. The headline: there is no free *production* SMS-OTP in India

Every source agrees. DLT compliance plus per-message carrier charges mean a real OTP delivered to an Indian
handset **always costs money** (~₹0.10–0.45 + GST). Anything advertised as "free SMS" is one of:

- a **one-time signup credit** (₹50–₹500) that expires, or
- a **demo/sandbox** that doesn't deliver a real message, or
- a **grey "no-DLT" international route** — non-compliant, poor deliverability, blocked to DND numbers. Avoid.

So "free" splits cleanly into two honest buckets:

| Bucket | Cost | What it covers |
| --- | --- | --- |
| **Build + staging** | **₹0, genuinely** | Local **sandbox adapter** (logs/returns a fixed OTP, no provider, no DLT) for all dev + CI, then a provider's **free trial credits** for staging smoke tests. |
| **Production** | **not ₹0** | A DLT-registered aggregator at ~₹0.12–0.17/OTP, or WhatsApp-auth at ~₹0.115. Small at our volume (see §5). |

**Guardrail note — no contradiction, but be explicit:** the "keep ₹0 under 10k users" rule is about
**Cognito/AWS** (Cognito Essentials is free under 10k MAU, and we are *not* using SNS SMS). The SMS channel is a
**separate external vendor cost** that the guardrail does not cover and cannot make ₹0 in production. The whole
*build* stays ₹0 via the sandbox adapter; real spend begins only at production cutover.

## 2. The genuinely-free path for the build (recommended now)

1. **Local/CI: a sandbox SMS adapter.** Mirror the existing `LocalIdentityAdapter` pattern — an
   `SmsSender` port whose local impl writes the OTP to the logger (or returns a fixed `000000` in test) and
   sends nothing. Zero cost, zero DLT, and it's the CI contract-test double the rules already require. The whole
   `CUSTOM_AUTH` flow + client sign-in UI can be built and tested against this at ₹0.
2. **Staging: free trial credits.** Point the real adapter at one provider's trial balance to prove end-to-end
   delivery to a handful of test handsets. No production spend.
3. **Production: flip the adapter to the chosen paid provider.** One config change; business logic untouched.

This is the only "free" that scales through the entire build phase, and it's the architecturally correct double
anyway.

## 3. Provider comparison (India, DLT-capable)

Per-OTP = one delivered transactional SMS, **+18% GST**, indicative. "Free to start" = one-time, not recurring.

| Provider | Free to start | ~Per-OTP SMS | WhatsApp too? | Node/REST fit | Verdict for AMPM |
| --- | --- | --- | --- | --- | --- |
| **2Factor.in** | Free test credits + **free DLT onboarding** (scrubbing, template, sender-ID) | **from ₹0.12** | Yes | Simple REST | **Top pick for SMS** — lowest headline rate, hand-holds the DLT registration we must do anyway |
| **MSG91** | Trial credits; startup-India perk | ~₹0.15 | **Yes** (+ email) | Clean REST + helper SDKs | **Top pick if consolidating channels** — SMS + WhatsApp + email under one adapter/vendor |
| **Gupshup** | Trial | ~₹0.17 | Yes (large BSP) | REST | Strong WhatsApp BSP; fine SMS; heavier onboarding |
| **Kaleyra / Tanla** | Trial | ~₹0.18 | Yes | REST | Enterprise-grade; overkill at our volume |
| **Fast2SMS** | **₹50** signup credit | official **₹0.35** OTP route (less at high top-up) | Yes | Very simple REST | Easiest to start; headline OTP rate higher than 2Factor/MSG91 |
| **Message Central (VerifyNow)** | ₹500 credits | ₹0.12–0.30 | Yes | REST/Verify API | Markets a **"no-DLT" international route** — compliance/deliverability risk; avoid that route |
| **Plivo Verify** | Trial | ~$0.0055 (~₹0.46) | — | Good REST/SDK | Priced in USD; dearer than local aggregators |
| **Twilio Verify** | ~$15 trial credit | ~₹0.45 (3× local), **USD-billed**, still needs DLT | Yes | Excellent SDK | Best DX, worst India price — **not recommended** |
| **Firebase Phone Auth** | **10 SMS/day free**, then ~₹5/verification (India) | ~₹5 | — | Client SDK, **not** a send API | **Architecturally wrong** — it's a competing IdP to Cognito, can't drive `CUSTOM_AUTH`, and pricey |
| **AWS SNS / Cognito SMS** | No India free tier | pay-per-SMS | — | SDK | **Excluded by guardrail** (and the design) |

## 4. The cheaper channel: WhatsApp-auth first, SMS fallback

Meta's **authentication** template rate for India is **~₹0.115/delivered message** (Jan 2026) — marginally below
the cheapest SMS and with richer UX. It has **no free tier** either, and there's one real trap: **cross-border is
billed ~22×** ($0.0304), so the WhatsApp Business Account **must be India-based**. MSG91 / Gupshup / 2Factor all
do WhatsApp *and* SMS, so a single adapter-backed vendor can serve **WhatsApp-primary → SMS-fallback** — which is
both the cheapest blend and the design already assumed.

## 5. What this costs us in practice

At low early volume the "non-free" production cost is negligible. Rough monthly, OTP only:

- 1,000 client logins/mo × ₹0.12 SMS ≈ **₹120** (+GST); via WhatsApp ≈ **₹115**.
- 5,000 logins/mo ≈ **₹600** SMS / **₹575** WhatsApp.

The real fixed cost is **DLT**, not the messages (§6).

## 6. DLT registration — the actual launch dependency

Mandatory for any compliant Indian SMS, independent of provider:

- **Entity (PE) registration** on a DLT portal: ~**₹5,000–₹10,000/year** (one-time + annual).
- **Header (sender-ID)** approval + **per-template** approval for the OTP message.
- **Lead time 2–4 weeks.** Start it now; it gates client go-live regardless of which vendor we pick.
- **2Factor's free DLT onboarding** is worth real money here — it's why it leads §3 even though MSG91 is close on
  price.

## 7. Recommendation

1. **Now, ₹0:** build the `CUSTOM_AUTH` flow against a **local sandbox `SmsSender` adapter** (§2). No vendor
   decision blocks the build.
2. **Start DLT registration this sprint** (§6) — it's the long pole, not the code.
3. **Primary production provider — pick on consolidation:**
   - **MSG91** if we want **WhatsApp + SMS (+ email) under one vendor/adapter** — best fit for the multi-channel
     `notification` design.
   - **2Factor.in** if we optimise purely for **cheapest SMS + free DLT help** and keep WhatsApp with a separate
     BSP.
   Both are cheap, DLT-registered, REST-simple, India-supported. Default lean: **MSG91** (fewer vendors behind one
   adapter), with **2Factor as the documented fallback** (the `api.md` "swap is contained" clause makes this safe).
4. **Channel order:** **WhatsApp-auth primary (~₹0.115) → SMS fallback (~₹0.12–0.15)**; WABA must be India-based.
5. **Avoid:** Twilio (3× price, USD), Firebase Phone Auth (competing IdP, breaks the Cognito design), Cognito/SNS
   SMS (guardrail), and any "no-DLT" international route (compliance/deliverability).

### Build-rule reminders when we wire it

- One `SmsSender` adapter interface, one impl, **sandbox config for dev/staging, contract test in CI**
  (`api.md`). Lambda calls the adapter, never the vendor SDK directly.
- DLT **sender-ID + template** are `configurations` rows, not code.
- **Rate-limit OTP** per-IP and per-principal (`security.md`); never log the code or the phone number.

## 8. AWS-native path priced out — Cognito + SNS vs other free tiers

_Follow-up audit, 13 November 2026. Puts real numbers on the Cognito/SNS option §3 excluded, and confirms the
exclusion. All AWS figures are USD-billed and indicative — verify the India row of the AWS pricing CSV._

**"Cognito/SNS" is two different services with two different cost stories — don't conflate them:**

- **Amazon Cognito** = the auth directory. **Has a real free tier we rely on** (§8.1).
- **Amazon SNS / AWS End User Messaging** = the SMS pipe. **Has no India free tier, and we don't use it** (§8.2).

The guardrail maps exactly onto this split: _keep Cognito auth free (≤10k MAU) **and** never turn on Cognito/SNS
SMS._ Both halves are the right call — §8.3.

### 8.1 Cognito — the auth free tier (this we use)

| Tier | Free MAU | Then | Notes |
| --- | --- | --- | --- |
| **Essentials** — our tier, new-pool default | **10,000** | **$0.015/MAU** (~₹1.25) | Required for the pre-token V2 fix; Lite can't do it |
| Lite | 10,000 | $0.0055/MAU | Pools created ≤22 Nov 2024 keep **50,000** free |
| Plus | 0 | $0.020/MAU | Not needed |

Cognito auth is therefore **₹0 for every client under 10,000 MAU** — precisely the "keep ₹0 under 10k users"
guardrail. Federated SAML/OIDC is metered separately (50 MAU free) — irrelevant, clients sign in directly.

**Context — other auth free tiers (2026, MAU). The IdP is already locked to Cognito/Mumbai; this is only to show
where Cognito sits:**

| Provider | Free MAU | Catch |
| --- | --- | --- |
| Supabase Auth | 50,000 | — |
| Firebase / Google Identity Platform | 50,000 | phone **SMS billed separately** (~₹5, §3) |
| Clerk | 50,000 | counts **MRU** (narrower unit); $25/mo base after |
| Auth0 | 25,000 | **no MFA on the free tier** |
| **Cognito Essentials** | **10,000** | smallest free MAU — but **ap-south-1 data residency**, verify-only seam, already built & live-tested |

Cognito's free MAU is the **smallest** of the majors, but the lock-in was for **data residency**, the verify-only
API seam and the fact it's already integrated — not for free-tier size. Under 10k clients every option here is ₹0.

### 8.2 SNS / End User Messaging — the SMS pipe (this we avoid)

AWS SMS sending has moved from SNS to **AWS End User Messaging** (ex-Pinpoint SMS). For India:

- **No free tier for India.** The permanent free SMS allowance is **100/month to US numbers only**; India gets
  **zero** free SMS. (The SNS free tier — 1M API requests, 1M push, etc. — is for other channels, not SMS.)
- **Still requires DLT** — register use case + templates on a DLT portal, exactly like any aggregator. Since
  **30 Apr 2025**, India local routes run only through **ap-south-1 / ap-south-2**.
- **Per-message to India (approximate — verify the CSV):**
  - **Local DLT route:** ~**$0.003–0.005 (~₹0.25–0.42)** per SMS.
  - **International ILDO route** (the default if you skip DLT): _"significantly higher"_, ~**$0.069 (~₹5.8)** — a trap.
  - **USD-billed**; a **sandbox** (verified numbers only) until you request production access; default spend cap
    $1/account.

### 8.3 Verdict — exclusion confirmed by the numbers

Even on its **best** (local DLT) route, AWS SMS to India runs **~1.5–3× a local aggregator** (2Factor ₹0.12 /
MSG91 ₹0.15), with the **same DLT burden**, **no India free tier**, **USD billing** and **sandbox friction** — and
**no feature win**, because `CUSTOM_AUTH` only needs a plain "send" call. So the §3/§7 call holds: **Cognito stays
as the free-under-10k auth directory; the OTP SMS goes out through an aggregator behind our adapter, not SNS.**

## 9. Implementation status — SMS adapter scaffolded (14 Nov 2026)

The ₹0, unblocked half is built on branch `claude/free-sms-services-audit-71d066` (API-internal; **not merged,
not wired live**):

- **`GatewaySmsAdapter`** (`apps/api/src/modules/admin/notification/gateway-sms.adapter.ts`) — the live SMS
  sender, behind the **existing** `NotificationAdapter` seam (reuse-first — no parallel port was created),
  mirroring `SmtpEmailAdapter`. Sends via an injected `SmsTransport`; logs channel/template/ref only (never the
  number or the OTP); sanitises provider errors to a non-PII code.
- **`SmsTransport`** — the vendor-neutral seam the live HTTP client plugs into, so a 2Factor → MSG91 swap is a
  transport change, not an adapter change.
- **Sandbox already works:** the `sms` channel is served today by `ConsoleNotificationAdapter` (logs, no send,
  no DLT); a test now pins that.
- **Tests:** an offline contract test (fake transport, ₹0) covers the request shape, error sanitisation, the
  no-address guard (`null` **and** empty), and **no PII/OTP in logs**. Shared `providerErrorCode` /
  `AdapterLogger` were extracted so the email and SMS adapters don't duplicate them (code.md reuse-first).
- **Gates:** typecheck, ESLint, Prettier and all 454 api unit tests green. (The e2e suite needs a local
  `DATABASE_URL_TEST`; it can't run in this worktree and is unrelated to this change.)

**To turn it on — needs the 2Factor account + DLT (the long pole):**
1. Create the 2Factor account; register the DLT entity + OTP template + sender ID (2Factor onboards this free).
2. Implement `smsGatewayTransport(env)` — the live `SmsTransport` (a `fetch` client for 2Factor's transactional
   endpoint); keys from the SOPS app zone, never code.
3. Add `SMS_PROVIDER` (`console` | `gateway`) + `SMS_GATEWAY_*` to `apps/api/src/env.ts` with a `superRefine`
   guard (require the keys when `gateway`; refuse `console` in production once client OTP is live — the C1 pattern).
4. Wire `buildAdapters` in `notification.module.ts`: `sms` → `GatewaySmsAdapter(smsGatewayTransport(env), …)`
   when `SMS_PROVIDER=gateway`, else the console stub.
5. Rate-limit OTP sends per-IP and per-principal (security.md).
6. The client-OTP broker (Cognito `CUSTOM_AUTH` Lambdas → AMPM API → this adapter) is still an **unratified API
   surface** — settle that next.

## Sources

**AWS pricing (follow-up §8):** [Amazon Cognito pricing](https://aws.amazon.com/cognito/pricing/),
[Amazon SNS SMS pricing](https://aws.amazon.com/sns/sms-pricing/),
[AWS End User Messaging pricing](https://aws.amazon.com/end-user-messaging/pricing/),
[AWS — India local vs international routes](https://docs.aws.amazon.com/sms-voice/latest/userguide/registrations-sms-senderid-india-routes.html),
[Frontegg — Cognito pricing 2026](https://frontegg.com/guides/aws-cognito-pricing),
[Kinde — auth providers 2026](https://kinde.com/comparisons/top-authentication-providers-2026/).

Vendor and comparison pages (indicative, verify live): [Message Central — SMS OTP pricing India](https://www.messagecentral.com/en-in/blog/sms-otp-pricing-india),
[SignOps — SMS OTP cost & DLT](https://signops.dev/blog/sms-otp-cost-india/),
[2Factor.in](https://2factor.in/v4/index.html),
[Fast2SMS OTP](https://www.fast2sms.com/otp) · [Fast2SMS pricing](https://fast2sms.com/pricing),
[MSG91 deductions/DLT](https://msg91.com/help/all-service-deductions-),
[QuickAuth — WhatsApp vs SMS OTP cost](https://quickauth.in/blog/otp-cost-india),
[Authgear — WhatsApp API pricing 2026](https://www.authgear.com/post/whatsapp-api-pricing/),
[Google Identity Platform pricing](https://cloud.google.com/identity-platform/pricing),
[Plivo Verify pricing](https://www.plivo.com/verify-pricing),
[CallerDesk — top OTP providers India](https://callerdesk.io/blog/top-7-otp-service-providers-in-india/).
