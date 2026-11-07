import { cn, fieldLabelStyles } from "@ampm/ui/styles";

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
  /** The radios' shared name; the error line is named after it. */
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
  /** Placement in the form's grid. */
  readonly className?: string | undefined;
}

interface ChoiceSegmentProps extends Pick<ChoiceSegmentsProps, "name" | "onChange"> {
  readonly option: ChoiceOption;
  readonly isChecked: boolean;
  readonly look: ChoiceLook;
  readonly describedBy: string | undefined;
}

/** One pill: a native radio, hidden for sight only, and the pill drawn after it. */
function ChoiceSegment({
  name,
  option,
  isChecked,
  look,
  onChange,
  describedBy,
}: ChoiceSegmentProps) {
  return (
    <label className={choiceTargetStyles(look)}>
      <input
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

/**
 * A one-of choice as pills in a track (W6: the enquiry or demo switch, the best way to reach you):
 * native radios in a fieldset, so arrow keys move the choice and the legend names the group.
 *
 *   <ChoiceSegments name="contactPreference" legend="Best way to reach you" look="soft"
 *     options={[{ value: "whatsapp", label: "WhatsApp" }, …]} value={value} onChange={onChange} />
 */
export function ChoiceSegments({
  name,
  legend,
  isLegendHidden = false,
  options,
  value,
  onChange,
  look = "solid",
  error,
  className,
}: ChoiceSegmentsProps) {
  const describedBy = error ? `${name}-error` : undefined;
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-2", className)}>
      <legend className={isLegendHidden ? "sr-only" : cn(fieldLabelStyles, "mb-2")}>
        {legend}
      </legend>
      <div className={choiceTrackStyles}>
        {options.map((option) => (
          <ChoiceSegment
            key={option.value}
            {...{ name, option, look, onChange, describedBy }}
            isChecked={option.value === value}
          />
        ))}
      </div>
      <FieldMessage id={name} error={error} />
    </fieldset>
  );
}
