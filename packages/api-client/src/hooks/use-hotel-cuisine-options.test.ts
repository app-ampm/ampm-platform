import { hotelCuisineOptionsView } from "@ampm/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HOTEL_CUISINE_OPTIONS_QUERY_KEY,
  useHotelCuisineOptions,
} from "./use-hotel-cuisine-options";
import { STAFF_HOTELS_QUERY_KEY } from "./use-staff-hotels";

interface QueryOptions {
  readonly queryKey: readonly unknown[];
  readonly queryFn: (context: { signal: AbortSignal }) => Promise<unknown>;
  readonly enabled: boolean;
  readonly staleTime: number;
}

interface Read {
  readonly path: string;
  readonly schema: unknown;
}

/** What the hook handed to useQuery, and every read its query made. */
const seen = vi.hoisted(() => ({
  options: null as QueryOptions | null,
  reads: [] as Read[],
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
    seen.options = options;
    return {};
  },
}));

vi.mock("../provider", () => ({
  useApiClient: () => ({
    get: (path: string, schema: unknown) => {
      seen.reads.push({ path, schema });
      return Promise.resolve({ options: ["Indian"], other: "Other" });
    },
  }),
}));

describe("useHotelCuisineOptions", () => {
  beforeEach(() => {
    seen.options = null;
    seen.reads.length = 0;
  });

  it("reads the staff route through its schema", async () => {
    useHotelCuisineOptions();
    await seen.options?.queryFn({ signal: new AbortController().signal });
    expect(seen.reads).toEqual([
      { path: "/hotels-admin/cuisine-options", schema: hotelCuisineOptionsView },
    ]);
    expect(seen.options?.enabled).toBe(true);
  });

  it("keeps its own key, outside the hotels, so a hotel write does not refetch it", () => {
    useHotelCuisineOptions();
    const key = seen.options?.queryKey ?? [];
    expect(key).toEqual(HOTEL_CUISINE_OPTIONS_QUERY_KEY);
    expect(key.slice(0, STAFF_HOTELS_QUERY_KEY.length)).not.toEqual([...STAFF_HOTELS_QUERY_KEY]);
    expect(seen.options?.staleTime).toBeGreaterThan(0);
  });

  it("waits while the editor is closed", () => {
    useHotelCuisineOptions({ enabled: false });
    expect(seen.options?.enabled).toBe(false);
  });
});
