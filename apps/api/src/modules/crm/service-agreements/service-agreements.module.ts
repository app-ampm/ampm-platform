import { Module } from "@nestjs/common";

import { EnquiryLookupModule } from "../../consultancy/enquiry-lookup.module.js";
import { PolicyModule } from "../../../policy/policy.module.js";
import { ServiceAgreementsClientController } from "./service-agreements-client.controller.js";
import { ServiceAgreementsClientService } from "./service-agreements-client.service.js";
import { ServiceAgreementsController } from "./service-agreements.controller.js";
import { ServiceAgreementsRepository } from "./service-agreements.repository.js";
import { ServiceAgreementsService } from "./service-agreements.service.js";
import { ServiceTypesController } from "./service-types.controller.js";
import { ServiceTypesRepository } from "./service-types.repository.js";
import { ServiceTypesService } from "./service-types.service.js";

/**
 * Module B — paid-service agreements (feature 10.2, GP-5): the commercial contract for a paid service
 * beyond the subscription. The staff workspace (`crm.service_agreements.*`) drives the hand-rolled
 * draft→sent→accepted→active→completed lifecycle; the client portal views and accepts its own (account-
 * scoped, not entitlement-gated). An `active` agreement grants `hotel_assistance`, so activation busts
 * the account's entitlement cache — PolicyModule provides PrincipalService for that; AuditService is
 * @Global. ServiceAgreementsService is exported so the consultancy module can run the AC-05.7 gate
 * (hasActiveForEnquiry) through a service call, never by reading this module's tables. The reciprocal
 * read — resolving a `hotel_enquiry`'s owning account when staff draft an agreement against it — comes
 * through EnquiryLookupModule's service, a dependency-light leaf so the two modules do not form a cycle.
 */
@Module({
  imports: [PolicyModule, EnquiryLookupModule],
  controllers: [
    ServiceAgreementsController,
    ServiceAgreementsClientController,
    ServiceTypesController,
  ],
  providers: [
    ServiceAgreementsService,
    ServiceAgreementsClientService,
    ServiceAgreementsRepository,
    ServiceTypesService,
    ServiceTypesRepository,
  ],
  exports: [ServiceAgreementsService],
})
export class ServiceAgreementsModule {}
