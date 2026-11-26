import { Injectable } from "@nestjs/common";
import type {
  HotelFormCodeDelivery,
  HotelFormDisplayAnswer,
  HotelInfoRequestConsentKind,
} from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";

/*
 * The people of a hotel information request and their consents (D-189 §1): a person exists only after a
 * correct code and is never a `users` row. One live person per request and phone (the partial unique index
 * hotel_info_request_people_request_phone_live_key, while neither removed nor deleted); a removed person
 * frees their place among the request's `maxPeople`. Consents are append-only: created here (the privacy
 * notice at a correct code; 7.4 and 7.5 at a submit, bound to the revision's hash, D-190), and only ever
 * withdrawn, by their contributor here or by staff.
 */

/** A person as the identity step reads them: their own details only. */
export interface PersonRow {
  readonly id: string;
  readonly fullName: string;
  readonly designation: string;
}

const PERSON_SELECT = { id: true, fullName: true, designation: true } as const;

/** A live person: neither removed by AMPM nor deleted. */
const LIVE = { removedAt: null, deletedAt: null } as const;

/** What a correct code records on its person. */
export interface CodeEntered {
  readonly at: Date;
  readonly delivery: HotelFormCodeDelivery;
}

/** A new person, from the claim their correct code confirmed. */
export interface NewPerson extends CodeEntered {
  readonly requestId: string;
  readonly fullName: string;
  readonly designation: string;
  readonly phone: string;
}

/** The two declarations a submit records against its revision's hash (D-190 §3). */
export interface Declarations {
  readonly personId: string;
  readonly revisionHash: string;
  readonly accuracyVersion: string;
  readonly displayVersion: string;
  readonly display: HotelFormDisplayAnswer;
  readonly ipAddress: string | null;
  readonly at: Date;
}

/** A declaration as recorded: its kind, the words' version and the answer. */
export interface DeclarationRow {
  readonly kind: HotelInfoRequestConsentKind;
  readonly textVersion: string;
  readonly granted: boolean;
}

/** A consent a withdrawal took back. */
export interface WithdrawnConsent {
  readonly id: string;
  readonly kind: HotelInfoRequestConsentKind;
}

/** Only an SMS code checks the mobile; a code shown on screen proves nothing about it. */
const verifiedBy = (entered: CodeEntered) => (entered.delivery === "sms" ? entered.at : undefined);

