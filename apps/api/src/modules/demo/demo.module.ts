import { Module } from "@nestjs/common";

import { DbModule } from "../../db/db.module.js";
import { DemoBaselineRepository } from "./demo-baseline.repository.js";
import { DemoRestoreService } from "./demo-restore.service.js";

/**
 * The nightly demo-restore (feature 5.5). `JobQueue` and `AppLogger`/`ENV` come from the global jobs and
 * platform modules; only `PrismaService` needs importing. `DemoRestoreService` registers and (in the
 * worker) schedules the job at start-up.
 */
@Module({
  imports: [DbModule],
  providers: [DemoBaselineRepository, DemoRestoreService],
  exports: [DemoRestoreService],
})
export class DemoModule {}
