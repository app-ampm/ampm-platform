import { Module } from "@nestjs/common";

import { FieldNoteController } from "./field-note.controller.js";
import { FieldNoteService } from "./field-note.service.js";

/**
 * SPIKE STAND-IN — sprint 2 offline spike (docs/review/build-plan.md §11.4). One throwaway module
 * carrying the offline-capable "field note" mutation; removed when the real operational records land.
 */
@Module({ controllers: [FieldNoteController], providers: [FieldNoteService] })
export class SpikeModule {}
