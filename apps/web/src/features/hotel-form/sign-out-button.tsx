import { useEffect, useRef, useState } from "react";

import type { HotelFormSectionKey } from "@ampm/core";
import { calloutStyles, cn, glassStyles, textStyles } from "@ampm/ui/styles";

import { FormButton } from "./form-parts";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { SectionLinks } from "./section-links";
import type { HeldSections } from "./sections/held-sections";
import type { HotelFormFlow } from "./use-hotel-form-flow";

const COPY = HOTEL_FORM_COPY.signedIn;

/** Sign out: focus comes back to it once the person chose to stay. */
const SIGN_OUT_ID = "hf-sign-out";

/** The question's heading, which takes focus as it appears. */
const CONFIRM_HEADING_ID = "hf-sign-out-confirm";

interface SignOutConfirmProps {
  /** The sections with changes not saved when Sign out was pressed. */
  readonly sections: readonly HotelFormSectionKey[];
  readonly isSigningOut: boolean;
  readonly onSignOut: () => void;
  readonly onStay: () => void;
}

/** What signing out now would drop, then Sign out anyway or Stay signed in. Its heading takes focus. */
function SignOutConfirm({ sections, isSigningOut, onSignOut, onStay }: SignOutConfirmProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div
      role="group"
      aria-labelledby={CONFIRM_HEADING_ID}
      className={cn(
        glassStyles({ recipe: "gold", blur: false }),
        calloutStyles,
        "w-full flex-col gap-3",
      )}
    >
      <h2
        ref={heading}
        id={CONFIRM_HEADING_ID}
        tabIndex={-1}
        className={cn(textStyles({ variant: "label", tone: "primary" }), "outline-none")}
      >
        {COPY.signOutPending.heading}
      </h2>
      <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>
        {COPY.signOutPending.body}
      </p>
      <SectionLinks sections={sections} />
      <div className="flex flex-row flex-wrap gap-3">
        <FormButton variant="destructive" isBusy={isSigningOut} onClick={onSignOut}>
          {isSigningOut ? COPY.signingOut : COPY.signOutPending.confirm}
        </FormButton>
        <FormButton variant="ghost" onClick={onStay}>
          {COPY.signOutPending.stay}
        </FormButton>
      </div>
    </div>
  );
}

/** Puts focus back on Sign out once the person chose to stay signed in. */
function useFocusAfterStay(isAsking: boolean) {
  const wasAsking = useRef(isAsking);
  useEffect(() => {
    if (wasAsking.current && !isAsking) document.getElementById(SIGN_OUT_ID)?.focus();
    wasAsking.current = isAsking;
  }, [isAsking]);
}

export interface SignOutButtonProps {
  readonly flow: HotelFormFlow;
  /** The layout's held sections: their changes not saved yet are asked about first. */
  readonly sections?: HeldSections | undefined;
}

/**
 * Sign out on HF-04 and HF-07 (D-190 §5, review fix F2). With every change saved it signs out at once.
 * While a section still has changes not saved (waiting to save, or refused), it asks first, naming those
 * sections, each a link: "Sign out anyway" drops the changes and signs out; "Stay signed in" keeps them,
 * focus back on Sign out.
 *
 *   <SignOutButton flow={flow} sections={site.sections} />
 */
export function SignOutButton({ flow, sections }: SignOutButtonProps) {
  const [asking, setAsking] = useState<readonly HotelFormSectionKey[] | null>(null);
  useFocusAfterStay(asking !== null);
  const press = () => {
    const pending = sections?.pendingSections() ?? [];
    if (pending.length === 0) flow.signOut();
    else setAsking(pending);
  };
  const signOutAnyway = () => {
    sections?.drop();
    flow.signOut();
  };
  if (asking !== null)
    return (
      <SignOutConfirm
        sections={asking}
        isSigningOut={flow.isSigningOut}
        onSignOut={signOutAnyway}
        onStay={() => setAsking(null)}
      />
    );
  return (
    <FormButton id={SIGN_OUT_ID} variant="secondary" onClick={press} isBusy={flow.isSigningOut}>
      {flow.isSigningOut ? COPY.signingOut : COPY.signOut}
    </FormButton>
  );
}
