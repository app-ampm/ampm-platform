import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  useOpenHotelForm,
  useRequestHotelFormCode,
  useSignOutOfHotelForm,
  useUpdateHotelFormMe,
  useVerifyHotelFormCode,
} from "@ampm/api-client";
import {
  hotelFormLinkToken,
  type HotelFormMeUpdateRequest,
  type HotelFormPerson,
} from "@ampm/core";

import { codeStep } from "./code.form";
import { detailsStep, type DetailsFields } from "./details.form";
import {
  INITIAL_FLOW,
  flowReducer,
  openingKeyOf,
  type FlowEvent,
  type FlowState,
  type HeldCall,
  type IdentityStep,
} from "./flow";
import {
  browserLinkHost,
  forgetSession,
  keepSession,
  linkFromHash,
  storedSession,
  takeLink,
  type SessionStore,
} from "./hotel-form-link";
import { asksForSession, refusalOf, saveOutcomeOf, type SaveOutcome } from "./refusal";
import {
  useSessionViews,
  type DraftView,
  type MeView,
  type OnSessionRefused,
} from "./use-session-views";

export type { DraftView, MeView, QueryView } from "./use-session-views";

/** The bot check as a step hands it over: the token Send carries, and how to start a fresh check. */
export interface BotCheckPass {
  readonly token: string | null;
  readonly reset: () => void;
}

/** The flow and what the steps can do. */
export interface HotelFormFlow {
  readonly state: FlowState;
  readonly me: MeView;
  /** The form's draft (D-190 §3), read while signed in: the overview's and the sections' data. */
  readonly draft: DraftView;
  readonly isSendingCode: boolean;
  readonly isVerifying: boolean;
  readonly isSigningOut: boolean;
  readonly reopen: () => void;
  readonly start: () => void;
  readonly changeClaim: (claim: DetailsFields) => void;
  readonly sendCode: (botCheck: BotCheckPass) => void;
  readonly changeCode: (code: string) => void;
  readonly verifyCode: () => void;
  readonly changeDetails: () => void;
  readonly saveDetails: (change: HotelFormMeUpdateRequest) => Promise<SaveOutcome>;
  readonly signOut: () => void;
  /**
   * Hands the flow a call's refusal when it is the session's (a section's save): the flow then asks for a
   * new code in place, keeping the page. True when it was the session's.
   */
  readonly refuseSession: (error: unknown) => boolean;
}

/** The identity step on screen: in the main flow, or in place over the signed-in page. */
export function identityOf(state: FlowState): IdentityStep | null {
  if (state.phase.kind === "identity") return state.phase.identity;
  return state.phase.kind === "signed_in" ? state.phase.reverify : null;
}

/**
 * Opens the form afresh when a link arrives in the address bar of a page already open (pasted into the
 * same tab, or followed from a page there): only the fragment changes then, so the page is not loaded
 * again. Taking the link out with replaceState fires no hashchange, so this runs once per link.
 */
