import { Body, Param, Query, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Validate at the edge (api.md): `@ZodBody(schema) body: z.infer<typeof schema>`, and the same for
 * the params and the query. A failed parse throws the ZodError that AppErrorFilter turns into
 * validation_failed with the field paths. Written here because nestjs-zod does not declare NestJS 12
 * yet.
 *
 * Pipes on the built-in decorators, not a custom parameter decorator: Nest treats any argument with
 * a `transform` method as a pipe, and every Zod schema has one, so a schema passed as the decorator's
 * data was taken for a pipe and the handler received nothing to parse.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}

export const ZodBody = <T>(schema: ZodType<T>): ParameterDecorator =>
  Body(new ZodValidationPipe(schema));

export const ZodQuery = <T>(schema: ZodType<T>): ParameterDecorator =>
  Query(new ZodValidationPipe(schema));

export const ZodParams = <T>(schema: ZodType<T>): ParameterDecorator =>
  Param(new ZodValidationPipe(schema));
