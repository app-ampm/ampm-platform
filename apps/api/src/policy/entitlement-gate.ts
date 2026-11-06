import { errors, type EntitlementModule } from "@ampm/core";
import type { Entitlements } from "@ampm/policy";

import type { Principal } from "./principal.types.js";

/**
 * The client-entitlement gate shared by the Module C discovery paths and the Module D consultancy paths
 * (code.md reuse-first). Only a client or the demo carries entitlements; anyone else, a module they do
 * not hold, or — for a write — a read-only module, is absence: the same 404 as a missing record
 * (security.md, denial equals absence). Returns the entitlements and the caller's user id.
 */
export function entitlementGate(
  principal: Principal,
  module: EntitlementModule,
  needWrite: boolean,
): { ent: Entitlements; userId: string } {
  if (principal.type !== "client" && principal.type !== "demo") throw errors.notFound();
  const ent = principal.entitlements;
  if (!ent.modules.includes(module)) throw errors.notFound();
  if (needWrite && ent.readOnlyModules.includes(module)) throw errors.notFound();
  return { ent, userId: principal.userId };
}
