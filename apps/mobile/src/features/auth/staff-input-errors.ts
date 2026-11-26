/**
 * What each step says when the API refuses the body itself ("Validation failed" on its own told no one
 * what to fix): the work email (alone on the forgotten-password screen), the email and password, the
 * authenticator code, a recovery code.
 */
export const STAFF_INPUT_ERRORS = {
  email: "Enter your full work email, such as name@ampmverse.com.",
  credentials: "Enter your full work email, such as name@ampmverse.com, and your password.",
  code: "Enter the 6-digit code from your authenticator app.",
  recoveryCode: "Enter a recovery code such as ABCDE-23456.",
} as const;
