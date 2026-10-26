import { randomUUID } from "node:crypto";

import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { requestContext } from "./request-context.js";

const REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/** Step 0 of every request: a request id (kept from a trusted caller or minted) on the context and the response. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header("x-request-id");
    const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader("x-request-id", requestId);
    requestContext.run({ requestId, ip: req.ip ?? null, principal: null }, () => next());
  }
}
