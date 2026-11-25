import type { ReactNode } from "react";

import {
  buttonLabelStyles,
  buttonStyles,
  calloutStyles,
  cn,
  glassStyles,
  textStyles,
  type ButtonVariant,
} from "@ampm/ui/styles";

import type { StepNotice } from "./flow";
import { HOTEL_FORM_COPY as COPY } from "./hotel-form-copy";

/*
 * The small pieces every step of the hotel form shares: its buttons, the notice that carries a refusal,
 * and the help line. Plain DOM with the kit's recipes (peacock-night.md §6).
 */

export interface FormButtonProps {
  readonly children: ReactNode;
  readonly onClick?: (() => void) | undefined;
  readonly type?: "button" | "submit" | undefined;
  /** primary (gold, one per step), secondary (pearl outline) or ghost. */
  readonly variant?: ButtonVariant | undefined;
  readonly isDisabled?: boolean | undefined;
  readonly isBusy?: boolean | undefined;
  readonly describedBy?: string | undefined;
  readonly label?: string | undefined;
}

/**
 * A pill button: the kit's Button recipe on a DOM button, 48 tall and full width for the primary on a
 * phone. While disabled it is the kit's dashed pill, and it says why in its words.
 *
 *   <FormButton type="submit" isDisabled={!canSend}>Send me a code</FormButton>
 */
export function FormButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  isDisabled = false,
  isBusy = false,
  describedBy,
  label,
}: FormButtonProps) {
  const isPrimary = variant === "primary";
  const size = isPrimary ? "lg" : "md";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled || isBusy}
      aria-busy={isBusy || undefined}
      aria-describedby={describedBy}
      aria-label={label}
      className={buttonStyles({ variant, size, fullWidth: isPrimary, disabled: isDisabled })}
    >
      <span className={buttonLabelStyles({ variant, size, disabled: isDisabled })}>{children}</span>
    </button>
  );
}

/**
 * A refusal or a reason to ask again, in gold glass, announced as it appears. A changed privacy notice
 * adds the way on: reloading the page (the link stays in the tab).
 *
 *   <FormNotice notice={state.notice} />
 */
export function FormNotice({ notice }: { readonly notice: StepNotice }) {
  return (
    <div
      role="alert"
      className={cn(glassStyles({ recipe: "gold", blur: false }), calloutStyles, "flex-col")}
    >
      <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>{notice.message}</p>
      {notice.isReload ? (
        <FormButton variant="secondary" onClick={() => window.location.reload()}>
          {COPY.errors.reload}
        </FormButton>
      ) : null}
    </div>
  );
}

/** "Need help?" and AMPM's help contact, or whom to ask while AMPM has set none. */
export function HelpLine({ helpContact }: { readonly helpContact: string | null }) {
  return (
    <p className={textStyles({ variant: "bodySmall", tone: "muted" })}>
      {`${COPY.helpPrefix} ${helpContact ?? COPY.helpFallback}`}
    </p>
  );
}

/** A quiet line of facts (the link's end, the in-app browser hint). */
export function QuietLine({ children }: { readonly children: ReactNode }) {
  return <p className={textStyles({ variant: "bodySmall", tone: "muted" })}>{children}</p>;
}
