import { useState } from "react";
import { useWithdrawHotelFormConsent } from "@ampm/api-client";
import type { HotelFormWithdrawalRequest, HotelFormWithdrawn } from "@ampm/core";

import type { HotelFormSite } from "../hotel-form-provider";
import { usePersonScoped } from "../use-person-scoped";
import { STATUS_COPY } from "./status-copy";
import { pressRefusalOf } from "./status.form";
import { pressNoticeOf, usePressNotice, type ShownPressNotice } from "./use-press-notice";

const COPY = STATUS_COPY.consent;

/** Withdrawing 7.5, and removing the person's details after a confirmation step. */
export interface Withdrawal {
  /** The call running: 7.5's withdrawal, or the removal. */
  readonly sending: HotelFormWithdrawalRequest["kind"] | null;
  readonly displayNotice: ShownPressNotice | null;
  readonly removalNotice: ShownPressNotice | null;
  /**
   * The person withdrew 7.5 here: the block and its notice stay until they leave, though `me`, read
   * again, now answers none. Theirs only: someone else signing in in place starts without it.
   */
  readonly hasWithdrawnDisplay: boolean;
  /** The removal's confirmation step is open, saying what happens next. */
  readonly isConfirming: boolean;
  readonly withdrawDisplay: () => void;
  readonly startRemoval: () => void;
  readonly cancelRemoval: () => void;
  readonly confirmRemoval: () => void;
}

type Notice = ReturnType<typeof usePressNotice>;

/**
 * One withdrawal call inside the session; a refusal is shown on `notice` unless it is the session's,
 * which the flow takes (a new code in place). Answers the withdrawal, or null when refused.
 */
function useWithdrawalCall(site: HotelFormSite) {
  const { mutateAsync } = useWithdrawHotelFormConsent();
  const [sending, setSending] = useState<Withdrawal["sending"]>(null);
  const call = async (
    withdrawal: HotelFormWithdrawalRequest,
    notice: Notice,
    newCode: string,
  ): Promise<HotelFormWithdrawn | null> => {
    const sessionToken = site.flow.state.session;
    if (sessionToken === null) {
      notice.show({ kind: "refused", message: newCode });
      return null;
    }
    setSending(withdrawal.kind);
    try {
      return await mutateAsync({ sessionToken, withdrawal });
    } catch (refused) {
      const refusal = pressRefusalOf(refused);
      if (!site.flow.refuseSession(refused))
        notice.show(
          refusal.kind === "session"
            ? { kind: "refused", message: newCode }
            : pressNoticeOf(refusal),
        );
      return null;
    } finally {
      setSending(null);
    }
  };
  return { call, sending };
}

/**
 * HF-07's withdrawals (D-190 §3; plan §9.3, withdrawal as easy as consent): "Withdraw my permission to
 * show photos" sends `display_authorisation` at once and says what changed; "Remove my details" first
 * opens a step saying what happens next, and confirmed sends `all` with `requestRemoval`, which ends
 * every session of the person: `onRemoved` then shows the plain confirmation, and the flow signs out
 * (its own call answers 401, and the session is forgotten all the same).
 *
 *   const withdrawal = useWithdrawal(site, () => setIsRemoved(true));
 */
export function useWithdrawal(site: HotelFormSite, onRemoved: () => void): Withdrawal {
  const { call, sending } = useWithdrawalCall(site);
  const [hasWithdrawnDisplay, updateWithdrawn] = usePersonScoped(
    site.flow.me.data?.personId,
    false,
  );
  const display = usePressNotice();
  const removal = usePressNotice();
  const [isConfirming, setIsConfirming] = useState(false);
  const withdrawDisplay = async () => {
    if (sending !== null) return;
    if (display.isHeld() && display.current) return display.show(display.current);
    const kind = "display_authorisation";
    const done = await call({ kind, requestRemoval: false }, display, COPY.newCode);
    if (done === null) return;
    updateWithdrawn(() => true);
    const message = done.withdrawn.includes(kind) ? COPY.display.done : COPY.display.none;
    display.show({ kind: "done", message });
  };
  const confirmRemoval = async () => {
    if (sending !== null) return;
    if (removal.isHeld() && removal.current) return removal.show(removal.current);
    const done = await call({ kind: "all", requestRemoval: true }, removal, COPY.newCode);
    if (done === null) return;
    onRemoved();
    site.flow.signOut();
  };
  return {
    sending,
    displayNotice: display.current,
    removalNotice: removal.current,
    hasWithdrawnDisplay,
    isConfirming,
    withdrawDisplay: () => void withdrawDisplay(),
    startRemoval: () => setIsConfirming(true),
    cancelRemoval: () => setIsConfirming(false),
    confirmRemoval: () => void confirmRemoval(),
  };
}
