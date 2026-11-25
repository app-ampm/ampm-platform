import { HOTEL_FORM_NOTICE_VERSION } from "@ampm/core";

/*
 * The privacy notice a contributor reads on the welcome page (HF-01) and accepts on the details page
 * (HF-02) before a code is issued (plan §9.3, DPDP). The API records the accepted version with the
 * person's consent and refuses an older one ("The form was updated. Reload the page."), so these words
 * and HOTEL_FORM_NOTICE_VERSION change together: whoever edits the words bumps the version in core. The
 * wording awaits counsel's review and AMPM's approval before real hotels use the form (HF-G2).
 */

/** One part of the notice: a heading and its paragraphs. */
export interface NoticePart {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

/** The notice as the page shows it, with the version it is. */
export interface PrivacyNotice {
  readonly version: string;
  readonly title: string;
  readonly dated: string;
  readonly parts: readonly NoticePart[];
  /** The last line: whom to write to (AMPM's help contact, when set). */
  readonly contactLead: string;
}

export const PRIVACY_NOTICE: PrivacyNotice = {
  version: HOTEL_FORM_NOTICE_VERSION,
  title: "Privacy notice",
  dated: "Hotel information form · version of 25 November 2026",
  parts: [
    {
      heading: "Why AMPM asks",
      paragraphs: [
        "AMPM plans destination weddings in India. We use what you enter in this form to describe your hotel to our planners and to the couples they advise, and to contact your hotel about weddings.",
      ],
    },
    {
      heading: "What we keep about you",
      paragraphs: [
        "Your name, your designation and your mobile number, so we know who supplied each answer; the time you accepted this notice; and the network address and browser you used, to protect the form from abuse.",
        "Until AMPM sends codes by text message, the code appears on this page, so it does not prove that the mobile is yours.",
      ],
    },
    {
      heading: "Who sees what you enter",
      paragraphs: [
        "Anyone who has this link can see what is entered in the form, including the names and designations of the colleagues who help. Share it only with your hotel's team.",
        "AMPM's hotel team reviews every answer before anything is used. Nothing from AMPM's own records about your hotel is shown on the form.",
        "Filling in the form does not make you one of AMPM's contacts for your hotel. If someone names you as a contact in the form, AMPM emails you a short notice before using your details, and you can object.",
      ],
    },
    {
      heading: "Who handles the data for AMPM",
      paragraphs: [
        "Cloudflare runs the security check on this page (Turnstile); Resend sends AMPM's emails; an SMS provider will send the codes once they go by text message; and a hosting company runs AMPM's server and keeps its backups off the server.",
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "Code requests, network addresses and browser details: 12 months. The people on a request that expires without being submitted: 12 months after it expires. Once your hotel's answers are merged, your name and contact details are masked after 24 months. Nothing is deleted automatically: AMPM reviews each clean-up.",
      ],
    },
    {
      heading: "Your choices",
      paragraphs: [
        "You can ask AMPM to show, correct or remove your details, or withdraw your consent, as easily as you gave it. This notice is in English; ask us for another language.",
      ],
    },
  ],
  contactLead: "To ask about your data, or to complain:",
};
