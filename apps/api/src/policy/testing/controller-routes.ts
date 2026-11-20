/// <reference types="vite/client" />
import "reflect-metadata";

import type { RequestMethod } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

/** A controller class as the architecture tests reflect on it. */
export type Ctor = new (...args: never[]) => object;

/** One route: the controller that declares it, its handler's name and its HTTP method. */
export interface ControllerRoute {
  readonly file: string;
  readonly cls: Ctor;
  readonly handler: string;
  readonly method: RequestMethod;
}

const reflector = new Reflector();
// The metadata key Nest stores the route method under (via @Get/@Post/...); a stable framework constant.
const METHOD_METADATA = "method";

const modules = import.meta.glob<Record<string, unknown>>("../../**/*.controller.ts", {
  eager: true,
});

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

/** The route handler's function, for reading the metadata its decorators set. */
export function handlerOf(route: Pick<ControllerRoute, "cls" | "handler">) {
  const handler = (route.cls.prototype as Record<string, unknown>)[route.handler];
  if (typeof handler !== "function") throw new Error(`${route.handler} is not a method`);
  return handler;
}

/**
 * Every route of every controller in the source tree, so an architecture test checks a new controller
 * with no upkeep (audit coverage, rate-limit coverage). Test-only: it relies on Vite's
 * `import.meta.glob`, and the build leaves `testing/` folders out.
 *
 * @example
 * for (const route of controllerRoutes()) expect(reflector.get(AUDITED, handlerOf(route))).toBeDefined();
 */
export function controllerRoutes(): ControllerRoute[] {
  return controllerClasses().flatMap(({ file, cls }) =>
    allMethodNames(cls).flatMap((handler) => {
      const fn = (cls.prototype as Record<string, unknown>)[handler];
      const method =
        typeof fn === "function"
          ? reflector.get<RequestMethod | undefined>(METHOD_METADATA, fn)
          : undefined;
      return method === undefined ? [] : [{ file, cls, handler, method }];
    }),
  );
}
