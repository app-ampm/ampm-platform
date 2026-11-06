import { Module } from "@nestjs/common";

import { EnquiryLookupService } from "./enquiry-lookup.service.js";

/**
 * A leaf module exposing {@link EnquiryLookupService}: the consultancy-domain read of an enquiry's
 * owning account that Module B's service-agreement create uses to verify ownership. It depends only on
 * the @Global PrismaService, so importing it introduces no cycle with ServiceAgreementsModule (which the
 * consultancy enquiry service imports for the AC-05.7 gate). ConsultancyModule keeps providing its own
 * EnquiriesRepository; this module is deliberately separate so neither has to import the other.
 */
@Module({
  providers: [EnquiryLookupService],
  exports: [EnquiryLookupService],
})
export class EnquiryLookupModule {}
