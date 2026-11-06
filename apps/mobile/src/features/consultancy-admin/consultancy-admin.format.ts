import type { HotelEnquiryStatus, HotelProposalStatus, ServiceAgreementStatus } from "@ampm/core";

import {
  agreementBadge,
  type Badge,
  enquiryBadge,
  proposalBadge,
} from "../consultancy/consultancy.format";

/**
 * Staff-audience status badges. The client map (consultancy.format) phrases three statuses in the second
 * person for the portal ("Your decision", "Awaiting your decision", "Action needed") — on the internal
 * workspace those read as if the staff user must act. Reuse the tones, rewrite only those labels; the
 * visit and milestone badges are already neutral, so staff screens use the client maps for those.
 */
export const staffEnquiryBadge: Record<HotelEnquiryStatus, Badge> = {
  ...enquiryBadge,
  client_decision: { ...enquiryBadge.client_decision, label: "Client decision" },
};

export const staffProposalBadge: Record<HotelProposalStatus, Badge> = {
  ...proposalBadge,
  shared: { ...proposalBadge.shared, label: "Shared (awaiting client)" },
};

export const staffAgreementBadge: Record<ServiceAgreementStatus, Badge> = {
  ...agreementBadge,
  sent: { ...agreementBadge.sent, label: "Sent" },
};
