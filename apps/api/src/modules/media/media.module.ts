import { Module } from "@nestjs/common";

import { MediaController } from "./media.controller.js";
import { MediaRepository } from "./media.repository.js";
import { MediaUploadService } from "./media-upload.service.js";
import { MediaService } from "./media.service.js";

/**
 * Module N — gallery media. Owns `media_assets` and its staff-management surface (feature 9.3). Exports
 * the service so Module C (hotel discovery) can read a hotel's gallery through it, never by querying the
 * table directly (architecture §5, the downward C→N dependency). The storage, scan and download paths
 * arrive in slice 3b.
 */
@Module({
  controllers: [MediaController],
  // The storage adapter, the AV scanner and the image processor are global (StorageModule): ClamAV in
  // production (AV_PROVIDER), and sharp for the metadata-stripped derivatives (feature 9.3c), one image at
  // a time for the whole process (D-187).
  providers: [MediaService, MediaUploadService, MediaRepository],
  exports: [MediaService],
})
export class MediaModule {}
