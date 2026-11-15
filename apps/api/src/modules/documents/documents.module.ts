import { Module } from "@nestjs/common";

import { AV_SCANNER, StubAvScanner } from "../../storage/av-scanner.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsRepository } from "./documents.repository.js";
import { DocumentsService } from "./documents.service.js";

/**
 * Module N — documents (data-model §16, D-132). Owns `documents` and `document_access_links`: stores a
 * file for an owning record and serves it only through a minted, expiring link. Exports the service so
 * an owning module (Module D's booking milestones first) attaches files through it, never by querying
 * these tables (architecture §5, a downward D→N dependency). The storage adapter is global; the AV
 * scanner is the shared fail-closed stub until a real provider is configured.
 */
@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentsRepository,
    { provide: AV_SCANNER, useClass: StubAvScanner },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
