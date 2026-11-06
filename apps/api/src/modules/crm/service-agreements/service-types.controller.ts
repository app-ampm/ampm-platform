import { Controller, Get } from "@nestjs/common";
import type { ServiceTypesResponse } from "@ampm/core";

import { RequirePermission } from "../../../policy/decorators.js";
import { ServiceTypesService } from "./service-types.service.js";

/**
 * The service-type catalogue (Module B), read by staff when drafting an agreement so the create form can
 * offer a `serviceTypeId`. Gated on the agreement read permission (SA/SM/FA) — an unscoped reference list,
 * so no `@CurrentAccess`; it returns the active, non-deleted rows only.
 */
@Controller("crm")
export class ServiceTypesController {
  constructor(private readonly serviceTypes: ServiceTypesService) {}

  @Get("service-types")
  @RequirePermission("crm.service_agreements.read")
  list(): Promise<ServiceTypesResponse> {
    return this.serviceTypes.listActive();
  }
}
