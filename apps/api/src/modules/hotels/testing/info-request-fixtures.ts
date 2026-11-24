import {
  CONFIG_REGISTRY,
  type HotelFormPolicy,
  type HotelInfoRequestLinkEmail,
  type HotelStatus,
} from "@ampm/core";
import { vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { Env } from "../../../env.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { ConfigService } from "../../admin/config/config.service.js";
import { HotelInfoRequestIssueService } from "../hotel-info-request-issue.service.js";
import type { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import type { HotelInfoRequestMailer } from "../hotel-info-request-mailer.js";
import type { HotelInfoRequestReader } from "../hotel-info-request-reader.js";
import type {
  HotelInfoRequestsRepository,
  LiveRequestRef,
  LockedHotel,
  RequestRow,
} from "../hotel-info-requests.repository.js";

/*
 * Synthetic hotel information requests for the unit specs (data.md: fictitious names, example domains).
 * Test-only: the build leaves `testing/` folders out.
 */

export const REQUEST_ID = "0192f1a0-0000-7000-8000-0000000000b1";
export const HOTEL_ID = "0192f1a0-0000-7000-8000-0000000000a1";
export const DESTINATION_ID = "0192f1a0-0000-7000-8000-0000000000a2";
export const SITE = "https://site.synthetic.example";
export const AT = new Date("2026-11-24T10:00:00.000Z");

/** A stored request as the repository reads it: open, for the synthetic hotel. */
export function requestRow(overrides: Partial<RequestRow> = {}): RequestRow {
  return {
    id: REQUEST_ID,
    reference: "HIR-2026-0007",
    kind: "onboarding",
    target: "existing",
    hotelId: HOTEL_ID,
    proposedName: null,
    proposedDestinationId: null,
    proposedWebAddress: null,
    officialWebsite: null,
    switchboardPhone: null,
    switchboardSource: null,
    isTest: false,
    status: "open",
    expiresAt: new Date("2099-12-24T10:00:00.000Z"),
    statusOnlyUntil: null,
    displayLabel: null,
    staffNote: null,
    tokenGeneration: 1,
    linkIssuedAt: AT,
    linkEmailedAt: null,
    recipientName: "Synthetic Sales Desk",
    recipientEmail: "sales@synthetic-hotel.example",
    revokedAt: null,
    revokeReason: null,
    createdAt: AT,
    updatedAt: AT,
    hotel: { name: "Synthetic Lake Hotel", destination: { name: "Synthetic Coast" } },
    proposedDestination: null,
    ...overrides,
  };
}

/** What the issue service's fakes hold: the hotel's status, the stored request, the policy. */
export interface IssueFakeOptions {
  readonly policy?: Partial<HotelFormPolicy>;
  readonly hotelStatus?: HotelStatus;
  readonly row?: RequestRow;
}

/** A repository holding one hotel and one request; its transaction draws reference number 7. */
function issueRepo(options: IssueFakeOptions) {
  const tx = { $queryRaw: vi.fn(async () => [{ value: 7n }]) };
  const hotel: LockedHotel = {
    id: HOTEL_ID,
    name: "Synthetic Lake Hotel",
    status: options.hotelStatus ?? "active",
  };
  const destination = { id: DESTINATION_ID, name: "Synthetic Coast" };
  return {
    transaction: vi.fn(async <T>(work: (client: Prisma.TransactionClient) => Promise<T>) =>
      work(tx as unknown as Prisma.TransactionClient),
    ),
    lockLiveHotel: vi.fn(async (): Promise<LockedHotel | null> => hotel),
    findLiveForHotel: vi.fn(async (): Promise<LiveRequestRef | null> => null),
    findDestination: vi.fn(async (): Promise<{ id: string; name: string } | null> => destination),
    findLiveForAddress: vi.fn(async (): Promise<LiveRequestRef | null> => null),
    create: vi.fn(async (_data: unknown): Promise<string> => REQUEST_ID),
    findById: vi.fn(async (): Promise<RequestRow | null> => options.row ?? requestRow()),
    lockById: vi.fn(async (): Promise<RequestRow | null> => options.row ?? requestRow()),
    updateIf: vi.fn(async (..._args: unknown[]): Promise<number> => 1),
  };
}

/** The issue service over fakes: a repository holding one hotel and one request, and the policy given. */
export function buildIssueService(options: IssueFakeOptions = {}) {
  const repo = issueRepo(options);
  const journal = { event: vi.fn(async () => undefined), record: vi.fn(async () => undefined) };
  const mailer = {
    sendLink: vi.fn(
      async (..._args: unknown[]): Promise<HotelInfoRequestLinkEmail> => "not_requested",
    ),
  };
  const reader = {
    detail: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ id: REQUEST_ID })),
  };
  const logger = {
    warn: vi.fn((_event: string, _fields?: unknown): void => undefined),
    info: vi.fn((_event: string, _fields?: unknown): void => undefined),
  };
  const policy = { ...CONFIG_REGISTRY["hotel_form.policy"].default, ...options.policy };
  const config = { get: vi.fn(async () => policy), getFresh: vi.fn(async () => policy) };
  const service = new HotelInfoRequestIssueService(
    repo as unknown as HotelInfoRequestsRepository,
    journal as unknown as HotelInfoRequestJournal,
    mailer as unknown as HotelInfoRequestMailer,
    reader as unknown as HotelInfoRequestReader,
    config as unknown as ConfigService,
    { PUBLIC_SITE_URL: SITE } as unknown as Env,
    logger as unknown as AppLogger,
  );
  return { service, repo, journal, mailer, reader, config, logger };
}

/**
 * Every argument the given fakes were called with, as text: where a link's secret must never appear. The
 * mailer is left out by its callers, as the queued email is where the link legitimately goes.
 */
export function everythingWritten(fakes: Readonly<Record<string, unknown>>): string {
  const calls = Object.values(fakes).flatMap((fake) =>
    Object.values(fake as Record<string, { mock?: { calls: unknown[] } }>).flatMap(
      (member) => member?.mock?.calls ?? [],
    ),
  );
  return JSON.stringify(calls, (_key, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}
