import type * as ReactQuery from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import {
  AppError,
  HOTEL_FORM_ERRORS,
  hotelFormReadOnlyDetails,
  hotelFormSectionConflictDetails,
  hotelFormSectionsChangedDetails,
  type HotelFormDraftView,
} from "@ampm/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HOTEL_FORM_ME_QUERY_KEY } from "./use-hotel-form";
import {
  HOTEL_FORM_DRAFT_QUERY_KEY,
  useRequestHotelFormCorrection,
  useSaveHotelFormSection,
  useSubmitHotelForm,
  useWithdrawHotelFormConsent,
} from "./use-hotel-form-draft";
import { AT, DRAFT, ME, SESSION, THEIRS } from "./use-hotel-form-draft.test-fixtures";

/* What the hotel form's draft hooks cache (D-190 §3): the draft as the API holds it, after each call. */

interface MutationSeen {
  readonly mutationFn: (variables: unknown) => Promise<unknown>;
  readonly onSuccess?: (data: unknown, variables: unknown) => unknown;
  readonly onError?: (error: unknown, variables: unknown) => unknown;
}

const hooks = vi.hoisted(() => ({ options: [] as MutationSeen[] }));
const cache = new QueryClient();

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useMutation: (options: MutationSeen) => {
    hooks.options.push(options);
    return options;
  },
  useQueryClient: () => cache,
}));

vi.mock("../provider", () => ({ useApiClient: () => ({}) }));

beforeEach(() => {
  hooks.options.length = 0;
  cache.clear();
});

describe("the hooks keep the cached draft as the API holds it", () => {
  const isInvalidated = (key: readonly string[]) =>
    cache.getQueryState(key)?.isInvalidated === true;

  const roomsSave = (totalRooms: number) => ({
    sessionToken: SESSION,
    section: "rooms",
    save: { answers: { totalRooms, noLongerOffered: "  " }, expectedVersion: 2, noChanges: false },
  });
  const cachedRooms = () =>
    cache.getQueryData<HotelFormDraftView>(HOTEL_FORM_DRAFT_QUERY_KEY)?.sections.rooms;

  it("after a save: the section's new version, its normalised answers, and the editor the API names", () => {
    cache.setQueryData(HOTEL_FORM_DRAFT_QUERY_KEY, DRAFT);
    cache.setQueryData(HOTEL_FORM_ME_QUERY_KEY, ME);
    useSaveHotelFormSection();
    const [save] = hooks.options;
    const saved = {
      version: 3,
      isComplete: false,
      contentHash: "b".repeat(64),
      lastEditedBy: "Synthetic Person",
      lastEditedAt: "2026-11-26T09:45:00.000Z",
    };
    save?.onSuccess?.(saved, roomsSave(41));
    expect(cachedRooms()).toEqual({
      answers: { totalRooms: 41, noLongerOffered: null },
      version: 3,
      isComplete: false,
      noChanges: false,
      lastEditedBy: "Synthetic Person",
      lastEditedAt: "2026-11-26T09:45:00.000Z",
    });
  });

  it("after a save that changed nothing at a colleague's newer version: their name and time, not you now", () => {
    cache.setQueryData(HOTEL_FORM_DRAFT_QUERY_KEY, DRAFT);
    cache.setQueryData(HOTEL_FORM_ME_QUERY_KEY, ME);
    useSaveHotelFormSection();
    const [save] = hooks.options;
    const theirs = {
      version: 4,
      isComplete: false,
      contentHash: "c".repeat(64),
      lastEditedBy: null,
      lastEditedAt: "2026-11-26T09:40:00.000Z",
    };
    save?.onSuccess?.(theirs, roomsSave(30));
    expect(cachedRooms()).toMatchObject({
      version: 4,
      lastEditedBy: null,
      lastEditedAt: "2026-11-26T09:40:00.000Z",
    });
  });

  it("after a conflict: the colleague's save, so Keep mine saves on their version", () => {
    cache.setQueryData(HOTEL_FORM_DRAFT_QUERY_KEY, DRAFT);
    useSaveHotelFormSection();
    const [save] = hooks.options;
    const theirs = THEIRS;
    const error = new AppError(
      "conflict",
      HOTEL_FORM_ERRORS.sectionConflict,
      hotelFormSectionConflictDetails(theirs),
    );
    save?.onError?.(error, { sessionToken: SESSION, section: "rooms", save: {} });
    expect(
      cache.getQueryData<HotelFormDraftView>(HOTEL_FORM_DRAFT_QUERY_KEY)?.sections.rooms,
    ).toEqual({
      answers: { totalRooms: 44 },
      version: 4,
      isComplete: false,
      noChanges: false,
      lastEditedBy: "Colleague",
      lastEditedAt: AT,
    });
  });

  it("after a refused save on a locked request, and after a submit or a withdrawal: read again", () => {
    useSaveHotelFormSection();
    useSubmitHotelForm();
    useWithdrawHotelFormConsent();
    useRequestHotelFormCorrection();
    const [save, submit, withdraw, correction] = hooks.options;
    const reseed = () => {
      cache.setQueryData(HOTEL_FORM_DRAFT_QUERY_KEY, DRAFT);
      cache.setQueryData(HOTEL_FORM_ME_QUERY_KEY, ME);
    };
    reseed();
    const locked = new AppError(
      "conflict",
      HOTEL_FORM_ERRORS.readOnly,
      hotelFormReadOnlyDetails({ status: "submitted", submittedBy: "Colleague", submittedAt: AT }),
    );
    save?.onError?.(locked, { sessionToken: SESSION, section: "rooms", save: {} });
    expect(isInvalidated(HOTEL_FORM_DRAFT_QUERY_KEY)).toBe(true);
    expect(isInvalidated(HOTEL_FORM_ME_QUERY_KEY)).toBe(true);
    reseed();
    submit?.onSuccess?.({ reference: "HIR-2026-0042", status: "submitted", submittedAt: AT }, {});
    expect(isInvalidated(HOTEL_FORM_DRAFT_QUERY_KEY)).toBe(true);
    expect(isInvalidated(HOTEL_FORM_ME_QUERY_KEY)).toBe(true);
    reseed();
    withdraw?.onSuccess?.({ withdrawn: [], removalRequested: true }, {});
    expect(isInvalidated(HOTEL_FORM_DRAFT_QUERY_KEY)).toBe(true);
    expect(correction?.onSuccess).toBeUndefined();
  });

  it("after a submit refused because a colleague changed sections since the review page read them: read again", () => {
    useSubmitHotelForm();
    const [submit] = hooks.options;
    cache.setQueryData(HOTEL_FORM_DRAFT_QUERY_KEY, DRAFT);
    const changed = new AppError(
      "conflict",
      HOTEL_FORM_ERRORS.sectionsChanged,
      hotelFormSectionsChangedDetails(["rooms"]),
    );
    submit?.onError?.(changed, {});
    expect(isInvalidated(HOTEL_FORM_DRAFT_QUERY_KEY)).toBe(true);
  });
});
