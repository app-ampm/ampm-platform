import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSubmitHotelForm } from "@ampm/api-client";
import {
  HOTEL_FORM_ERRORS,
  type HotelFormDraftView,
  type HotelFormMissingItem,
  type HotelFormSectionKey,
  type HotelFormSubmitRequest,
} from "@ampm/core";

import type { BotCheckControl } from "@/components/bot-check/use-bot-check";

import type { HotelFormSite } from "../hotel-form-provider";
import { HOTEL_FORM_ROUTES } from "../hotel-form-routes";
import { usePersonScoped } from "../use-person-scoped";
import { REVIEW_COPY as COPY } from "./review-copy";
import {
  EMPTY_DECLARATIONS,
  submitCheckOf,
  submitRefusalOf,
  type DeclarationErrors,
  type DeclarationFields,
  type SubmitRefusal,
} from "./review.form";

/** 7.4's checkbox and 7.5's radios, where focus goes when one needs an answer. */
export const ACCURACY_ID = "hf-accuracy";
export const DISPLAY_NAME = "hf-display";

/** What the notice beside Submit says: why Submit did not go through, and the way on. */
export type ReviewNotice =
  | { readonly kind: "message" | "bot" | "reload"; readonly message: string }
  | { readonly kind: "wait"; readonly message: string; readonly retryAt: number }
  | {
      readonly kind: "incomplete";
      readonly message: string;
      readonly items: readonly HotelFormMissingItem[];
    }
  | {
      readonly kind: "sections_changed";
      readonly message: string;
      readonly sections: readonly HotelFormSectionKey[];
    };

/** A notice as shown: each showing is counted, so the notice takes focus every time, a repeat too. */
export type ShownNotice = ReviewNotice & { readonly shown: number };

/** The review's declarations, its notice, the sections a colleague changed, and Submit. */
export interface ReviewSubmit {
  readonly fields: DeclarationFields;
  readonly errors: DeclarationErrors;
  readonly notice: ShownNotice | null;
  /** Sections a 409 sectionsChanged named: marked until the page takes the latest answers in. */
  readonly changed: readonly HotelFormSectionKey[];
  readonly isSending: boolean;
  readonly setAccuracy: (accepted: boolean) => void;
  readonly setDisplay: (answer: string) => void;
  readonly submit: () => void;
  /** The latest answers were taken in: the 409's marks, and its notice, have done their work. */
  readonly clearChanged: () => void;
}

/** Puts focus on the first declaration that needs an answer: 7.4's tick, else 7.5's first answer. */
function focusDeclaration(errors: DeclarationErrors): void {
  const target = errors.accuracy
    ? document.getElementById(ACCURACY_ID)
    : document.querySelector<HTMLInputElement>(`input[name="${DISPLAY_NAME}"]`);
  target?.focus();
}

/** The notice for a refusal the page shows itself; null for one handled by leaving or by the flow. */
function noticeOf(refusal: SubmitRefusal, now: number): ReviewNotice | null {
  switch (refusal.kind) {
    case "session":
    case "already_submitted":
      return null;
    case "wait":
      return { kind: "wait", message: refusal.message, retryAt: now + refusal.seconds * 1000 };
    default:
      return refusal;
  }
}

/** No refusal shown on either declaration. */
const NO_ERRORS: DeclarationErrors = {};

/**
 * 7.4 and 7.5 as the person answers them; 7.5 is never pre-selected. They are the signed-in person's: kept
 * across a new code entered in place while it is still them, started afresh for someone else (fix C2).
 */
function useDeclarations(personId: string | undefined) {
  const [fields, updateFields] = usePersonScoped<DeclarationFields>(personId, EMPTY_DECLARATIONS);
  const [errors, updateErrors] = usePersonScoped<DeclarationErrors>(personId, NO_ERRORS);
  const setErrors = (next: DeclarationErrors) => updateErrors(() => next);
  const setAccuracy = (accepted: boolean) =>
    updateFields((current) => ({ ...current, accuracyAccepted: accepted }));
  const setDisplay = (answer: string) =>
    updateFields((current) => ({
      ...current,
      displayAnswer: answer === "yes" || answer === "no" ? answer : "",
    }));
  return { fields, errors, setErrors, setAccuracy, setDisplay };
}

