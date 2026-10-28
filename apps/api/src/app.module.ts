import { Module } from "@nestjs/common";

import { PlatformModule } from "./common/platform.module.js";
import { DbModule } from "./db/db.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";
import { AuditLogModule } from "./modules/admin/audit-log/audit-log.module.js";
import { ConfigModule } from "./modules/admin/config/config.module.js";
import { NotificationModule } from "./modules/admin/notification/notification.module.js";
import { PermissionSetsModule } from "./modules/admin/permission-sets/permission-sets.module.js";
import { RolesModule } from "./modules/admin/roles/roles.module.js";
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
    PolicyModule,
    HealthModule,
    AdminModule,
    NotificationModule,
    RolesModule,
    PermissionSetsModule,
    AuditLogModule,
    SpikeModule,
  ],
})
export class AppModule {}
