import { z } from "zod";

import { uuid } from "./common.js";

/*
 * AMPM's own staff sign-in (D-142): an email and password, then a six-digit authenticator code (TOTP,
 * R10). Activation from an invitation sets the password and enrols the authenticator in one flow, and a
 * forgotten password is reset through an emailed single-use link. No self-registration (A-13): every
 * flow starts from an account AMPM created.
 */

/** A new password: 12 to 128 characters (the 12-character policy staff already had). */
export const newPassword = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128, "Use at most 128 characters");

/** A six-digit code from the authenticator app. */
export const totpCode = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

/**
 * A single-use recovery code (shown once, at enrolment): ten base32 characters, written XXXXX-XXXXX.
 * Lower case and a missing dash are accepted; the API normalises before comparing.
 */
export const recoveryCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z2-7]{5}-?[A-Za-z2-7]{5}$/, "Enter a recovery code such as ABCDE-23456");

/** Sign in with an email and password; the answer always asks for the authenticator next. */
export const signInRequest = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});
export type SignInRequest = z.infer<typeof signInRequest>;

/** The authenticator to add: the secret for manual entry and the otpauth:// URI the QR code encodes. */
export const totpEnrolment = z.object({
  secret: z.string().min(16),
  otpauthUri: z.string().startsWith("otpauth://totp/"),
});
export type TotpEnrolment = z.infer<typeof totpEnrolment>;

/**
 * The second step after a correct password, with a short-lived single-use challenge: enter the code
 * (`totp`), or, when the authenticator was reset by an administrator, add one first (`enrol`).
 */
export const signInResponse = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("totp"), challenge: z.string().min(1) }),
  z.object({ kind: z.literal("enrol"), challenge: z.string().min(1), enrolment: totpEnrolment }),
]);
export type SignInResponse = z.infer<typeof signInResponse>;

/** Finish signing in with the authenticator code, or with one of the recovery codes instead. */
export const signInCodeRequest = z
  .object({
    challenge: z.string().min(1),
    code: totpCode.optional(),
    recoveryCode: recoveryCode.optional(),
  })
  .refine((body) => (body.code === undefined) !== (body.recoveryCode === undefined), {
    message: "Send either the authenticator code or a recovery code",
  });
export type SignInCodeRequest = z.infer<typeof signInCodeRequest>;

/** Confirm a newly added authenticator with its first code (the `enrol` step). */
export const signInEnrolRequest = z.object({
  challenge: z.string().min(1),
  code: totpCode,
});
export type SignInEnrolRequest = z.infer<typeof signInEnrolRequest>;

/** A signed-in session: the access token sent as the Bearer, and who it belongs to. */
export const signInGrant = z.object({
  accessToken: z.string().min(1),
  user: z.object({ id: uuid, name: z.string().min(1), email: z.string().email() }),
});
export type SignInGrant = z.infer<typeof signInGrant>;

/** A session that also set up an authenticator: the recovery codes, shown once and never again. */
export const enrolledGrant = signInGrant.extend({
  recoveryCodes: z.array(z.string()).length(10),
});
export type EnrolledGrant = z.infer<typeof enrolledGrant>;

/** An invitation link's token, to preview the invitation or to act on it. */
export const invitationTokenRequest = z.object({ token: z.string().min(1) });
export type InvitationTokenRequest = z.infer<typeof invitationTokenRequest>;

/** Who an invitation is for, so the activation screen can greet them before anything is set. */
export const invitationPreview = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  userType: z.enum(["staff", "client"]),
});
export type InvitationPreview = z.infer<typeof invitationPreview>;

/** Activation, step one: choose a password; the answer is the authenticator to add. */
export const activationPasswordRequest = z.object({
  token: z.string().min(1),
  password: newPassword,
});
export type ActivationPasswordRequest = z.infer<typeof activationPasswordRequest>;

export const activationPasswordResponse = z.object({ enrolment: totpEnrolment });
export type ActivationPasswordResponse = z.infer<typeof activationPasswordResponse>;

/** Activation, step two: confirm the authenticator with its first code; the account becomes active. */
export const activationConfirmRequest = z.object({ token: z.string().min(1), code: totpCode });
export type ActivationConfirmRequest = z.infer<typeof activationConfirmRequest>;

/** Ask for a password-reset email. The answer is the same whether or not the account exists. */
export const forgotPasswordRequest = z.object({ email: z.string().trim().email().max(255) });
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequest>;

/** Set a new password with the emailed single-use link's token. Every session is signed out. */
export const resetPasswordRequest = z.object({ token: z.string().min(1), password: newPassword });
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequest>;

/** An accepted request that returns nothing to show (forgot-password, reset, sign-out). */
export const acknowledged = z.object({ ok: z.literal(true) });
export type Acknowledged = z.infer<typeof acknowledged>;

/**
 * The refusals the sign-in screens show. The error envelope has a code and a message but no finer
 * reason, so the API raises these exact messages. One credentials message covers an unknown email, a
 * wrong password and a paused account alike, so the answer never reveals which accounts exist.
 */
export const SIGN_IN_ERRORS = {
  /** 401: unknown email, wrong password, an account that cannot sign in this way, or a lockout. */
  invalidCredentials:
    "Email or password is incorrect. After several failed attempts, sign-in pauses for 15 minutes.",
  /** 401: a wrong authenticator or recovery code. */
  invalidCode: "That code didn't work. Check your authenticator app and try again.",
  /** 401: the challenge is unknown, used, expired or out of attempts: start again from the password. */
  challengeExpired: "Your sign-in timed out. Please start again.",
  /** 401: an unknown, used or expired password-reset link. */
  invalidResetLink: "This reset link is invalid or has expired. Ask for a new one.",
  /** 400: client accounts sign in with a mobile code, which is not available yet. */
  clientActivationUnavailable:
    "Client accounts are activated with a code sent to your mobile, which is not available yet.",
} as const;
