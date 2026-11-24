import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../policy/audit.service.js";
import type { ConfigService } from "../admin/config/config.service.js";
import type {
  HotelRatesRepository,
  VerificationRow,
  VerificationWriteData,
} from "./hotel-rates.repository.js";
import { HotelRatesService } from "./hotel-rates.service.js";
import type { HotelSubresourcesRepository } from "./hotel-subresources.repository.js";

const HOTEL = "0192f1a0-0000-7000-8000-0000000000a1";
const ACTOR = "018f0000-0000-7000-8000-00000000cafe";
const DAY = 24 * 60 * 60 * 1000;
const TX = { name: "the transaction client" };

function build(options: { readonly locked?: boolean } = {}) {
  const calls: string[] = [];
  const repo = {
    hotelExists: vi.fn(async () => true),
    lockHotel: vi.fn(async () => {
      calls.push("lock");
      return options.locked ?? true;
    }),
    createVerification: vi.fn(
      async (hotelId: string, data: VerificationWriteData): Promise<VerificationRow> => {
        calls.push("create");
        return {
          id: "0192f1a0-0000-7000-8000-0000000000f1",
          hotelId,
          verifiedBy: ACTOR,
          status: "verified",
          ...data,
        };
      },
    ),
    recomputeLastVerifiedAt: vi.fn(async () => {
      calls.push("recompute");
    }),
    transaction: <T>(work: (tx: unknown) => Promise<T>): Promise<T> => work(TX),
  };
  const config = { get: vi.fn(async () => ({ maxAgeDays: 30 })) };
  const service = new HotelRatesService(
    repo as unknown as HotelRatesRepository,
    {} as unknown as AuditService,
    config as unknown as ConfigService,
    {} as unknown as HotelSubresourcesRepository,
  );
  return { service, repo, calls };
}

describe("HotelRatesService.recordVerification (AC-04.3)", () => {
  it("locks the hotel, records the verification due one window on, then refreshes the hotel, in one transaction", async () => {
    const { service, repo, calls } = build();
    const verifiedAt = new Date(Date.now() - 2 * DAY).toISOString();
    const view = await service.recordVerification(
      HOTEL,
      { fieldGroup: "policies", source: "contract", verifiedAt },
      ACTOR,
    );
    expect(calls).toEqual(["lock", "create", "recompute"]);
    expect(repo.lockHotel).toHaveBeenCalledWith(HOTEL, TX);
    expect(repo.recomputeLastVerifiedAt).toHaveBeenCalledWith(HOTEL, TX);
    expect(view).toMatchObject({
      fieldGroup: "policies",
      verifiedAt,
      nextDueAt: new Date(Date.parse(verifiedAt) + 30 * DAY).toISOString(),
    });
  });

  it("refuses a future date before any write", async () => {
    const { service, calls } = build();
    const verifiedAt = new Date(Date.now() + DAY).toISOString();
    await expect(
      service.recordVerification(
        HOTEL,
        { fieldGroup: "rates", source: "email", verifiedAt },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(calls).toEqual([]);
  });

  it("answers 404 when the hotel is deleted before its row is locked", async () => {
    const { service, calls } = build({ locked: false });
    await expect(
      service.recordVerification(HOTEL, { fieldGroup: "rates", source: "email" }, ACTOR),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(calls).toEqual(["lock"]);
  });
});
