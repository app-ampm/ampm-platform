import { Body, Param, Query, type PipeTransform } from "@nestjs/common";
import { errors } from "@ampm/core";
import type { ZodType } from "zod";

/**
 * Validate at the edge (api.md): `@ZodBody(schema) body: z.infer<typeof schema>`, and the same for
 * the params and the query. A failed parse throws a typed validation_failed error with the field
 * paths, so AppErrorFilter can tell a caller's bad input (400) from a schema failure inside the API,
 * such as a stored row that breaks a response model (500, logged as an error). Written here because
 * nestjs-zod does not declare NestJS 12 yet.
 *
 * Pipes on the built-in decorators, not a custom parameter decorator: Nest treats any argument with
 * a `transform` method as a pipe, and every Zod schema has one, so a schema passed as the decorator's
 * data was taken for a pipe and the handler received nothing to parse.
 *
 * @example
 * \@Post()
 * create(\@ZodParams(projectParams) params: ProjectParams, \@ZodBody(noteUpsert) body: NoteUpsert) {}
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw errors.validation(
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }
}

export const ZodBody = <T>(schema: ZodType<T>): ParameterDecorator =>
  Body(new ZodValidationPipe(schema));

export const ZodQuery = <T>(schema: ZodType<T>): ParameterDecorator =>
  Query(new ZodValidationPipe(schema));

export const ZodParams = <T>(schema: ZodType<T>): ParameterDecorator =>
  Param(new ZodValidationPipe(schema));
