import { Module } from "@nestjs/common";

import { PlatformModule } from "./common/platform.module.js";
import { DbModule } from "./db/db.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";
import { AuditLogModule } from "./modules/admin/audit-log/audit-log.module.js";
import { ClientLoginsModule } from "./modules/admin/client-logins/client-logins.module.js";
import { ConfigModule } from "./modules/admin/config/config.module.js";
import { NotificationModule } from "./modules/admin/notification/notification.module.js";
import { ConsultancyModule } from "./modules/consultancy/consultancy.module.js";
import { CrmModule } from "./modules/crm/crm.module.js";
import { ServiceAgreementsModule } from "./modules/crm/service-agreements/service-agreements.module.js";
import { SubscriptionsModule } from "./modules/crm/subscriptions/subscriptions.module.js";
import { DemoModule } from "./modules/demo/demo.module.js";
import { HotelsModule } from "./modules/hotels/hotels.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { PermissionSetsModule } from "./modules/admin/permission-sets/permission-sets.module.js";
import { RolesModule } from "./modules/admin/roles/roles.module.js";
import { StaffUsersModule } from "./modules/admin/staff-users/staff-users.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { SpikeModule } from "./modules/spike/spike.module.js";
import { AuditModule } from "./policy/audit.module.js";
import { PolicyModule } from "./policy/policy.module.js";

@Module({
  // SpikeModule is the sprint 2 offline spike (build-plan §11.4); remove it when the real records land.
  imports: [
    PlatformModule,
    DbModule,
    AuditModule,
    ConfigModule,
    JobsModule,
    StorageModule,
    PolicyModule,
    HealthModule,
    AdminModule,
    AuthModule,
    NotificationModule,
    RolesModule,
    PermissionSetsModule,
    AuditLogModule,
    StaffUsersModule,
    ClientLoginsModule,
    CrmModule,
    SubscriptionsModule,
    ServiceAgreementsModule,
    HotelsModule,
    MediaModule,
    ConsultancyModule,
    DemoModule,
    SpikeModule,
  ],
})
export class AppModule {}
