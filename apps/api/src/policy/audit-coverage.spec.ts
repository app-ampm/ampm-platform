/// <reference types="vite/client" />
import "reflect-metadata";

import { RequestMethod } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { AUDITED } from "./decorators.js";

/*
 * Architecture test (security.md §9): every mutating controller route must declare how it is audited
 * — @SelfAudited when its service audits in its own transaction, or @Audited for the backstop
 * interceptor. A new mutation added without either fails CI here, so internal-user audit coverage
 * cannot silently regress. Controllers are discovered from the tree, so the check needs no upkeep.
 */
const reflector = new Reflector();
// The metadata key Nest stores the route method under (via @Get/@Post/...); a stable framework constant.
const METHOD_METADATA = "method";
// ALL (@All) is included: it serves every verb, the mutating ones among them, so it must declare too.
const MUTATING: ReadonlySet<RequestMethod> = new Set([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
  RequestMethod.ALL,
]);

type Ctor = new (...args: never[]) => object;

const modules = import.meta.glob<Record<string, unknown>>("../**/*.controller.ts", { eager: true });

function controllerClasses(): { readonly file: string; readonly cls: Ctor }[] {
  const found: { file: string; cls: Ctor }[] = [];
  for (const [file, mod] of Object.entries(modules)) {
    for (const exported of Object.values(mod)) {
      if (typeof exported === "function" && exported.name.endsWith("Controller")) {
        found.push({ file, cls: exported as Ctor });
      }
    }
  }
  return found;
}

function routeMethod(cls: Ctor, name: string): RequestMethod | undefined {
  const handler = (cls.prototype as Record<string, unknown>)[name];
  if (typeof handler !== "function") return undefined;
  return reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler);
}

function auditMarker(cls: Ctor, name: string): unknown {
  const handler = (cls.prototype as Record<string, unknown>)[name];
  return typeof handler === "function" ? reflector.get<unknown>(AUDITED, handler) : undefined;
}

/** Every method name of the controller, including inherited ones — Nest registers inherited routes too. */
function allMethodNames(cls: Ctor): string[] {
  const names = new Set<string>();
  let proto: object | null = cls.prototype as object;
  while (proto !== null && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== "constructor") names.add(name);
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return [...names];
}

function mutatingHandlers(cls: Ctor): string[] {
  return allMethodNames(cls).filter((name) => {
    const method = routeMethod(cls, name);
    return method !== undefined && MUTATING.has(method);
  });
}

describe("audit coverage: every staff mutation declares its audit (§9)", () => {
  const classes = controllerClasses();

  it("discovers the controllers to check", () => {
    expect(classes.length).toBeGreaterThan(0);
  });

  for (const { file, cls } of classes) {
    for (const handler of mutatingHandlers(cls)) {
      it(`${cls.name}.${handler} declares @Audited or @SelfAudited`, () => {
        expect(
          auditMarker(cls, handler),
          `${cls.name}.${handler} (${file}) is a mutating route with no audit declaration; ` +
            `add @Audited({ entityType }) or @SelfAudited()`,
        ).toBeDefined();
      });
    }
  }
});
