import {
  queryOptions,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  acknowledged,
  canonicalJson,
  HOTEL_FORM_SECTION_DRAFTS,
  hotelFormDraftView,
  hotelFormReadOnlyOf,
  hotelFormSectionConflictOf,
  hotelFormSectionSaved,
  hotelFormSubmitted,
  hotelFormWithdrawn,
  isAppError,
  isHotelFormSectionComplete,
  type Acknowledged,
  type HotelFormCorrectionRequest,
  type HotelFormDraftSections,
  type HotelFormDraftView,
  type HotelFormSectionAnswers,
  type HotelFormSectionAnswersInput,
  type HotelFormSectionKey,
  type HotelFormSectionSaved,
  type HotelFormSubmitRequest,
  type HotelFormSubmitted,
  type HotelFormWithdrawalRequest,
  type HotelFormWithdrawn,
} from "@ampm/core";
import type { z, ZodType } from "zod";

import type { ApiClient } from "../client";
import { useApiClient } from "../provider";
import {
  forgetHotelForm,
  HOTEL_FORM_DRAFT_QUERY_KEY,
  HOTEL_FORM_ME_QUERY_KEY,
  type HotelFormSessionCall,
} from "./use-hotel-form";

/*
 * The hotel form's own routes (D-190 §3), which the website's pages call inside a form session: the draft,
 * a section's autosave, submit, a correction and consent withdrawal, each with the session's token as the
 * Bearer (never a staff or client token) and each answer parsed with @ampm/core's strict schema. A refusal
 * is an AppError whose details core reads back (`hotelFormSectionConflictOf`, `hotelFormReadOnlyOf`,
 * `hotelFormMissingItemsOf`). The cached draft follows the API: a save writes its section, a conflict
 * writes the colleague's save, a refused save on a locked request, a submit and a withdrawal read it again.
 */

export { HOTEL_FORM_DRAFT_QUERY_KEY };

/** A section's save: the section, and its answers as the page holds them, version and No changes. */
export interface HotelFormSectionSaveCall<
  K extends HotelFormSectionKey = HotelFormSectionKey,
> extends HotelFormSessionCall {
  readonly section: K;
  readonly save: {
    readonly answers: HotelFormSectionAnswersInput[K];
    /** The version the answers were based on: 0 before the section's first save. */
    readonly expectedVersion: number;
    readonly noChanges: boolean;
  };
}

/**
 * `submit`'s variables: the session, and the body: both declarations, every section's version as the
 * review page showed it, and the Turnstile pass for `hf_submit`.
 */
export interface HotelFormSubmitCall extends HotelFormSessionCall {
  readonly submit: HotelFormSubmitRequest;
}

/** `corrections`' variables: the session, the message and the Turnstile pass for `hf_correction`. */
export interface HotelFormCorrectionCall extends HotelFormSessionCall {
  readonly correction: HotelFormCorrectionRequest;
}

/** `consent-withdrawal`'s variables: the session, the kind, and whether to ask for removal. */
export interface HotelFormWithdrawalCall extends HotelFormSessionCall {
  readonly withdrawal: HotelFormWithdrawalRequest;
}

/** A correction's answer, held to its one field. */
const correctionSent = acknowledged.strict();

/** Each section's draft, typed so a key's parse gives that section's answers. */
const DRAFTS: { readonly [K in HotelFormSectionKey]: z.ZodType<HotelFormSectionAnswers[K]> } =
  HOTEL_FORM_SECTION_DRAFTS;

/**
 * Answers as the API keeps them, so the body stays compact under its 100 KB limit: canonical JSON read
 * back, a null, an empty list or an empty object left out (the API reads them as unanswered either way).
 */
function compact(answers: object): unknown {
  return JSON.parse(canonicalJson(answers));
}

/**
 * The five routes as plain calls on a client, for the hooks below and for a test.
 *
 * @example
 * const saved = await hotelFormDraftCalls(api).saveSection({ sessionToken, section: "rooms", save });
 */