function useLinkArrival(dispatch: (event: FlowEvent) => void) {
  useEffect(() => {
    const onHashChange = () => {
      if (linkFromHash(window.location.hash) !== null) dispatch({ type: "reopen" });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [dispatch]);
}

/**
 * Takes the link out of the address bar and opens it, each time the flow is asked to open (the first
 * render, Try again, and a link arriving in the same tab, even while another still opens: the effect is
 * keyed on each open, not on whether the flow is opening). Only the latest open's answer is taken.
 */
function useOpening(
  state: FlowState,
  dispatch: (event: FlowEvent) => void,
  storage: { current: SessionStore | null },
) {
  const { mutate: open } = useOpenHotelForm();
  const openingKey = openingKeyOf(state);
  useEffect(() => {
    if (openingKey === null) return;
    const host = browserLinkHost();
    storage.current = host.storage;
    const secret = takeLink(host);
    if (secret === null) {
      dispatch({ type: "no_link" });
    } else if (!hotelFormLinkToken.safeParse(secret).success) {
      dispatch({ type: "open_failed", refusal: { kind: "gone", message: null }, now: Date.now() });
    } else {
      open(
        { token: secret },
        {
          onSuccess: (answer) =>
            dispatch({ type: "opened", secret, answer, session: storedSession(host.storage) }),
          onError: (error) =>
            dispatch({ type: "open_failed", refusal: refusalOf(error), now: Date.now() }),
        },
      );
    }
  }, [openingKey, open, dispatch, storage]);
}

/** A refusal of a code route, handed to the flow with the time it came and the call it refused. */
const refusedBy = (dispatch: (event: FlowEvent) => void, call: HeldCall) => (error: unknown) =>
  dispatch({ type: "refused", refusal: refusalOf(error), now: Date.now(), call });

/** Asking for a code (HF-02, and HF-03's resend), in the main flow or in place. */
function useSendCode(state: FlowState, dispatch: (event: FlowEvent) => void) {
  const requestCode = useRequestHotelFormCode();
  const sendCode = (botCheck: BotCheckPass) => {
    if (state.link === null) return;
    const step = detailsStep(state.claim, state.link.secret, botCheck.token);
    // Checked on every press: a refused answer shows on its field, and a corrected one clears.
    dispatch({ type: "details_checked", errors: step.kind === "invalid" ? step.errors : {} });
    if (step.kind !== "send") return;
    // A token is good for one request: spend it now, so the check is already running again.
    botCheck.reset();
    requestCode.mutate(step.request, {
      onSuccess: (issued) => dispatch({ type: "code_issued", issued, now: Date.now() }),
      onError: refusedBy(dispatch, "send"),
    });
  };
  return { sendCode, isSendingCode: requestCode.isPending };
}

/** Entering the code (HF-03): the session it opens is kept for the tab. */
function useVerifyCode(
  state: FlowState,
  dispatch: (event: FlowEvent) => void,
  storage: { current: SessionStore | null },
) {
  const verify = useVerifyHotelFormCode();
  const verifyCode = () => {
    const identity = identityOf(state);
    if (state.link === null || identity?.step !== "code") return;
    const step = codeStep(state.code, state.link.secret, identity.issued.challengeId);
    if (step.kind === "invalid") {
      dispatch({ type: "code_invalid", error: step.error });
      return;
    }
    verify.mutate(step.request, {
      onSuccess: ({ sessionToken }) => {
        keepSession(storage.current, sessionToken);
        dispatch({ type: "verified", sessionToken });
      },
      onError: refusedBy(dispatch, "verify"),
    });
  };
  return { verifyCode, isVerifying: verify.isPending };
}

/** Saving your own details and signing out, inside the session. */
function useSessionCalls(
  state: FlowState,
  dispatch: (event: FlowEvent) => void,
  onSessionRefused: OnSessionRefused,
  storage: { current: SessionStore | null },
  person: HotelFormPerson | undefined,
) {
  const { mutateAsync: update } = useUpdateHotelFormMe();
  const signOutCall = useSignOutOfHotelForm();

  const saveDetails = async (change: HotelFormMeUpdateRequest): Promise<SaveOutcome> => {
    if (state.session === null) return { kind: "session" };
    try {
      await update({ sessionToken: state.session, change });
      return { kind: "saved" };
    } catch (error) {
      const refusal = refusalOf(error);
      if (asksForSession(refusal)) onSessionRefused(refusal, person);
      return saveOutcomeOf(refusal, Date.now());
    }
  };

  const signOut = () => {
    const done = () => {
      forgetSession(storage.current);
      dispatch({ type: "signed_out" });
    };
    if (state.session === null) done();
    else signOutCall.mutate({ sessionToken: state.session }, { onSettled: done });
  };

  return { saveDetails, signOut, isSigningOut: signOutCall.isPending };
}

/**
 * The hotel form's identity step as the page runs it (D-189 §8): the link taken from the fragment and
 * opened, the details and the code, the session kept for the tab, and every refusal handed to the flow.
 *
 *   const flow = useHotelFormFlow();
 *   <HotelFormScreen flow={flow} siteKey={siteKey} />
 */
export function useHotelFormFlow(): HotelFormFlow {
  const [state, dispatch] = useReducer(flowReducer, INITIAL_FLOW);
  const storage = useRef<SessionStore | null>(null);
  const onSessionRefused = useCallback<OnSessionRefused>((refusal, person) => {
    forgetSession(storage.current);
    dispatch({ type: "session_refused", refusal, person });
  }, []);
  useOpening(state, dispatch, storage);
  useLinkArrival(dispatch);
  const { me, draft } = useSessionViews(state, onSessionRefused);
  const person = me.data?.person;
  return {
    state,
    me,
    draft,
    ...useSendCode(state, dispatch),
    ...useVerifyCode(state, dispatch, storage),
    ...useSessionCalls(state, dispatch, onSessionRefused, storage, person),
    refuseSession: (error) => {
      const refusal = refusalOf(error);
      if (!asksForSession(refusal)) return false;
      onSessionRefused(refusal, person);
      return true;
    },
    reopen: () => dispatch({ type: "reopen" }),
    start: () => dispatch({ type: "start" }),
    changeClaim: (claim) => dispatch({ type: "claim_changed", claim }),
    changeCode: (code) => dispatch({ type: "code_changed", code }),
    changeDetails: () => dispatch({ type: "change_details" }),
  };
}
