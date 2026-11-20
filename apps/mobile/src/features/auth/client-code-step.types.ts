/**
 * The code that was sent: how long it lives, how long until another may be asked for, and, when there
 * is one to show, the code itself. Production's `ClientCodeSent` (D-147) is one as it comes.
 */
export interface SentCode {
  readonly expiresInSeconds: number;
  /** 0 when another code may be asked for at once (the dev demo). */
  readonly resendAfterSeconds: number;
  /** Shown on screen with "Use this code": the dev demo's code, or production's while SMS is not live. */
  readonly screenCode?: string | undefined;
}

/** How the code reached the person: by SMS (AMPM's own sign-in), or only on screen (the dev demo). */
export type CodeDelivery = "sms" | "screen";

/**
 * What the code step needs from whoever drives it: the dev demo's `useClientAccess`, the client
 * sign-in's `useAmpmClientSignIn` and the client activation's `useAmpmClientActivation`.
 */
export interface CodeStep {
  /** The digits typed so far. */
  readonly code: string;
  readonly setCode: (value: string) => void;
  /** Exchanges a full code for a session; a short code is ignored. */
  readonly confirm: (code: string) => void;
  /** Asks for a fresh code for the same number. */
  readonly resend: () => void;
  /** Back to the mobile form, keeping the number; activation has none (the number is on file). */
  readonly change?: (() => void) | undefined;
  readonly verifying: boolean;
  /** A request for a code is on its way. */
  readonly sending: boolean;
  /** Why the code was refused (wrong, expired), under the boxes. */
  readonly codeError: string | undefined;
  /** Why a fresh code was refused (too soon, too many, offline), under "Send a new code". */
  readonly sendError?: string | undefined;
}