@Injectable()
export class HotelFormPeopleRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The live person of a request with this phone (E.164); null when none. */
  findLive(
    requestId: string,
    phone: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<PersonRow | null> {
    return tx.hotelInfoRequestPerson.findFirst({
      where: { requestId, phone, ...LIVE },
      select: PERSON_SELECT,
    });
  }

  /** Whether AMPM removed a person of this request with this phone. */
  async wasRemoved(
    requestId: string,
    phone: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const removed = await tx.hotelInfoRequestPerson.count({
      where: { requestId, phone, removedAt: { not: null }, deletedAt: null },
    });
    return removed > 0;
  }

  /** The request's live people, oldest first: who is helping, by name and designation only. */
  contributors(requestId: string): Promise<PersonRow[]> {
    return this.prisma.hotelInfoRequestPerson.findMany({
      where: { requestId, ...LIVE },
      select: PERSON_SELECT,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  /** How many live people the request has: what `maxPeople` caps. */
  countLive(requestId: string, tx: Prisma.TransactionClient): Promise<number> {
    return tx.hotelInfoRequestPerson.count({ where: { requestId, ...LIVE } });
  }

  async create(person: NewPerson, tx: Prisma.TransactionClient): Promise<PersonRow> {
    return tx.hotelInfoRequestPerson.create({
      data: {
        requestId: person.requestId,
        fullName: person.fullName,
        designation: person.designation,
        phone: person.phone,
        codeEnteredAt: person.at,
        codeDelivery: person.delivery,
        phoneVerifiedAt: verifiedBy(person) ?? null,
        lastSeenAt: person.at,
      },
      select: PERSON_SELECT,
    });
  }

  /** A returning person's correct code; their stored name and designation stay as they are. */
  async markReturning(
    id: string,
    entered: CodeEntered,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const verifiedAt = verifiedBy(entered);
    await tx.hotelInfoRequestPerson.update({
      where: { id },
      data: {
        codeEnteredAt: entered.at,
        codeDelivery: entered.delivery,
        lastSeenAt: entered.at,
        ...(verifiedAt === undefined ? {} : { phoneVerifiedAt: verifiedAt }),
      },
    });
  }

  /** Changes a person's own name or designation; answers the person as stored. */
  updateDetails(
    id: string,
    details: { readonly fullName?: string; readonly designation?: string },
    tx: Prisma.TransactionClient,
  ): Promise<PersonRow> {
    return tx.hotelInfoRequestPerson.update({
      where: { id },
      data: details,
      select: PERSON_SELECT,
    });
  }

  /** Records that the person accepted the privacy notice of `textVersion` (no revision: a CHECK). */
  async addNoticeConsent(
    consent: {
      readonly personId: string;
      readonly textVersion: string;
      readonly ipAddress: string | null;
      readonly at: Date;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.hotelInfoRequestConsent.create({
      data: {
        personId: consent.personId,
        kind: "privacy_notice",
        textVersion: consent.textVersion,
        granted: true,
        recordedAt: consent.at,
        ipAddress: consent.ipAddress,
      },
      select: { id: true },
    });
  }
  /**
   * Records 7.4 (accepted, so granted) and 7.5 (`granted` holding the Yes or the No), each with its words'
   * version and bound to the revision's hash (the CHECK requires it); answers their ids.
   */
  async addDeclarations(
    declarations: Declarations,
    tx: Prisma.TransactionClient,
  ): Promise<string[]> {
    const { personId, revisionHash, ipAddress, at } = declarations;
    const common = { personId, revisionHash, ipAddress, recordedAt: at };
    const accuracy = await tx.hotelInfoRequestConsent.create({
      data: {
        ...common,
        kind: "accuracy_attestation",
        textVersion: declarations.accuracyVersion,
        granted: true,
      },
      select: { id: true },
    });
    const display = await tx.hotelInfoRequestConsent.create({
      data: {
        ...common,
        kind: "display_authorisation",
        textVersion: declarations.displayVersion,
        granted: declarations.display === "yes",
      },
      select: { id: true },
    });
    return [accuracy.id, display.id];
  }

  /** The declarations a person recorded against a revision's hash, newest first. */
  declarationsOf(
    personId: string,
    revisionHash: string,
    tx: Prisma.TransactionClient,
  ): Promise<DeclarationRow[]> {
    return tx.hotelInfoRequestConsent.findMany({
      where: {
        personId,
        revisionHash,
        kind: { in: ["accuracy_attestation", "display_authorisation"] },
        deletedAt: null,
      },
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
      select: { kind: true, textVersion: true, granted: true },
    });
  }

  /**
   * Withdraws the person's live consents of `kinds`, as their own act (source `contributor`); answers the
   * ones it took back, none when nothing was live.
   */
  async withdrawLive(
    personId: string,
    kinds: readonly HotelInfoRequestConsentKind[],
    at: Date,
    tx: Prisma.TransactionClient,
  ): Promise<WithdrawnConsent[]> {
    const live = await tx.hotelInfoRequestConsent.findMany({
      where: { personId, kind: { in: [...kinds] }, withdrawnAt: null, deletedAt: null },
      orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
      select: { id: true, kind: true },
    });
    if (live.length === 0) return [];
    await tx.hotelInfoRequestConsent.updateMany({
      where: { id: { in: live.map((consent) => consent.id) }, withdrawnAt: null },
      data: { withdrawnAt: at, withdrawalSource: "contributor" },
    });
    return live;
  }
}
