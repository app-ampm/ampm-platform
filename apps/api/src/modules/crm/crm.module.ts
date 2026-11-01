import { Module } from "@nestjs/common";

import { IdentityModule } from "../../identity/identity.module.js";
import { NotificationModule } from "../admin/notification/notification.module.js";
import { AccountsController } from "./accounts/accounts.controller.js";
import { AccountsRepository } from "./accounts/accounts.repository.js";
import { AccountsService } from "./accounts/accounts.service.js";
import { BOT_CHECK_ADAPTER, StubBotCheckAdapter } from "./leads/bot-check.adapter.js";
import { LeadActivitiesRepository } from "./leads/lead-activities.repository.js";
import { LeadEnquiryService } from "./leads/lead-enquiry.service.js";
import { LeadReminderService } from "./leads/leads.reminder.service.js";
import { LeadsController } from "./leads/leads.controller.js";
import { LeadsRepository } from "./leads/leads.repository.js";
import { LeadsService } from "./leads/leads.service.js";

/**
 * Module B — CRM. Feature 8.1 (lead capture): the public enquiry, the Sales workspace, the follow-up
 * reminder job and the funnel. Feature 8.2 (conversion): Convert a lead into a client account with a
 * primary contact and a portal invite (the invite is minted through IdentityModule's kernel services).
 * NotificationModule delivers the Sales, reminder and invite notices; the job seam and the policy/audit
 * kernel are global. The bot check is a swappable adapter. Subscriptions are feature 8.3.
 */
@Module({
  imports: [NotificationModule, IdentityModule],
  controllers: [LeadsController, AccountsController],
  providers: [
    LeadsService,
    LeadEnquiryService,
    LeadReminderService,
    LeadsRepository,
    LeadActivitiesRepository,
    AccountsService,
    AccountsRepository,
    { provide: BOT_CHECK_ADAPTER, useClass: StubBotCheckAdapter },
  ],
})
export class CrmModule {}
