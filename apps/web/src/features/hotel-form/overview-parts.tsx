import {
  hotelFormStateOf,
  type HotelFormDraftRequest,
  type HotelFormRequestStatus,
} from "@ampm/core";
import {
  calloutStyles,
  cn,
  flatTintStyles,
  glassStyles,
  textStyles,
  type StatusTone,
} from "@ampm/ui/styles";

import { ButtonLink } from "@/components/site/button-link";
import { Chip } from "@/components/site/chip";

import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { HOTEL_FORM_ROUTES } from "./hotel-form-routes";
import { momentOf } from "./hotel-form-time";
import { OVERVIEW_COPY as COPY } from "./overview-copy";

/*
 * The parts of HF-04 about the request itself (D-190 §5): its status, AMPM's note, why the answers are
 * locked or wanted again, and the way on: Review and submit while the form is open, else its status.
 */

/** The chip each status wears (peacock-night.md §8), seen from the hotel's side; the word carries it. */
const STATUS_TONE: Readonly<Record<HotelFormRequestStatus, StatusTone>> = {
  open: "danger",
  changes_requested: "danger",
  submitted: "info",
  in_review: "warning",
  merged: "success",
};

/** "Status" and the request's chip; the word carries the meaning. */
export function StatusRow({ status }: { readonly status: HotelFormRequestStatus }) {
  return (
    <div className="flex flex-row flex-wrap items-center gap-3">
      <span className={textStyles({ variant: "label", tone: "body" })}>
        {HOTEL_FORM_COPY.signedIn.statusLabel}
      </span>
      <Chip tone={STATUS_TONE[status]}>{HOTEL_FORM_COPY.signedIn.status[status]}</Chip>
    </div>
  );
}

/** AMPM's note for the hotel, as staff wrote it on the request. */
export function StaffNote({ note }: { readonly note: string }) {
  return (
    <section
      aria-labelledby="hf-staff-note"
      className={cn(flatTintStyles, "flex flex-col gap-1.5 rounded p-4")}
    >
      <h2 id="hf-staff-note" className={textStyles({ variant: "label", tone: "primary" })}>
        {HOTEL_FORM_COPY.signedIn.noteHeading}
      </h2>
      <p className={textStyles({ variant: "bodySmall", tone: "body" })}>{note}</p>
    </section>
  );
}

/** A callout over the page: its heading and one line, in gold (needs you) or peacock glass (done). */
function Callout({
  id,
  tone,
  heading,
  body,
}: {
  readonly id: string;
  readonly tone: "gold" | "peacock";
  readonly heading: string;
  readonly body: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(glassStyles({ recipe: tone, blur: false }), calloutStyles, "flex-col gap-1")}
    >
      <h2 id={id} className={textStyles({ variant: "label", tone: "primary" })}>
        {heading}
      </h2>
      <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>{body}</p>
    </section>
  );
}

/** Who submitted a locked request and when, from the draft, in words. */
export function submittedLine(request: HotelFormDraftRequest | undefined): string {
  if (request?.submittedBy && request.submittedAt)
    return COPY.locked.submitted(request.submittedBy, momentOf(request.submittedAt));
  return COPY.locked.submittedPlain;
}

/**
 * Why the overview reads as it does: AMPM asked for changes, the answers are with AMPM (who submitted
 * them and when, once the draft has said), or the request is complete; nothing while the form is open.
 */
export function RequestBanner({
  status,
  request,
}: {
  readonly status: HotelFormRequestStatus;
  readonly request: HotelFormDraftRequest | undefined;
}) {
  if (status === "changes_requested")
    return <Callout id="hf-banner" tone="gold" {...COPY.changesRequested} />;
  const state = hotelFormStateOf(status);
  if (state === "locked")
    return (
      <Callout
        id="hf-banner"
        tone="peacock"
        heading={COPY.locked.heading}
        body={submittedLine(request)}
      />
    );
  if (state === "status_only") return <Callout id="hf-banner" tone="peacock" {...COPY.complete} />;
  return null;
}

/**
 * The page's way on: Review and submit (the one gold action) while the form takes answers, else where
 * the request stands.
 */
export function NextAction({ status }: { readonly status: HotelFormRequestStatus }) {
  if (hotelFormStateOf(status) === "ready")
    return (
      <ButtonLink href={HOTEL_FORM_ROUTES.review} size="lg" fullWidth>
        {COPY.review}
      </ButtonLink>
    );
  return (
    <ButtonLink href={HOTEL_FORM_ROUTES.status} variant="secondary" size="lg">
      {COPY.status}
    </ButtonLink>
  );
}
