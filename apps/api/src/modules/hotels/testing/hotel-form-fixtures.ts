import { AppError, CONFIG_REGISTRY, createMemoryLogger, type HotelFormPolicy } from "@ampm/core";
import { vi } from "vitest";

import { requestContext } from "../../../common/request-context.js";
import type { Env } from "../../../env.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { signInKeysFor } from "../../../identity/sign-in-keys.js";
import type { ConfigService } from "../../admin/config/config.service.js";
import { mintLinkSecret } from "../hotel-info-request-link.js";
import type {
  HotelFormRequestsRepository,
  LinkedRequest,
} from "../hotel-form/hotel-form-requests.repository.js";

/*
 * Synthetic hotel form state for the identity step's unit specs (D-189): reserved test mobiles
 * (+91 70000 0XXXX), made-up names, example domains. Test-only: the build leaves `testing/` folders out.
 */

export const FORM_REQUEST_ID = "0192f1a0-0000-7000-8000-0000000000b1";
export const FORM_PERSON_ID = "0192f1a0-0000-7000-8000-0000000000d1";
export const FORM_NOW = new Date("2026-11-25T10:00:00.000Z");
export const FORM_LATER = new Date("2026-12-25T10:00:00.000Z");
export const FORM_SITE = "https://site.synthetic.example";
/** A reserved test mobile, as the contract writes it. */
export const FORM_MOBILE = "+917000001234";
export const FORM_IP = "203.0.113.7";

/** The link the specs open with: its secret and the hash a request stores. */
export const FORM_LINK = mintLinkSecret();

/** The keys of the local identity provider, as the e2e and development run. */
export const FORM_KEYS = signInKeysFor({
  IDENTITY_PROVIDER: "local",
  IDENTITY_LOCAL_SECRET: "l".repeat(40),
});

/** The environment with no SMS provider: codes are shown on screen. */
export const SCREEN_ENV = { SMS_PROVIDER: "console", PUBLIC_SITE_URL: FORM_SITE } as unknown as Env;
/** The environment with a provider and the form's template: codes go by SMS. */
export const SMS_ENV = {
  SMS_PROVIDER: "msg91",
  SMS_API_KEY: "synthetic-key",
  SMS_OTP_TEMPLATE: "synthetic-otp-template",
  SMS_HOTEL_FORM_TEMPLATE: "synthetic-form-template",
  PUBLIC_SITE_URL: FORM_SITE,
} as unknown as Env;

/** A request found by the spec link: open, a test request, on its first link. */
export function linkedRequest(overrides: Partial<LinkedRequest> = {}): LinkedRequest {
  return {
    id: FORM_REQUEST_ID,
    isTest: true,
    status: "open",
    expiresAt: FORM_LATER,
    statusOnlyUntil: null,
    tokenGeneration: 1,
    displayLabel: "Monsoon refresh",
    staffNote: "Rooms first, please",
    hotelDeleted: false,
    tokenHash: FORM_LINK.hash,
    ...overrides,
  };
}

/** A configuration service holding the form's policy, read fresh. */
export function formConfig(policy: Partial<HotelFormPolicy> = {}): ConfigService {
  const value = { ...CONFIG_REGISTRY["hotel_form.policy"].default, mode: "on" as const, ...policy };
  return { getFresh: vi.fn(async () => value) } as unknown as ConfigService;
}

/** The transaction client the fakes are handed; repositories are fakes, so it is never used. */
export const FORM_TX = { kind: "tx" } as unknown as Prisma.TransactionClient;

/** A requests repository finding `row` by the spec link, its transactions run at once. */
export function formRequests(
  row: LinkedRequest | null = linkedRequest(),
  locked: LinkedRequest | null = row,
) {
  const repository = {
    findByLinkHash: vi.fn(async () => row),
    lockForForm: vi.fn(async () => locked),
    alertRecipientIds: vi.fn(async () => []),
    transaction: vi.fn(async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
      work(FORM_TX),
    ),
  };
  return { repository, typed: repository as unknown as HotelFormRequestsRepository };
}

/** Runs `work` inside a request's context, as every route does, and hands back the context. */
export async function inFormRequest<T>(work: () => Promise<T>) {
  const context = { requestId: "req-unit-1", ip: FORM_IP, principal: null, access: null };
  const result = await requestContext.run(context, work);
  return { result, context };
}

/** The refusal an attempt raised, or null when it went through. */
export async function refusalOf(attempt: Promise<unknown>): Promise<AppError | null> {
  try {
    await attempt;
    return null;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
}

/** A memory logger and its entries, as AppLogger's slice the services use. */
export function formLogger() {
  return createMemoryLogger("debug");
}
