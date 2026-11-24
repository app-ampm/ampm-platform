import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { ENV, loadEnv } from "../env.js";
import { AppErrorFilter } from "./app-error.filter.js";
import { EnvelopeInterceptor } from "./envelope.interceptor.js";
import { AppLogger } from "./logger.service.js";
import { UploadSlots } from "./upload-slot/upload-slots.js";

/**
 * Environment, logging and the two envelopes, available everywhere, and the process's one count of
 * upload slots, which every upload route's interceptor shares (D-187). The request context is not a
 * Nest middleware: configureHttp (http.setup.ts) creates it ahead of the body parser.
 *
 * @example
 * \@Module({ imports: [PlatformModule, DbModule, PolicyModule] })
 */
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    AppLogger,
    { provide: UploadSlots, useFactory: () => new UploadSlots() },
    { provide: APP_FILTER, useClass: AppErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
  ],
  exports: [ENV, AppLogger, UploadSlots],
})
export class PlatformModule {}
