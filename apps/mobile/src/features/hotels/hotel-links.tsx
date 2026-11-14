import type { HotelDetailView } from "@ampm/core";
import { Link, Row } from "@ampm/ui";

import { externalHttpUrl, hotelMapUrl } from "./hotels.format";

/**
 * The hotel's off-site links a client can open (CP-05): its own website and its location on a map. Both
 * leave the app (the shared Link's `external` opens the browser or Maps app), and both stay non-gold —
 * the screen's one gold action is the footer's or the title's — so the page keeps a single primary. The
 * map is a link out, not an embed: the client view carries no coordinates and there is no maps provider
 * yet. Rendered only when the hotel has a website or somewhere to map to.
 */
export function HotelLinks({ hotel }: { readonly hotel: HotelDetailView }) {
  const websiteUrl = externalHttpUrl(hotel.website);
  const mapUrl = hotelMapUrl(hotel);
  if (!websiteUrl && !mapUrl) return null;
  return (
    <Row gap={4} wrap>
      {websiteUrl ? (
        <Link
          href={websiteUrl}
          external
          variant="standalone"
          tone="body"
          accessibilityLabel={`Visit website for ${hotel.name}`}
        >
          Visit website
        </Link>
      ) : null}
      {mapUrl ? (
        <Link
          href={mapUrl}
          external
          variant="standalone"
          tone="body"
          accessibilityLabel={`Open in maps for ${hotel.name}`}
        >
          Open in maps
        </Link>
      ) : null}
    </Row>
  );
}
