import { Global, Module } from "@nestjs/common";

import { AppLogger } from "../common/logger.service.js";
import { ENV, type Env } from "../env.js";
import { AV_SCANNER, StubAvScanner, type AvScanner } from "./av-scanner.js";
import { ClamAvScanner } from "./clamav-scanner.js";
import { LocalStorageAdapter } from "./local.adapter.js";
import { STORAGE_ADAPTER, type StorageAdapter } from "./storage.types.js";

/**
 * One storage adapter per provider behind one port (api.md); the environment picks it. `local` is the
 * dev/staging filesystem store (refused in production by env.ts); the S3 bucket + CDN arrives in feature
 * 6.4. Global so any module (media now, documents later) injects STORAGE_ADAPTER without importing. The
 * antivirus scanner every upload path shares is chosen here too, by AV_PROVIDER.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_ADAPTER,
      inject: [ENV],
      useFactory: (env: Env): StorageAdapter => {
        if (env.STORAGE_PROVIDER === "local")
          return new LocalStorageAdapter(env.STORAGE_LOCAL_DIR, env.MEDIA_SIGNING_SECRET ?? "");
        throw new Error("the S3 storage adapter is wired in feature 6.4");
      },
    },
    {
      provide: AV_SCANNER,
      inject: [ENV, AppLogger],
      useFactory: (env: Env, logger: AppLogger): AvScanner => {
        if (env.AV_PROVIDER === "stub") return new StubAvScanner();
        // env.ts requires the host with clamav; never fall back to the stub if that ever slips.
        if (!env.CLAMAV_HOST) throw new Error("AV_PROVIDER=clamav needs CLAMAV_HOST");
        const options = {
          host: env.CLAMAV_HOST,
          port: env.CLAMAV_PORT,
          timeoutMs: env.CLAMAV_TIMEOUT_MS,
        };
        return new ClamAvScanner(options, logger);
      },
    },
  ],
  exports: [STORAGE_ADAPTER, AV_SCANNER],
})
export class StorageModule {}
