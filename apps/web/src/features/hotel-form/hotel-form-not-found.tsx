import { buttonLabelStyles, buttonStyles, cn, textStyles } from "@ampm/ui/styles";

import { Eyebrow } from "@/components/site/eyebrow";
import { GlassCard } from "@/components/site/glass-card";

import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { HOTEL_FORM_ROUTES } from "./hotel-form-routes";

const COPY = HOTEL_FORM_COPY.notFound;

/**
 * The form's not-found page: a mistyped section's address, inside the form's frame, with the overview as
 * the one way on (nothing leads away from the form). Drawn on the server with no script of its own: every
 * page of the form loads its not-found boundary, so a client component here would add to each page's
 * first load (HF-G11). The way on is a plain link, which loads the overview afresh; the tab's link and
 * session are in sessionStorage, so the overview opens signed in.
 *
 *   <HotelFormNotFound />
 */
export function HotelFormNotFound() {
  return (
    <GlassCard
      as="section"
      aria-labelledby="hf-not-found-heading"
      padding="lg"
      className="w-full max-w-xl gap-5 md:p-9"
    >
      <Eyebrow>{COPY.eyebrow}</Eyebrow>
      <h1
        id="hf-not-found-heading"
        className={cn(textStyles({ variant: "title" }), "text-balance md:text-5xl")}
      >
        {COPY.title} <span className="text-brand">{COPY.emphasis}</span>
      </h1>
      <p className={textStyles({ variant: "body", tone: "body" })}>{COPY.body}</p>
      <a
        href={HOTEL_FORM_ROUTES.overview}
        className={buttonStyles({ variant: "primary", size: "lg", fullWidth: true })}
      >
        <span className={buttonLabelStyles({ variant: "primary", size: "lg" })}>{COPY.back}</span>
      </a>
    </GlassCard>
  );
}
