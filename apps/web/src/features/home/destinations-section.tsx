import { cn, glassStyles, textStyles } from "@ampm/ui/styles";

import { PhotoPlaceholder, SectionIntro } from "@/components/site";
import { DESTINATIONS, type Destination } from "@/features/destinations/destinations-content";

import { HOME_DESTINATION_COUNT, PHONE_DESTINATION_COUNT } from "./home-content";
import { DESTINATIONS_HEADING_ID } from "./home-ids";

/** The destinations page's list opens with the six the home page shows. */
const HOME_DESTINATIONS = DESTINATIONS.slice(0, HOME_DESTINATION_COUNT);

interface DestinationTileProps {
  readonly destination: Destination;
  readonly isPhoneHidden: boolean;
}

/** A destination: a photo placeholder with its name, and its region from a tablet, in a glass card. */
function DestinationTile({ destination, isPhoneHidden }: DestinationTileProps) {
  return (
    <li className={cn("relative", isPhoneHidden && "hidden md:block")}>
      <PhotoPlaceholder tone="peacock" className="h-40 md:h-72" />
      <div
        className={cn(
          glassStyles({ recipe: "base" }),
          // Absolute: the name card rests on the photo's lower edge (W1, W8).
          "absolute inset-x-2 bottom-2 flex flex-wrap items-baseline justify-between gap-x-2 rounded px-3 py-2.5",
          "md:inset-x-3.5 md:bottom-3.5 md:px-4.5 md:py-4",
        )}
      >
        <h3 className={cn(textStyles({ variant: "heading" }), "text-xl md:text-2xl")}>
          {destination.name}
        </h3>
        <p className={cn(textStyles({ variant: "eyebrow", tone: "muted" }), "hidden md:block")}>
          {destination.region}
        </p>
      </div>
    </li>
  );
}

/** Where AMPM plans (W1: six in three columns; W8: four in two), with the link to every destination. */
export function DestinationsSection() {
  return (
    <section aria-labelledby={DESTINATIONS_HEADING_ID} className="flex flex-col gap-3 md:gap-10">
      <SectionIntro
        eyebrow="Destinations"
        title="Where we plan"
        headingId={DESTINATIONS_HEADING_ID}
        action={{ href: "/destinations", label: "All destinations →" }}
        compactOnPhone
        className="px-1.5 pb-1.5 md:p-0"
      />
      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-5">
        {HOME_DESTINATIONS.map((destination, index) => (
          <DestinationTile
            key={destination.name}
            destination={destination}
            isPhoneHidden={index >= PHONE_DESTINATION_COUNT}
          />
        ))}
      </ul>
    </section>
  );
}
