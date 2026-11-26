import { Injectable } from "@nestjs/common";
import type { HotelFormSectionKey } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { formNameOf, NAMED_PERSON_SELECT } from "./hotel-form-named-person.js";

/*
 * A request's shared draft (D-190 §1): one row per section, made at its first save, written only through a
 * version check, so a colleague's newer save is never overwritten. The answers are stored as their
 * canonical JSON with its SHA-256 (hotel-form-content.ts); the last editor is a person of the request,
 * read back by name only, and not even that once they withdrew their privacy notice consent. Soft-deleted
 * rows are left out. Module C, as the request tables are.
 */

const SECTION_SELECT = {
  sectionKey: true,
  schemaVersion: true,
  answers: true,
  contentHash: true,
  version: true,
  isComplete: true,
  noChanges: true,
  lastEditedAt: true,
  lastEditorPersonId: true,
  lastEditor: { select: NAMED_PERSON_SELECT },
} as const satisfies Prisma.HotelInfoRequestSectionSelect;

type SectionSelected = Prisma.HotelInfoRequestSectionGetPayload<{ select: typeof SECTION_SELECT }>;

/** A saved section as the form reads it. */
export interface SectionRow {
  readonly sectionKey: HotelFormSectionKey;
  readonly schemaVersion: number;
  /** The answers as stored: canonical JSON, read through the section's draft before any use. */
  readonly answers: Prisma.JsonValue;
  readonly contentHash: string;
  readonly version: number;
  readonly isComplete: boolean;
  readonly noChanges: boolean;
  readonly lastEditedAt: Date;
  /** The person who saved it last: compared with a session's person, never sent to the page. */
  readonly lastEditorPersonId: string;
  /**
   * The last editor's name (RESTRICTED-CONTACT, shown to the request's people), or null once they
   * withdrew their privacy notice consent (hotel-form-named-person.ts).
   */
  readonly lastEditedBy: string | null;
}

function toSectionRow({ lastEditor, ...row }: SectionSelected): SectionRow {
  return { ...row, lastEditedBy: formNameOf(lastEditor) };
}

/** What a save writes: the content, its completeness and "No changes", by whom and when. */
export interface SectionWrite {
  readonly schemaVersion: number;
  readonly answers: Prisma.InputJsonObject;
  readonly contentHash: string;
  readonly isComplete: boolean;
  readonly noChanges: boolean;
  readonly editorPersonId: string;
  readonly at: Date;
}

const columnsOf = (write: SectionWrite) => ({
  schemaVersion: write.schemaVersion,
  answers: write.answers,
  contentHash: write.contentHash,
  isComplete: write.isComplete,
  noChanges: write.noChanges,
  lastEditorPersonId: write.editorPersonId,
  lastEditedAt: write.at,
});

@Injectable()
export class HotelFormSectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Every saved section of a request, in no particular order. */
  async list(requestId: string, tx: Prisma.TransactionClient = this.prisma): Promise<SectionRow[]> {
    const rows = await tx.hotelInfoRequestSection.findMany({
      where: { requestId, deletedAt: null },
      select: SECTION_SELECT,
    });
    return rows.map(toSectionRow);
  }

  /** One saved section; null before its first save. */
  async find(
    requestId: string,
    sectionKey: HotelFormSectionKey,
    tx: Prisma.TransactionClient,
  ): Promise<SectionRow | null> {
    const row = await tx.hotelInfoRequestSection.findFirst({
      where: { requestId, sectionKey, deletedAt: null },
      select: SECTION_SELECT,
    });
    return row === null ? null : toSectionRow(row);
  }

  /**
   * A section's first save, at version 1. False when a row holds the request and section already
   * (`ON CONFLICT DO NOTHING`), so a first save racing another is refused as a conflict, never a 500.
   */
  async createFirst(
    requestId: string,
    sectionKey: HotelFormSectionKey,
    write: SectionWrite,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const { count } = await tx.hotelInfoRequestSection.createMany({
      data: [{ requestId, sectionKey, version: 1, ...columnsOf(write) }],
      skipDuplicates: true,
    });
    return count === 1;
  }

  /** Writes the next version while the section is still at `expectedVersion`: 1 written, 0 moved on. */
  async updateIf(
    requestId: string,
    sectionKey: HotelFormSectionKey,
    expectedVersion: number,
    write: SectionWrite,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const { count } = await tx.hotelInfoRequestSection.updateMany({
      where: { requestId, sectionKey, version: expectedVersion, deletedAt: null },
      data: { ...columnsOf(write), version: { increment: 1 } },
    });
    return count;
  }
}
