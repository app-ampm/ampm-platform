import { useMe, useStaffAccess } from "@ampm/api-client";
import type { HotelImportKind } from "@ampm/core";

import { importableKinds } from "./hotel-import.kinds";

export interface ImportKinds {
  /** The kinds the signed-in staff member may import, in the picker's order. */
  readonly kinds: readonly HotelImportKind[];
  /** True until `/me` answers, when no grant is known yet. */
  readonly isPending: boolean;
  /** True when `/me` failed (an ended session, no network): the role is unknown, not denied. */
  readonly isError: boolean;
  /** Why `/me` failed, for the shared error states. */
  readonly error: unknown;
  /** Asks `/me` again. */
  readonly retry: () => void;
}

/**
 * The kinds the signed-in staff member may import (`useStaffAccess().can`, a custom role's grants
 * included, D-164), and how `/me` stands. The screen offers only these; the server stays the gate.
 *
 *   const { kinds, isPending, isError } = useImportKinds();
 */
export function useImportKinds(): ImportKinds {
  const me = useMe();
  const access = useStaffAccess();
  return {
    kinds: importableKinds(access),
    isPending: me.isPending,
    isError: me.isError,
    error: me.error,
    retry: () => void me.refetch(),
  };
}
