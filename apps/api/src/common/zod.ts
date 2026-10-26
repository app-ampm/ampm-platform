import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { ZodType } from "zod";

/**
 * Validate at the edge (api.md): `@ZodBody(schema) body: z.infer<typeof schema>`. A failed parse
 * throws the ZodError that AppErrorFilter turns into validation_failed with the field paths.
 * Written here because nestjs-zod does not declare NestJS 12 yet.
 */
function fromRequest(pick: (request: Request) => unknown) {
  return createParamDecorator((schema: ZodType, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();
    return schema.parse(pick(request));
  });
}

export const ZodBody = fromRequest((request) => request.body);
export const ZodQuery = fromRequest((request) => request.query);
export const ZodParams = fromRequest((request) => request.params);
