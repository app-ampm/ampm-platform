import type { Metadata } from "next";

import { HomePage } from "@/features/home/home-page";

export const metadata: Metadata = {
  title: "AMPM · Weddings, planned end to end",
  description:
    "Find the right hotel with rates we've checked ourselves, hand over the details, and let one team run every function, from the first enquiry to the last departure.",
};

// Matches the layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/** PUB-01, the home page (W1, W8). */
export default function Page() {
  return <HomePage />;
}
