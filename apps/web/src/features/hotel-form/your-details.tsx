import { useState, type FormEvent } from "react";

import {
  HOTEL_FORM_DESIGNATIONS,
  HOTEL_FORM_OTHER_DESIGNATION,
  type HotelFormMeUpdateRequest,
  type HotelFormPerson,
} from "@ampm/core";
import { cn, flatTintStyles, textStyles } from "@ampm/ui/styles";
import { SelectField, TextField } from "@ampm/web-forms";

import { detailsFromPerson, type DetailsErrors } from "./details.form";
import { FormButton, WaitButton } from "./form-parts";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { meChangeStep, type PersonFields } from "./person.form";
import type { SaveOutcome } from "./refusal";

const COPY = HOTEL_FORM_COPY.signedIn;
const FIELDS = HOTEL_FORM_COPY.details;

/** Save's id: the page moves focus back to it once a new code was entered in place. */
export const EDIT_SAVE_ID = "hf-edit-save";
const OPTIONS = HOTEL_FORM_DESIGNATIONS.map((value) => ({ value, label: value }));

export interface YourDetailsProps {
  readonly person: HotelFormPerson;
  /** False once the request shows its status only: nothing can change then. */
  readonly canEdit: boolean;
  readonly onSave: (change: HotelFormMeUpdateRequest) => Promise<SaveOutcome>;
}

interface EditProps {
  readonly fields: PersonFields;
  readonly errors: DetailsErrors;
  readonly onChange: (fields: PersonFields) => void;
}

/** The name and the designation (and Other's words), as on HF-02. */
function EditFields({ fields, errors, onChange }: EditProps) {
  const set = (patch: Partial<PersonFields>) => onChange({ ...fields, ...patch });
  return (
    <>
      <TextField
        id="hf-edit-name"
        label={FIELDS.fullName}
        value={fields.fullName}
        onChange={(event) => set({ fullName: event.target.value })}
        required
        autoComplete="name"
        error={errors.fullName}
      />
      <SelectField
        id="hf-edit-designation"
        label={FIELDS.designation}
        options={OPTIONS}
        value={fields.designationChoice}
        onChange={(event) => set({ designationChoice: event.target.value })}
        required
        error={errors.designationChoice}
      />
      {fields.designationChoice === HOTEL_FORM_OTHER_DESIGNATION ? (
        <TextField
          id="hf-edit-designation-other"
          label={FIELDS.designationOther}
          value={fields.designationOther}
          onChange={(event) => set({ designationOther: event.target.value })}
          required
          error={errors.designationOther}
        />
      ) : null}
    </>
  );
}

/**
 * The edit's state and Save: only what changed is sent; a refused session keeps what was typed, and a
 * wait the API asked for (Retry-After) holds Save back, counted down on it.
 */
function useEdit(person: HotelFormPerson, onSave: YourDetailsProps["onSave"]) {
  const [fields, setFields] = useState<PersonFields | null>(null);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (fields === null) return;
    const step = meChangeStep(fields, person);
    setErrors(step.kind === "invalid" ? step.errors : {});
    if (step.kind !== "send")
      return setMessage(step.kind === "unchanged" ? COPY.nothingChanged : null);
    setIsSaving(true);
    const outcome = await onSave(step.change);
    setIsSaving(false);
    if (outcome.kind === "saved") setFields(null);
    setRetryAt(outcome.kind === "refused" ? outcome.retryAt : null);
    setMessage(
      outcome.kind === "saved" ? COPY.saved : outcome.kind === "refused" ? outcome.message : null,
    );
  };
  const start = () => {
    setFields(detailsFromPerson(person));
    setMessage(null);
  };
  return { fields, setFields, errors, message, retryAt, isSaving, save, start };
}

/** The edit itself: the fields, Save and Cancel. */
function EditForm({ edit }: { readonly edit: ReturnType<typeof useEdit> }) {
  if (edit.fields === null) return null;
  return (
    <form noValidate onSubmit={(event) => void edit.save(event)} className="flex flex-col gap-4">
      <EditFields fields={edit.fields} errors={edit.errors} onChange={edit.setFields} />
      <div className="flex flex-row flex-wrap gap-3">
        <WaitButton
          id={EDIT_SAVE_ID}
          type="submit"
          variant="secondary"
          retryAt={edit.retryAt}
          isBusy={edit.isSaving}
          words={COPY.save}
          busyWords={COPY.saving}
        />
        <FormButton variant="ghost" onClick={() => edit.setFields(null)}>
          {COPY.cancel}
        </FormButton>
      </div>
    </form>
  );
}

/**
 * "Your details" on the signed-in page: the person's own name and designation, with Edit (D-189 §4:
 * `PATCH /hotel-form/me`; a new mobile needs a new code, so it is not here). While the session is asked
 * for again in place, the edit stays open with what was typed, ready to save once the new code is in.
 *
 *   <YourDetails person={me.person} canEdit onSave={flow.saveDetails} />
 */
export function YourDetails({ person, canEdit, onSave }: YourDetailsProps) {
  const edit = useEdit(person, onSave);
  return (
    <section
      aria-labelledby="hf-your-details"
      className={cn(flatTintStyles, "flex flex-col gap-3 rounded p-4")}
    >
      <h2 id="hf-your-details" className={textStyles({ variant: "label", tone: "primary" })}>
        {COPY.detailsHeading}
      </h2>
      {edit.fields === null ? (
        <>
          <p className={textStyles({ variant: "body", tone: "body" })}>
            {`${person.fullName} · ${person.designation}`}
          </p>
          {canEdit ? (
            <FormButton variant="secondary" onClick={edit.start}>
              {COPY.edit}
            </FormButton>
          ) : null}
        </>
      ) : (
        <EditForm edit={edit} />
      )}
      {edit.message ? (
        <p role="status" className={textStyles({ variant: "bodySmall", tone: "body" })}>
          {edit.message}
        </p>
      ) : null}
    </section>
  );
}
