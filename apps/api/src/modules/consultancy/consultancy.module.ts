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
import { ProposalsClientController } from "./proposals-client.controller.js";
import { ProposalsClientService } from "./proposals-client.service.js";
import { ProposalsController } from "./proposals.controller.js";
import { ProposalsRepository } from "./proposals.repository.js";
import { ProposalsService } from "./proposals.service.js";
import { BookingMilestonesClientController } from "./booking-milestones-client.controller.js";
import { BookingMilestonesClientService } from "./booking-milestones-client.service.js";
import { BookingMilestonesController } from "./booking-milestones.controller.js";
import { BookingMilestonesRepository } from "./booking-milestones.repository.js";
import { BookingMilestonesService } from "./booking-milestones.service.js";
import { MilestoneOverdueService } from "./milestones.overdue.service.js";

/**
 * Module D — Hotel consultancy. 10.1 built the enquiry pipeline (`consultancy-admin` on
 * `consultancy.enquiries.*`; the client side `consultancy` gated on `hotel_assistance`); 10.3 added site
 * visits (`consultancy.site_visits.*`); 10.4 adds hotel proposals (`consultancy.proposals.*`, the
 * client/internal money split with `read_internal_amount`, the version/decision machine, sharing advances
 * the enquiry to `client_decision`, and handler-less `consultancy.proposal.*` events); 10.5 adds booking
 * milestones (`consultancy.booking_milestones.*`), the AC-05.6 confirmed-guard on the enquiry transition
 * and an hourly overdue sweep. It reads Module C
 * through HotelsService, reaches Module B through ServiceAgreementsService (the AC-05.7 gate) and domain
 * events; account resolution reads the CRM `account_contacts` table directly (the recorded D-063 shortcut).
 * PrismaService, the EventBus, ConfigService and the policy/audit kernel are @Global.
 */
@Module({
  imports: [HotelsModule, NotificationModule, ServiceAgreementsModule],
  controllers: [
    EnquiriesController,
    EnquiriesClientController,
    SiteVisitsController,
    SiteVisitsClientController,
    ProposalsController,
    ProposalsClientController,
    BookingMilestonesController,
    BookingMilestonesClientController,
  ],
  providers: [
    EnquiriesService,
    EnquiriesClientService,
    EnquiriesRepository,
    EnquiryEventsRepository,
    SiteVisitsService,
    SiteVisitsClientService,
    SiteVisitsRepository,
    ProposalsService,
    ProposalsClientService,
    ProposalsRepository,
    BookingMilestonesService,
    BookingMilestonesClientService,
    BookingMilestonesRepository,
    MilestoneOverdueService,
  ],
})
export class ConsultancyModule {}
