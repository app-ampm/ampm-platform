import { z } from "zod";

import { uuid } from "./common.js";
import { indianPhone } from "./leads.js";

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
 * The second step after a correct password: a short-lived, single-use challenge for the authenticator
 * code. An account without a confirmed authenticator never gets this far: it activates from an
 * invitation, which sets both (D-142).
 */
export const signInResponse = z.object({ kind: z.literal("totp"), challenge: z.string().min(1) });
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

/*
 * Client sign-in by a one-time code sent to the mobile AMPM has on file (D-147). There is no password and
 * no sign-up: an active client asks for a code and exchanges it for a session; an invited client
 * activates from the invitation link the same way. The code goes out by SMS. Until an SMS provider is
 * wired the API may also return it for the screen to show (`screenCode`). A number with no client gets
 * the same answer, without a code.
 */

/** Ask for a sign-in code by mobile (normalised to E.164, +91 for ten digits). */
export const clientCodeRequest = z.object({ phone: indianPhone });
export type ClientCodeRequest = z.infer<typeof clientCodeRequest>;

/**
 * A code is on its way: how long it lives, how long until another may be asked for, and, while SMS
 * delivery is not live yet, the code itself to show on screen.
 */
export const clientCodeSent = z.object({
  expiresInSeconds: z.number().int().positive(),
  resendAfterSeconds: z.number().int().nonnegative(),
  screenCode: totpCode.optional(),
});
export type ClientCodeSent = z.infer<typeof clientCodeSent>;

/** Exchange the mobile and its code for a session (answered with a `signInGrant`). */
export const clientSignInRequest = z.object({ phone: indianPhone, code: totpCode });
export type ClientSignInRequest = z.infer<typeof clientSignInRequest>;

/** An activation code was sent to the invited client's mobile, shown masked ("+91 ••••• •3210"). */
export const clientActivationCodeSent = clientCodeSent.extend({ maskedPhone: z.string().min(1) });
export type ClientActivationCodeSent = z.infer<typeof clientActivationCodeSent>;

/** Activate an invited client with the invitation and the code (answered with a `signInGrant`). */
export const clientActivationConfirmRequest = z.object({
  token: z.string().min(1),
  code: totpCode,
});
export type ClientActivationConfirmRequest = z.infer<typeof clientActivationConfirmRequest>;

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
  /** 400: a client invitation used on the staff (password) activation; clients activate by mobile code. */
  clientActivationUnavailable:
    "Client accounts are activated with a code sent to your mobile, not with a password.",
  /**
   * 401: every refusal of a client code (wrong, used, replaced, expired, out of tries, or a number with
   * no client) gets this one message, so the answer never tells which numbers have accounts (D-147).
   */
  invalidClientCode: "That code didn't work or has expired. Check it, or ask for a new one.",
  /** 503: the per-number limits cannot be counted, so no code is issued (failing closed, D-147). */
  clientCodesUnavailable:
    "Sign-in codes can't be sent right now. Please try again in a few minutes.",
  /** 409: another active client account already has this mobile, so codes could reach neither. */
  mobileInUse:
    "This mobile number is already used by another client account. Ask AMPM to correct it, then open this link again.",
  /** 429: another code was asked for too soon after the last one. */
  clientCodeTooSoon: "Please wait a few seconds before asking for another code.",
  /** 429: too many codes for this number in the last hour or day. */
  clientCodeLimit: "Too many codes for this number. Please try again later.",
  /** 409: an invited client account with no mobile on file cannot receive an activation code. */
  noMobileOnFile:
    "There's no mobile number on this account yet. Ask AMPM to add it, then open this link again.",
} as const;
