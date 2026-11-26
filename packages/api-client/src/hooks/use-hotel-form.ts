import {
  queryOptions,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  acknowledged,
  hotelFormCodeIssued,
  hotelFormMe,
  hotelFormOpenAnswer,
  hotelFormVerified,
  type Acknowledged,
  type HotelFormCodeIssued,
  type HotelFormCodeRequestInput,
  type HotelFormMe,
  type HotelFormMeUpdateRequest,
  type HotelFormOpenAnswer,
  type HotelFormOpenRequest,
  type HotelFormVerified,
  type HotelFormVerifyRequest,
} from "@ampm/core";
import type { ZodType } from "zod";

import type { ApiClient } from "../client";
import { useApiClient } from "../provider";

/*
 * The hotel form's public routes (D-189 §4, §5), which the website calls. Before a code every call is
 * anonymous: the link's secret travels in the POST body, and no token the client holds (a staff or
 * client session) ever goes with it. After the code, the form's own session (`hfs_…`) is passed in by
 * the page and sent as the Bearer, never read from a token store. Every answer is parsed with the
 * strict schemas of @ampm/core, so a field beyond the contract fails the call. Nothing is stored here:
 * the page keeps the link and the session in sessionStorage itself.
 */

/** Sign-out's answer, held to its one field as the form's other answers are. */
const signedOut = acknowledged.strict();

/** The form's own `me`, apart from the staff and client `me` (`["me"]`). */
export const HOTEL_FORM_ME_QUERY_KEY = ["hotel-form", "me"] as const;

/**
 * The form's draft (D-190 §3), apart from the form's `me` and from every staff or client query: it is
 * read again after a code (who is "you" among the people helping may change) and forgotten on sign-out.
 */
export const HOTEL_FORM_DRAFT_QUERY_KEY = ["hotel-form", "draft"] as const;

/** A call made inside a form session. */
export interface HotelFormSessionCall {
  /** The session's token (`hfs_…`), from the answer of `codes/verify`. */
  readonly sessionToken: string;
}

/** `PATCH /hotel-form/me`'s variables: the session and the change. */
export interface HotelFormMeChange extends HotelFormSessionCall {
  readonly change: HotelFormMeUpdateRequest;
}

/**
 * The six routes as plain calls on a client, for the hooks below and for a test.
 *
 * @example
 * const answer = await hotelFormCalls(api).open({ token });
 */
export function hotelFormCalls(api: ApiClient) {
  // Anonymous: whoever holds the link is nobody yet, and a token the client holds must not go along.
  const post = <T>(path: string, body: unknown, schema: ZodType<T>): Promise<T> =>
    api.request(path, { method: "POST", body, schema, anonymous: true });
  return {
    open: (body: HotelFormOpenRequest) => post("/hotel-form/open", body, hotelFormOpenAnswer),
    requestCode: (body: HotelFormCodeRequestInput) =>
      post("/hotel-form/codes", body, hotelFormCodeIssued),
    verify: (body: HotelFormVerifyRequest) =>
      post("/hotel-form/codes/verify", body, hotelFormVerified),
    me: (sessionToken: string, signal?: AbortSignal): Promise<HotelFormMe> =>
      api.request("/hotel-form/me", { schema: hotelFormMe, accessToken: sessionToken, signal }),
    updateMe: ({ sessionToken, change }: HotelFormMeChange): Promise<HotelFormMe> =>
      api.request("/hotel-form/me", {
        method: "PATCH",
        body: change,
        schema: hotelFormMe,
        accessToken: sessionToken,
      }),
    signOut: ({ sessionToken }: HotelFormSessionCall): Promise<Acknowledged> =>
      api.request("/hotel-form/sign-out", {
        method: "POST",
        schema: signedOut,
        accessToken: sessionToken,
      }),
  };
}

/**
 * `POST /hotel-form/open`: the state the link opens to, when it stops working, and AMPM's help contact;
 * nothing about the hotel. Opening spends nothing.
 *
 *   const answer = await useOpenHotelForm().mutateAsync({ token });
 */
