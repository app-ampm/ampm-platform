import { randomUUID } from "node:crypto";

import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";

import { AppLogger } from "../../common/logger.service.js";
import { requestContext, type RequestContext } from "../../common/request-context.js";
import { PrismaService } from "../../db/prisma.service.js";
import { ENV, type Env } from "../../env.js";
import { EventBus } from "../../jobs/event-bus.js";
import { JobQueue } from "../../jobs/job-queue.js";
import { defineJob } from "../../jobs/job.types.js";
import { AuditService } from "../../policy/audit.service.js";
import type { Principal } from "../../policy/principal.types.js";
import { NotificationService } from "../admin/notification/notification.service.js";
import { milestoneDue } from "./booking-milestones.events.js";
import { emitMilestoneEvent } from "./booking-milestones.helpers.js";
import { BookingMilestonesRepository, type DueMilestone } from "./booking-milestones.repository.js";

const SYSTEM_PRINCIPAL: Principal = { type: "system", name: "milestone-overdue-sweep" };

/** The booking-milestone overdue sweep (feature 10.5, brief §1 reminder pattern, D-047). */
export const milestoneOverdueJob = defineJob(
  "consultancy.booking_milestone.overdue_sweep",
  z.object({}),
);

/**
 * Marks a past-due booking milestone `overdue` and notifies the enquiry's assignee once (AC-28 pattern).
 * Registered on boot; scheduled hourly in the worker only (inline in dev/tests, run on demand). The mark
 * and its audit commit together in one transaction under a system request context (mirroring the
 * subscription-expiry sweep); the compare-and-swap clears exactly one winner, so a rerun — or a second
 * worker — marks and notifies nothing again. The assignee notice and the handler-less `due` event are
 * best-effort after the commit; the sweep is recorded on a `job_runs` row.
 */
@Injectable()
export class MilestoneOverdueService implements OnModuleInit {
  constructor(
    private readonly jobs: JobQueue,
    private readonly milestones: BookingMilestonesRepository,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly bus: EventBus,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobs.register(milestoneOverdueJob, async () => {
      await this.runSweep();
    });
    if (this.env.JOB_WORKER) {
      await this.jobs.scheduleRepeatable(milestoneOverdueJob, "0 * * * *", {});
    }
  }

  /** Records the sweep on a `job_runs` row and marks the due milestones under a system request context
   *  (so the overdue transition audits). Returns how many were marked overdue. */
  async runSweep(now: Date = new Date()): Promise<number> {
    const run = await this.prisma.jobRun.create({
      data: {
        jobName: milestoneOverdueJob.name,
        idempotencyKey: `${milestoneOverdueJob.name}.${now.toISOString()}`,
        startedAt: now,
      },
    });
    const result = await requestContext.run(this.systemContext(), () => this.sweepDue(now));
    await this.prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: result.failed > 0 ? "failed" : "succeeded",
        detailJson: result,
        finishedAt: new Date(),
      },
    });
    if (result.marked > 0)
      this.logger.info("consultancy.milestones_overdue", { marked: result.marked });
    return result.marked;
  }

  private async sweepDue(now: Date): Promise<{ due: number; marked: number; failed: number }> {
    const due = await this.milestones.findDueMilestones(now);
    let marked = 0;
    let failed = 0;
    for (const milestone of due) {
      try {
        if (await this.surface(milestone, now)) marked += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn("consultancy.milestone_overdue_failed", {
          milestoneId: milestone.id,
          error: String(error),
        });
      }
    }
    return { due: due.length, marked, failed };
  }

  /**
   * Marks one milestone overdue and audits that transition atomically (CAS: exactly one winner). On
   * winning, best-effort notifies the enquiry's assignee and emits `due` — a notice failure is logged, not
   * fatal, and never undoes the committed mark. Returns whether this call marked it.
   */
  private async surface(milestone: DueMilestone, now: Date): Promise<boolean> {
    const marked = await this.prisma.$transaction(async (tx) => {
      if (!(await this.milestones.markOverdue(milestone.id, now, tx))) return false;
      await this.audit.record(
        {
          action: "update",
          entityType: "booking_milestone",
          entityId: milestone.id,
          before: { status: "pending" },
          after: { status: "overdue" },
          maskImages: false,
        },
        tx,
      );
      return true;
    });
    if (marked) await this.notifyAndEmit(milestone);
    return marked;
  }

  private async notifyAndEmit(milestone: DueMilestone): Promise<void> {
    try {
      if (milestone.assignedUserId) {
        await this.notifications.queue({
          recipientType: "user",
          recipientId: milestone.assignedUserId,
          channel: "in_app",
          eventType: "consultancy.milestone_overdue",
          templateKey: "consultancy.milestone_overdue",
          entityType: "booking_milestone",
          entityId: milestone.id,
        });
      }
      await emitMilestoneEvent(this.bus, this.logger, milestoneDue, milestone);
    } catch (error) {
      this.logger.warn("consultancy.milestone_overdue_notice_failed", {
        milestoneId: milestone.id,
        error: String(error),
      });
    }
  }

  private systemContext(): RequestContext {
    return { requestId: randomUUID(), ip: null, principal: SYSTEM_PRINCIPAL, access: null };
  }
}
