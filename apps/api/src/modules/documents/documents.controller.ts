import { Controller, Get, Res } from "@nestjs/common";
import { uuid } from "@ampm/core";
import type { Response } from "express";
import { z } from "zod";

import { sendFile } from "../../common/file-response.js";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { ZodParams } from "../../common/zod.js";
import { Public } from "../../policy/decorators.js";
import { DocumentsService } from "./documents.service.js";

// The link id names the row; the token (43 base64url characters for 32 random bytes) is its secret.
const linkParams = z.object({
  linkId: uuid,
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
type LinkParams = z.infer<typeof linkParams>;

/**
 * The byte stream a minted document link points at (Module N, D-132). Public because the link itself is
 * the capability: the owning module checked the principal's access to the record before minting it, and
 * this route checks the token, expiry, revocation and download cap. Anything wrong is a 404 (denial
 * equals absence). Never cached; served restrictively under its detected type with a PII-free file name
 * (common/file-response.ts; D-187 §5: no active content, same-site only, inline only for a PDF or a
 * raster image). Limited per network and failing open (D-149): the token, not the limiter, is the gate,
 * and the link's own download cap bounds each document.
 */
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get("links/:linkId/:token")
  @Public()
  @RateLimit({ name: "documents.link", limit: 60, windowMs: 60_000, failClosed: false })
  async open(@ZodParams(linkParams) params: LinkParams, @Res() res: Response): Promise<void> {
    const blob = await this.documents.open(params.linkId, params.token);
    sendFile(res, { ...blob, cacheControl: "private, no-store" });
  }
}