export function useOpenHotelForm() {
  const api = useApiClient();
  return useMutation<HotelFormOpenAnswer, Error, HotelFormOpenRequest>({
    mutationFn: (body) => hotelFormCalls(api).open(body),
  });
}

/**
 * `POST /hotel-form/codes`: a code for the person's claim (name, designation, mobile), with the notice
 * version they accepted and the bot check's token for action `hf_code`. In on-screen mode the answer
 * carries the code itself.
 *
 *   const issued = await useRequestHotelFormCode().mutateAsync(claim);
 */
export function useRequestHotelFormCode() {
  const api = useApiClient();
  return useMutation<HotelFormCodeIssued, Error, HotelFormCodeRequestInput>({
    mutationFn: (body) => hotelFormCalls(api).requestCode(body),
  });
}

/**
 * `POST /hotel-form/codes/verify`: the code of one challenge, answered with the session's token and the
 * person and request as `me` answers them, which become the cached `me` (without the token). The draft is
 * read again, kept on the page meanwhile, so a new code asked for in place keeps what the page shows.
 *
 *   const { sessionToken } = await useVerifyHotelFormCode().mutateAsync({ token, challengeId, oneTimeCode });
 */
export function useVerifyHotelFormCode() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelFormVerified, Error, HotelFormVerifyRequest>({
    mutationFn: (body) => hotelFormCalls(api).verify(body),
    onSuccess: ({ sessionToken: _token, ...me }) => {
      queryClient.setQueryData<HotelFormMe>(HOTEL_FORM_ME_QUERY_KEY, me);
      void queryClient.invalidateQueries({ queryKey: HOTEL_FORM_DRAFT_QUERY_KEY });
    },
  });
}

/**
 * `GET /hotel-form/me` as a query: what the page shows once signed in, read again when the window
 * regains focus, so a session that ended meanwhile is refused (401 with its reason) before the person
 * types on. It runs only while there is a session.
 *
 *   await queryClient.prefetchQuery(hotelFormMeQueryOptions(api, sessionToken));
 */
export function hotelFormMeQueryOptions(api: ApiClient, sessionToken: string | null) {
  return queryOptions({
    queryKey: HOTEL_FORM_ME_QUERY_KEY,
    queryFn:
      sessionToken === null
        ? skipToken
        : ({ signal }) => hotelFormCalls(api).me(sessionToken, signal),
    enabled: sessionToken !== null,
  });
}

/**
 * The signed-in person and their request (`GET /hotel-form/me`), while `sessionToken` is not null.
 *
 *   const me = useHotelFormMe(sessionToken);
 */
export function useHotelFormMe(sessionToken: string | null) {
  const api = useApiClient();
  return useQuery(hotelFormMeQueryOptions(api, sessionToken));
}

/**
 * `PATCH /hotel-form/me`: your own name or designation; the answer becomes the cached `me`.
 *
 *   await useUpdateHotelFormMe().mutateAsync({ sessionToken, change: { fullName } });
 */
export function useUpdateHotelFormMe() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelFormMe, Error, HotelFormMeChange>({
    mutationFn: (variables) => hotelFormCalls(api).updateMe(variables),
    onSuccess: (me) => queryClient.setQueryData<HotelFormMe>(HOTEL_FORM_ME_QUERY_KEY, me),
  });
}

/**
 * `POST /hotel-form/sign-out`: ends the session; the cached `me` and draft are forgotten whatever the
 * answer, so the next person to sign in on the tab never sees them.
 *
 *   await useSignOutOfHotelForm().mutateAsync({ sessionToken });
 */
export function useSignOutOfHotelForm() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<Acknowledged, Error, HotelFormSessionCall>({
    mutationFn: (variables) => hotelFormCalls(api).signOut(variables),
    onSettled: () => {
      queryClient.removeQueries({ queryKey: HOTEL_FORM_ME_QUERY_KEY });
      queryClient.removeQueries({ queryKey: HOTEL_FORM_DRAFT_QUERY_KEY });
    },
  });
}
