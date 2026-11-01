import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/*
 * PUB-06 form parts: the centralised copy, the field primitives and the field groups the enquiry form
 * composes. Kept apart from the form's state so each piece stays small (code.md). Strings live in COPY
 * pending the public site's i18n. All fields are plain HTML styled with AMPM tokens.
 */

export interface FormFields {
  name: string;
  email: string;
  phone: string;
  contactPreference: string;
  tentativeDateFrom: string;
  tentativeDateTo: string;
  destinationText: string;
  guestEstimate: string;
  requirements: string;
  requestedDemo: boolean;
  consentMarketing: boolean;
}

export const EMPTY: FormFields = {
  name: "",
  email: "",
  phone: "",
  contactPreference: "",
  tentativeDateFrom: "",
  tentativeDateTo: "",
  destinationText: "",
  guestEstimate: "",
  requirements: "",
  requestedDemo: false,
  consentMarketing: false,
};

export const COPY = {
  name: "Your name",
  email: "Email",
  phone: "Phone",
  contact: "How should we reach you?",
  dates: "Tentative dates",
  destination: "Preferred destination",
  guests: "Approximate guests",
  requirements: "Tell us more",
  demo: "I would like a demo of hotel discovery",
  consent: "AMPM may contact me with updates and offers",
  consentHelp: "We use your details only to respond to this enquiry unless you tick this.",
  contactHelp: "Give an email or a phone number so we can reach you.",
  submit: "Send enquiry",
  submitting: "Sending…",
  failed: "Sorry, we could not send your enquiry. Please try again.",
  rateLimited: "You have sent several enquiries. Please wait a moment and try again.",
  thanksTitle: (first: string) => `Thank you, ${first}`,
  thanksBody: "Your enquiry is in — our team will be in touch shortly.",
} as const;

const PREFERENCES = [
  { value: "", label: "No preference" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
] as const;

export interface FieldGroupProps {
  readonly fields: FormFields;
  readonly errors: Record<string, string>;
  readonly onText: (key: keyof FormFields) => (event: { target: { value: string } }) => void;
  readonly onCheck: (key: keyof FormFields) => (event: { target: { checked: boolean } }) => void;
}

function inputClass(hasError: boolean): string {
  const border = hasError ? "border-danger" : "border-subtle";
  return `w-full rounded-md border ${border} bg-surface px-3 py-2 text-base text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-focus`;
}

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  readonly required?: boolean | undefined;
  readonly children: ReactNode;
}

function Field({ id, label, error, help, required, children }: FieldProps) {
  // Associate the control with its error or help text, and mark its invalid/required state, so screen
  // readers announce the problem on the right field (E5). Injected once here rather than on every input.
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required ? true : undefined,
      })
    : children;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-primary">
        {label}
        {required ? " *" : ""}
      </label>
      {control}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-sm text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}

interface CheckboxProps {
  readonly id: string;
  readonly label: string;
  readonly help?: string | undefined;
  readonly checked: boolean;
  readonly onChange: (event: { target: { checked: boolean } }) => void;
}

function Checkbox({ id, label, help, checked, onChange }: CheckboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm text-primary">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="size-5 rounded border-subtle"
        />
        {label}
      </label>
      {help ? <p className="pl-8 text-sm text-muted">{help}</p> : null}
    </div>
  );
}

