import { Module } from "@nestjs/common";

import { AppLogger } from "../../../common/logger.service.js";
import {
  ConsoleNotificationAdapter,
  NOTIFICATION_ADAPTER,
  type NotificationAdapter,
} from "./notification.adapter.js";
import { NotificationController } from "./notification.controller.js";
import { NotificationRepository, PrismaNotificationRepository } from "./notification.repository.js";
import { NotificationService } from "./notification.service.js";

/**
 * Module A notifications: queue → persist → send job → adapter; in-app is delivered as a readable
 * row, every external channel sits behind the provider-neutral adapter (the console stub this
 * sprint, live providers in sprint 5). JobsModule and ConfigModule are global, so JobQueue is
 * available here.
 */
@Module({
  controllers: [NotificationController],
  providers: [
    { provide: NotificationRepository, useClass: PrismaNotificationRepository },
    {
      provide: NOTIFICATION_ADAPTER,
      useFactory: (logger: AppLogger): NotificationAdapter =>
        new ConsoleNotificationAdapter(logger),
      inject: [AppLogger],
    },
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
