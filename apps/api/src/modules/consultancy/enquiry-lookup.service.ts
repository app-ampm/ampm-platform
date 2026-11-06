import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service.js";

/**
 * A minimal, dependency-light read of a hotel enquiry's owning account, exposed for Module B's
 * service-agreement create-time ownership check (api.md: never trust a client-supplied identifier for
 * ownership — look it up and compare). Exposing it as a consultancy-domain SERVICE keeps the
 * service-agreements module off the `hotel_enquiries` table itself (respecting the module boundary),
 * and keeping this service's only dependency the @Global PrismaService (never EnquiriesService) means
 * Module B can use it without a cycle — the consultancy enquiry service already calls
 * ServiceAgreementsService for the AC-05.7 chargeable gate.
 */
@Injectable()
export class EnquiryLookupService {
  constructor(private readonly prisma: PrismaService) {}

  /** The account that owns a live (non-soft-deleted) enquiry, or null when there is no such enquiry. */
  async accountIdForEnquiry(enquiryId: string): Promise<string | null> {
    const row = await this.prisma.hotelEnquiry.findFirst({
      where: { id: enquiryId, deletedAt: null },
      select: { accountId: true },
    });
    return row ? row.accountId : null;
  }
}
