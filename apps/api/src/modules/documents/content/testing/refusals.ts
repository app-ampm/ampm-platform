import { contentKind, type ContentKind } from "@ampm/core";

import { ContentRefusal } from "../refusal.js";

/*
 * Spec helpers shared by the content checks' specs. Test-only: the build leaves `testing/` folders out.
 */

/** Every kind: a slot that takes everything, so a spec sees the content rules and not the slot's. */
export const EVERY_KIND: ReadonlySet<ContentKind> = new Set<ContentKind>(contentKind.options);

/** The refusal a piece of work ends in; fails the spec when it ends without one. */
export async function refusalOf(work: Promise<unknown> | (() => unknown)): Promise<ContentRefusal> {
  try {
    await (typeof work === "function" ? work() : work);
  } catch (error) {
    if (error instanceof ContentRefusal) return error;
    throw error;
  }
  throw new Error("expected a ContentRefusal");
}
