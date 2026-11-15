import { Injectable } from "@nestjs/common";
import type { HotelEnquiryStatus } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { AuditService } from "../../policy/audit.service.js";
import { NotificationService } from "../admin/notification/notification.service.js";
import {
  EnquiriesRepository,
  type EnquiryRow,
  type EnquiryStatusPatch,
} from "./enquiries.repository.js";
import { EnquiryEventsRepository } from "./enquiry-events.repository.js";
import { isClientVisibleStatus } from "./enquiry-status.js";

/**
 * How an enquiry's status change is written, shared by the team's own moves (EnquiriesService) and the
 * moves a shared proposal causes (EnquiryShareAdvance). In one transaction: the status, an append-only
 * `status_change` event (internal-only when the new status is not one the client sees) and the audit
 * row, before and after. The client notice (AC-05.3) is a separate call, so a caller that steps through
 * several statuses still sends the client one.
 */
@Injectable()
export class EnquiryTransitionWriter {
  constructor(
    private readonly enquiries: EnquiriesRepository,
    private readonly events: EnquiryEventsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async write(
    current: EnquiryRow,
    patch: EnquiryStatusPatch,
    to: HotelEnquiryStatus,
    summary: string | null,
    actorId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.enquiries.updateStatus(current.id, patch, actorId, tx);
      await this.events.create(
        {
          enquiryId: current.id,
          eventType: "status_change",
          occurredAt: new Date(),
          userId: actorId,
          summary,
          internalOnly: !isClientVisibleStatus(to),
          documentId: null,
        },
        actorId,
        tx,
      );
      await this.audit.record(
        {
          action: "update",
          entityType: "hotel_enquiry",
          entityId: current.id,
          before: { status: current.status, outcome: current.outcome },
          after: { status: to, outcome: patch.outcome ?? current.outcome },
          maskImages: false,
        },
        tx,
      );
    });
  }

  /** One in-app notice per client login on the account that the enquiry's status changed. */
  async notifyClient(accountId: string, enquiryId: string): Promise<void> {
    const userIds = await this.enquiries.accountClientUserIds(accountId);
    await Promise.all(
      userIds.map((recipientId) =>
        this.notifications.queue({
          recipientType: "user",
          recipientId,
          channel: "in_app",
          eventType: "enquiry.status_changed",
          templateKey: "enquiry.status_changed",
          entityType: "hotel_enquiry",
          entityId: enquiryId,
        }),
      ),
    );
  }
}
