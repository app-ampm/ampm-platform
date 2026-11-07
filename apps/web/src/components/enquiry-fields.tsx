import {
  buttonLabelStyles,
  buttonStyles,
  calloutStyles,
  cn,
  glassStyles,
  linkLabelStyles,
  linkStyles,
  textStyles,
} from "@ampm/ui/styles";

import { PRIVACY_HREF } from "@/components/site/site-links";

import { CheckboxField } from "./contact/checkbox-field";
import { ChoiceSegments, type ChoiceOption } from "./contact/choice-segments";
import { channelHref } from "./contact/contact-channels";
import { fullRowStyles } from "./contact/contact.styles";
import { reachOf, type ReceivedRequest } from "./contact/contact-request";
import { DateRangeField } from "./contact/date-range-field";
import { ENQUIRY_COPY as COPY } from "./contact/enquiry-copy";
import { RequestReceived } from "./contact/request-received";
import { TextAreaField } from "./contact/text-area-field";
import { TextField } from "./contact/text-field";

/*
 * PUB-06 form parts: the field groups the enquiry form composes, drawn with the Peacock Night pieces
 * in ./contact (W6, W7). Kept apart from the form's state so each piece stays small (code.md). Their
 * words are ENQUIRY_COPY (./contact/enquiry-copy) pending the public site's i18n; the validation
 * messages are the shared schema's.
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

const REQUEST_TYPES: readonly ChoiceOption[] = [
  { value: "enquiry", label: COPY.enquiry },
  { value: "demo", label: COPY.demoRequest },
];

/**
 * The reply channels (`contactPreference`) in the mock's order, then "Any": no preference, the value
 * "" that `toPayload` sends as none. It is chosen until the visitor picks a channel, and it lets a
 * mis-tap be taken back (a radio cannot be cleared). Short, so the four pills fit the field's column.
 */
const REACH_OPTIONS: readonly ChoiceOption[] = [
  { value: "whatsapp", label: COPY.reachOptions.whatsapp },
  { value: "phone", label: COPY.reachOptions.phone },
  { value: "email", label: COPY.reachOptions.email },
  { value: "", label: COPY.reachOptions.any },
];

export interface FieldGroupProps {
  readonly fields: FormFields;
  readonly errors: Record<string, string>;
  readonly onText: (key: keyof FormFields) => (event: { target: { value: string } }) => void;
  readonly onCheck: (key: keyof FormFields) => (event: { target: { checked: boolean } }) => void;
}

type TextKey = {
  [Key in keyof FormFields]: FormFields[Key] extends string ? Key : never;
}[keyof FormFields];

/** A text field's id, value, change handler and error, all keyed by its form field. */
function bindText({ fields, errors, onText }: FieldGroupProps, key: TextKey) {
  return { id: key, value: fields[key], onChange: onText(key), error: errors[key] };
}

/** The switch at the top of the form (W6): an enquiry or a demo request, which is `requestedDemo`. */
export function RequestTypeField({ fields, onCheck }: FieldGroupProps) {
  const setDemo = onCheck("requestedDemo");
  return (
    <ChoiceSegments
      name="requestType"
      legend={COPY.requestType}
      isLegendHidden
      options={REQUEST_TYPES}
      value={fields.requestedDemo ? "demo" : "enquiry"}
      onChange={(event) => setDemo({ target: { checked: event.target.value === "demo" } })}
    />
  );
}

/** Who they are and how to reach them (a mobile number or an email is required). */
export function IdentityFields(props: FieldGroupProps) {
  return (
    <>
      <TextField {...bindText(props, "name")} label={COPY.name} required autoComplete="name" />
      <TextField
        {...bindText(props, "phone")}
        label={COPY.phone}
        prefixText={COPY.phonePrefix}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
      />
      <TextField
        {...bindText(props, "email")}
        label={COPY.email}
        optionalText={COPY.optional}
        help={COPY.contactHelp}
        type="email"
        autoComplete="email"
        placeholder={COPY.emailPlaceholder}
      />
      <ChoiceSegments
        name="contactPreference"
        legend={COPY.contact}
        look="soft"
        options={REACH_OPTIONS}
        value={props.fields.contactPreference}
        onChange={props.onText("contactPreference")}
        error={props.errors["contactPreference"]}
      />
    </>
  );
}

