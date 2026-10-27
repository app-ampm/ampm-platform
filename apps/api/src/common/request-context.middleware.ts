import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { requestContext } from "./request-context.js";

const REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Step 0 of every request: a request id (a well-formed caller's id kept, otherwise minted) on the
 * response and on a new request context, which everything after it runs in. configureHttp
 * registers it as plain Express middleware ahead of the body parser, the only place it is
 * registered, so a parser refusal carries the id and its log line has it too.
 *
 * @example
 * app.use(requestContextMiddleware);
 * app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("x-request-id", requestId);
  requestContext.run({ requestId, ip: req.ip ?? null, principal: null, access: null }, () =>
    next(),
  );
}
