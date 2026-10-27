import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { ENV, loadEnv } from "../env.js";
import { AppErrorFilter } from "./app-error.filter.js";
import { EnvelopeInterceptor } from "./envelope.interceptor.js";
import { AppLogger } from "./logger.service.js";

/**
 * Environment, logging and the two envelopes, available everywhere. The request context is not a
 * Nest middleware: configureHttp (http.setup.ts) creates it ahead of the body parser.
 */
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
export class PlatformModule {}