export function hotelFormDraftCalls(api: ApiClient) {
  // Inside the form's session: its token is the Bearer, never a token the client holds.
  const post = <T>(path: string, body: unknown, schema: ZodType<T>, sessionToken: string) =>
    api.request(path, { method: "POST", body, schema, accessToken: sessionToken });
  return {
    draft: (sessionToken: string, signal?: AbortSignal): Promise<HotelFormDraftView> =>
      api.request("/hotel-form/draft", {
        schema: hotelFormDraftView,
        accessToken: sessionToken,
        signal,
      }),
    saveSection: <K extends HotelFormSectionKey>({
      sessionToken,
      section,
      save,
    }: HotelFormSectionSaveCall<K>): Promise<HotelFormSectionSaved> =>
      api.request(`/hotel-form/draft/sections/${section}`, {
        method: "PUT",
        body: { ...save, answers: compact(save.answers) },
        schema: hotelFormSectionSaved,
        accessToken: sessionToken,
      }),
    submit: ({ sessionToken, submit }: HotelFormSubmitCall): Promise<HotelFormSubmitted> =>
      post("/hotel-form/submit", submit, hotelFormSubmitted, sessionToken),
    requestCorrection: ({ sessionToken, correction }: HotelFormCorrectionCall) =>
      post("/hotel-form/corrections", correction, correctionSent, sessionToken),
    withdrawConsent: ({ sessionToken, withdrawal }: HotelFormWithdrawalCall) =>
      post("/hotel-form/consent-withdrawal", withdrawal, hotelFormWithdrawn, sessionToken),
  };
}

/**
 * `GET /hotel-form/draft` as a query, run only while there is a session.
 *
 *   await queryClient.prefetchQuery(hotelFormDraftQueryOptions(api, sessionToken));
 */
export function hotelFormDraftQueryOptions(api: ApiClient, sessionToken: string | null) {
  return queryOptions({
    queryKey: HOTEL_FORM_DRAFT_QUERY_KEY,
    queryFn:
      sessionToken === null
        ? skipToken
        : ({ signal }) => hotelFormDraftCalls(api).draft(sessionToken, signal),
    enabled: sessionToken !== null,
  });
}

/**
 * The draft (`GET /hotel-form/draft`) while `sessionToken` is not null: every section, the request, the
 * people helping, the caps and the choices.
 *
 *   const draft = useHotelFormDraft(sessionToken);
 */
export function useHotelFormDraft(sessionToken: string | null) {
  const api = useApiClient();
  return useQuery(hotelFormDraftQueryOptions(api, sessionToken));
}

/** The cached draft with one section replaced. */
function withSection<K extends HotelFormSectionKey>(
  queryClient: QueryClient,
  key: K,
  next: (section: HotelFormDraftSections[K]) => HotelFormDraftSections[K],
): void {
  queryClient.setQueryData<HotelFormDraftView>(HOTEL_FORM_DRAFT_QUERY_KEY, (draft) => {
    if (draft === undefined) return draft;
    const sections: HotelFormDraftSections = { ...draft.sections };
    sections[key] = next(draft.sections[key]);
    return { ...draft, sections };
  });
}

/**
 * A saved section in the cache: its version, its answers as the API stores them, and who saved it last
 * and when as the API answered (a save that changed nothing answers the section as it stands, which may
 * be a colleague's, so the saver is never assumed). A section whose stored answers no longer read reads
 * again: the save replaced them.
 */
function cacheSaved<K extends HotelFormSectionKey>(
  queryClient: QueryClient,
  { section: key, save }: HotelFormSectionSaveCall<K>,
  saved: HotelFormSectionSaved,
): void {
  const answers = DRAFTS[key].safeParse(compact(save.answers));
  withSection(queryClient, key, (section) => ({
    answers: answers.success ? answers.data : section.answers,
    version: saved.version,
    isComplete: saved.isComplete,
    noChanges: save.noChanges,
    lastEditedBy: saved.lastEditedBy,
    lastEditedAt: saved.lastEditedAt,
    isLastSaveYours: saved.isLastSaveYours,
    isUnreadable: false,
  }));
}

