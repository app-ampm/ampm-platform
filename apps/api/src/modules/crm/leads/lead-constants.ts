/**
 * Lead-capture constants shared across the CRM services, so a value that must stay identical lives in
 * one place (code.md reuse-first).
 *
 * `PRIVACY_NOTICE_VERSION` is the privacy-notice version recorded with marketing consent (AC-27.1); it
 * becomes a `configurations` value once AMPM confirms the consent wording and retention policy (Q17).
 */
import type { LeadStatus } from "@ampm/core";

export const PRIVACY_NOTICE_VERSION = "2026-10";

/** The default lead source for a public enquiry when no campaign source is supplied. */
export const DEFAULT_SOURCE_KEY = "website";

/** Statuses a lead no longer moves through; reminders and the view treat them as done. */
export const CLOSED_LEAD_STATUSES: readonly LeadStatus[] = ["closed", "converted"];
