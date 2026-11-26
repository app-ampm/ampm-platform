import { hotelFormStateOf, type HotelFormDraftRequest } from "@ampm/core";
import { cn, flatTintStyles, textStyles } from "@ampm/ui/styles";

import { ButtonLink } from "@/components/site/button-link";

import { HOTEL_FORM_ROUTES } from "../hotel-form-routes";
import { StatusRow } from "../overview-parts";
import { STATUS_COPY as COPY } from "./status-copy";
import { submittedLineOf } from "./status.form";

/**
 * Where the request stands (HF-07; D-190 §5): its reference, its status as a chip with the word, who
 * submitted it and when (the time alone for a submitter who withdrew their consent), what the status means
 * in plain words, and, while the form takes answers (never submitted, or AMPM asked for changes), the way
 * back to the overview to update them: the page's one gold action then.
 *
 *   <StatusCard request={draft.request} />
 */
export function StatusCard({ request }: { readonly request: HotelFormDraftRequest }) {
  const submitted = submittedLineOf(request);
  return (
    <div className={cn(flatTintStyles, "flex flex-col gap-3 rounded p-4 md:p-5")}>
      <p className="flex flex-row flex-wrap items-baseline gap-3">
        <span className={textStyles({ variant: "label", tone: "body" })}>
          {COPY.referenceLabel}
        </span>
        <span className={textStyles({ variant: "data", tone: "primary" })}>
          {request.reference}
        </span>
      </p>
      <StatusRow status={request.status} />
      {submitted ? (
        <p className={textStyles({ variant: "bodySmall", tone: "body" })}>{submitted}</p>
      ) : null}
      <p className={textStyles({ variant: "body", tone: "body" })}>
        {COPY.status[request.status].body}
      </p>
      {hotelFormStateOf(request.status) === "ready" ? (
        <ButtonLink href={HOTEL_FORM_ROUTES.overview} size="lg" fullWidth>
          {COPY.update}
        </ButtonLink>
      ) : null}
    </div>
  );
}
