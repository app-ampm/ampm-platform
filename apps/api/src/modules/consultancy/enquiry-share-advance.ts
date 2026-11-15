import { Injectable } from "@nestjs/common";
import type { HotelEnquiryStatus } from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import type { EnquiryRow } from "./enquiries.repository.js";
import { isEnquiryTransitionDefined } from "./enquiry-status.js";
import { EnquiryTransitionWriter } from "./enquiry-transition-writer.js";

/** The statuses an open enquiry can be at before its client is asked to decide. */
const BEFORE_DECISION: ReadonlySet<HotelEnquiryStatus> = new Set([
  "submitted",
  "awaiting_hotel",
  "response_received",
  "negotiating",
  "visit_scheduled",
  "proposal_received",
]);

const HOTEL_QUOTED: HotelEnquiryStatus = "proposal_received";
const CLIENT_DECIDES: HotelEnquiryStatus = "client_decision";

/** The timeline's words for each step a share causes. */
function summaryFor(to: HotelEnquiryStatus, versionNumber: number): string {
  return to === CLIENT_DECIDES
    ? `Proposal version ${versionNumber} shared with the client`
    : `Proposal version ${versionNumber} prepared`;
}

/**
 * Sharing a proposal puts the decision with the client, so the share moves the enquiry to
 * `client_decision` (D-131). It walks only edges the §7 graph defines: from any status before the
 * decision, through `proposal_received` (the hotel has quoted) when the enquiry is not there yet, then
 * to `client_decision`. Each step writes its own event and audit row, and the client gets one notice.
 *
 * The move is a consequence of the share, which the API has already permission-checked
 * (`consultancy.proposals.share`, in scope), so it does not ask again whether the sharer may make
 * those moves by hand: a Super Admin's share advances the enquiry as a hotel-team member's does. A
 * draft, an enquiry already at the decision, and a confirmed or closed one are left as they are. It
 * never fails the share: a step that cannot be written is logged and the rest is skipped.
 */
@Injectable()
export class EnquiryShareAdvance {
  constructor(
    private readonly writer: EnquiryTransitionWriter,
    private readonly logger: AppLogger,
  ) {}

  async advance(enquiry: EnquiryRow, actorId: string, versionNumber: number): Promise<void> {
    if (!BEFORE_DECISION.has(enquiry.status)) return;
    let current = enquiry;
    try {
      for (const to of this.path(enquiry.status)) {
        await this.writer.write(
          current,
          { status: to },
          to,
          summaryFor(to, versionNumber),
          actorId,
        );
        current = { ...current, status: to };
      }
    } catch {
      this.logger.warn("consultancy.proposal.enquiry_advance_failed", { enquiryId: enquiry.id });
    }
    // One notice for however far it got; none if nothing moved.
    if (current.status === enquiry.status) return;
    await this.writer
      .notifyClient(enquiry.accountId, enquiry.id)
      .catch(() =>
        this.logger.warn("consultancy.enquiry.notify_failed", { enquiryId: enquiry.id }),
      );
  }

  /** The defined steps from `from` to the decision, or none if the graph has no such route. */
  private path(from: HotelEnquiryStatus): readonly HotelEnquiryStatus[] {
    if (isEnquiryTransitionDefined(from, CLIENT_DECIDES)) return [CLIENT_DECIDES];
    if (
      isEnquiryTransitionDefined(from, HOTEL_QUOTED) &&
      isEnquiryTransitionDefined(HOTEL_QUOTED, CLIENT_DECIDES)
    )
      return [HOTEL_QUOTED, CLIENT_DECIDES];
    return [];
  }
}