/** Who they are and how to reach them (email or phone is required). */
export function IdentityFields({ fields, errors, onText }: FieldGroupProps) {
  return (
    <>
      <Field id="name" label={COPY.name} error={errors["name"]} required>
        <input
          id="name"
          value={fields.name}
          onChange={onText("name")}
          className={inputClass(!!errors["name"])}
          autoComplete="name"
        />
      </Field>
      <Field id="email" label={COPY.email} error={errors["email"]} help={COPY.contactHelp}>
        <input
          id="email"
          type="email"
          value={fields.email}
          onChange={onText("email")}
          className={inputClass(!!errors["email"])}
          autoComplete="email"
        />
      </Field>
      <Field id="phone" label={COPY.phone} error={errors["phone"]}>
        <input
          id="phone"
          type="tel"
          value={fields.phone}
          onChange={onText("phone")}
          className={inputClass(!!errors["phone"])}
          autoComplete="tel"
        />
      </Field>
      <Field id="contactPreference" label={COPY.contact} error={errors["contactPreference"]}>
        <select
          id="contactPreference"
          value={fields.contactPreference}
          onChange={onText("contactPreference")}
          className={inputClass(!!errors["contactPreference"])}
        >
          {PREFERENCES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

/** The celebration: tentative dates, destination, size and anything else. */
export function WeddingFields({ fields, errors, onText }: FieldGroupProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          id="tentativeDateFrom"
          label={`${COPY.dates} (from)`}
          error={errors["tentativeDateFrom"]}
        >
          <input
            id="tentativeDateFrom"
            type="date"
            value={fields.tentativeDateFrom}
            onChange={onText("tentativeDateFrom")}
            className={inputClass(!!errors["tentativeDateFrom"])}
          />
        </Field>
        <Field id="tentativeDateTo" label={`${COPY.dates} (to)`} error={errors["tentativeDateTo"]}>
          <input
            id="tentativeDateTo"
            type="date"
            value={fields.tentativeDateTo}
            onChange={onText("tentativeDateTo")}
            className={inputClass(!!errors["tentativeDateTo"])}
          />
        </Field>
      </div>
      <Field id="destinationText" label={COPY.destination} error={errors["destinationText"]}>
        <input
          id="destinationText"
          value={fields.destinationText}
          onChange={onText("destinationText")}
          className={inputClass(!!errors["destinationText"])}
        />
      </Field>
      <Field id="guestEstimate" label={COPY.guests} error={errors["guestEstimate"]}>
        <input
          id="guestEstimate"
          type="number"
          min={0}
          inputMode="numeric"
          value={fields.guestEstimate}
          onChange={onText("guestEstimate")}
          className={inputClass(!!errors["guestEstimate"])}
        />
      </Field>
      <Field id="requirements" label={COPY.requirements} error={errors["requirements"]}>
        <textarea
          id="requirements"
          rows={4}
          value={fields.requirements}
          onChange={onText("requirements")}
          className={inputClass(!!errors["requirements"])}
        />
      </Field>
    </>
  );
}

/** The demo request and the marketing-consent capture (AC-01.1/AC-01.2). */
export function ConsentFields({ fields, onCheck }: FieldGroupProps) {
  return (
    <>
      <Checkbox
        id="requestedDemo"
        label={COPY.demo}
        checked={fields.requestedDemo}
        onChange={onCheck("requestedDemo")}
      />
      <Checkbox
        id="consentMarketing"
        label={COPY.consent}
        help={COPY.consentHelp}
        checked={fields.consentMarketing}
        onChange={onCheck("consentMarketing")}
      />
    </>
  );
}

/** The error banner and submit button at the foot of the form. */
export function FormActions({
  isPending,
  isError,
  isRateLimited,
}: {
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isRateLimited: boolean;
}) {
  return (
    <>
      {isError ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {isRateLimited ? COPY.rateLimited : COPY.failed}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 py-2 text-base font-medium text-brand-ink disabled:opacity-60"
      >
        {isPending ? COPY.submitting : COPY.submit}
      </button>
    </>
  );
}

/** PUB-09 — the confirmation shown after a successful enquiry. */
export function ThankYou({ firstName }: { readonly firstName: string }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface-elevated p-6 shadow-sm"
    >
      <p className="text-lg font-semibold text-primary">{COPY.thanksTitle(firstName)}</p>
      <p className="text-base text-muted">{COPY.thanksBody}</p>
    </div>
  );
}