/** A refused save in the cache: a colleague's save is written in; a locked request is read again. */
function cacheRefused<K extends HotelFormSectionKey>(
  queryClient: QueryClient,
  key: K,
  error: unknown,
): void {
  if (!isAppError(error)) return;
  const theirs = hotelFormSectionConflictOf(error, key);
  if (theirs !== null) {
    withSection(queryClient, key, () => ({
      answers: theirs.answers,
      version: theirs.version,
      isComplete: isHotelFormSectionComplete(key, theirs.answers, theirs.noChanges),
      noChanges: theirs.noChanges,
      lastEditedBy: theirs.editedBy,
      lastEditedAt: theirs.editedAt,
      // A conflict is a colleague's save, as the section page words it.
      isLastSaveYours: false,
      isUnreadable: false,
    }));
    return;
  }
  if (hotelFormReadOnlyOf(error) !== null) void readAgain(queryClient);
}

/** The draft and the form's `me` read again: the request's status moved. */
function readAgain(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: HOTEL_FORM_DRAFT_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: HOTEL_FORM_ME_QUERY_KEY }),
  ]);
}

/**
 * `PUT /hotel-form/draft/sections/:sectionKey`: a section's autosave. On success the cached section takes
 * the new version and the answers as stored; on a 409 sectionConflict it takes the colleague's save, so
 * "Keep mine" saves again on `hotelFormSectionConflictOf(error, section).version`; on a 409 readOnly the
 * draft is read again, and the page keeps the unsaved text.
 *
 *   await useSaveHotelFormSection().mutateAsync({ sessionToken, section: "rooms", save });
 */
export function useSaveHotelFormSection() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelFormSectionSaved, Error, HotelFormSectionSaveCall>({
    mutationFn: (call) => hotelFormDraftCalls(api).saveSection(call),
    onSuccess: (saved, call) => cacheSaved(queryClient, call, saved),
    onError: (error, call) => cacheRefused(queryClient, call.section, error),
  });
}

/**
 * `POST /hotel-form/submit`: both declarations, the section versions the review page showed
 * (`hotelFormSectionVersionsOf(draft.sections)`) and the Turnstile pass. The draft and `me` are read
 * again after it, and after any 409: sectionsChanged (a colleague saved since the page read the draft;
 * `hotelFormSectionsChangedOf` names the sections), alreadySubmitted (who submitted and when:
 * `hotelFormReadOnlyOf`) or noticeStale.
 *
 *   const { reference } = await useSubmitHotelForm().mutateAsync({ sessionToken, submit });
 */
export function useSubmitHotelForm() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelFormSubmitted, Error, HotelFormSubmitCall>({
    mutationFn: (call) => hotelFormDraftCalls(api).submit(call),
    onSuccess: () => readAgain(queryClient),
    onError: (error) => {
      if (isAppError(error) && error.code === "conflict") void readAgain(queryClient);
    },
  });
}

/**
 * `POST /hotel-form/corrections`: a message for AMPM's Hotel team after submitting; the draft is unchanged.
 *
 *   await useRequestHotelFormCorrection().mutateAsync({ sessionToken, correction: { message, botToken } });
 */
export function useRequestHotelFormCorrection() {
  const api = useApiClient();
  return useMutation<Acknowledged, Error, HotelFormCorrectionCall>({
    mutationFn: (call) => hotelFormDraftCalls(api).requestCorrection(call),
  });
}

/**
 * `POST /hotel-form/consent-withdrawal`: withdraw 7.5 or every consent, or ask for removal. After 7.5
 * the draft is read again; withdrawing every consent ends every session of the person, this one included,
 * so every query of the form is forgotten, and the page forgets its session too (the flow's sign-out
 * does both, its own call answered 401).
 *
 *   await useWithdrawHotelFormConsent().mutateAsync({ sessionToken, withdrawal: { kind: "all", requestRemoval: true } });
 */
export function useWithdrawHotelFormConsent() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelFormWithdrawn, Error, HotelFormWithdrawalCall>({
    mutationFn: (call) => hotelFormDraftCalls(api).withdrawConsent(call),
    onSuccess: async (_withdrawn, { withdrawal }) => {
      if (withdrawal.kind === "all") forgetHotelForm(queryClient);
      else await queryClient.invalidateQueries({ queryKey: HOTEL_FORM_DRAFT_QUERY_KEY });
    },
  });
}
