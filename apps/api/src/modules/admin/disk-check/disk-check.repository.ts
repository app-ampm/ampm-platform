import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";
import {
  DISK_CHECK_JOB_NAME,
  diskCheckOutcome,
  type DiskCheckOutcome,
  type NoticeHistory,
  type PastNotice,
} from "./disk-check.rules.js";

/** A finished run that notified someone, an alert or the recovery notice, by its recorded outcome. */
const NOTIFIED = { jobName: DISK_CHECK_JOB_NAME, status: "succeeded" as const };
const ALERTED = { detailJson: { path: ["alerted"], equals: true } };

/**
 * The disk check's `job_runs` rows, which are also its alert history. Each run's outcome is
 * `{ freeBytes, totalBytes, level, alerted }` (disk-check.rules.ts). Its recipients come from the query
 * every staff alert shares (StaffAlertRecipients, D-190 §4).
 */
@Injectable()
export class DiskCheckRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Records a run measured at `now`; its idempotency key is the job's name and the UTC minute. */
  async start(now: Date): Promise<string> {
    const run = await this.prisma.jobRun.create({
      data: {
        jobName: DISK_CHECK_JOB_NAME,
        idempotencyKey: `${DISK_CHECK_JOB_NAME}.${now.toISOString().slice(0, 16)}`,
        startedAt: now,
      },
      select: { id: true },
    });
    return run.id;
  }

  async succeed(runId: string, outcome: DiskCheckOutcome): Promise<void> {
    await this.prisma.jobRun.update({
      where: { id: runId },
      data: { status: "succeeded", detailJson: { ...outcome }, finishedAt: new Date() },
    });
  }

  async fail(runId: string, message: string): Promise<void> {
    await this.prisma.jobRun.update({
      where: { id: runId },
      data: { status: "failed", error: message.slice(0, 1024), finishedAt: new Date() },
    });
  }

  /** What earlier finished runs sent: the last notice of either kind, and when the last recovery went. */
  async history(): Promise<NoticeHistory> {
    const [last, recovery] = await Promise.all([
      this.prisma.jobRun.findFirst({
        where: { ...NOTIFIED, ...ALERTED },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, detailJson: true },
      }),
      this.prisma.jobRun.findFirst({
        where: { ...NOTIFIED, AND: [ALERTED, { detailJson: { path: ["level"], equals: "ok" } }] },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      }),
    ]);
    return {
      lastNotice: last ? toNotice(last) : null,
      lastRecoveryAt: recovery?.startedAt ?? null,
    };
  }
}

/** A run's recorded notice; an outcome that does not parse counts as no notice. */
function toNotice(run: {
  readonly startedAt: Date;
  readonly detailJson: unknown;
}): PastNotice | null {
  const outcome = diskCheckOutcome.safeParse(run.detailJson);
  return outcome.success ? { level: outcome.data.level, at: run.startedAt } : null;
}
