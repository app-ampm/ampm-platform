import { z } from "zod";

import { cursorQuery, isoDateTime, page, uuid } from "./common.js";

/*
 * Contracts for lead capture (Module B CRM, feature 8.1): the public enquiry form (PUB-06), the Sales
 * lead workspace (TW-10/TW-11) and the funnel report. Every lead field is INTERNAL — no lead is ever
 * serialised to a client, guest or demo principal (permission-matrix §4), so there is one staff-facing
 * view and no client view. The enquiry request is the only public surface; it is written by the system
 * principal, with consent and the privacy-notice version captured where the data enters (security.md).
 */

export const leadStatus = z.enum([
  "new",
  "contacted",
  "introduction_shared",
  "demo_offered",
  "demo_accessed",
  "follow_up",
  "converted",
  "closed",
]);
export type LeadStatus = z.infer<typeof leadStatus>;

export const contactPreference = z.enum(["phone", "whatsapp", "email"]);
export type ContactPreference = z.infer<typeof contactPreference>;

export const leadActivityType = z.enum([
  "call",
  "email",
  "whatsapp",
  "meeting",
  "consultation",
  "demo",
  "questionnaire",
  "call_request",
  "note",
]);
export type LeadActivityType = z.infer<typeof leadActivityType>;

/** A JSON value, so a stored questionnaire type-checks as JSON for persistence, not `unknown`. */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);
const jsonObject = z.record(z.string(), jsonValue);

/**
 * A phone number normalised to E.164 with an Indian (+91) default (AC-01.3): a bare ten-digit number,
 * a leading zero, or a `91`/`+91` prefix all resolve to `+91XXXXXXXXXX`; anything else must already be
 * a valid E.164 string. Pure, so it runs on the public form and in the API alike.
 */
export const indianPhone = z
  .string()
  .trim()
  .transform((value) => {
    const compact = value.replace(/[\s()-]/g, "");
    const digits = compact.replace(/\D/g, "");
    if (/^\+\d{8,15}$/.test(compact) && !compact.startsWith("+0")) return compact;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    return compact;
  })
  .refine((value) => /^\+[1-9]\d{7,14}$/.test(value), {
    message: "Enter a valid phone number",
  });

const enquiryName = z.string().trim().min(1).max(255);
const email = z.string().trim().toLowerCase().email().max(255);
const requirements = z.string().max(10_000);
const destinationText = z.string().trim().max(255);

/** The shared enquiry fields PUB-06 and a manual lead both carry (everything but who owns/sources it). */
const enquiryFields = {
  email: email.optional(),
  phone: indianPhone.optional(),
  contactPreference: contactPreference.optional(),
  tentativeDateFrom: z.iso.date().optional(),
  tentativeDateTo: z.iso.date().optional(),
  destinationId: uuid.optional(),
  destinationText: destinationText.optional(),
  guestEstimate: z.number().int().min(0).max(100_000).optional(),
  requirements: requirements.optional(),
  requestedDemo: z.boolean().optional(),
};

// Email or phone is required (AC-01.3), and tentative dates must not run backwards. Chained refines so
// each failing field is named independently; `datesOk` reads an unknown-keyed record to stay reusable.
const hasContact = (v: { email?: string | undefined; phone?: string | undefined }) =>
  Boolean(v.email || v.phone);
const datesOk = (v: {
  tentativeDateFrom?: string | undefined;
  tentativeDateTo?: string | undefined;
}) => !v.tentativeDateFrom || !v.tentativeDateTo || v.tentativeDateTo >= v.tentativeDateFrom;

/**
 * The public enquiry (PUB-06). `source` is an optional campaign key; the API resolves it against the
 * active lead sources and falls back to `website`. No owner — Sales assigns one later.
 */
export const leadEnquiryRequest = z
  .object({
    name: enquiryName,
    source: z.string().trim().max(64).optional(),
    consentMarketing: z.boolean().default(false),
    /** The bot-check (CAPTCHA) token the public form carries; verified server-side, never stored. */
    botToken: z.string().max(4096).optional(),
    ...enquiryFields,
  })
  .refine(hasContact, { message: "Give an email or a phone number", path: ["email"] })
  .refine(hasContact, { message: "Give an email or a phone number", path: ["phone"] })
  .refine(datesOk, { message: "The end date is before the start date", path: ["tentativeDateTo"] });
export type LeadEnquiryRequest = z.infer<typeof leadEnquiryRequest>;

/** PUB-09 confirmation: nothing echoed back beyond the first name (AC-01.1). */
export const leadEnquiryResponse = z.object({ firstName: z.string() });
export type LeadEnquiryResponse = z.infer<typeof leadEnquiryResponse>;

/** A lead created by hand in the workspace (a call, an Instagram DM): source is explicit (AC-01.4). */
export const leadCreateRequest = z
  .object({
    name: enquiryName,
    source: z.string().trim().min(1).max(64),
    consentMarketing: z.boolean().default(false),
    ownerUserId: uuid.optional(),
    ...enquiryFields,
  })
  .refine(hasContact, { message: "Give an email or a phone number", path: ["email"] })
  .refine(hasContact, { message: "Give an email or a phone number", path: ["phone"] })
  .refine(datesOk, { message: "The end date is before the start date", path: ["tentativeDateTo"] });
