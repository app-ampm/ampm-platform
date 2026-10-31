import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";

import { AppLogger } from "../../../common/logger.service.js";
import { ENV, type Env } from "../../../env.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import { defineJob } from "../../../jobs/job.types.js";
import { NotificationService } from "../../admin/notification/notification.service.js";
import { LeadActivitiesRepository } from "./lead-activities.repository.js";

/** The follow-up reminder sweep (AC-01.5): reuses the job seam and the job_runs recorded outcome (D-047). */
export const leadFollowUpReminderJob = defineJob("crm.lead.follow_up_reminder", z.object({}));

/**
 * Sends an in-app reminder to a lead's owner when a logged follow-up falls due. Registered on boot;
 * scheduled every fifteen minutes in the worker only (inline in dev/tests, run on demand). Claiming
 * each reminder clears its `next_follow_up_at`, so a rerun — or a second worker — sends nothing (AC-01.5).
 */
@Injectable()
export class LeadReminderService implements OnModuleInit {
  constructor(
    private readonly jobs: JobQueue,
    private readonly activities: LeadActivitiesRepository,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobs.register(leadFollowUpReminderJob, async () => {
      await this.runDue();
    });
    if (this.env.JOB_WORKER) {
      await this.jobs.scheduleRepeatable(leadFollowUpReminderJob, "*/15 * * * *", {});
    }
  }

  /** Notifies each owner whose follow-up is due at `now`; returns how many reminders were sent. */
  async runDue(now: Date = new Date()): Promise<number> {
    const due = await this.activities.dueReminders(now);
    let sent = 0;
    for (const reminder of due) {
      if (!(await this.activities.claim(reminder.activityId, now))) continue;
      await this.notifications.queue({
        recipientType: "user",
        recipientId: reminder.ownerUserId,
        channel: "in_app",
        eventType: "crm.follow_up_due",
        templateKey: "crm.follow_up_due",
        entityType: "lead",
        entityId: reminder.leadId,
      });
      sent += 1;
    }
    if (sent > 0) this.logger.info("crm.follow_up_reminders_sent", { sent });
    return sent;
  }
}
