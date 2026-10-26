import { Module } from "@nestjs/common";

import { PlatformModule } from "./common/platform.module.js";
import { DbModule } from "./db/db.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { PolicyModule } from "./policy/policy.module.js";

@Module({
  imports: [PlatformModule, DbModule, PolicyModule, HealthModule, AdminModule],
})
export class AppModule {}
