import { cardStyles, cn, textStyles } from "@ampm/ui/styles";

import { Eyebrow } from "@/components/site/eyebrow";

import { FormButton } from "./form-parts";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";

const COPY = HOTEL_FORM_COPY.code;

export interface ShownCodeProps {
  readonly code: string;
  /** The field already holds this code: "Use this code" has nothing left to do. */
  readonly isUsed: boolean;
  readonly onUse: () => void;
}

/**
 * The code itself while the form cannot send its own SMS (on-screen mode, D-174): large and spaced, in a
 * flat panel, with "Use this code" to fill the field, as client sign-in's stand-in for the SMS shows it.
 * A screen reader hears the digits one by one (a spaced copy; the large one is for sight only). The
 * caption says what the code does not prove.
 *
 *   <ShownCode code={issued.code} isUsed={code === issued.code} onUse={() => setCode(issued.code)} />
 */
export function ShownCode({ code, isUsed, onUse }: ShownCodeProps) {
  return (
    <div className={cn(cardStyles({ tone: "flat", padding: "sm" }), "gap-2")}>
      <Eyebrow>{COPY.shownEyebrow}</Eyebrow>
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <p
          className={cn(
            textStyles({ variant: "data", tone: "primary" }),
            "text-3xl tracking-widest",
          )}
        >
          <span aria-hidden>{code}</span>
          <span className="sr-only">{code.split("").join(" ")}</span>
        </p>
        <FormButton variant="secondary" onClick={onUse} isDisabled={isUsed}>
          {COPY.useShown}
        </FormButton>
      </div>
      <p className={textStyles({ variant: "caption", tone: "muted" })}>{COPY.shownCaption}</p>
    </div>
  );
}