/** The celebration: tentative dates, destination, size and anything else. */
export function WeddingFields(props: FieldGroupProps) {
  return (
    <>
      <DateRangeField
        legend={COPY.dates}
        from={{ ...bindText(props, "tentativeDateFrom"), label: COPY.dateFrom }}
        to={{ ...bindText(props, "tentativeDateTo"), label: COPY.dateTo }}
        className={fullRowStyles}
      />
      <TextField {...bindText(props, "destinationText")} label={COPY.destination} />
      <TextField
        {...bindText(props, "guestEstimate")}
        label={COPY.guests}
        type="number"
        min={0}
        inputMode="numeric"
      />
      <TextAreaField
        {...bindText(props, "requirements")}
        label={COPY.requirements}
        className={fullRowStyles}
      />
    </>
  );
}

/** The demo request, the marketing consent (AC-01.1/AC-01.2) and what the details are used for. */
export function ConsentFields({ fields, onCheck }: FieldGroupProps) {
  return (
    <div className="flex flex-col">
      <CheckboxField
        id="requestedDemo"
        label={COPY.demo}
        checked={fields.requestedDemo}
        onChange={onCheck("requestedDemo")}
      />
      <CheckboxField
        id="consentMarketing"
        label={COPY.consent}
        checked={fields.consentMarketing}
        onChange={onCheck("consentMarketing")}
      />
      <p className={cn(textStyles({ variant: "bodySmall", tone: "muted" }), "pt-2")}>
        {`${COPY.privacy} `}
        {/* A new tab, so reading the notice never loses what the visitor has typed. */}
        <a
          href={PRIVACY_HREF}
          target="_blank"
          rel="noreferrer"
          className={cn(
            linkStyles({ variant: "inline" }),
            linkLabelStyles({ variant: "inline", textVariant: "bodySmall" }),
          )}
        >
          {COPY.privacyLink}
          <span className="sr-only">{COPY.newTab}</span>
        </a>
      </p>
    </div>
  );
}

export interface FormActionsProps {
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isRateLimited: boolean;
}

/** The error notice (gold glass) and the gold "Send request" at the foot of the form. */
export function FormActions({ isPending, isError, isRateLimited }: FormActionsProps) {
  return (
    <>
      {isError ? (
        <p
          role="alert"
          className={cn(
            glassStyles({ recipe: "gold", blur: false }),
            calloutStyles,
            textStyles({ variant: "bodySmall", tone: "primary" }),
          )}
        >
          {isRateLimited ? COPY.rateLimited : COPY.failed}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={buttonStyles({ size: "lg", fullWidth: true })}
      >
        <span className={buttonLabelStyles({ size: "lg" })}>
          {isPending ? COPY.submitting : COPY.submit}
        </span>
      </button>
    </>
  );
}

export interface ThankYouProps {
  readonly firstName: string;
  /** The request as sent, for the line naming how AMPM will reach them; never read from the URL. */
  readonly request: ReceivedRequest;
}

/**
 * PUB-09 — the confirmation shown after a successful request (W7). Its gold "Chat with AMPM" opens
 * AMPM's WhatsApp while there is no chat service, so it shows only once AMPM has given the number.
 */
export function ThankYou({ firstName, request }: ThankYouProps) {
  const isDemo = request.requestedDemo === true;
  const whatsApp = channelHref("whatsapp");
  return (
    <RequestReceived
      title={COPY.thanksTitle(firstName)}
      lead={isDemo ? COPY.receivedDemo : COPY.receivedEnquiry}
      reach={reachOf(request)}
      reachVia={COPY.reachVia}
      purpose={isDemo ? COPY.purposeDemo : COPY.purposeEnquiry}
      steps={isDemo ? COPY.demoSteps : COPY.enquirySteps}
      chat={whatsApp ? { label: COPY.chat, href: whatsApp } : undefined}
      backLabel={COPY.backHome}
    />
  );
}
