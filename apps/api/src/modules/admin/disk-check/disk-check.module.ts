import { Module } from "@nestjs/common";

import { NotificationModule } from "../notification/notification.module.js";
import { DiskCheckRepository } from "./disk-check.repository.js";
import { DiskCheckService } from "./disk-check.service.js";
import { DiskSpaceProbe } from "./disk-space.probe.js";

/**
 * The worker's disk check (D-177). PrismaService, JobQueue, ConfigService, AppLogger and ENV come from the
 * global modules; NotificationModule is imported for the alerts. `DiskCheckService` registers and schedules
 * the job at start-up in the worker only.
 */
@Module({
  imports: [NotificationModule],
  providers: [DiskCheckRepository, DiskSpaceProbe, DiskCheckService],
  exports: [DiskCheckService],
})
export class DiskCheckModule {}