/** The notice beside Submit, and the sections a colleague changed: what a refusal leaves on the page. */
function useSubmitNotice() {
  const [notice, setNotice] = useState<ShownNotice | null>(null);
  const [changed, setChanged] = useState<readonly HotelFormSectionKey[]>([]);
  const show = (next: ReviewNotice) =>
    setNotice((current) => ({ ...next, shown: (current?.shown ?? 0) + 1 }));
  const clear = () => {
    setNotice(null);
    setChanged([]);
  };
  const clearChanged = () => {
    setChanged([]);
    setNotice((current) => (current?.kind === "sections_changed" ? null : current));
  };
  return { notice, changed, setChanged, show, clear, clearChanged };
}

type SubmitNoticeState = ReturnType<typeof useSubmitNotice>;

/**
 * The call itself: the pass spent at once (a fresh check then runs), success to the status page, and each
 * refusal handed on: the session's to the flow, an earlier submit to the status page with the API's words,
 * the rest to the notice, a colleague's save marking its sections.
 */
function useSubmitCall(site: HotelFormSite, botCheck: BotCheckControl, page: SubmitNoticeState) {
  const router = useRouter();
  const { mutateAsync } = useSubmitHotelForm();
  const [isSending, setIsSending] = useState(false);
  const refused = (error: unknown) => {
    if (site.flow.refuseSession(error)) return;
    const refusal = submitRefusalOf(error);
    if (refusal.kind === "already_submitted") {
      site.carryNotice(HOTEL_FORM_ROUTES.status, refusal.message);
      return router.replace(HOTEL_FORM_ROUTES.status);
    }
    if (refusal.kind === "sections_changed") page.setChanged(refusal.sections);
    const next = noticeOf(refusal, Date.now());
    if (next !== null) page.show(next);
  };
  const send = async (request: HotelFormSubmitRequest) => {
    const sessionToken = site.flow.state.session;
    if (sessionToken === null) return page.show({ kind: "message", message: COPY.newCode });
    botCheck.reset();
    setIsSending(true);
    page.clear();
    try {
      await mutateAsync({ sessionToken, submit: request });
      router.replace(HOTEL_FORM_ROUTES.status);
    } catch (error) {
      refused(error);
    } finally {
      setIsSending(false);
    }
  };
  return { send, isSending };
}

/**
 * HF-06's Submit (D-190 §5): 7.4 and 7.5 as the person answers them, then on Submit, in order, the
 * declarations (focus on the first unanswered), the missing items, the bot check's pass, and the call with
 * the section versions the page showed (`draft` is the page's snapshot, never a later read). Success goes to the status page; a refusal shows beside Submit and
 * takes focus (useSubmitCall); a 429 holds Submit back until its wait is over, saying so again if pressed.
 * Submit is disabled only while it sends.
 *
 *   const submit = useReviewSubmit(site, draft, botCheck);
 */
export function useReviewSubmit(
  site: HotelFormSite,
  draft: HotelFormDraftView,
  botCheck: BotCheckControl,
): ReviewSubmit {
  const declarations = useDeclarations(site.flow.me.data?.personId);
  const page = useSubmitNotice();
  const call = useSubmitCall(site, botCheck, page);
  const submit = () => {
    const { notice } = page;
    if (call.isSending) return;
    if (notice?.kind === "wait" && notice.retryAt > Date.now()) return page.show(notice);
    const { errors, step } = submitCheckOf(declarations.fields, draft, botCheck.token);
    declarations.setErrors(errors);
    if (step.kind === "fix_declarations") return focusDeclaration(errors);
    if (step.kind === "incomplete") {
      const message = HOTEL_FORM_ERRORS.submitIncomplete;
      return page.show({ kind: "incomplete", message, items: step.items });
    }
    if (step.kind === "bot_check")
      return page.show({ kind: "message", message: COPY.waitingForCheck });
    void call.send(step.request);
  };
  const { fields, errors, setAccuracy, setDisplay } = declarations;
  const { notice, changed, clearChanged } = page;
  return {
    fields,
    errors,
    notice,
    changed,
    isSending: call.isSending,
    setAccuracy,
    setDisplay,
    submit,
    clearChanged,
  };
}
