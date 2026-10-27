import { Module } from "@nestjs/common";

import { PlatformModule } from "./common/platform.module.js";
import { DbModule } from "./db/db.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { SpikeModule } from "./modules/spike/spike.module.js";
import { PolicyModule } from "./policy/policy.module.js";

@Module({
  // SpikeModule is the sprint 2 offline spike (build-plan §11.4); remove it when the real records land.
  imports: [PlatformModule, DbModule, PolicyModule, HealthModule, AdminModule, SpikeModule],
})
export class AppModule {}
