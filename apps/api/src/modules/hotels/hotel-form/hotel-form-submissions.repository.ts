import { Injectable } from "@nestjs/common";
import type { HotelInfoRequestKind } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { formNameOf, NAMED_PERSON_SELECT } from "./hotel-form-named-person.js";
import { FORM_REQUEST_SELECT, toFormRequest } from "./hotel-form-requests.repository.js";
import type { FormRequest } from "./hotel-form-state.js";

/*
 * What the hotel form's draft, submit, corrections and withdrawal read and write of a request beyond the
 * identity step (D-190 §1 and §3): its submission (kind, reference, revision, who submitted and when, read
 * under the request's lock for a change), its immutable revisions, its corrections, and whether a person
 * already asked to have their details removed. Nothing from the catalogue, but for the staff notice's
 * subject, which only staff read. Soft-deleted rows are left out. Module C, as the request tables are.
 */

const SUBMISSION_SELECT = {
  ...FORM_REQUEST_SELECT,
  reference: true,
  kind: true,
  revision: true,
  submittedAt: true,
  submittedBy: { select: NAMED_PERSON_SELECT },
} as const satisfies Prisma.HotelInfoRequestSelect;

type SubmissionRow = Prisma.HotelInfoRequestGetPayload<{ select: typeof SUBMISSION_SELECT }>;

/** A request as the form's sections and submit read it: its state, and its submission so far. */
export interface FormSubmission extends FormRequest {
  readonly reference: string;
  readonly kind: HotelInfoRequestKind;
  /** The latest submitted revision's number; 0 until the first submit. */
  readonly revision: number;
  readonly submittedAt: Date | null;
  /**
   * The name of the person who submitted the latest revision: null until then, and null once they
   * withdrew their privacy notice consent (the form's views only: hotel-form-named-person.ts).
   */
  readonly submittedBy: string | null;
}

function toSubmission(row: SubmissionRow): FormSubmission {
  const { reference, kind, revision, submittedAt, submittedBy, ...request } = row;
  return {
    ...toFormRequest(request),
    reference,
    kind,
    revision,
    submittedAt,
    submittedBy: submittedBy === null ? null : formNameOf(submittedBy),
  };
}

/** A submitted revision as a repeat of its submit compares it. */
export interface RevisionRow {
  readonly id: string;
  readonly revision: number;
  readonly answersHash: string;
  readonly submittedByPersonId: string;
  readonly submittedAt: Date;
}

/** A new revision: every section's answers and their hash, by whom and when. */
export interface NewRevision {
  readonly requestId: string;
  readonly revision: number;
  readonly answers: Prisma.InputJsonObject;
  readonly answersHash: string;
  readonly submittedByPersonId: string;
  readonly submittedAt: Date;
}

/** What a staff notice names a request by: its reference, and the hotel's name as AMPM knows it. */
export interface NoticeSubject {
  readonly reference: string;
  /** The catalogue's name, else the staff label, else the name staff proposed; never typed by a hotel. */
  readonly name: string;
}

@Injectable()
export class HotelFormSubmissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The request's submission as it stands; null when the request is gone or deleted. */
  async find(requestId: string): Promise<FormSubmission | null> {
    const row = await this.prisma.hotelInfoRequest.findFirst({
      where: { id: requestId, deletedAt: null },
      select: SUBMISSION_SELECT,
    });
    return row === null ? null : toSubmission(row);
  }

  /**
   * Locks the request's row until the transaction ends, then reads its submission: a section's save, a
   * submit, a correction and a withdrawal take it first, so they land one at a time on a request, and a
   * staff move (revoke, request changes) that is writing is waited for and seen. Null when it is gone.
   */
  async lock(requestId: string, tx: Prisma.TransactionClient): Promise<FormSubmission | null> {
    await tx.$queryRaw`
      SELECT id FROM hotel_info_requests WHERE id = ${requestId}::uuid AND deleted_at IS NULL FOR UPDATE`;
    const row = await tx.hotelInfoRequest.findFirst({
      where: { id: requestId, deletedAt: null },
      select: SUBMISSION_SELECT,
    });
    return row === null ? null : toSubmission(row);
  }

  /** The request's latest revision; null before its first submit. */
  latestRevision(requestId: string, tx: Prisma.TransactionClient): Promise<RevisionRow | null> {
    return tx.hotelInfoRequestRevision.findFirst({
      where: { requestId, deletedAt: null },
      orderBy: { revision: "desc" },
      select: {
        id: true,
        revision: true,
        answersHash: true,
        submittedByPersonId: true,
        submittedAt: true,
      },
    });
  }

  /** Writes a revision, immutable from then on; answers its id. */
  async createRevision(revision: NewRevision, tx: Prisma.TransactionClient): Promise<string> {
    const row = await tx.hotelInfoRequestRevision.create({
      data: { ...revision, files: [] },
      select: { id: true },
    });
    return row.id;
  }

  /** Stores a person's correction message (RESTRICTED-CONTACT); answers its id. */
  async createCorrection(
    correction: { readonly requestId: string; readonly personId: string; readonly message: string },
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const row = await tx.hotelInfoRequestCorrection.create({
      data: correction,
      select: { id: true },
    });
    return row.id;
  }

  /** Whether the person already asked, on this request, to have their details removed. */
  async hasRemovalRequest(
    requestId: string,
    personId: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const asked = await tx.hotelInfoRequestEvent.count({
      where: {
        requestId,
        actorPersonId: personId,
        eventType: "removal_requested",
        deletedAt: null,
      },
    });
    return asked > 0;
  }

  /**
   * What a staff notice names the request by (D-190 §4). The only read of the catalogue on the form's
   * paths, and its answer goes to staff alone, never to the form.
   */
  async noticeSubject(requestId: string): Promise<NoticeSubject | null> {
    const row = await this.prisma.hotelInfoRequest.findFirst({
      where: { id: requestId },
      select: {
        reference: true,
        displayLabel: true,
        proposedName: true,
        hotel: { select: { name: true } },
      },
    });
    if (row === null) return null;
    const name = row.hotel?.name ?? row.displayLabel ?? row.proposedName ?? row.reference;
    return { reference: row.reference, name };
  }
}
