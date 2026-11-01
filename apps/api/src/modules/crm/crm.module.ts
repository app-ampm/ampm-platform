import { Module } from "@nestjs/common";

import { AppLogger } from "../../common/logger.service.js";
import { ENV, type Env } from "../../env.js";
import { NotificationModule } from "../admin/notification/notification.module.js";
import {
  BOT_CHECK_ADAPTER,
  SiteverifyBotCheckAdapter,
  StubBotCheckAdapter,
  type BotCheckAdapter,
} from "./leads/bot-check.adapter.js";
import { LeadActivitiesRepository } from "./leads/lead-activities.repository.js";
import { LeadEnquiryService } from "./leads/lead-enquiry.service.js";
import { LeadReminderService } from "./leads/leads.reminder.service.js";
import { LeadsController } from "./leads/leads.controller.js";
import { LeadsRepository } from "./leads/leads.repository.js";
import { LeadsService } from "./leads/leads.service.js";

/**
 * Module B — CRM. Feature 8.1 (lead capture): the public enquiry, the Sales workspace, the follow-up
 * reminder job and the funnel. NotificationModule delivers the Sales and reminder notices; the job
 * seam (JobsModule) and the policy/audit kernel are global. The bot check adapter is chosen by
 * configuration: the stub in development/staging, a real siteverify provider in production (env.ts
 * refuses the stub there, C1). Conversion and subscriptions are features 8.2 and 8.3.
 */
@Module({
  imports: [NotificationModule],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    LeadEnquiryService,
    LeadReminderService,
    LeadsRepository,
    LeadActivitiesRepository,
    {
      provide: BOT_CHECK_ADAPTER,
      useFactory: (env: Env, logger: AppLogger): BotCheckAdapter =>
        env.BOT_CHECK_PROVIDER === "siteverify" && env.BOT_CHECK_URL && env.BOT_CHECK_SECRET
          ? new SiteverifyBotCheckAdapter(env.BOT_CHECK_URL, env.BOT_CHECK_SECRET, logger)
          : new StubBotCheckAdapter(),
      inject: [ENV, AppLogger],
    },
  ],
})
export class CrmModule {}
