import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRecordVerification, verificationsQueryKey } from "./use-hotel-rates";
import { STAFF_HOTELS_QUERY_KEY } from "./use-staff-hotels";

const HOTEL_ID = "0192f1a0-0000-7000-8000-0000000c0001";

interface Seen {
  onSuccess: (() => void) | null;
  readonly invalidated: unknown[];
}

/** What the hook handed to useMutation, and the keys its success refreshed. */
const seen = vi.hoisted((): Seen => ({ onSuccess: null, invalidated: [] }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: Pick<Seen, "onSuccess">) => {
    seen.onSuccess = options.onSuccess;
    return {};
  },
  useQueryClient: () => ({
    invalidateQueries: ({ queryKey }: { queryKey: unknown }) => {
      seen.invalidated.push(queryKey);
      return Promise.resolve();
    },
  }),
}));

vi.mock("../provider", () => ({ useApiClient: () => ({}) }));

describe("useRecordVerification", () => {
  beforeEach(() => {
    seen.onSuccess = null;
    seen.invalidated.length = 0;
  });

  // The server refreshes the hotel's lastVerifiedAt with the verification, so T4's "Last verified"
  // column and the hotel's detail must not keep the old date.
  it("refreshes the verifications, the hotel's detail and the catalogue lists", () => {
    useRecordVerification(HOTEL_ID);
    seen.onSuccess?.();
    expect(seen.invalidated).toEqual([verificationsQueryKey(HOTEL_ID), STAFF_HOTELS_QUERY_KEY]);
    // The staff hotels prefix covers every list (any filter) and this hotel's detail key.
    expect(verificationsQueryKey(HOTEL_ID).slice(0, 2)).toEqual([...STAFF_HOTELS_QUERY_KEY]);
  });
});
