import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";

import { AppLogger } from "../../../common/logger.service.js";
import { PrismaService } from "../../../db/prisma.service.js";
import { ENV, type Env } from "../../../env.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import { defineJob } from "../../../jobs/job.types.js";
import { NotificationService } from "../../admin/notification/notification.service.js";
import { LeadActivitiesRepository, type DueReminder } from "./lead-activities.repository.js";

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
    private readonly prisma: PrismaService,
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

  /**
   * Notifies each owner whose follow-up is due at `now`, and records the sweep on a `job_runs` row
   * (C5, D-057, api.md). Each reminder is queued first and only then claimed (its `next_follow_up_at`
   * cleared): a queue failure leaves the reminder due for the next sweep rather than losing it, and one
   * failed reminder does not abort the rest. Returns how many reminders were sent.
   */
  async runDue(now: Date = new Date()): Promise<number> {
    const run = await this.prisma.jobRun.create({
      data: {
        jobName: leadFollowUpReminderJob.name,
        idempotencyKey: `${leadFollowUpReminderJob.name}.${now.toISOString()}`,
        startedAt: now,
      },
    });
    const due = await this.activities.dueReminders(now);
    let sent = 0;
    let failed = 0;
    for (const reminder of due) {
      try {
        await this.sendReminder(reminder, now);
        sent += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn("crm.follow_up_reminder_failed", {
          activityId: reminder.activityId,
          error: String(error),
        });
      }
    }
    await this.prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: failed > 0 ? "failed" : "succeeded",
        detailJson: { due: due.length, sent, failed },
        finishedAt: new Date(),
      },
    });
    if (sent > 0) this.logger.info("crm.follow_up_reminders_sent", { sent });
    return sent;
  }

  /**
   * Queues one owner's in-app reminder, then claims it (clears `next_follow_up_at`). Queue first so a
   * failure throws before the claim and the reminder stays due for the next sweep rather than being lost.
   */
  private async sendReminder(reminder: DueReminder, now: Date): Promise<void> {
    await this.notifications.queue({
      recipientType: "user",
      recipientId: reminder.ownerUserId,
      channel: "in_app",
      eventType: "crm.follow_up_due",
      templateKey: "crm.follow_up_due",
      entityType: "lead",
      entityId: reminder.leadId,
    });
    await this.activities.claim(reminder.activityId, now);
  }
}
