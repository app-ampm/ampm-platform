import { Eyebrow, GlowOrbs, SectionHeading, SiteContainer } from "@/components/site";

import { DestinationCard } from "./destination-card";
import { DestinationsBrowser } from "./destinations-browser";
import { DESTINATIONS, DESTINATIONS_COPY } from "./destinations-content";
import { DESTINATIONS_HEADING_ID } from "./destinations-ids";
import { FeaturedDestination } from "./featured-destination";

/** The page's eyebrow and its Gilda heading with the gold "we plan." (W4: 88 on a desktop). */
function DestinationsIntro() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Eyebrow size="md">{DESTINATIONS_COPY.eyebrow}</Eyebrow>
      <SectionHeading
        as="h1"
        id={DESTINATIONS_HEADING_ID}
        emphasis={DESTINATIONS_COPY.emphasis}
        className="text-5xl tracking-tight md:text-6xl xl:text-7xl"
      >
        {DESTINATIONS_COPY.title}
      </SectionHeading>
    </div>
  );
}

/**
 * PUB-04, the destinations page (W4): the heading and the region pills, the nine destinations the
 * pills filter, and the featured destination with its gold call to action, under the page's glow.
 * The cards render on the server; only the filter runs in the browser.
 */
export function DestinationsPage() {
  return (
    <>
      <GlowOrbs />
      <SiteContainer className="gap-14 pb-14 pt-14 md:gap-24 md:pb-24 md:pt-28">
        <DestinationsBrowser
          intro={<DestinationsIntro />}
          cards={DESTINATIONS.map((destination) => ({
            key: destination.name,
            region: destination.region,
            card: <DestinationCard destination={destination} />,
          }))}
        />
        <FeaturedDestination />
      </SiteContainer>
    </>
  );
}
