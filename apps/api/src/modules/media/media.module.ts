import { Module } from "@nestjs/common";

import { AV_SCANNER, StubAvScanner } from "./av-scanner.js";
import { MediaController } from "./media.controller.js";
import { MediaRepository } from "./media.repository.js";
import { MediaService } from "./media.service.js";

/**
 * Module N — gallery media. Owns `media_assets` and its staff-management surface (feature 9.3). Exports
 * the service so Module C (hotel discovery) can read a hotel's gallery through it, never by querying the
 * table directly (architecture §5, the downward C→N dependency). The storage, scan and download paths
 * arrive in slice 3b.
 */
@Module({
  controllers: [MediaController],
  // The storage adapter is global (StorageModule); the AV scanner is a stub this sprint (fail-closed),
  // with a real provider a later config swap — production media is gated by the storage prod guard until then.
  providers: [MediaService, MediaRepository, { provide: AV_SCANNER, useClass: StubAvScanner }],
  exports: [MediaService],
})
export class MediaModule {}
