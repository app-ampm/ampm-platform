import type { ConfigView } from "@ampm/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONFIGURATIONS_QUERY_KEY, useUpdateConfiguration } from "./use-configurations";
import { HOTEL_CUISINE_OPTIONS_QUERY_KEY } from "./use-hotel-cuisine-options";

interface Written {
  readonly key: string;
  readonly value: unknown;
}

interface Seen {
  onSuccess: ((view: ConfigView, written: Written) => void) | null;
  readonly invalidated: unknown[];
}

/** What the hook handed to useMutation, and the keys it refreshed. */
const seen = vi.hoisted((): Seen => ({ onSuccess: null, invalidated: [] }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: Pick<Seen, "onSuccess">) => {
    seen.onSuccess = options.onSuccess;
    return {};
  },
  useQuery: () => ({}),
  useQueryClient: () => ({
    invalidateQueries: ({ queryKey }: { queryKey: unknown }) => {
      seen.invalidated.push(queryKey);
      return Promise.resolve();
    },
  }),
}));

vi.mock("../provider", () => ({ useApiClient: () => ({}) }));

describe("useUpdateConfiguration", () => {
  beforeEach(() => {
    seen.onSuccess = null;
    seen.invalidated.length = 0;
  });

  it("refreshes the inventory after any write", () => {
    useUpdateConfiguration();
    const written = { key: "hotel.verification_policy", value: { maxAgeDays: 60 } };
    seen.onSuccess?.(written, written);
    expect(seen.invalidated).toEqual([CONFIGURATIONS_QUERY_KEY]);
  });

  it("refreshes the editor's cuisine choices too when the cuisine options change", () => {
    useUpdateConfiguration();
    const written = { key: "hotel.cuisine_options", value: { options: ["Indian", "Goan"] } };
    seen.onSuccess?.(written, written);
    expect(seen.invalidated).toEqual([CONFIGURATIONS_QUERY_KEY, HOTEL_CUISINE_OPTIONS_QUERY_KEY]);
  });
});
