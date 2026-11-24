import { Module } from "@nestjs/common";

import { DocumentVersionsService } from "./document-versions.service.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsRepository } from "./documents.repository.js";
import { DocumentsService } from "./documents.service.js";

/**
 * Module N — documents (data-model §16, D-132). Owns `documents` and `document_access_links`: stores a
 * file for an owning record and serves it only through a minted, expiring link. Exports the services so
 * an owning module (Module D's booking milestones first) attaches files through them, never by querying
 * these tables (architecture §5, a downward D→N dependency); an owner that keeps a library of versions
 * (a hotel's documents, D-187 §6) lists and removes them through DocumentVersionsService. The storage
 * adapter, the AV scanner and the image processor are global (StorageModule; ClamAV in production,
 * chosen by AV_PROVIDER).
 */
@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentVersionsService, DocumentsRepository],
  exports: [DocumentsService, DocumentVersionsService],
})
export class DocumentsModule {}
