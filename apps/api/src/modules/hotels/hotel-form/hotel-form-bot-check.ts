import { errors, HOTEL_FORM_ERRORS, type AppError } from "@ampm/core";

import type {
  BotCheckAdapter,
  BotCheckOptions,
} from "../../../common/bot-check/bot-check.adapter.js";

/*
 * The hotel form's bot check (D-189 §3 and §7, D-190 §3), through the shared adapter: a Turnstile pass
 * must have been solved on the site's own host for the action its widget was drawn with (`hf_code` for a
 * code, `hf_submit` for a submit, `hf_correction` for a correction), and a missing, used or misplaced one
 * is a 400 on `botToken`.
 */

/**
 * What a hotel form pass must show: the host of the site's origin (PUBLIC_SITE_URL) and `action`.
 *
 * @example
 * await botCheck.verify(body.botToken, hotelFormBotOptions(env.PUBLIC_SITE_URL, ip, "hf_submit"));
 */
export function hotelFormBotOptions(
  siteUrl: string,
  ip: string | null,
  action: string,
): BotCheckOptions {
  return {
    remoteIp: ip ?? undefined,
    expectedHostnames: [new URL(siteUrl).hostname],
    expectedAction: action,
  };
}

/** The 400 on `botToken` a missing, used or misplaced pass is refused with. */
export function hotelFormBotRefusal(): AppError {
  const detail = { path: "botToken", message: HOTEL_FORM_ERRORS.botCheck };
  return errors.validation([detail], HOTEL_FORM_ERRORS.botCheck);
}

/**
 * Whether a hotel form pass is good for `action`; never throws (a provider failure is false).
 *
 * @example
 * const human = await hotelFormBotPasses(botCheck, env.PUBLIC_SITE_URL, body.botToken, ip, "hf_submit");
 */
export function hotelFormBotPasses(
  botCheck: BotCheckAdapter,
  siteUrl: string,
  token: string | undefined,
  ip: string | null,
  action: string,
): Promise<boolean> {
  return botCheck.verify(token, hotelFormBotOptions(siteUrl, ip, action));
}
