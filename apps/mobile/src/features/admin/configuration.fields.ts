import { hotelFormMode, serviceKey } from "@ampm/core";

/*
 * The fields the configuration editor shows for each key it can edit (admin console). The bounds here
 * only make a field's message friendly; the key's own `@ampm/core` schema, which the API enforces on the
 * write, re-checks every assembled value (configuration.edit.ts). A key with no entry stays read-only.
 */

/** How one field of a configuration value is edited. */
export type ConfigEditFieldKind = "int" | "boolean" | "enumSet" | "flagMap" | "choice" | "text";

/** One editable field of a configuration value. */
export interface ConfigEditField {
  /** The value property this field sets; for a flag map, the value is the record itself. */
  readonly path: string;
  readonly label: string;
  readonly kind: ConfigEditFieldKind;
  /** For `int`: the smallest value the schema allows. */
  readonly min?: number;
  /** For `int`: the largest value the schema allows. */
  readonly max?: number;
  /** For `enumSet` and `choice`: the options to choose from. */
  readonly options?: readonly string[];
  /** For `choice`: a line under each option saying what it does. */
  readonly optionHelp?: Readonly<Record<string, string>>;
  /** For `text`: the longest text the schema allows; a blank text is saved as none. */
  readonly maxLength?: number;
  /** For `text`: the keyboard to offer. */
  readonly keyboard?: "email";
  /** For `text`: what the field says when the schema refuses the text (a malformed address). */
  readonly invalid?: string;
  readonly help?: string;
}

export const FLAG_MAP_PATH = "flags";

const HOTEL_FORM_POLICY: readonly ConfigEditField[] = [
  {
    path: "mode",
    label: "Mode",
    kind: "choice",
    options: hotelFormMode.options,
    optionHelp: {
      off: "Every link answers as not found, and nothing is emailed to a hotel.",
      test_only: "Only requests marked as tests reach a hotel.",
      on: "Every request's link opens the form, and its email is sent.",
    },
    help: "Read at once by the API and the worker: a change applies to the next link and email.",
  },
  {
    path: "linkValidityDays",
    label: "Link valid for (days)",
    kind: "int",
    min: 1,
    max: 90,
  },
  {
    path: "maxExtensionDays",
    label: "Extension past the first expiry (days)",
    kind: "int",
    min: 0,
    max: 60,
  },
  {
    path: "statusOnlyDays",
    label: "Status only after a merge (days)",
    kind: "int",
    min: 0,
    max: 30,
  },
  { path: "maxPeople", label: "People per request", kind: "int", min: 1, max: 20 },
  {
    path: "replyTo",
    label: "Reply-to address",
    kind: "text",
    maxLength: 255,
    keyboard: "email",
    invalid: "Enter an email such as desk@ampm.example",
    help: "Where a hotel's replies to the form's emails go. Blank: no reply-to.",
  },
  {
    path: "helpContact",
    label: "Help contact",
    kind: "text",
    maxLength: 300,
    help: "Shown on the form to a hotel that needs help. Blank: none shown.",
  },
  {
    path: "smsDailyCap",
    label: "Codes sent by SMS a day",
    kind: "int",
    min: 1,
    max: 10000,
    help: "Across every request, once SMS is wired. When it is reached, code requests wait until the next day.",
  },
];

export const CONFIG_EDIT_FIELDS: Readonly<Record<string, readonly ConfigEditField[]>> = {
  "session.idle_timeouts": [
    { path: "staffMinutes", label: "Staff minutes", kind: "int", min: 1 },
    { path: "clientMinutes", label: "Client minutes", kind: "int", min: 1 },
    { path: "demoMinutes", label: "Demo minutes", kind: "int", min: 1 },
  ],
  "notification.default_channels": [
    { path: "inApp", label: "In-app", kind: "boolean" },
    { path: "email", label: "Email", kind: "boolean" },
    { path: "sms", label: "SMS", kind: "boolean" },
    { path: "whatsapp", label: "WhatsApp", kind: "boolean" },
    { path: "push", label: "Push", kind: "boolean" },
  ],
  "feature.flags": [
    {
      path: FLAG_MAP_PATH,
      label: "Feature flags",
      kind: "flagMap",
      help: "A named switch; one that is absent is off.",
    },
  ],
  "subscription.policy": [
    { path: "expiryNoticeDays", label: "Expiry notice days", kind: "int", min: 0 },
  ],
  "hotel.verification_policy": [{ path: "maxAgeDays", label: "Max age days", kind: "int", min: 1 }],
  "consultancy.chargeable_services": [
    {
      path: "chargeableServiceKeys",
      label: "Chargeable services",
      kind: "enumSet",
      options: serviceKey.options,
    },
  ],
  "consultancy.milestone_amounts_visible": [
    { path: "milestoneAmountsVisible", label: "Client sees milestone amounts", kind: "boolean" },
  ],
  "storage.disk_guard": [
    {
      path: "floorGiB",
      label: "Floor (GiB)",
      kind: "int",
      min: 9,
      help: "New hotel-form uploads are refused below it.",
    },
    {
      path: "warnGiB",
      label: "Warning level (GiB)",
      kind: "int",
      min: 10,
      help: "Above the floor; the alerts start below it.",
    },
  ],
  // D-188 §6: a Super Admin switches the hotel form's mode here, and sets its limits and addresses.
  "hotel_form.policy": HOTEL_FORM_POLICY,
};
