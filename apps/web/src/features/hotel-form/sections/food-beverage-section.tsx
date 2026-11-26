import { HOTEL_FORM_OTHER_TEXT_MAX, type HotelFormDraftView } from "@ampm/core";
import { ChipGroupField, ChoiceSegments } from "@ampm/web-forms";

import { QuietLine } from "../form-parts";
import { choiceField, textField } from "./bindings";
import { withField, type YesNo } from "./field-values";
import { FOOD_FACTS, foodId, type FoodBeverageFields, type FoodFact } from "./food-beverage.form";
import {
  COMMON_FIELDS_COPY as COMMON,
  FOOD_FIELDS_COPY as COPY,
  FACT_SHEET_FIELDS_COPY,
} from "./section-fields-copy";
import type { SectionEditor } from "./use-section-editor";

type Editor = SectionEditor<FoodBeverageFields>;

const YES_NO = [
  { value: "yes", label: COMMON.yes },
  { value: "no", label: COMMON.no },
];

const yesNo = (value: string): YesNo => (value === "yes" || value === "no" ? value : "");

/** One of the Yes or No facts, which can be left unanswered again. */
function Fact({ editor, fact }: { readonly editor: Editor; readonly fact: FoodFact }) {
  return (
    <ChoiceSegments
      legend={COPY.facts[fact]}
      options={YES_NO}
      look="soft"
      clearLabel={COMMON.clear}
      {...choiceField(editor, foodId(fact), editor.fields[fact], (fields, value) =>
        withField(fields, fact, yesNo(value)),
      )}
    />
  );
}

/**
 * Food and beverage (plan §5.1: 5.2 and the new facts; D-190 §2): cuisine chips from the draft's options
 * with Other and its words, then pure vegetarian, a separate vegetarian kitchen and alcohol served.
 *
 *   <FoodBeverageSection editor={editor} draft={draft} />
 */
export function FoodBeverageSection({
  editor,
  draft,
}: {
  readonly editor: Editor;
  readonly draft: HotelFormDraftView;
}) {
  const { fields } = editor;
  const cuisines = draft.options.cuisines;
  const otherId = foodId("cuisinesOther");
  return (
    <>
      <ChipGroupField
        id={foodId("cuisines")}
        legend={COPY.cuisines}
        options={cuisines.options.map((option) => ({ value: option, label: option }))}
        value={fields.cuisines}
        onChange={(chosen) => editor.update((all) => withField(all, "cuisines", chosen))}
        error={editor.errorOf(foodId("cuisines"), true)}
        other={{
          value: cuisines.other,
          label: cuisines.other,
          textId: otherId,
          textLabel: COPY.cuisinesOther,
          text: fields.cuisinesOther,
          onTextChange: textField(editor, otherId, fields.cuisinesOther, (all, text) =>
            withField(all, "cuisinesOther", text),
          ).onChange,
          textError: editor.errorOf(otherId),
          maxLength: HOTEL_FORM_OTHER_TEXT_MAX,
        }}
      />
      {FOOD_FACTS.map((fact) => (
        <Fact key={fact} editor={editor} fact={fact} />
      ))}
      <QuietLine>{FACT_SHEET_FIELDS_COPY.uploadsSoon}</QuietLine>
    </>
  );
}
