import { z } from "zod";

import { userStatus } from "./staff-users.js";
import { uuid } from "./common.js";
import { indianPhone } from "./leads.js";

/*
 * Contracts for invitation activation (Module A, sprint-4 feature 5.2). A user AMPM invited presents
 * their invite token together with a verified provider access token; the API links the identity
 * subject and activates them (D-041, "link on activate"). No self-registration (A-13).
 */

/** Activate an invited account. The invite token is in the body; the provider access token is the Bearer. */
export const activateRequest = z.object({
  token: z.string().min(1),
});
export type ActivateRequest = z.infer<typeof activateRequest>;

/** The result of activation: the now-active user. */
export const activateResponse = z.object({
  userId: uuid,
  status: userStatus,
});
export type ActivateResponse = z.infer<typeof activateResponse>;

/*
 * Development sign-in (feature TW-11 demo). A seeded, active staff user's email is exchanged for a
 * minted local access token. Dev-only: the API refuses it unless IDENTITY_PROVIDER=local and NODE_ENV
 * is not production (env.ts), so there is no production path. Not self-registration (A-13) — it only
 * mints a token for an account that already exists and is active.
 */

/** Ask for a local dev access token by the staff account's email. */
export const devLoginRequest = z.object({
  email: z.string().email(),
});
export type DevLoginRequest = z.infer<typeof devLoginRequest>;

/** A minted local access token and the signed-in staff account it belongs to. */
export const devLoginResponse = z.object({
  accessToken: z.string().min(1),
  user: z.object({
    id: uuid,
    name: z.string().min(1),
    email: z.string().email(),
  }),
});
export type DevLoginResponse = z.infer<typeof devLoginResponse>;

/*
 * Dev-only OTP sign-in — the demo stand-in until the real SMS/OTP provider is wired (SMS/OTP audit,
 * docs/engineering/sms-otp-provider-audit.md). A seeded, active client's mobile is exchanged for a
 * one-time code the API stores briefly AND returns, so the demo screen can show it (there is no SMS
 * yet). Dev-only, the same gate as dev-login: refused unless IDENTITY_PROVIDER=local and NODE_ENV is
 * not production, so a code is never generated or returned in production. Not self-registration (A-13).
 */

/** Request a demo OTP for a mobile number (normalised to E.164 with a +91 default). */
export const devOtpSendRequest = z.object({
  phone: indianPhone,
});
export type DevOtpSendRequest = z.infer<typeof devOtpSendRequest>;

/**
 * The demo code to show on screen and how long it stays valid. The code is returned ONLY by the
 * dev-gated endpoint; the real SMS flow returns no code.
 */
export const devOtpSendResponse = z.object({
  demoCode: z.string().regex(/^\d{6}$/),
  expiresInSeconds: z.number().int().positive(),
});
export type DevOtpSendResponse = z.infer<typeof devOtpSendResponse>;

/** Verify a demo OTP for a mobile number; the result is the same minted session as dev-login. */
export const devOtpVerifyRequest = z.object({
  phone: indianPhone,
  code: z.string().regex(/^\d{6}$/),
});
export type DevOtpVerifyRequest = z.infer<typeof devOtpVerifyRequest>;
