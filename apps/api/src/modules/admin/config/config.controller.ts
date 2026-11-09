import { Controller, Get, Put } from "@nestjs/common";
import {
  configWriteRequest,
  type ConfigListView,
  type ConfigView,
  type ConfigWriteRequest,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams } from "../../../common/zod.js";
import { RequirePermission, SelfAudited } from "../../../policy/decorators.js";
import { ConfigService } from "./config.service.js";

const keyParams = z.object({ key: z.string().min(1) });
type KeyParams = z.infer<typeof keyParams>;

/**
 * `/admin/configurations` lists every key; `/admin/configurations/:key` — a Super Admin or Finance
 * reads (`GET`, `admin.configurations.read`);
 * a Super Admin sets (`PUT`, `admin.configurations.update`) a configuration value: plans, limits,
 * thresholds, notification templates, feature switches (permission-matrix §5.1). An unknown key is
 * absence (404). The write
 * validates the value against the key's schema and audits the change with before/after images (the
 * audit-on-mutation pattern); a read is not audited (configuration values are not restricted).
 */
@Controller("admin/configurations")
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @RequirePermission("admin.configurations.read")
  list(): Promise<ConfigListView> {
    return this.config.list();
  }

  @Get(":key")
  @RequirePermission("admin.configurations.read")
  read(@ZodParams(keyParams) params: KeyParams): Promise<ConfigView> {
    return this.config.read(params.key);
  }

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
