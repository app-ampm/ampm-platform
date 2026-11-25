import type {
  HotelFormCodeIssued,
  HotelFormLinkState,
  HotelFormOpenAnswer,
  HotelFormPerson,
} from "@ampm/core";

import { resendDeadline } from "./code.form";
import {
  EMPTY_DETAILS,
  detailsFromPerson,
  type DetailsErrors,
  type DetailsFields,
} from "./details.form";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { CODE_FIELD, type Refusal } from "./refusal";

/*
 * The identity step's flow (D-189 §8), as a pure reducer the page drives: open the link, welcome (HF-01),
 * your details (HF-02), your code (HF-03), signed in, and HF-08 for a link that is not active. A session
 * refused with a reason that asks for a new code reopens HF-02 and HF-03 in place over the signed-in
 * page, so whatever the person typed there stays. The page's effects (the calls, the link and the session
 * in sessionStorage) live in use-hotel-form-flow.ts.
 */

/** HF-02 or HF-03: the details, or the code of the challenge they opened. */
export type IdentityStep =
  | { readonly step: "details" }
  | {
      readonly step: "code";
      readonly issued: HotelFormCodeIssued;
      /** When another code may be asked for, on this device's clock. */
      readonly resendAt: number;
    };

export type Phase =
  | { readonly kind: "opening" }
  | { readonly kind: "no_link" }
  /** The link could not be opened for now; `retryAt` holds any wait the API asked for. */
  | { readonly kind: "unreachable"; readonly message: string; readonly retryAt: number | null }
  /** HF-08; `message` is the API's when it gave one (the link replaced, the person removed). */
  | { readonly kind: "gone"; readonly message: string | null }
  | { readonly kind: "welcome" }
  | { readonly kind: "identity"; readonly identity: IdentityStep }
  /** Signed in; `reverify` asks for a new code in place once the session was refused. */
  | { readonly kind: "signed_in"; readonly reverify: IdentityStep | null };

/** The link the page opened: its secret (sent in POST bodies only) and what it opened to. */
export interface OpenedLink {
  readonly secret: string;
  readonly state: Exclude<HotelFormLinkState, "not_active">;
  readonly expiresAt: string | null;
}

/** A notice over the step on screen: a refusal, or why the page asks again. */
export interface StepNotice {
  readonly message: string;
  /** When the person may try again, on this device's clock (a Retry-After). */
  readonly retryAt: number | null;
  /** The privacy notice changed: the way on is a reload. */
  readonly isReload: boolean;
}

export interface FlowState {
  readonly phase: Phase;
  readonly link: OpenedLink | null;
  readonly helpContact: string | null;
  /** HF-02's fields, kept as typed across the steps and a new code. */
  readonly claim: DetailsFields;
  readonly errors: DetailsErrors;
  readonly code: string;
  readonly codeError: string | null;
  readonly notice: StepNotice | null;
  /** The form session, mirrored in sessionStorage by the page. */
  readonly session: string | null;
}

export type FlowEvent =
  | { readonly type: "no_link" }
  | {
      readonly type: "opened";
      readonly secret: string;
      readonly answer: HotelFormOpenAnswer;
      readonly session: string | null;
    }
  | { readonly type: "open_failed"; readonly refusal: Refusal; readonly now: number }
  | { readonly type: "reopen" }
  | { readonly type: "start" }
  | { readonly type: "claim_changed"; readonly claim: DetailsFields }
  | { readonly type: "details_checked"; readonly errors: DetailsErrors }
  | { readonly type: "code_issued"; readonly issued: HotelFormCodeIssued; readonly now: number }
  | { readonly type: "code_changed"; readonly code: string }
  | { readonly type: "code_invalid"; readonly error: string }
  | { readonly type: "change_details" }
  | { readonly type: "verified"; readonly sessionToken: string }
  | { readonly type: "refused"; readonly refusal: Refusal; readonly now: number }
  | {
      readonly type: "session_refused";
      readonly refusal: Refusal;
      /** The signed-in person, when the page has them: their details fill an empty HF-02. */
      readonly person?: HotelFormPerson | undefined;
    }
  | { readonly type: "signed_out" };

export const INITIAL_FLOW: FlowState = {
  phase: { kind: "opening" },
  link: null,
  helpContact: null,
  claim: EMPTY_DETAILS,
  errors: {},
  code: "",
  codeError: null,
  notice: null,
  session: null,
};

const noticeOf = (message: string, retryAt: number | null = null): StepNotice => ({
  message,
  retryAt,
  isReload: false,
});

/** The flow with the identity step on screen moved on: in the main flow, or in place when signed in. */
function withIdentity(state: FlowState, identity: IdentityStep): FlowState {
  const phase: Phase =
    state.phase.kind === "signed_in"
      ? { kind: "signed_in", reverify: identity }
      : { kind: "identity", identity };
  return { ...state, phase };
}

