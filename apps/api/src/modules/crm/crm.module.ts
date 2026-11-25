import { Module } from "@nestjs/common";

import { BotCheckModule } from "../../common/bot-check/bot-check.module.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { NotificationModule } from "../admin/notification/notification.module.js";
import { AccountContactsController } from "./accounts/account-contacts.controller.js";
import { AccountContactsService } from "./accounts/account-contacts.service.js";
import { AccountInviteService } from "./accounts/account-invite.service.js";
import { AccountsController } from "./accounts/accounts.controller.js";
import { AccountsRepository } from "./accounts/accounts.repository.js";
import { AccountsService } from "./accounts/accounts.service.js";
import { HotelAssistanceDemoHandler } from "./leads/hotel-assistance-demo.handler.js";
import { LeadActivitiesRepository } from "./leads/lead-activities.repository.js";
import { LeadEnquiryService } from "./leads/lead-enquiry.service.js";
import { LeadReminderService } from "./leads/leads.reminder.service.js";
import { LeadsController } from "./leads/leads.controller.js";
import { LeadsRepository } from "./leads/leads.repository.js";
import { LeadsService } from "./leads/leads.service.js";

/**
 * Module B — CRM. Feature 8.1 (lead capture): the public enquiry, the Sales workspace, the follow-up
 * reminder job and the funnel. Feature 8.2 (conversion): convert a lead into a client account with a
 * primary contact and a portal invite (minted through IdentityModule's kernel services). NotificationModule
 * delivers the Sales, reminder and invite notices; the job seam and the policy/audit kernel are global. The
 * public enquiry's bot check comes from BotCheckModule, shared with the hotel form (D-189 §7): the stub in
 * development/staging, a real siteverify provider in production (env.ts refuses the stub there, C1).
 * Subscriptions are feature 8.3.
 */
@Module({
  imports: [NotificationModule, IdentityModule, BotCheckModule],
  controllers: [LeadsController, AccountsController, AccountContactsController],
  providers: [
    LeadsService,
    LeadEnquiryService,
    LeadReminderService,
    LeadsRepository,
    LeadActivitiesRepository,
    HotelAssistanceDemoHandler,
    AccountsService,
    AccountContactsService,
    AccountInviteService,
    AccountsRepository,
  ],
})
export class CrmModule {}
