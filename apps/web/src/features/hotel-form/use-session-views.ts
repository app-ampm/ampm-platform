import { useEffect, useRef, useState } from "react";
import { useHotelFormDraft, useHotelFormMe } from "@ampm/api-client";
import type { HotelFormDraftView, HotelFormMe, HotelFormPerson } from "@ampm/core";

import type { FlowState } from "./flow";
import { asksForSession, refusalOf, type Refusal } from "./refusal";

/** A signed-in page's data from the API: the answer, while it loads, and why it failed. */
export interface QueryView<T> {
  readonly data: T | undefined;
  readonly isLoading: boolean;
  /** A failure that is not the session's (a lost connection): shown with Try again. */
  readonly error: string | null;
  readonly retry: () => void;
}

/** The form's `me`: the person and the request (HF-04's header, "Same as me"). */
export type MeView = QueryView<HotelFormMe>;

/** The form's draft: every section, the request, the people helping, the caps and the chips' options. */
export interface DraftView extends QueryView<HotelFormDraftView> {
  /**
   * How far the API's clock runs ahead of this device's (negative when behind), from the latest read of
   * the draft: add it to `Date.now()` for the API's time. 0 before the first read.
   */
  readonly clockSkewMs: number;
}

/** Hands a refused session to the flow, with the signed-in person when the page has them. */
export type OnSessionRefused = (refusal: Refusal, person: HotelFormPerson | undefined) => void;

interface SessionQuery<T> {
  readonly data: T | undefined;
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly refetch: () => Promise<unknown>;
}

/** A query's view, a refusal of the session left to the flow (it asks for a new code in place). */
function viewOf<T>(query: SessionQuery<T>): QueryView<T> {
  const refusal = query.error ? refusalOf(query.error) : null;
  return {
    data: query.data,
    isLoading: query.isLoading,
    error: refusal === null || asksForSession(refusal) ? null : refusal.message,
    retry: () => void query.refetch(),
  };
}

/**
 * Hands the flow a session a query was refused with, once per refusal: the person's details change while
 * a new code is entered (`me` is written again first), and the refusal the draft still holds until it is
 * read again must not ask for another code.
 */
function useRefusedSession(
  error: Error | null,
  onSessionRefused: OnSessionRefused,
  person: HotelFormPerson | undefined,
) {
  const handled = useRef<Error | null>(null);
  useEffect(() => {
    if (error === null || error === handled.current) return;
    handled.current = error;
    const refused = refusalOf(error);
    if (asksForSession(refused)) onSessionRefused(refused, person);
  }, [error, onSessionRefused, person]);
}

/** One read of the draft as the clock sees it: the API's time it was read at, and the skew it gave. */
interface ClockReading {
  readonly readAt: string;
  readonly skewMs: number;
}

/**
 * How far the API's clock runs from this device's (review fix C7): the draft's `readAt` against this
 * device's clock when that answer arrived (the query's `dataUpdatedAt`), taken once per read. A save
 * written into the cache moves `dataUpdatedAt` but keeps the read's `readAt`, so the skew is not taken
 * again then. The flow is mounted for as long as the form is, so it sees every read as it lands.
 */
function useClockSkew(readAt: string | undefined, receivedAt: number): number {
  const [reading, setReading] = useState<ClockReading | null>(null);
  if (readAt !== undefined && reading?.readAt !== readAt) {
    const next = { readAt, skewMs: Date.parse(readAt) - receivedAt };
    // Kept from this render on, as React allows a component to adjust its own state while it renders.
    setReading(next);
    return next.skewMs;
  }
  return reading?.skewMs ?? 0;
}

/**
 * The signed-in pages' data (D-189 §8, D-190 §5), read while the flow holds a session: the form's `me`
 * and its draft, with how far the API's clock runs from this device's. Either refused with a session
 * reason hands the refusal to the flow, which asks for a new code in place; the data already read stays
 * on the page meanwhile.
 *
 *   const { me, draft } = useSessionViews(state, onSessionRefused);
 */
export function useSessionViews(state: FlowState, onSessionRefused: OnSessionRefused) {
  const session = state.phase.kind === "signed_in" ? state.session : null;
  const me = useHotelFormMe(session);
  const draft = useHotelFormDraft(session);
  const person = me.data?.person;
  useRefusedSession(me.error, onSessionRefused, person);
  useRefusedSession(draft.error, onSessionRefused, person);
  const clockSkewMs = useClockSkew(draft.data?.readAt, draft.dataUpdatedAt);
  const draftView: DraftView = { ...viewOf<HotelFormDraftView>(draft), clockSkewMs };
  return { me: viewOf<HotelFormMe>(me), draft: draftView };
}
