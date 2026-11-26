import {
  HOTEL_FORM_DESCRIPTION_MAX,
  HOTEL_FORM_OTHER_TEXT_MAX,
  HOTEL_STAR_CATEGORIES,
  type HotelFormDraftView,
} from "@ampm/core";
import { cn, textStyles } from "@ampm/ui/styles";
import { ChipGroupField, SelectField, TextAreaField, TextField } from "@ampm/web-forms";

import { textField } from "./bindings";
import { FieldGroup, PAIR_STYLES, TRIO_STYLES } from "./field-group";
import { withField } from "./field-values";
import { bindProperty, type PropertyEditor } from "./property-bind";
import { ACCESS_POINTS, propertyId, type AccessPoint } from "./property.form";
import { COMMON_FIELDS_COPY as COMMON, PROPERTY_FIELDS_COPY as COPY } from "./section-fields-copy";

/*
 * Property and location's last two groups (plan §5.1: 1.9, 1.10 and the new questions): getting there,
 * and what the hotel is like.
 */

const STARS = HOTEL_STAR_CATEGORIES.map((stars) => ({ value: stars, label: stars }));

/** One place a guest travels from (1.9, 1.10, the city centre): its name, km and drive in minutes. */
function AccessPointFields({
  editor,
  point,
}: {
  readonly editor: PropertyEditor;
  readonly point: AccessPoint;
}) {
  const value = editor.fields[point];
  const part = (key: "name" | "km" | "minutes") =>
    textField(editor, propertyId(point, key), value[key], (fields, typed) =>
      withField(fields, point, { ...fields[point], [key]: typed }),
    );
  const isNamed = point !== "cityCentre";
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className={cn(textStyles({ variant: "label", tone: "primary" }), "mb-1")}>
        {COPY.access[point].legend}
      </legend>
      <div className={isNamed ? TRIO_STYLES : PAIR_STYLES}>
        {isNamed ? (
          <TextField label={COPY.access[point].name} {...part("name")} maxLength={255} />
        ) : null}
        <TextField label={COPY.km} {...part("km")} inputMode="decimal" />
        <TextField label={COPY.minutes} {...part("minutes")} inputMode="numeric" />
      </div>
    </fieldset>
  );
}

/**
 * Getting there: the airport, the railway station, the city centre, and directions.
 *
 *   <AccessGroup editor={editor} />
 */
export function AccessGroup({ editor }: { readonly editor: PropertyEditor }) {
  return (
    <FieldGroup id="hf-property-access" heading={COPY.groups.gettingThere}>
      {ACCESS_POINTS.map((point) => (
        <AccessPointFields key={point} editor={editor} point={point} />
      ))}
      <TextAreaField label={COPY.accessNotes} rows={3} {...bindProperty(editor, "accessNotes")} />
    </FieldGroup>
  );
}

/** The facility chips from the draft's options, with Other and its words. */
function Facilities({
  editor,
  draft,
}: {
  readonly editor: PropertyEditor;
  readonly draft: HotelFormDraftView;
}) {
  const { options, other } = draft.options.facilities;
  const otherText = bindProperty(editor, "facilitiesOther");
  return (
    <ChipGroupField
      id={propertyId("facilities")}
      legend={COPY.facilities}
      options={options.map((option) => ({ value: option, label: option }))}
      value={editor.fields.facilities}
      onChange={(chosen) => editor.update((fields) => withField(fields, "facilities", chosen))}
      error={editor.errorOf(propertyId("facilities"), true)}
      other={{
        value: other,
        label: other,
        textId: otherText.id,
        textLabel: COPY.facilitiesOther,
        text: otherText.value,
        onTextChange: otherText.onChange,
        textError: otherText.error,
        maxLength: HOTEL_FORM_OTHER_TEXT_MAX,
      }}
    />
  );
}

/**
 * About the hotel: stars, a short description (its count of characters as help) and its facilities.
 *
 *   <AboutGroup editor={editor} draft={draft} />
 */
export function AboutGroup({
  editor,
  draft,
}: {
  readonly editor: PropertyEditor;
  readonly draft: HotelFormDraftView;
}) {
  const { description } = editor.fields;
  return (
    <FieldGroup id="hf-property-about" heading={COPY.groups.about}>
      <SelectField
        label={COPY.starCategory}
        options={STARS}
        placeholder={COMMON.choose}
        {...bindProperty(editor, "starCategory")}
      />
      <TextAreaField
        label={COPY.description}
        rows={4}
        {...bindProperty(editor, "description")}
        help={COPY.descriptionCount(description.length, HOTEL_FORM_DESCRIPTION_MAX)}
      />
      <Facilities editor={editor} draft={draft} />
    </FieldGroup>
  );
}
