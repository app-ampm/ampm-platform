import type { WeddingReferenceClientItem, WeddingReferenceView } from "@ampm/core";

import type {
  WeddingReferenceClientRow,
  WeddingReferenceRow,
} from "./hotel-references.repository.js";

/*
 * Response models for previous-wedding references (feature 9.3). Two audiences, two models (security.md):
 * the staff view carries the governance fields (`projectId`, `consentDocumentId`, `clientVisible`); the
 * client item carries only the social-proof content. The return types are the @ampm/core views, so
 * TypeScript rejects any extra field — the structural guarantee alongside the repository's explicit selects
 * that an internal join key cannot reach a client, even though the model stores it.
 */

export function toWeddingReferenceView(row: WeddingReferenceRow): WeddingReferenceView {
  return {
    id: row.id,
    hotelId: row.hotelId,
    projectId: row.projectId,
    eventYear: row.eventYear,
    guestCount: row.guestCount,
    descriptionClient: row.descriptionClient,
    clientVisible: row.clientVisible,
    consentDocumentId: row.consentDocumentId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toWeddingReferenceClientItem(
  row: WeddingReferenceClientRow,
): WeddingReferenceClientItem {
  return {
    id: row.id,
    eventYear: row.eventYear,
    guestCount: row.guestCount,
    descriptionClient: row.descriptionClient,
  };
}
