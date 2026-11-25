import type { Metadata } from "next";

import { AboutPage } from "@/features/about/about-page";

export const metadata: Metadata = {
  title: "About · AMPM",
  description:
    "AMPM plans destination weddings in India: one team, from the first call to the last departure.",
};

// Matches the layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/** PUB-05, the about page (W5). */
export default function Page() {
  return <AboutPage />;
}
