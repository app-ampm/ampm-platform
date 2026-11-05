import { Module } from "@nestjs/common";

import { NotificationModule } from "../admin/notification/notification.module.js";
import { ServiceAgreementsModule } from "../crm/service-agreements/service-agreements.module.js";
import { HotelsModule } from "../hotels/hotels.module.js";
import { EnquiriesClientController } from "./enquiries-client.controller.js";
import { EnquiriesClientService } from "./enquiries-client.service.js";
import { EnquiriesController } from "./enquiries.controller.js";
import { EnquiriesRepository } from "./enquiries.repository.js";
import { EnquiriesService } from "./enquiries.service.js";
import { EnquiryEventsRepository } from "./enquiry-events.repository.js";
import { SiteVisitsClientController } from "./site-visits-client.controller.js";
import { SiteVisitsClientService } from "./site-visits-client.service.js";
import { SiteVisitsController } from "./site-visits.controller.js";
import { SiteVisitsRepository } from "./site-visits.repository.js";
import { SiteVisitsService } from "./site-visits.service.js";

/**
 * Module D — Hotel consultancy. 10.1 built the enquiry pipeline (`consultancy-admin` staff workspace on
 * `consultancy.enquiries.*` driving the ten-status lifecycle; the client/demo side `consultancy` gated on
 * `hotel_assistance`); 10.3 adds site visits (`consultancy.site_visits.*`, scheduling advances the enquiry
 * to `visit_scheduled`; the client reads date/status and submits own feedback). It reads Module C through
 * HotelsService, reaches Module B through ServiceAgreementsService (the AC-05.7 gate) and a domain event
 * (P-7); account resolution reads the CRM `account_contacts` table directly (the recorded D-063 shortcut).
 * PrismaService, the EventBus, ConfigService and the policy/audit kernel are @Global.
 */
@Module({
  imports: [HotelsModule, NotificationModule, ServiceAgreementsModule],
  controllers: [
    EnquiriesController,
    EnquiriesClientController,
    SiteVisitsController,
    SiteVisitsClientController,
  ],
  providers: [
    EnquiriesService,
    EnquiriesClientService,
    EnquiriesRepository,
    EnquiryEventsRepository,
    SiteVisitsService,
    SiteVisitsClientService,
    SiteVisitsRepository,
  ],
})
export class ConsultancyModule {}
