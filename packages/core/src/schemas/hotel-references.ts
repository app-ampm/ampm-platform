import { z } from "zod";

import { isoDateTime, uuid } from "./common.js";

/*
 * Contracts for previous-wedding references (Module C `hotel_wedding_references`; data-model.md §5,
 * field-matrix C, feature 9.3). A reference is a past wedding held at a hotel, shown to clients/prospects
 * as social proof. The GP-20 publishing rule — a reference may be `client_visible` only when a
 * `consent_document_id` records the referenced couple's consent — is a service guard, not a field
 * (security.md). The internal join keys (`project_id`, `consent_document_id`) are managed by staff but
 * never serialised to a client: a client sees the social-proof content, not the governance behind it
 * (one response model per audience) — so the client item below carries neither.
 */

/** Longest `description_client` the field matrix allows (C, hotel_wedding_references). */
const DESCRIPTION_MAX = 10_000;
/** `event_year` is a four-digit year (field-matrix C); a sane wedding-venue range, not a calendar bound. */
const EVENT_YEAR_MIN = 1900;
const EVENT_YEAR_MAX = 2100;

/**
 * A previous-wedding reference as staff manage it (HT/SA; `hotels.wedding_references.*`). Strict; carries
 * the internal `projectId`/`consentDocumentId` a client never sees (that is the client item's job). The
 * publishing rule (`clientVisible` ⇒ `consentDocumentId` set) is enforced in the service, not expressible
 * as a field, so the view reports the stored state as-is.
 */
export const weddingReferenceView = z
  .object({
    id: uuid,
    hotelId: uuid,
    projectId: uuid.nullable(),
    eventYear: z.number().int(),
    guestCount: z.number().int().nullable(),
    descriptionClient: z.string().nullable(),
    clientVisible: z.boolean(),
    consentDocumentId: uuid.nullable(),
    createdAt: isoDateTime,
  })
  .strict();
export type WeddingReferenceView = z.infer<typeof weddingReferenceView>;

export const weddingReferenceCreateRequest = z
  .object({
    projectId: uuid.nullish(),
    eventYear: z.number().int().min(EVENT_YEAR_MIN).max(EVENT_YEAR_MAX),
    guestCount: z.number().int().min(0).nullish(),
    descriptionClient: z.string().trim().max(DESCRIPTION_MAX).nullish(),
    // Defaults false: a reference is internal until a staff member sets it client-visible with consent on
    // file (GP-20). The service refuses `true` without a `consentDocumentId`, whatever the request order.
    clientVisible: z.boolean().default(false),
    consentDocumentId: uuid.nullish(),
  })
  .strict();
export type WeddingReferenceCreateRequest = z.infer<typeof weddingReferenceCreateRequest>;

// No-default base, so the update (a `.partial()` of these) never re-applies a create default (data.md).
const weddingReferenceFields = {
  projectId: uuid.nullish(),
  eventYear: z.number().int().min(EVENT_YEAR_MIN).max(EVENT_YEAR_MAX),
  guestCount: z.number().int().min(0).nullish(),
  descriptionClient: z.string().trim().max(DESCRIPTION_MAX).nullish(),
  clientVisible: z.boolean(),
  consentDocumentId: uuid.nullish(),
};

export const weddingReferenceUpdateRequest = z
  .object(weddingReferenceFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "at least one field is required");
export type WeddingReferenceUpdateRequest = z.infer<typeof weddingReferenceUpdateRequest>;

/** The acknowledgement after removing a reference (soft delete is idempotent — returns its id). */
export const weddingReferenceRemovedResponse = z.object({ id: uuid }).strict();
export type WeddingReferenceRemovedResponse = z.infer<typeof weddingReferenceRemovedResponse>;

/**
 * One previous-wedding reference as a client/demo principal sees it on a hotel detail (CP-05). Only the
 * social-proof content: never `projectId` or `consentDocumentId` (internal join keys), never
 * `clientVisible` (implicit — only client-visible references are listed), never `hotelId` (the parent).
 * Mirrors the media gallery item: a client sees the proof, not the governance (security.md, GP-20).
 */
export const weddingReferenceClientItem = z
  .object({
    id: uuid,
    eventYear: z.number().int(),
    guestCount: z.number().int().nullable(),
    descriptionClient: z.string().nullable(),
  })
  .strict();
export type WeddingReferenceClientItem = z.infer<typeof weddingReferenceClientItem>;
