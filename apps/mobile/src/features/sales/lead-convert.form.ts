import { coupleTitle, type LeadConvertRequest } from "@ampm/core";

/*
 * Pure form logic for the Convert card (TW-11): the lead's email becomes the primary contact, and the
 * couple's names, when Sales knows them, go with it so the new client is named after the couple (D-158).
 */

export interface ConvertCoupleDraft {
  readonly brideName: string;
  readonly groomName: string;
}

export const EMPTY_COUPLE: ConvertCoupleDraft = { brideName: "", groomName: "" };

/**
 * The convert body: the contact's email (a decision maker), plus each of the couple's names that was
 * typed; an empty box is left out.
 *
 * @example
 * buildConvertRequest("a@example.com", { brideName: "Priya", groomName: "" });
 * // { primaryContact: { email: "a@example.com", isDecisionMaker: true }, brideName: "Priya" }
 */
export function buildConvertRequest(email: string, couple: ConvertCoupleDraft): LeadConvertRequest {
  const brideName = couple.brideName.trim();
  const groomName = couple.groomName.trim();
  return {
    primaryContact: { email, isDecisionMaker: true },
    ...(brideName === "" ? {} : { brideName }),
    ...(groomName === "" ? {} : { groomName }),
  };
}

/** What the card says under the names: the name the client will take, or why the names help. */
export function convertCoupleHint(couple: ConvertCoupleDraft): string {
  const title = coupleTitle(couple);
  return title === null
    ? "Optional. With both names, the client is named after the couple."
    : `The client will be named ${title}.`;
}
