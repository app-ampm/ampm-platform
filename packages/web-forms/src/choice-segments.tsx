import { useRef, type Ref } from "react";

import { buttonLabelStyles, buttonStyles, cn, fieldLabelStyles } from "@ampm/ui/styles";

import {
  choiceLabelStyles,
  choicePillStyles,
  choiceTargetStyles,
  choiceTrackStyles,
  type ChoiceLook,
} from "./choice-segments.styles";
import { FieldMessage } from "./field-message";

export interface ChoiceOption {
  readonly value: string;
  readonly label: string;
}

export interface ChoiceSegmentsProps {
  /** The radios' shared name; the legend, error and help lines are named after it. */
  readonly name: string;
  readonly legend: string;
  /** The request switch shows no legend (W6); screen readers still hear it. */
  readonly isLegendHidden?: boolean | undefined;
  readonly options: readonly ChoiceOption[];
  /** The chosen option's value, or "" while none is. */
  readonly value: string;
  readonly onChange: (event: { target: { value: string } }) => void;
  /** solid for a switch, soft for a field's value (see choice-segments.styles.ts). */
  readonly look?: ChoiceLook | undefined;
  readonly error?: string | undefined;
  /** A line under the pills while there is no error. */
  readonly help?: string | undefined;
  /**
   * The words of a button that takes the answer back to none ("Clear"), shown once one is chosen: an
   * optional question (Yes, No or Depends) can be left unanswered again, which radios alone cannot do.
   */
  readonly clearLabel?: string | undefined;
  /** Placement in the form's grid. */
  readonly className?: string | undefined;
}

interface ChoiceSegmentProps extends Pick<ChoiceSegmentsProps, "name" | "onChange"> {
  readonly option: ChoiceOption;
  readonly isChecked: boolean;
  readonly look: ChoiceLook;
  readonly describedBy: string | undefined;
  readonly inputRef?: Ref<HTMLInputElement> | undefined;
}

/** One pill: a native radio, hidden for sight only, and the pill drawn after it. */
function ChoiceSegment({
  name,
  option,
  isChecked,
  look,
  onChange,
  describedBy,
  inputRef,
}: ChoiceSegmentProps) {
  return (
    <label className={choiceTargetStyles(look)}>
      <input
        ref={inputRef}
        type="radio"
        name={name}
        value={option.value}
        checked={isChecked}
        onChange={onChange}
        aria-describedby={describedBy}
        className="peer sr-only"
      />
      <span className={choicePillStyles(look, isChecked)}>
        <span className={choiceLabelStyles(look, isChecked)}>{option.label}</span>
      </span>
    </label>
  );
}

/** Clear: back to no answer, focus on the first pill so a keyboard can choose again from there. */
function ClearButton({
  label,
  legendId,
  onClear,
}: {
  readonly label: string;
  readonly legendId: string;
  readonly onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-describedby={legendId}
      className={cn(buttonStyles({ variant: "ghost", size: "sm" }), "self-start")}
    >
      <span className={buttonLabelStyles({ variant: "ghost", size: "sm" })}>{label}</span>
    </button>
  );
}

/**
 * A one-of choice as pills in a track (W6: the enquiry or demo switch, the best way to reach you; the
 * hotel form's Yes, No or Depends): native radios in a fieldset, so arrow keys move the choice and the
 * legend names the group. With `clearLabel`, a chosen answer can be cleared again.
 *
 *   <ChoiceSegments name="contactPreference" legend="Best way to reach you" look="soft"
 *     options={[{ value: "whatsapp", label: "WhatsApp" }, …]} value={value} onChange={onChange} />
 *   <ChoiceSegments name="buyout" legend="Do weddings need a full buyout?" look="soft" clearLabel="Clear"
 *     options={[{ value: "required", label: "Yes" }, …]} value={value} onChange={onChange} />
 */
export function ChoiceSegments(props: ChoiceSegmentsProps) {
  const { name, legend, isLegendHidden = false, options, value, onChange, look = "solid" } = props;
  const { error, help, clearLabel, className } = props;
  const firstRadio = useRef<HTMLInputElement>(null);
  const describedBy = error ? `${name}-error` : help ? `${name}-help` : undefined;
  // Named only where Clear points at it, so a choice without Clear keeps its markup as it was.
  const legendId = clearLabel === undefined ? undefined : `${name}-legend`;
  const clear = () => {
    onChange({ target: { value: "" } });
    firstRadio.current?.focus();
  };
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-2", className)}>
      <legend id={legendId} className={isLegendHidden ? "sr-only" : cn(fieldLabelStyles, "mb-2")}>
        {legend}
      </legend>
      <div className={choiceTrackStyles}>
        {options.map((option, index) => (
          <ChoiceSegment
            key={option.value}
            {...{ name, option, look, onChange, describedBy }}
            isChecked={option.value === value}
            inputRef={index === 0 ? firstRadio : undefined}
          />
        ))}
      </div>
      {clearLabel !== undefined && legendId !== undefined && value !== "" ? (
        <ClearButton label={clearLabel} legendId={legendId} onClear={clear} />
      ) : null}
      <FieldMessage id={name} error={error} help={help} />
    </fieldset>
  );
}
