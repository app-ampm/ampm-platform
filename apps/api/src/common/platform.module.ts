import { Global, type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { ENV, loadEnv } from "../env.js";
import { AppErrorFilter } from "./app-error.filter.js";
import { EnvelopeInterceptor } from "./envelope.interceptor.js";
import { AppLogger } from "./logger.service.js";
import { RequestContextMiddleware } from "./request-context.middleware.js";

/** Environment, request context, logging and the two envelopes, available everywhere. */
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    AppLogger,
    { provide: APP_FILTER, useClass: AppErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
  ],
  exports: [ENV, AppLogger],
})
export class PlatformModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
