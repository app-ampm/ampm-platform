import { Module } from "@nestjs/common";

import { DbModule } from "../../../db/db.module.js";
import { PartitionMaintenanceService } from "./partition-maintenance.service.js";
import { PartitionsRepository } from "./partitions.repository.js";

/**
 * The partition maintenance of the log tables (data.md). `JobQueue`, `AppLogger` and `ENV` come from the
 * global jobs and platform modules; `PartitionMaintenanceService` registers and, in the worker, schedules
 * the job at start-up, as the demo restore does.
 */
@Module({
  imports: [DbModule],
  providers: [PartitionsRepository, PartitionMaintenanceService],
  exports: [PartitionMaintenanceService],
})
export class PartitionsModule {}
