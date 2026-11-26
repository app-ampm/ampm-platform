import { useEffect, useRef } from "react";

import { calloutStyles, cn, flatTintStyles, glassStyles, textStyles } from "@ampm/ui/styles";

import { FocusNotice, WaitLeft } from "../focus-notice";
import { FormButton, QuietLine } from "../form-parts";
import type { HotelFormSite } from "../hotel-form-provider";
import { STATUS_COPY } from "./status-copy";
import type { ShownPressNotice } from "./use-press-notice";
import { useWithdrawal, type Withdrawal } from "./use-withdrawal";

const COPY = STATUS_COPY.consent;

/** "Remove my details": focus comes back to it when the confirmation step is cancelled. */
const REMOVAL_START_ID = "hf-removal-start";

/** A withdrawal's notice: done in peacock, refused in gold, a wait counted down. */
function WithdrawalNotice({
  id,
  notice,
}: {
  readonly id: string;
  readonly notice: ShownPressNotice | null;
}) {
  if (notice === null) return null;
  return (
    <FocusNotice
      id={id}
      shown={notice.shown}
      message={notice.message}
      tone={notice.kind === "done" ? "peacock" : "gold"}
    >
      {notice.kind === "wait" ? (
        <WaitLeft retryAt={notice.retryAt} words={STATUS_COPY.correction.waitLeft} />
      ) : null}
    </FocusNotice>
  );
}

/** 7.5: what the permission covers, and withdrawing it at once. */
function DisplayPermission({ withdrawal }: { readonly withdrawal: Withdrawal }) {
  const isSending = withdrawal.sending === "display_authorisation";
  return (
    <div className={cn(flatTintStyles, "flex flex-col gap-3 rounded p-4")}>
      <h3 className={textStyles({ variant: "subheading", tone: "primary" })}>
        {COPY.display.heading}
      </h3>
      <p className={textStyles({ variant: "bodySmall", tone: "body" })}>{COPY.display.body}</p>
      <WithdrawalNotice id="hf-display-notice" notice={withdrawal.displayNotice} />
      <FormButton variant="secondary" isBusy={isSending} onClick={withdrawal.withdrawDisplay}>
        {isSending ? COPY.display.withdrawing : COPY.display.withdraw}
      </FormButton>
    </div>
  );
}

/**
 * 7.5 as the person answered it (`me.photoPermission`): a Yes, what it covers and its withdrawal; a No,
 * one plain line in its place, with nothing to withdraw; none on record (they never submitted, or withdrew
 * it on an earlier visit), nothing. A withdrawal made here keeps the block and its notice on screen until
 * the person leaves, though `me`, read again, now answers none; a reload then shows the state as it is.
 */
function PhotoPermission({
  site,
  withdrawal,
}: {
  readonly site: HotelFormSite;
  readonly withdrawal: Withdrawal;
}) {
  const answer = site.flow.me.data?.photoPermission ?? "none";
  if (answer === "yes" || withdrawal.hasWithdrawnDisplay)
    return <DisplayPermission withdrawal={withdrawal} />;
  return answer === "no" ? <QuietLine>{COPY.display.answeredNo}</QuietLine> : null;
}

/** The removal's confirmation step: what happens next, then Yes or Cancel. Its heading takes focus. */
function RemovalConfirm({ withdrawal }: { readonly withdrawal: Withdrawal }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const isSending = withdrawal.sending === "all";
  return (
    <div
      role="group"
      aria-labelledby="hf-removal-confirm"
      className={cn(glassStyles({ recipe: "gold", blur: false }), calloutStyles, "flex-col gap-3")}
    >
      <h4
        ref={heading}
        id="hf-removal-confirm"
        tabIndex={-1}
        className={cn(textStyles({ variant: "label", tone: "primary" }), "outline-none")}
      >
        {COPY.removal.confirmHeading}
      </h4>
      <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>{COPY.removal.next}</p>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {COPY.removal.steps.map((step) => (
          <li key={step} className={textStyles({ variant: "bodySmall", tone: "primary" })}>
            {step}
          </li>
        ))}
      </ul>
      <div className="flex flex-row flex-wrap gap-3">
        <FormButton variant="destructive" isBusy={isSending} onClick={withdrawal.confirmRemoval}>
          {isSending ? COPY.removal.removing : COPY.removal.confirm}
        </FormButton>
        <FormButton variant="ghost" onClick={withdrawal.cancelRemoval}>
          {COPY.removal.cancel}
        </FormButton>
      </div>
    </div>
  );
}

/** Puts focus back on "Remove my details" once its confirmation step is cancelled. */
function useFocusAfterCancel(isConfirming: boolean) {
  const wasConfirming = useRef(isConfirming);
  useEffect(() => {
    if (wasConfirming.current && !isConfirming) document.getElementById(REMOVAL_START_ID)?.focus();
    wasConfirming.current = isConfirming;
  }, [isConfirming]);
}

/** "Remove my details": what it asks AMPM, then its confirmation step. */
function RemoveDetails({ withdrawal }: { readonly withdrawal: Withdrawal }) {
  useFocusAfterCancel(withdrawal.isConfirming);
  return (
    <div className={cn(flatTintStyles, "flex flex-col gap-3 rounded p-4")}>
      <h3 className={textStyles({ variant: "subheading", tone: "primary" })}>
        {COPY.removal.heading}
      </h3>
      <p className={textStyles({ variant: "bodySmall", tone: "body" })}>{COPY.removal.body}</p>
      {withdrawal.isConfirming ? (
        <RemovalConfirm withdrawal={withdrawal} />
      ) : (
        <FormButton id={REMOVAL_START_ID} variant="secondary" onClick={withdrawal.startRemoval}>
          {COPY.removal.start}
        </FormButton>
      )}
      <WithdrawalNotice id="hf-removal-notice" notice={withdrawal.removalNotice} />
    </div>
  );
}

/**
 * "Your consent and your details" on HF-07 (D-190 §3; plan §9.3): withdraw 7.5, the permission to show
 * photos, at once, when the person gave it (a No is said in one line, and none on record shows nothing);
 * or remove your details, after a step that says what happens next, which signs you out and leaves the
 * page saying so (`onRemoved`).
 *
 *   <ConsentPanel site={site} onRemoved={() => setIsRemoved(true)} />
 */
export function ConsentPanel({
  site,
  onRemoved,
}: {
  readonly site: HotelFormSite;
  readonly onRemoved: () => void;
}) {
  const withdrawal = useWithdrawal(site, onRemoved);
  return (
    <section aria-labelledby="hf-consent-heading" className="flex flex-col gap-4">
      <h2 id="hf-consent-heading" className={textStyles({ variant: "heading" })}>
        {COPY.heading}
      </h2>
      <PhotoPermission site={site} withdrawal={withdrawal} />
      <RemoveDetails withdrawal={withdrawal} />
    </section>
  );
}
