import { Module } from "@nestjs/common";

import { NotificationModule } from "../admin/notification/notification.module.js";
import { MediaModule } from "../media/media.module.js";
import { HotelFreshnessService } from "./hotel-freshness.service.js";
import { HotelImportService } from "./hotel-import.service.js";
import { HotelRatesController } from "./hotel-rates.controller.js";
import { HotelRatesRepository } from "./hotel-rates.repository.js";
import { HotelRatesService } from "./hotel-rates.service.js";
import { HotelSubresourcesRepository } from "./hotel-subresources.repository.js";
import { HotelSubresourcesService } from "./hotel-subresources.service.js";
import { HotelsAdminController } from "./hotels-admin.controller.js";
import { HotelsAdminRepository } from "./hotels-admin.repository.js";
import { HotelsAdminService } from "./hotels-admin.service.js";
import { HotelsController } from "./hotels.controller.js";
import { HotelsRepository } from "./hotels.repository.js";
import { HotelsService } from "./hotels.service.js";

/**
 * Module C — Hotel intelligence (docs/data-model.md §5). Client-facing discovery: browse/search the
 * hotel catalogue, read one hotel, save/remove a hotel on the account shortlist — all gated on the
 * client's `hotel_discovery` / `saved_hotels` entitlements and scoped by `hotelReach` (demo isolation,
 * A-28). PrismaService (DbModule), ENV/AppLogger (PlatformModule), JobQueue (JobsModule) and ConfigService
 * (ConfigModule) are @Global; NotificationModule is imported for the freshness job's hotel-team notice
 * (feature 9.2). The principal with its resolved entitlements arrives on the request context.
 *
 * One deliberate deviation from api.md ("a module never queries another module's tables"): the repository
 * resolves the caller's own account by reading the CRM table `account_contacts` directly (shortlist
 * ownership). This is a recorded MVP shortcut (D-063); the account-resolution rule is to move onto the
 * principal (or a shared accessor) when the next account-scoped feature lands, retiring the duplication
 * with PortalService.
 */
@Module({
  imports: [NotificationModule, MediaModule],
  controllers: [HotelsController, HotelsAdminController, HotelRatesController],
  providers: [
    HotelsService,
    HotelsRepository,
    HotelsAdminService,
    HotelsAdminRepository,
    HotelImportService,
    HotelSubresourcesService,
    HotelSubresourcesRepository,
    HotelRatesService,
    HotelRatesRepository,
    HotelFreshnessService,
  ],
})
export class HotelsModule {}
