import { cardStyles, cn, listItemStyles, textStyles } from "@ampm/ui/styles";

import { ButtonLink, ENQUIRY_HREF, Eyebrow, PhotoPlaceholder } from "@/components/site";

import { DESTINATIONS_COPY, FEATURED_DESTINATION } from "./destinations-content";
import { FEATURED_HEADING_ID, FEATURED_HOTELS_ID } from "./destinations-ids";

/**
 * The hotels AMPM works with at the featured destination (W4), under their label: flat rows inside
 * the card (a panel inside a panel is a flat tint), each with a striped thumbnail, gold and peacock
 * by turn, and the name in Gilda.
 */
function FeaturedHotels() {
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow size="md" className="pt-1.5">
        <span id={FEATURED_HOTELS_ID}>{FEATURED_DESTINATION.hotelsLabel}</span>
      </Eyebrow>
      <ul aria-labelledby={FEATURED_HOTELS_ID} className="flex flex-col gap-2.5">
        {FEATURED_DESTINATION.hotels.map((hotel, index) => (
          <li key={hotel} className={cn(listItemStyles({ tone: "flat" }), "gap-3.5 p-2.5")}>
            <PhotoPlaceholder
              tone={index % 2 === 0 ? "gold" : "peacock"}
              className="h-12 w-16 shrink-0 rounded-sm md:rounded-sm"
            />
            <span className={textStyles({ variant: "heading" })}>{hotel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The featured destination under the grid (W4): one large glass card (radius 28) with the photo on
 * the left and, on the right, the gold eyebrow, the name in Gilda, what it offers, the hotels AMPM
 * works with there and the gold "Plan Udaipur with AMPM" to the contact page. Halves from 1024 (the
 * mock's 1.1fr / 1fr), the photo stretching to the text's height; stacked, photo first, below that.
 */
export function FeaturedDestination() {
  return (
    <section
      aria-labelledby={FEATURED_HEADING_ID}
      className={cn(
        cardStyles({ padding: "none" }),
        "gap-6 rounded-2xl p-3 md:rounded-2xl md:p-5 lg:grid lg:grid-cols-2 lg:gap-10",
      )}
    >
      <PhotoPlaceholder
        tone="peacock"
        label={FEATURED_DESTINATION.photo}
        className="h-64 md:h-96 lg:h-auto lg:min-h-96"
      />
      <div className="flex flex-col gap-5 px-2 pb-3 md:gap-5.5 md:p-7 lg:pl-0">
        <Eyebrow size="md" className="text-brand">
          {DESTINATIONS_COPY.featuredEyebrow}
        </Eyebrow>
        <h2
          id={FEATURED_HEADING_ID}
          className={cn(textStyles({ variant: "display" }), "text-5xl md:text-6xl")}
        >
          {FEATURED_DESTINATION.name}
        </h2>
        <p className={cn(textStyles({ variant: "body", tone: "body" }), "md:text-lg")}>
          {FEATURED_DESTINATION.description}
        </p>
        <FeaturedHotels />
        <p className={textStyles({ variant: "bodySmall", tone: "muted" })}>
          {FEATURED_DESTINATION.note}
        </p>
        <ButtonLink href={ENQUIRY_HREF} size="lg" className="mt-1">
          {FEATURED_DESTINATION.action}
        </ButtonLink>
      </div>
    </section>
  );
}
