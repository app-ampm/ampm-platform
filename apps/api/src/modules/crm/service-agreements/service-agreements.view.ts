import type { ServiceAgreementClientView, ServiceAgreementStaffView } from "@ampm/core";

import { toClientMoney } from "./service-agreements.money.js";
import type { AgreementRow } from "./service-agreements.repository.js";

/**
 * One serialiser per audience (security.md). The client view carries the agreement's own terms —
 * service, scope, the fee the account agreed to pay, status — all CLIENT-class; internal metadata
 * (account id, service_type id, who accepted, the evidence document, the author) is ABSENT from it,
 * never a hide-flag. The return type is the `@ampm/core` view, so TypeScript rejects any stray field.
 */

function iso(date: Date): string {
  return date.toISOString();
}

export function toAgreementClientView(row: AgreementRow): ServiceAgreementClientView {
  return {
    id: row.id,
    serviceKey: row.serviceType.serviceKey,
    serviceName: row.serviceType.name,
    category: row.serviceType.category,
    hotelEnquiryId: row.hotelEnquiryId,
    projectId: row.projectId,
    scopeText: row.scopeText,
    fee: toClientMoney(row.feeAmount),
    feeStructure: row.feeStructure,
    termsVersion: row.termsVersion,
    status: row.status,
    acceptedAt: row.acceptedAt ? iso(row.acceptedAt) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toAgreementStaffView(row: AgreementRow): ServiceAgreementStaffView {
  return {
    ...toAgreementClientView(row),
    accountId: row.accountId,
    serviceTypeId: row.serviceTypeId,
    acceptedByUserId: row.acceptedByUserId,
    documentId: row.documentId,
    createdBy: row.createdBy,
  };
}
