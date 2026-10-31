import { Controller, Put } from "@nestjs/common";
import { configWriteRequest, type ConfigView, type ConfigWriteRequest } from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams } from "../../../common/zod.js";
import { RequirePermission, SelfAudited } from "../../../policy/decorators.js";
import { ConfigService } from "./config.service.js";

const keyParams = z.object({ key: z.string().min(1) });
type KeyParams = z.infer<typeof keyParams>;

/**
 * `PUT /admin/configurations/:key` — a Super Admin sets a configuration value (plans, limits,
 * thresholds, templates, feature switches). Gated by `admin.configurations.update` (SA only,
 * permission-matrix §5.1); the service validates the value against the key's schema and audits the
 * change with before/after images (the audit-on-mutation pattern).
 */
@Controller("admin/configurations")
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Put(":key")
  @RequirePermission("admin.configurations.update")
  @SelfAudited()
  set(
    @ZodParams(keyParams) params: KeyParams,
    @ZodBody(configWriteRequest) body: ConfigWriteRequest,
  ): Promise<ConfigView> {
    return this.config.set(params.key, body.value);
  }
}
