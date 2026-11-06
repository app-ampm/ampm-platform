import { Injectable, type OnModuleInit } from "@nestjs/common";

import { AppLogger } from "../../../common/logger.service.js";
import { EventBus } from "../../../jobs/event-bus.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import { NotificationService } from "../../admin/notification/notification.service.js";
import { AccountsRepository } from "../accounts/accounts.repository.js";
import {
  hotelAssistanceDemoJob,
  hotelAssistanceDemoRequested,
  type HotelAssistanceDemoRequested,
} from "./hotel-assistance.events.js";
import { LeadActivitiesRepository } from "./lead-activities.repository.js";
import { LeadsRepository } from "./leads.repository.js";

/**
 * P-7 / AC-03.4: a demo prospect's hotel-assistance request becomes a Sales lead activity, never an
 * enquiry. The consultancy event is handled inside CRM — so Module D never touches a CRM table (api.md) —
 * and the thin bus handler enqueues a durable, idempotent job (the EventBus contract: durable work belongs
 * in the job, not the handler). The job resolves the demo account's originating lead, appends a `demo`
 * activity carrying the prospect's request text, and notifies the lead owner (best-effort).
 */
@Injectable()
export class HotelAssistanceDemoHandler implements OnModuleInit {
  constructor(
    private readonly jobs: JobQueue,
    private readonly bus: EventBus,
    private readonly accounts: AccountsRepository,
    private readonly leads: LeadsRepository,
    private readonly activities: LeadActivitiesRepository,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit(): void {
    this.jobs.register(hotelAssistanceDemoJob, (payload) => this.handle(payload));
    this.bus.on(hotelAssistanceDemoRequested, (payload) =>
      this.jobs.enqueue(hotelAssistanceDemoJob, payload, {
        idempotencyKey: `crm.hotel_assistance_demo.${payload.accountId}.${payload.hotelId}`,
      }),
    );
  }

  private async handle(payload: HotelAssistanceDemoRequested): Promise<void> {
    const account = await this.accounts.findById(payload.accountId);
    if (!account?.leadId) {
      this.logger.warn("crm.hotel_assistance_demo.no_lead", { accountId: payload.accountId });
      return;
    }
    await this.activities.create(
      {
        leadId: account.leadId,
        activityType: "demo",
        occurredAt: new Date(),
        userId: payload.demoUserId,
        summary: payload.requestNote,
        questionnaireJson: undefined,
        nextFollowUpAt: null,
      },
      payload.demoUserId,
    );
    const lead = await this.leads.findById(account.leadId);
    if (!lead?.ownerUserId) return;
    await this.notifications
      .queue({
        recipientType: "user",
        recipientId: lead.ownerUserId,
        channel: "in_app",
        eventType: "crm.hotel_assistance_demo",
        templateKey: "crm.hotel_assistance_demo",
        entityType: "lead",
        entityId: account.leadId,
      })
      .catch(() =>
        this.logger.warn("crm.hotel_assistance_demo.notify_failed", { leadId: account.leadId }),
      );
  }
}
