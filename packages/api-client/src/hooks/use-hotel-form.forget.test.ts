import type * as ReactQuery from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  forgetHotelForm,
  HOTEL_FORM_DRAFT_QUERY_KEY,
  HOTEL_FORM_ME_QUERY_KEY,
  HOTEL_FORM_QUERY_FAMILY,
  useOpenHotelForm,
  useRequestHotelFormCode,
  useSignOutOfHotelForm,
  useUpdateHotelFormMe,
  useVerifyHotelFormCode,
} from "./use-hotel-form";
import {
  useRequestHotelFormCorrection,
  useSaveHotelFormSection,
  useSubmitHotelForm,
  useWithdrawHotelFormConsent,
} from "./use-hotel-form-draft";

/*
 * What the form leaves in memory once forgotten (D-190 §5, review fix C3): every call of the form is kept
 * under the form's own family, so forgetting the form (sign-out, a withdrawal of every consent, a session
 * ending at HF-08) removes the calls with the queries: a claim's name, designation and mobile, the link's
 * secret, a correction's words. Synthetic people only.
 */

interface MutationSeen {
  readonly mutationKey?: readonly unknown[];
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

/** Runs a call through the cache as useMutation would, under `mutationKey`, answering its variables. */
async function ran(mutationKey: readonly unknown[], variables: unknown): Promise<void> {
  const mutation = cache.getMutationCache().build(cache, {
    mutationKey,
    mutationFn: async (sent: unknown) => sent,
  });
  await mutation.execute(variables);
}

describe("the form's calls", () => {
  it("are each kept under the form's family, apart from every staff or client call", () => {
    useOpenHotelForm();
    useRequestHotelFormCode();
    useVerifyHotelFormCode();
    useUpdateHotelFormMe();
    useSignOutOfHotelForm();
    useSaveHotelFormSection();
    useSubmitHotelForm();
    useRequestHotelFormCorrection();
    useWithdrawHotelFormConsent();
    const keys = hooks.options.map((options) => options.mutationKey);
    expect(keys).toHaveLength(9);
    for (const key of keys) expect(key?.slice(0, 1)).toEqual([...HOTEL_FORM_QUERY_FAMILY]);
    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(9);
  });

  it("are forgotten with the queries, the claim and a correction's words included, and no other call", async () => {
    useRequestHotelFormCode();
    useRequestHotelFormCorrection();
    const [code, correction] = hooks.options;
    const claim = {
      token: `hfl_${"s".repeat(43)}`,
      fullName: "Synthetic Asha Rao",
      designation: "General Manager",
      mobile: "+919800000001",
    };
    await ran(code?.mutationKey ?? [], claim);
    const message = { message: "The pool closes at 9 pm, not 10.", botToken: "pass" };
    await ran(correction?.mutationKey ?? [], { sessionToken: "hfs_x", correction: message });
    await ran(["accounts", "invite"], { email: "staff@ampm.example" });
    cache.setQueryData(HOTEL_FORM_ME_QUERY_KEY, { person: { fullName: claim.fullName } });
    cache.setQueryData(HOTEL_FORM_DRAFT_QUERY_KEY, { contributors: [] });
    forgetHotelForm(cache);
    const left = JSON.stringify([
      cache
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
      cache
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state.variables),
    ]);
    for (const personal of [claim.fullName, claim.mobile, claim.token, message.message])
      expect(left).not.toContain(personal);
    expect(left).toContain("staff@ampm.example");
  });
});
