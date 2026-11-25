import { HOTEL_FORM_NOTICE_VERSION, type HotelFormCodeRequest } from "@ampm/core";
import { vi } from "vitest";

import type { BotCheckAdapter } from "../../../common/bot-check/bot-check.adapter.js";
import type { AppLogger } from "../../../common/logger.service.js";
import type { Env } from "../../../env.js";
import type { AuditService } from "../../../policy/audit.service.js";
import type { NotificationService } from "../../admin/notification/notification.service.js";
import type { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import type {
  HotelFormChallengesRepository,
  NewChallenge,
} from "../hotel-form/hotel-form-challenges.repository.js";
import { HotelFormCodeIssuer } from "../hotel-form/hotel-form-code-issuer.service.js";
import { HotelFormGate } from "../hotel-form/hotel-form-gate.js";
import type { HotelFormLimits } from "../hotel-form/hotel-form-limits.js";
import type { BurnedChallenge } from "../hotel-form/hotel-form-lock.js";
import type { HotelFormPeopleRepository } from "../hotel-form/hotel-form-people.repository.js";
import {
  FORM_IP,
  FORM_KEYS,
  FORM_LINK,
  FORM_MOBILE,
  FORM_NOW,
  formConfig,
  formLogger,
  formRequests,
  inFormRequest,
  linkedRequest,
  SCREEN_ENV,
} from "./hotel-form-fixtures.js";

/*
 * The code issuer's unit harness (D-189 §2 to §4): the real gate over fake repositories, limits, journal,
 * audit, notifications and bot check, recording the challenges created and the order of the writes.
 * Test-only: the build leaves `testing/` folders out.
 */

export const BODY: HotelFormCodeRequest = {
  token: FORM_LINK.secret,
  fullName: "Synthetic Person",
  designation: "General Manager",
  mobile: FORM_MOBILE,
  noticeVersion: HOTEL_FORM_NOTICE_VERSION,
  botToken: "turnstile-pass",
};
export const CLIENT = { ip: FORM_IP, userAgent: "Synthetic Browser/1.0" };

export interface IssuerOptions {
  readonly env?: Env;
  readonly removed?: boolean;
  readonly live?: boolean;
  readonly burns?: BurnedChallenge[];
  readonly human?: boolean;
  readonly smsFails?: boolean;
}

/** The challenges repository's fake, recording what it created and the order of the writes. */
function fakeChallenges(options: IssuerOptions) {
  const created: NewChallenge[] = [];
  const order: string[] = [];
  const challenges = {
    recentBurns: vi.fn(async () => options.burns ?? []),
    retireOpen: vi.fn(async () => {
      order.push("retireOpen");
      return 1;
    }),
    create: vi.fn(async (data: NewChallenge) => {
      order.push("create");
      created.push(data);
    }),
    retire: vi.fn(async () => undefined),
  };
  return { challenges, created, order };
}

/** The collaborators beyond the repositories: limits, journal, audit, notifications, bot check. */
function fakeCollaborators(options: IssuerOptions) {
  return {
    people: {
      wasRemoved: vi.fn(async () => options.removed ?? false),
      findLive: vi.fn(async () =>
        options.live ? { id: "p1", fullName: "Kept", designation: "Kept" } : null,
      ),
    },
    limits: {
      allowCodeRequest: vi.fn(async () => undefined),
      allowSms: vi.fn(async () => undefined),
    },
    journal: { event: vi.fn(async () => undefined) },
    audit: { record: vi.fn(async () => undefined) },
    queue: vi.fn(async () => {
      if (options.smsFails) throw new Error(`insert failed for ${FORM_MOBILE}`);
      return { suppressed: false as const, notificationId: "n1" };
    }),
    verify: vi.fn(async () => options.human ?? true),
  };
}

/** The issuer over the real gate and the fakes, with the fakes to inspect. */
export function buildIssuer(options: IssuerOptions = {}) {
  const { repository, typed } = formRequests(linkedRequest());
  const { challenges, created, order } = fakeChallenges(options);
  const fakes = fakeCollaborators(options);
  const { logger, entries } = formLogger();
  const issuer = new HotelFormCodeIssuer(
    new HotelFormGate(formConfig({ smsDailyCap: 300 }), typed),
    typed,
    challenges as unknown as HotelFormChallengesRepository,
    fakes.people as unknown as HotelFormPeopleRepository,
    fakes.limits as unknown as HotelFormLimits,
    fakes.journal as unknown as HotelInfoRequestJournal,
    fakes.audit as unknown as AuditService,
    { queue: fakes.queue } as unknown as NotificationService,
    logger as unknown as AppLogger,
    { verify: fakes.verify } as unknown as BotCheckAdapter,
    FORM_KEYS,
    options.env ?? SCREEN_ENV,
  );
  return { issuer, repository, challenges, created, order, entries, ...fakes };
}

export const issueWith = (
  built: ReturnType<typeof buildIssuer>,
  body: HotelFormCodeRequest = BODY,
) => inFormRequest(() => built.issuer.issue(body, CLIENT, FORM_NOW));