export type LeadCreateRequest = z.infer<typeof leadCreateRequest>;

/** Edit a lead in the workspace; an absent field is left unchanged. A converted lead is read-only. */
export const leadUpdateRequest = z
  .object({
    name: enquiryName.optional(),
    email: email.nullish(),
    phone: indianPhone.nullish(),
    contactPreference: contactPreference.nullish(),
    tentativeDateFrom: z.iso.date().nullish(),
    tentativeDateTo: z.iso.date().nullish(),
    destinationId: uuid.nullish(),
    destinationText: destinationText.nullish(),
    guestEstimate: z.number().int().min(0).max(100_000).nullish(),
    requirements: requirements.nullish(),
    status: leadStatus.optional(),
    ownerUserId: uuid.nullish(),
    closedReason: z.string().trim().max(255).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Give at least one field to change",
  });
export type LeadUpdateRequest = z.infer<typeof leadUpdateRequest>;

/** Assign (or clear) a lead's owner from the board (AC-01.4 bulk assign uses the same body per lead). */
export const leadAssignRequest = z.object({ ownerUserId: uuid.nullable() });
export type LeadAssignRequest = z.infer<typeof leadAssignRequest>;

/** Merge a duplicate into a survivor the Sales user picks; the duplicate closes as `merged` (AC-01.6). */
export const leadMergeRequest = z.object({ survivorLeadId: uuid });
export type LeadMergeRequest = z.infer<typeof leadMergeRequest>;

/** Add an activity to a lead's timeline; `nextFollowUpAt` schedules the reminder (AC-01.5). */
export const leadActivityCreateRequest = z
  .object({
    activityType: leadActivityType,
    occurredAt: isoDateTime.optional(),
    summary: z.string().trim().max(10_000).optional(),
    questionnaireJson: jsonObject.optional(),
    nextFollowUpAt: isoDateTime.optional(),
  })
  .refine(
    (value) => value.activityType !== "questionnaire" || value.questionnaireJson !== undefined,
    {
      message: "A questionnaire activity needs its answers",
      path: ["questionnaireJson"],
    },
  );
export type LeadActivityCreateRequest = z.infer<typeof leadActivityCreateRequest>;

/** One activity on the lead timeline (staff view). */
export const leadActivityView = z.object({
  id: uuid,
  leadId: uuid,
  activityType: leadActivityType,
  occurredAt: isoDateTime,
  userId: uuid,
  summary: z.string().nullable(),
  questionnaireJson: z.unknown(),
  nextFollowUpAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});
export type LeadActivityView = z.infer<typeof leadActivityView>;

/** A lead as the Sales workspace shows it (INTERNAL: never serialised to a client/guest/demo). */
export const leadView = z.object({
  id: uuid,
  status: leadStatus,
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  contactPreference: contactPreference.nullable(),
  tentativeDateFrom: z.iso.date().nullable(),
  tentativeDateTo: z.iso.date().nullable(),
  destinationId: uuid.nullable(),
  destinationText: z.string().nullable(),
  guestEstimate: z.number().int().nullable(),
  requirements: z.string().nullable(),
  source: z.object({ sourceKey: z.string(), name: z.string() }),
  consentMarketing: z.boolean(),
  consentAt: isoDateTime.nullable(),
  consentNoticeVersion: z.string().nullable(),
  requestedDemo: z.boolean(),
  ownerUserId: uuid.nullable(),
  ownerName: z.string().nullable(),
  convertedAccountId: uuid.nullable(),
  convertedAt: isoDateTime.nullable(),
  closedReason: z.string().nullable(),
  duplicateOfLeadId: uuid.nullable(),
  nextFollowUpAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type LeadView = z.infer<typeof leadView>;

/** List/filter the pipeline (TW-10). Cursor-paginated; `source` filters by source key, `q` searches. */
export const leadListQuery = cursorQuery.extend({
  status: leadStatus.optional(),
  ownerUserId: uuid.optional(),
  source: z.string().trim().max(64).optional(),
  q: z.string().trim().max(255).optional(),
});
export type LeadListQuery = z.infer<typeof leadListQuery>;

export const leadPage = page(leadView);
export type LeadPage = z.infer<typeof leadPage>;

export const leadActivityList = z.object({ items: z.array(leadActivityView) });
export type LeadActivityList = z.infer<typeof leadActivityList>;

/** The lead funnel report (TW-83, AC-01.7): counts by status and by source over an optional window. */
export const leadFunnelQuery = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type LeadFunnelQuery = z.infer<typeof leadFunnelQuery>;

export const leadFunnelView = z.object({
  total: z.number().int(),
  byStatus: z.array(z.object({ status: leadStatus, count: z.number().int() })),
  bySource: z.array(z.object({ sourceKey: z.string(), name: z.string(), count: z.number().int() })),
});
export type LeadFunnelView = z.infer<typeof leadFunnelView>;
