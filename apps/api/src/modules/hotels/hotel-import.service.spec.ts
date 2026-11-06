import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../policy/audit.service.js";
import type { MediaService } from "../media/media.service.js";
import { HotelImportService } from "./hotel-import.service.js";
import type { HotelsAdminRepository } from "./hotels-admin.repository.js";

const CSV = [
  "destinationSlug,name,imageRef",
  "udaipur,The Lake Palace,https://img.example/lake.jpg",
].join("\n");

/**
 * Media is registered through Module N only AFTER the hotel transaction commits (feature 9.3 slice 5b): if
 * the transaction rolls back, no pending media must be left pointing at a hotel that was never written. The
 * e2e proves the happy path (media registered on a successful apply); this pins the rollback ordering.
 */
describe("HotelImportService media-after-commit ordering", () => {
  it("never registers media when the hotel transaction rolls back", async () => {
    const registerImportedImage = vi.fn();
    const repo = {
      // The whole upsert runs inside this transaction; rejecting it models any mid-batch write failure.
      transaction: vi.fn(async () => {
        throw new Error("boom");
      }),
    } as unknown as HotelsAdminRepository;
    const media = { registerImportedImage } as unknown as MediaService;
    const audit = {} as unknown as AuditService;
    const service = new HotelImportService(repo, audit, media);

    await expect(service.import({ content: CSV, dryRun: false }, "actor")).rejects.toThrow("boom");
    expect(registerImportedImage).not.toHaveBeenCalled();
  });
});
