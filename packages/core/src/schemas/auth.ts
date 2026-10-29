import { z } from "zod";

import { userStatus } from "./staff-users.js";
import { uuid } from "./common.js";

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
