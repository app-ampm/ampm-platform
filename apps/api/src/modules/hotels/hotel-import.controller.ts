import { Controller, HttpCode, Post, Req } from "@nestjs/common";
import {
  HOTEL_IMPORT_MAX_BYTES,
  hotelImportKind,
  hotelImportQuery,
  type HotelImportQuery,
  type HotelImportResult,
} from "@ampm/core";
import type { Request } from "express";
import { z } from "zod";

import { readBoundedBody, type BoundedBodyOptions } from "../../common/bounded-body.js";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { UPLOADS } from "../../common/rate-limit/route-limits.js";
import { ZodParams, ZodQuery } from "../../common/zod.js";
import { CurrentPrincipal, RequirePermission, SelfAudited } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { HotelImportService } from "./hotel-import.service.js";

const importParam = z.object({ kind: hotelImportKind });
type ImportParam = z.infer<typeof importParam>;

/** The file: raw CSV bytes, as a file upload sends them or as text/csv, at most 5 MiB. */
const IMPORT_BODY: BoundedBodyOptions = {
  limitBytes: HOTEL_IMPORT_MAX_BYTES,
  contentTypes: ["application/octet-stream", "text/csv"],
};

/**
 * The staff spreadsheet import (TW-25; AC-35.1; D-181): one CSV template per kind, keyed by web address.
 * The file is the raw request body, read only inside the handler (common/bounded-body.ts; D-176), so
 * authentication, the upload rate limit, the permission and the query have all been checked before a
 * byte is read, and no parser buffers it first (POST_GUARD_PATHS). `?dryRun=true` reports what each row
 * would do and writes nothing but the job. The service audits every row it applies in its own
 * transaction, hence `@SelfAudited`. Slices 3 and 4 add the rooms, venues and rates kinds.
 */
@Controller("hotels-admin")
export class HotelImportController {
  constructor(private readonly imports: HotelImportService) {}

  @Post("imports/:kind")
  @RequirePermission("hotels.hotel_profiles_client_fields.create")
  @RateLimit(UPLOADS)
  @HttpCode(200)
  @SelfAudited()
  async importHotels(
    @ZodParams(importParam) _params: ImportParam,
    @ZodQuery(hotelImportQuery) query: HotelImportQuery,
    @Req() req: Request,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelImportResult> {
    const bytes = await readBoundedBody(req, IMPORT_BODY);
    return this.imports.import(bytes, { dryRun: query.dryRun }, principal);
  }
}
