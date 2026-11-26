import { useForgetHotelForm, useSignOutOfHotelForm, useUpdateHotelFormMe } from "@ampm/api-client";
import type { HotelFormMeUpdateRequest, HotelFormPerson } from "@ampm/core";

import type { FlowEvent, FlowState } from "./flow";
import { forgetSession, type SessionStore } from "./hotel-form-link";
import { asksForSession, refusalOf, saveOutcomeOf, type SaveOutcome } from "./refusal";
import type { OnSessionRefused } from "./use-session-views";

/** What saving your details and signing out need from the flow. */
export interface SessionCallsContext {
  readonly state: FlowState;
  readonly dispatch: (event: FlowEvent) => void;
  readonly onSessionRefused: OnSessionRefused;
  readonly storage: { current: SessionStore | null };
  readonly person: HotelFormPerson | undefined;
  /** Forgets the flow's own calls (asking for a code, entering it): a claim, the secret, the person. */
  readonly forgetCalls: () => void;
}

/**
 * Saving your own details and signing out, inside the session. Signing out forgets every query and call
 * of the form (the API's sign-out does on its answer, whatever it is) and the flow's own calls, and with no
 * session to end (a new code being asked) the form is forgotten all the same (review fixes C3 and E3).
 *
 *   const { saveDetails, signOut, isSigningOut } = useSessionCalls(context);
 */
export function useSessionCalls(context: SessionCallsContext) {
  const { state, dispatch, onSessionRefused, storage, person, forgetCalls } = context;
  const { mutateAsync: update } = useUpdateHotelFormMe();
  const signOutCall = useSignOutOfHotelForm();
  const forgetForm = useForgetHotelForm();

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
      forgetCalls();
      dispatch({ type: "signed_out" });
    };
    if (state.session !== null) {
      signOutCall.mutate({ sessionToken: state.session }, { onSettled: done });
      return;
    }
    forgetForm();
    done();
  };

  return { saveDetails, signOut, isSigningOut: signOutCall.isPending };
}
