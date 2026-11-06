import { Injectable } from "@nestjs/common";
import type { ServiceTypesResponse } from "@ampm/core";

import { ServiceTypesRepository } from "./service-types.repository.js";
import { toServiceTypeView } from "./service-types.view.js";

/**
 * Service types (Module B, data-model §4): the fixed v1 catalogue an agreement's `serviceTypeId` points
 * at. Reference data a Super-Admin may extend later; staff read it to draft an agreement.
 */
@Injectable()
export class ServiceTypesService {
  constructor(private readonly serviceTypes: ServiceTypesRepository) {}

  async listActive(): Promise<ServiceTypesResponse> {
    const rows = await this.serviceTypes.listActive();
    return { items: rows.map(toServiceTypeView) };
  }
}
