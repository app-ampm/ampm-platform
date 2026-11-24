import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { NotificationChannel, StorageDiskGuard } from "@ampm/core";
import { z } from "zod";

import { AppLogger } from "../../../common/logger.service.js";
import { ENV, type Env } from "../../../env.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import { defineJob } from "../../../jobs/job.types.js";
import { ConfigService } from "../config/config.service.js";
import {
  NotificationService,
  type QueueNotification,
} from "../notification/notification.service.js";
import { DiskCheckRepository } from "./disk-check.repository.js";
import {
  DISK_CHECK_JOB_NAME,
  gbText,
  levelOf,
  noticeFor,
  type DiskCheckOutcome,
} from "./disk-check.rules.js";
import { DiskSpaceProbe, type DiskSpace } from "./disk-space.probe.js";

/** The worker's disk check (D-177); see DiskCheckService. */
export const diskCheckJob = defineJob(DISK_CHECK_JOB_NAME, z.object({}));

/** Every 15 minutes (UTC on the server). */
export const DISK_CHECK_CRON = "*/15 * * * *";

/** The preference key every disk notice shares, so a person turns its email off in one place. */
const EVENT_TYPE = "system.disk_space";

/** One kind of notice: its template and the channels it goes out on. */
interface Message {
  readonly templateKey: string;
  readonly channels: readonly NotificationChannel[];
}

/**
 * Checks the free space where uploads are stored every 15 minutes, and tells the active Super Admin and
 * Hotel team staff, in-app and by email, when it falls below configuration `storage.disk_guard`'s warning
 * level or floor (D-177). It measures the local storage directory (STORAGE_LOCAL_DIR, `/data/storage` in
 * production). On the production box that one filesystem also holds the WAL archive, the pgBackRest
 * repository, nginx's client-body temporary directory and Docker's data, so the alert covers them all.
 * Each run is recorded on `job_runs` with its outcome, and those rows are the alert history: an alert on a
 * move to a worse level, then at most one a day while the level stays, and one in-app notice on recovery
 * (noticeFor). A failed measurement is recorded and alerts no one. Registered and scheduled in the worker
 * only, so the API process never measures. The notices carry the GB figures only: no path, no secret.
 */
@Injectable()
export class DiskCheckService implements OnModuleInit {
  constructor(
    private readonly jobs: JobQueue,
    private readonly runs: DiskCheckRepository,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    private readonly probe: DiskSpaceProbe,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.env.JOB_WORKER) return;
    this.jobs.register(diskCheckJob, async () => {
      await this.run();
    });
    await this.jobs.scheduleRepeatable(diskCheckJob, DISK_CHECK_CRON, {});
  }

  /** Measures at `now`, notifies when it must, and records the run; a failure is recorded and rethrown. */
  async run(now: Date = new Date()): Promise<DiskCheckOutcome> {
    const runId = await this.runs.start(now);
    let outcome: DiskCheckOutcome;
    try {
      outcome = await this.check(runId, now);
    } catch (error) {
      await this.recordFailure(runId, error);
      throw error;
    }
    await this.runs.succeed(runId, outcome);
    return outcome;
  }

  private async check(runId: string, now: Date): Promise<DiskCheckOutcome> {
    const space = await this.probe.measure(this.env.STORAGE_LOCAL_DIR);
    const guard = await this.config.get("storage.disk_guard");
    const level = levelOf(space.freeBytes, guard);
    const notice = noticeFor(level, await this.runs.history(), now);
    let sent = 0;
    if (notice === "alert") {
      const templateKey = level === "critical" ? "system.disk_critical" : "system.disk_low";
      sent = await this.notify({ templateKey, channels: ["in_app", "email"] }, space, guard, runId);
      if (sent > 0) {
        this.logger.warn("system.disk_check.alerted", { level, freeGb: gbText(space.freeBytes) });
      }
    } else if (notice === "recovery") {
      const recovery: Message = { templateKey: "system.disk_recovered", channels: ["in_app"] };
      sent = await this.notify(recovery, space, guard, runId);
      if (sent > 0) this.logger.info("system.disk_check.recovered", { notices: sent });
    }
    return { freeBytes: space.freeBytes, totalBytes: space.totalBytes, level, alerted: sent > 0 };
  }

  /** Queues the message to every recipient on each of its channels; answers how many went out. */
  private async notify(
    message: Message,
    space: DiskSpace,
    guard: StorageDiskGuard,
    runId: string,
  ): Promise<number> {
    const recipients = await this.runs.recipientIds();
    if (recipients.length === 0) {
      this.logger.warn("system.disk_check.no_recipients", { templateKey: message.templateKey });
      return 0;
    }
    const variables = {
      freeGb: gbText(space.freeBytes),
      floorGb: String(guard.floorGiB),
      warnGb: String(guard.warnGiB),
    };
    let sent = 0;
    for (const recipientId of recipients) {
      for (const channel of message.channels) {
        sent += await this.queueOne({
          recipientType: "user",
          recipientId,
          channel,
          eventType: EVENT_TYPE,
          templateKey: message.templateKey,
          entityType: "job_run",
          entityId: runId,
          variables,
        });
      }
    }
    return sent;
  }

  /** One notice; a failure is logged (without the recipient) and does not stop the others. */
  private async queueOne(input: QueueNotification): Promise<number> {
    try {
      const result = await this.notifications.queue(input);
      return result.suppressed ? 0 : 1;
    } catch (error) {
      this.logger.warn("system.disk_check.notice_failed", {
        templateKey: input.templateKey,
        channel: input.channel,
        error: errorText(error).slice(0, 200),
      });
      return 0;
    }
  }

  /** Marks the run failed; if even that write fails (the database may be the outage), it logs and gives up. */
  private async recordFailure(runId: string, error: unknown): Promise<void> {
    const message = errorText(error);
    this.logger.warn("system.disk_check.failed", { error: message });
    try {
      await this.runs.fail(runId, message);
    } catch (recordError) {
      this.logger.warn("system.disk_check.record_failed", { error: errorText(recordError) });
    }
  }
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1024);
}
