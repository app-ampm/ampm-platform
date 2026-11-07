import type { Metadata } from "next";

import { ServicesPage } from "@/features/services/services-page";

export const metadata: Metadata = {
  title: "Services · AMPM",
  description:
    "What we take off your hands: hotel assistance, design and décor, vendor coordination and complete management of your wedding.",
};

// Matches the layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/** PUB-03, the services (W3). */
export default function Page() {
  return <ServicesPage />;
}
