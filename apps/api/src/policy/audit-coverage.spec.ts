import { RequestMethod } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { AUDITED } from "./decorators.js";
import { controllerRoutes, handlerOf } from "./testing/controller-routes.js";

/*
 * Architecture test (security.md §9): every mutating controller route must declare how it is audited
 * — @SelfAudited when its service audits in its own transaction, or @Audited for the backstop
 * interceptor. A new mutation added without either fails CI here, so internal-user audit coverage
 * cannot silently regress. Controllers are discovered from the tree, so the check needs no upkeep.
 */
const reflector = new Reflector();
// ALL (@All) is included: it serves every verb, the mutating ones among them, so it must declare too.
const MUTATING: ReadonlySet<RequestMethod> = new Set([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
  RequestMethod.ALL,
]);

describe("audit coverage: every staff mutation declares its audit (§9)", () => {
  const routes = controllerRoutes();

  it("discovers the controllers to check", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  for (const route of routes.filter((r) => MUTATING.has(r.method))) {
    const { cls, handler, file } = route;
    it(`${cls.name}.${handler} declares @Audited or @SelfAudited`, () => {
      expect(
        reflector.get<unknown>(AUDITED, handlerOf(route)),
        `${cls.name}.${handler} (${file}) is a mutating route with no audit declaration; ` +
          `add @Audited({ entityType }) or @SelfAudited()`,
      ).toBeDefined();
    });
  }
});
