import { Module } from "@nestjs/common";

import { NotificationModule } from "../admin/notification/notification.module.js";
import { HotelsModule } from "../hotels/hotels.module.js";
import { EnquiriesClientController } from "./enquiries-client.controller.js";
import { EnquiriesClientService } from "./enquiries-client.service.js";
import { EnquiriesController } from "./enquiries.controller.js";
import { EnquiriesRepository } from "./enquiries.repository.js";
import { EnquiriesService } from "./enquiries.service.js";
import { EnquiryEventsRepository } from "./enquiry-events.repository.js";

/**
 * Module D — Hotel consultancy (feature 10.1): the hotel enquiry pipeline on the Module C hotels made
 * discoverable. The staff workspace (`consultancy-admin`) is keyed on `consultancy.enquiries.*` and drives
 * the ten-status lifecycle; the client/demo side (`consultancy`) is entitlement-gated on `hotel_assistance`.
 * It reads Module C through HotelsService (the enquiry reach check) and reaches Module B for writes
 * through a domain event (P-7); account resolution still reads the CRM `account_contacts` table directly
 * — the recorded D-063 shortcut, pending a shared accessor. PrismaService, the EventBus (JobsModule),
 * ConfigService and the policy/audit kernel are @Global. The documents/document_access_links tables land
 * with this feature as forward schema; their service and contract arrive with feature 10.2 (first upload).
 */
@Module({
  imports: [HotelsModule, NotificationModule],
  controllers: [EnquiriesController, EnquiriesClientController],
  providers: [
    EnquiriesService,
    EnquiriesClientService,
    EnquiriesRepository,
    EnquiryEventsRepository,
  ],
})
export class ConsultancyModule {}
