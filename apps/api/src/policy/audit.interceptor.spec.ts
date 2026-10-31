import "reflect-metadata";

import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { lastValueFrom, of } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { requestContext, type RequestContext } from "../common/request-context.js";
import type { AuditInput, AuditService } from "./audit.service.js";
import { AuditInterceptor } from "./audit.interceptor.js";
import { Audited, AuditExempt, SelfAudited } from "./decorators.js";
import type { Principal } from "./principal.types.js";

interface Request {
  readonly method: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** A handler carrying the metadata the decorator sets, as Nest applies it to a controller method. */
function execContext(decorator: MethodDecorator | undefined, request: Request): ExecutionContext {
  const holder = { handle(): void {} };
  if (decorator) {
    const descriptor = Object.getOwnPropertyDescriptor(holder, "handle");
    if (descriptor) decorator(holder, "handle", descriptor);
  }
  return {
    getHandler: () => holder.handle,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

interface Invocation {
  readonly decorator?: MethodDecorator | undefined;
  readonly request: Request;
  readonly response?: unknown;
  readonly principalType?: Principal["type"];
}

async function invoke(options: Invocation) {
  const record = vi.fn<(input: AuditInput) => Promise<void>>().mockResolvedValue(undefined);
  const error = vi.fn();
  const interceptor = new AuditInterceptor(
    new Reflector(),
    { record } as unknown as AuditService,
    { error } as unknown as import("../common/logger.service.js").AppLogger,
  );
  const principal = {
    type: options.principalType ?? "staff",
    userId: "u1",
  } as unknown as Principal;
  const context: RequestContext = { requestId: "r1", ip: null, principal, access: null };
  const next: CallHandler = { handle: () => of(options.response) };
  const result = await requestContext.run(context, () =>
    lastValueFrom(interceptor.intercept(execContext(options.decorator, options.request), next)),
  );
  return { record, error, result };
}

describe("AuditInterceptor", () => {
  it("records a @Audited mutation from the response, action inferred from the method", async () => {
    const { record } = await invoke({
      decorator: Audited({ entityType: "role" }),
      request: { method: "POST" },
      response: { id: "e1" },
    });
    expect(record).toHaveBeenCalledWith({ action: "create", entityType: "role", entityId: "e1" });
  });

  it("resolves the entity id from a route parameter when the response has none (a DELETE)", async () => {
    const { record } = await invoke({
      decorator: Audited({ entityType: "role", entityIdParam: "roleId" }),
      request: { method: "DELETE", params: { roleId: "e9" } },
      response: undefined,
    });
    expect(record).toHaveBeenCalledWith({ action: "delete", entityType: "role", entityId: "e9" });
  });

  it("reads the id through the { data } envelope whatever the interceptor order", async () => {
    const { record } = await invoke({
      decorator: Audited({ entityType: "role" }),
      request: { method: "PUT" },
      response: { data: { id: "e2" } },
    });
    expect(record).toHaveBeenCalledWith({ action: "update", entityType: "role", entityId: "e2" });
  });

  it("passes the response through unchanged", async () => {
    const { result } = await invoke({
      decorator: Audited({ entityType: "role" }),
      request: { method: "POST" },
      response: { id: "e1", extra: true },
    });
    expect(result).toEqual({ id: "e1", extra: true });
  });

  it("skips @SelfAudited, @AuditExempt and undeclared handlers", async () => {
    for (const decorator of [SelfAudited(), AuditExempt("spike"), undefined]) {
      const { record } = await invoke({
        decorator,
        request: { method: "POST" },
        response: { id: "e1" },
      });
      expect(record).not.toHaveBeenCalled();
    }
  });

  it("never records for a non-staff principal", async () => {
    const { record } = await invoke({
      decorator: Audited({ entityType: "role" }),
      request: { method: "POST" },
      response: { id: "e1" },
      principalType: "client",
    });
    expect(record).not.toHaveBeenCalled();
  });

  it("logs an error and writes nothing when the entity id cannot be resolved (sole-record route)", async () => {
    const { record, error } = await invoke({
      decorator: Audited({ entityType: "role" }),
      request: { method: "DELETE" },
      response: undefined,
    });
    expect(record).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "audit.backstop.unrecorded",
      expect.objectContaining({ missing: "entityId" }),
    );
  });
});
