import { Module } from "@nestjs/common";

import { NotificationModule } from "../admin/notification/notification.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { MediaModule } from "../media/media.module.js";
import { HotelDocumentsController } from "./hotel-documents.controller.js";
import { HotelDocumentsRepository } from "./hotel-documents.repository.js";
import { HotelDocumentsService } from "./hotel-documents.service.js";
import { HotelFreshnessService } from "./hotel-freshness.service.js";
import { HotelImportPlanSweepService } from "./hotel-import-plan-sweep.service.js";
import { ChildRowsImporter } from "./hotel-import.children.js";
import { HotelImportController } from "./hotel-import.controller.js";
import { HotelRowsImporter } from "./hotel-import.hotels.js";
import { HotelRowsWriter } from "./hotel-import.hotels-write.js";
import { RatesImporter } from "./hotel-import.rates.js";
import { RateRowsWriter } from "./hotel-import.rates-write.js";
import { HotelImportRepository } from "./hotel-import.repository.js";
import { HotelImportService } from "./hotel-import.service.js";
import { HotelRatesController } from "./hotel-rates.controller.js";
import { HotelRatesRepository } from "./hotel-rates.repository.js";
import { HotelRatesService } from "./hotel-rates.service.js";
import { HotelReferenceConsentService } from "./hotel-reference-consent.service.js";
import { HotelReferencesController } from "./hotel-references.controller.js";
import { HotelReferencesRepository } from "./hotel-references.repository.js";
import { HotelReferencesService } from "./hotel-references.service.js";
import { HotelSubresourcesRepository } from "./hotel-subresources.repository.js";
import { HotelSubresourcesService } from "./hotel-subresources.service.js";
import { HotelsAdminController } from "./hotels-admin.controller.js";
import { HotelsAdminRepository } from "./hotels-admin.repository.js";
import { HotelsAdminService } from "./hotels-admin.service.js";
import { HotelsController } from "./hotels.controller.js";
import { HotelsRepository } from "./hotels.repository.js";
import { HotelsService } from "./hotels.service.js";
import { SavedHotelsStaffController } from "./saved-hotels-staff.controller.js";
import { SavedHotelsStaffRepository } from "./saved-hotels-staff.repository.js";
import { SavedHotelsStaffService } from "./saved-hotels-staff.service.js";

/**
 * Module C — Hotel intelligence (docs/data-model.md §5). Client-facing discovery: browse/search the
 * hotel catalogue, read one hotel, save/remove a hotel on the account shortlist — all gated on the
 * client's `hotel_discovery` / `saved_hotels` entitlements and scoped by `hotelReach` (demo isolation,
 * A-28). PrismaService (DbModule), ENV/AppLogger (PlatformModule), JobQueue (JobsModule) and ConfigService
 * (ConfigModule) are @Global; NotificationModule is imported for the freshness job's hotel-team notice
 * (feature 9.2), and DocumentsModule (Module N) files a wedding reference's consent (GP-20) and a hotel's
 * documents library (D-187 §6). The principal with its resolved entitlements arrives on the request context.
 *
 * One deliberate deviation from api.md ("a module never queries another module's tables"): the repository
 * resolves the caller's own account by reading the CRM table `account_contacts` directly (shortlist
 * ownership). This is a recorded MVP shortcut (D-063); the account-resolution rule is to move onto the
 * principal (or a shared accessor) when the next account-scoped feature lands, retiring the duplication
 * with PortalService.
 */
@Module({
  imports: [NotificationModule, MediaModule, DocumentsModule],
  controllers: [
    HotelsController,
    HotelsAdminController,
    HotelImportController,
    HotelRatesController,
    HotelReferencesController,
    HotelDocumentsController,
    SavedHotelsStaffController,
  ],
  providers: [
    HotelsService,
    HotelsRepository,
    HotelsAdminService,
    HotelsAdminRepository,
    HotelImportService,
    HotelImportRepository,
    HotelImportPlanSweepService,
    HotelRowsImporter,
    HotelRowsWriter,
    ChildRowsImporter,
    RatesImporter,
    RateRowsWriter,
    HotelSubresourcesService,
    HotelSubresourcesRepository,
    HotelRatesService,
    HotelRatesRepository,
    HotelReferencesService,
    HotelReferenceConsentService,
    HotelReferencesRepository,
    HotelDocumentsService,
    HotelDocumentsRepository,
    HotelFreshnessService,
    SavedHotelsStaffService,
    SavedHotelsStaffRepository,
  ],
  // ConsultancyModule (Module D, feature 10.1) injects HotelsService for the enquiry reach check.
  exports: [HotelsService],
})
export class HotelsModule {}
