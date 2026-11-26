import { INDIAN_STATES, type HotelFormDraftView } from "@ampm/core";
import { ChoiceSegments, SelectField, TextField } from "@ampm/web-forms";

import { SECTIONS_COPY } from "../sections-copy";
import { choiceField } from "./bindings";
import { FieldGroup, PAIR_STYLES } from "./field-group";
import { withField } from "./field-values";
import { AboutGroup, AccessGroup } from "./property-about";
import { bindProperty, type PropertyEditor } from "./property-bind";
import { propertyId } from "./property.form";
import { COMMON_FIELDS_COPY as COMMON, PROPERTY_FIELDS_COPY as COPY } from "./section-fields-copy";

interface GroupProps {
  readonly editor: PropertyEditor;
  /** A new hotel's request: the name, city and state are needed before submitting. */
  readonly isOnboarding: boolean;
}

const YES_NO = [
  { value: "yes", label: COMMON.yes },
  { value: "no", label: COMMON.no },
];
const STATES = INDIAN_STATES.map((state) => ({ value: state, label: state }));

/** The hotel's name and its chain (1.1, 1.2); the name is needed to submit a new hotel. */
function HotelGroup({ editor, isOnboarding }: GroupProps) {
  return (
    <FieldGroup id="hf-property-hotel" heading={COPY.groups.hotel}>
      <TextField
        label={COPY.name}
        {...bindProperty(editor, "name")}
        required={isOnboarding}
        help={isOnboarding ? SECTIONS_COPY.requiredToSubmit : undefined}
        autoComplete="organization"
        maxLength={255}
      />
      <ChoiceSegments
        legend={COPY.isChain}
        options={YES_NO}
        look="soft"
        clearLabel={COMMON.clear}
        {...choiceField(editor, propertyId("isChain"), editor.fields.isChain, (fields, value) =>
          withField(fields, "isChain", value === "yes" || value === "no" ? value : ""),
        )}
      />
      {editor.fields.isChain === "yes" ? (
        <TextField label={COPY.groupName} {...bindProperty(editor, "groupName")} maxLength={255} />
      ) : null}
    </FieldGroup>
  );
}

/** The city and the state, side by side: both needed to submit a new hotel. */
function CityAndState({ editor, isOnboarding }: GroupProps) {
  const required = isOnboarding ? SECTIONS_COPY.requiredToSubmit : undefined;
  return (
    <div className={PAIR_STYLES}>
      <TextField
        label={COPY.city}
        {...bindProperty(editor, "city")}
        required={isOnboarding}
        help={required}
        maxLength={255}
      />
      <SelectField
        label={COPY.state}
        options={STATES}
        placeholder={COMMON.choose}
        required={isOnboarding}
        help={required}
        {...bindProperty(editor, "state")}
      />
    </div>
  );
}

/** The PIN, the Google Maps link and the website (1.3, 1.5, 1.6). */
function CodeAndLinks({ editor }: { readonly editor: PropertyEditor }) {
  return (
    <>
      <TextField
        label={COPY.postalCode}
        help={COPY.postalCodeHelp}
        {...bindProperty(editor, "postalCode")}
        inputMode="numeric"
        autoComplete="postal-code"
      />
      <TextField
        label={COPY.mapsUrl}
        help={COPY.mapsUrlHelp}
        {...bindProperty(editor, "mapsUrl")}
        type="url"
        inputMode="url"
      />
      <TextField
        label={COPY.website}
        help={COPY.websiteHelp}
        {...bindProperty(editor, "website")}
        type="url"
        inputMode="url"
        autoComplete="url"
      />
    </>
  );
}

/** Where the hotel is (1.3 to 1.6). */
function AddressGroup({ editor, isOnboarding }: GroupProps) {
  return (
    <FieldGroup id="hf-property-address" heading={COPY.groups.address}>
      <TextField
        label={COPY.street}
        {...bindProperty(editor, "street")}
        autoComplete="street-address"
        maxLength={500}
      />
      <TextField label={COPY.locality} {...bindProperty(editor, "locality")} maxLength={255} />
      <CityAndState editor={editor} isOnboarding={isOnboarding} />
      <CodeAndLinks editor={editor} />
    </FieldGroup>
  );
}

/**
 * Property and location's questions (plan §5.1; D-190 §2): the hotel, its address, getting there and
 * what it is like. On a new hotel the name, city and state are marked as needed before submitting.
 *
 *   <PropertySection editor={editor} draft={draft} />
 */
export function PropertySection({
  editor,
  draft,
}: {
  readonly editor: PropertyEditor;
  readonly draft: HotelFormDraftView;
}) {
  const isOnboarding = draft.request.kind === "onboarding";
  return (
    <>
      <HotelGroup editor={editor} isOnboarding={isOnboarding} />
      <AddressGroup editor={editor} isOnboarding={isOnboarding} />
      <AccessGroup editor={editor} />
      <AboutGroup editor={editor} draft={draft} />
    </>
  );
}
