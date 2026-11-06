import { Global, Module } from "@nestjs/common";

import { ENV, type Env } from "../env.js";
import { LocalStorageAdapter } from "./local.adapter.js";
import { STORAGE_ADAPTER, type StorageAdapter } from "./storage.types.js";

/**
 * One storage adapter per provider behind one port (api.md); the environment picks it. `local` is the
 * dev/staging filesystem store (refused in production by env.ts); the S3 bucket + CDN arrives in feature
 * 6.4. Global so any module (media now, documents later) injects STORAGE_ADAPTER without importing.
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
  ],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
