import { Inject, Injectable } from "@nestjs/common";
import { errors, type LeadEnquiryRequest, type LeadEnquiryResponse } from "@ampm/core";

import { AppLogger } from "../../../common/logger.service.js";
import { NotificationService } from "../../admin/notification/notification.service.js";
import { BOT_CHECK_ADAPTER, type BotCheckAdapter } from "./bot-check.adapter.js";
import { DEFAULT_SOURCE_KEY, PRIVACY_NOTICE_VERSION } from "./lead-constants.js";
import { LeadsRepository, type LeadSourceRef, type LeadWriteData } from "./leads.repository.js";

/**
 * The public enquiry form (PUB-06, AC-01). A system-principal write: the visitor has no account, the
 * bot check guards abuse, consent and the notice version are captured where the data enters
 * (security.md), a matching email or phone flags a duplicate for Sales (never refused, never
 * auto-merged, AC-01.6), and Sales is notified. Nothing but the first name is echoed back (AC-01.1).
 */
@Injectable()
export class LeadEnquiryService {
  constructor(
    private readonly leads: LeadsRepository,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
    @Inject(BOT_CHECK_ADAPTER) private readonly botCheck: BotCheckAdapter,
  ) {}

  async submit(
    request: LeadEnquiryRequest,
    remoteIp: string | undefined,
  ): Promise<LeadEnquiryResponse> {
    if (!(await this.botCheck.verify(request.botToken, remoteIp))) {
      throw errors.validation([
        { path: "botToken", message: "Complete the bot check to continue" },
      ]);
    }
    const source = await this.resolveSource(request.source);
    const email = request.email ?? null;
    const phone = request.phone ?? null;
    const duplicateOfLeadId = await this.leads.findDuplicateId({ email, phone });
    const leadId = await this.leads.create(buildEnquiryLead(request, source, duplicateOfLeadId));
    // Delivery is best-effort and after the lead is saved: a queue hiccup must not fail the enquiry.
    await this.notifySales(leadId, request.requestedDemo ?? false).catch(() =>
      this.logger.warn("crm.enquiry.notify_failed", { leadId }),
    );
    return { firstName: firstName(request.name) };
  }

  /** The requested campaign source if it is active, otherwise `website`; a missing source is a 500. */
  private async resolveSource(key: string | undefined): Promise<LeadSourceRef> {
    const requested = key ? await this.leads.findActiveSourceByKey(key) : null;
    const resolved = requested ?? (await this.leads.findActiveSourceByKey(DEFAULT_SOURCE_KEY));
    if (!resolved) throw errors.internal("No active lead source is configured");
    return resolved;
  }

  private async notifySales(leadId: string, requestedDemo: boolean): Promise<void> {
    const recipients = await this.leads.salesRecipientIds();
    const eventType = requestedDemo ? "crm.demo_requested" : "crm.enquiry_received";
    await Promise.all(
      recipients.map((recipientId) =>
        this.notifications.queue({
          recipientType: "user",
          recipientId,
          channel: "in_app",
          eventType,
          templateKey: eventType,
          entityType: "lead",
          entityId: leadId,
        }),
      ),
    );
  }
}

function buildEnquiryLead(
  request: LeadEnquiryRequest,
  source: LeadSourceRef,
  duplicateOfLeadId: string | null,
): LeadWriteData {
  return {
    sourceId: source.id,
    status: "new",
    name: request.name,
    email: request.email ?? null,
    phone: request.phone ?? null,
    contactPreference: request.contactPreference ?? null,
    tentativeDateFrom: toDate(request.tentativeDateFrom),
    tentativeDateTo: toDate(request.tentativeDateTo),
    destinationId: request.destinationId ?? null,
    destinationText: request.destinationText ?? null,
    guestEstimate: request.guestEstimate ?? null,
    requirements: request.requirements ?? null,
    consentMarketing: request.consentMarketing,
    consentAt: new Date(),
    consentNoticeVersion: PRIVACY_NOTICE_VERSION,
    requestedDemo: request.requestedDemo ?? false,
    ownerUserId: null,
    duplicateOfLeadId,
    createdBy: null,
  };
}

function firstName(name: string): string {
  const [first] = name.trim().split(/\s+/);
  return first ?? name.trim();
}

function toDate(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}
