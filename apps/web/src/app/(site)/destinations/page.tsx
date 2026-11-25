import type { Metadata } from "next";

import { DestinationsPage } from "@/features/destinations/destinations-page";

export const metadata: Metadata = {
  title: "Destinations · AMPM",
  description:
    "Udaipur, Jaipur, Goa, Kerala, Mussoorie and the other places in India where AMPM plans destination weddings.",
};

// Matches the layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/** PUB-04, the destinations page (W4). */
export default function Page() {
  return <DestinationsPage />;
}
