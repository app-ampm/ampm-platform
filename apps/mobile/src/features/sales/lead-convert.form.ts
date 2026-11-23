import { coupleTitle, type LeadConvertRequest } from "@ampm/core";

import type { CoupleDraft } from "@/components/couple-fields";

/*
 * Pure form logic for the Convert card (TW-11): the lead's email becomes the primary contact, and the
 * couple (bride and groom with their fathers), when Sales knows them, goes with it; both names name the
 * new client after the couple (D-158).
 */

export type ConvertCoupleDraft = CoupleDraft;

export const EMPTY_COUPLE: ConvertCoupleDraft = {
  brideName: "",
  brideFatherName: "",
  groomName: "",
  groomFatherName: "",
};

const COUPLE_FIELDS: readonly (keyof ConvertCoupleDraft)[] = [
  "brideName",
  "brideFatherName",
  "groomName",
  "groomFatherName",
];

/**
 * The convert body: the contact's email (a decision maker), plus each of the couple's names that was
 * typed, trimmed; an empty box is left out.
 *
 * @example
 * buildConvertRequest("a@example.com", { ...EMPTY_COUPLE, brideName: "Priya" });
 * // { primaryContact: { email: "a@example.com", isDecisionMaker: true }, brideName: "Priya" }
 */
export function buildConvertRequest(email: string, couple: ConvertCoupleDraft): LeadConvertRequest {
  const body: LeadConvertRequest = { primaryContact: { email, isDecisionMaker: true } };
  for (const field of COUPLE_FIELDS) {
    const value = couple[field].trim();
    if (value !== "") body[field] = value;
  }
  return body;
}

/** What the card says under the names: the name the client will take, or why the names help. */
export function convertCoupleHint(couple: ConvertCoupleDraft): string {
  const title = coupleTitle(couple);
  return title === null
    ? "Optional. With both names, the client is named after the couple."
    : `The client will be named ${title}.`;
}
