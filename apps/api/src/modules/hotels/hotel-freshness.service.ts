import { randomUUID } from "node:crypto";

import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";

import { AppLogger } from "../../common/logger.service.js";
import { requestContext, type RequestContext } from "../../common/request-context.js";
import { ENV, type Env } from "../../env.js";
import { JobQueue } from "../../jobs/job-queue.js";
import { defineJob } from "../../jobs/job.types.js";
import { AuditService } from "../../policy/audit.service.js";
import type { Principal } from "../../policy/principal.types.js";
import { ConfigService } from "../admin/config/config.service.js";
import { NotificationService } from "../admin/notification/notification.service.js";
import { HotelRatesRepository } from "./hotel-rates.repository.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SYSTEM_PRINCIPAL: Principal = { type: "system", name: "hotel-rates-freshness" };

/** The rate-freshness sweep (AC-04.3): a verification past its max age goes stale, and so do its cards. */
export const hotelRatesFreshnessJob = defineJob("hotels.rates.freshness", z.object({}));

/**
 * Turns verifications (and the rate cards that cite them) `stale` once `verified_at` is older than
 * `configurations.hotel.verification_policy.maxAgeDays`, denormalises `hotels.last_verified_at`, and
 * notifies the hotel team once. Scheduled daily in the worker (inline/on-demand in dev and tests). It
 * changes status only (deletes nothing), and is idempotent: a verification already `stale` is not
 * matched again, so a rerun stales nothing and sends no notice (AC-04.3).
 */
@Injectable()
export class HotelFreshnessService implements OnModuleInit {
  constructor(
    private readonly repo: HotelRatesRepository,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly jobs: JobQueue,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobs.register(hotelRatesFreshnessJob, async () => {
      await this.runSweep();
    });
    if (this.env.JOB_WORKER) {
      await this.jobs.scheduleRepeatable(hotelRatesFreshnessJob, "0 3 * * *", {});
    }
  }

  async runSweep(
    now: Date = new Date(),
  ): Promise<{ staledVerifications: number; staledCards: number }> {
    const { maxAgeDays } = await this.config.get("hotel.verification_policy");
    const cutoff = new Date(now.getTime() - maxAgeDays * DAY_MS);
    const stale = await this.repo.findStaleVerifications(cutoff);
    if (stale.length === 0) return { staledVerifications: 0, staledCards: 0 };

    return requestContext.run(this.systemContext(), async () => {
      let staledCards = 0;
      const hotels = new Set<string>();
      for (const verification of stale) {
        await this.repo.transaction(async (tx) => {
          await this.repo.markVerificationStale(verification.id, tx);
          staledCards += await this.repo.markCardsStaleForVerification(verification.id, tx);
          await this.audit.record(
            {
              action: "update",
              entityType: "hotel_verification",
              entityId: verification.id,
              after: { status: "stale" },
            },
            tx,
          );
        });
        hotels.add(verification.hotelId);
      }
      for (const hotelId of hotels) {
        await this.repo.transaction((tx) => this.repo.recomputeLastVerifiedAt(hotelId, tx));
      }
      await this.notifyHotelTeam();
      this.logger.info("hotels.rates.freshness", {
        staledVerifications: stale.length,
        staledCards,
        hotels: hotels.size,
      });
      return { staledVerifications: stale.length, staledCards };
    });
  }

  /** One in-app notice to each active hotel-team member (AC-04.3 "notified once"; the early return on a
   *  rerun keeps it to a single notice per staling sweep). A failed notice does not abort the others. */
  private async notifyHotelTeam(): Promise<void> {
    const recipients = await this.repo.hotelTeamRecipientIds();
    for (const recipientId of recipients) {
      try {
        await this.notifications.queue({
          recipientType: "user",
          recipientId,
          channel: "in_app",
          eventType: "hotels.rates_stale",
          templateKey: "hotels.rates_stale",
          entityType: "user",
          entityId: recipientId,
        });
      } catch (error) {
        this.logger.warn("hotels.rates.notice_failed", { error: String(error) });
      }
    }
  }

  private systemContext(): RequestContext {
    return { requestId: randomUUID(), ip: null, principal: SYSTEM_PRINCIPAL, access: null };
  }
}
