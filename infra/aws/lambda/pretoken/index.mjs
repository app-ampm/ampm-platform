// infra/aws/lambda/pretoken/index.mjs  (handler = index.handler, runtime nodejs22.x)
// Pre-Token-Generation trigger, version V2_0 (access-token customization). Mirrors the pool-VERIFIED
// email/phone onto the ACCESS token so POST /auth/activate (D-041, activation.service.ts) can match the
// invited email. Fires on auth AND refresh (TokenGeneration_RefreshTokens). *_verified arrive as the
// STRING "true". Deployed to the AMPM pool ap-south-1_wcaro5oAK (10 Nov 2026); see docs/engineering/cognito-setup.md §3.
const isVerified = (v) => v === true || v === "true"; // mirrors cognito.adapter.ts isVerified()

export const handler = async (event) => {
  const a = event?.request?.userAttributes ?? {};
  const add = {};
  // Inject contact + its verified flag together, and ONLY when verified. An unverified contact is
  // omitted entirely -> the adapter resolves it to null -> activation fails closed (never trusts it).
  if (typeof a.email === "string" && a.email.length > 0 && isVerified(a.email_verified)) {
    add.email = a.email;
    add.email_verified = "true";
  }
  if (
    typeof a.phone_number === "string" &&
    a.phone_number.length > 0 &&
    isVerified(a.phone_number_verified)
  ) {
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