function opened(state: FlowState, event: Extract<FlowEvent, { type: "opened" }>): FlowState {
  const { answer, secret, session } = event;
  const helpContact = answer.helpContact;
  if (answer.state === "not_active")
    return { ...state, helpContact, phase: { kind: "gone", message: null }, session: null };
  const link: OpenedLink = { secret, state: answer.state, expiresAt: answer.expiresAt };
  const phase: Phase =
    session === null ? { kind: "welcome" } : { kind: "signed_in", reverify: null };
  return { ...state, link, helpContact, phase, session };
}

/** A field's refusal from the API, on the field it names. */
function fieldRefused(state: FlowState, field: string, message: string): FlowState {
  if (field === CODE_FIELD) return { ...state, codeError: message };
  if (field === "fullName" || field === "mobile")
    return { ...state, errors: { ...state.errors, [field]: message } };
  if (field === "designation") {
    const key =
      state.claim.designationChoice === "Other" ? "designationOther" : "designationChoice";
    return { ...state, errors: { ...state.errors, [key]: message } };
  }
  return { ...state, notice: noticeOf(message) };
}

function refused(state: FlowState, refusal: Refusal, now: number): FlowState {
  switch (refusal.kind) {
    case "gone":
      return { ...state, phase: { kind: "gone", message: refusal.message }, session: null };
    case "wait":
      return { ...state, notice: noticeOf(refusal.message, now + refusal.seconds * 1000) };
    case "reload":
      return { ...state, notice: { message: refusal.message, retryAt: null, isReload: true } };
    case "field":
      return fieldRefused(state, refusal.field, refusal.message);
    default:
      return { ...state, notice: noticeOf(refusal.message) };
  }
}

function sessionRefused(
  state: FlowState,
  { refusal, person }: Extract<FlowEvent, { type: "session_refused" }>,
): FlowState {
  if (refusal.kind === "gone") return refused(state, refusal, 0);
  const isUntyped = state.claim.fullName === "" && state.claim.mobile === "";
  const claim = isUntyped && person ? detailsFromPerson(person) : state.claim;
  const asked = { ...state, claim, session: null, notice: noticeOf(refusal.message), code: "" };
  return asked.phase.kind === "signed_in"
    ? { ...asked, phase: { kind: "signed_in", reverify: { step: "details" } } }
    : { ...asked, phase: { kind: "identity", identity: { step: "details" } } };
}

function codeIssued(state: FlowState, issued: HotelFormCodeIssued, now: number): FlowState {
  const next = { ...state, code: "", codeError: null, notice: null, errors: {} };
  return withIdentity(next, { step: "code", issued, resendAt: resendDeadline(issued, now) });
}

/**
 * The flow after one event.
 *
 * @example
 * const [state, dispatch] = useReducer(flowReducer, INITIAL_FLOW);
 */
export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case "no_link":
      return { ...state, phase: { kind: "no_link" } };
    case "opened":
      return opened(state, event);
    case "open_failed":
      if (event.refusal.kind === "gone") return refused(state, event.refusal, event.now);
      return { ...state, phase: unreachable(event.refusal, event.now) };
    case "reopen":
      return { ...state, phase: { kind: "opening" } };
    case "start":
      return { ...state, notice: null, phase: { kind: "identity", identity: { step: "details" } } };
    case "claim_changed":
      return { ...state, claim: event.claim };
    case "details_checked":
      return { ...state, errors: event.errors, notice: null };
    case "code_issued":
      return codeIssued(state, event.issued, event.now);
    case "code_changed":
      return { ...state, code: event.code };
    case "code_invalid":
      return { ...state, codeError: event.error };
    case "change_details":
      return withIdentity({ ...state, notice: null, codeError: null }, { step: "details" });
    case "verified":
      return verified(state, event.sessionToken);
    case "refused":
      return refused(state, event.refusal, event.now);
    case "session_refused":
      return sessionRefused(state, event);
    case "signed_out":
      return signedOut(state);
  }
}

function unreachable(refusal: Refusal, now: number): Phase {
  const retryAt = refusal.kind === "wait" ? now + refusal.seconds * 1000 : null;
  return {
    kind: "unreachable",
    message: refusal.message ?? HOTEL_FORM_COPY.errors.unexpected,
    retryAt,
  };
}

function verified(state: FlowState, sessionToken: string): FlowState {
  const phase: Phase = { kind: "signed_in", reverify: null };
  return { ...state, phase, session: sessionToken, code: "", codeError: null, notice: null };
}

function signedOut(state: FlowState): FlowState {
  return {
    ...INITIAL_FLOW,
    link: state.link,
    helpContact: state.helpContact,
    phase: { kind: "welcome" },
    notice: noticeOf(HOTEL_FORM_COPY.welcome.signedOut),
  };
}
