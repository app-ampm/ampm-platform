import type { Metadata } from "next";

import { HowItWorksPage } from "@/features/how-it-works/how-it-works-page";
import { fetchPlanPrice } from "@/features/how-it-works/plan-price";

export const metadata: Metadata = {
  title: "How it works · AMPM",
  description:
    "Three stages. Pay for the one you need. Hotel discovery is a subscription on its own; hotel assistance and complete management come after, only if you want them.",
};

// Matches the layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/**
 * PUB-02 + PUB-07, how it works and the plans (W2). Hotel discovery's price is configuration, read from
 * the public plan catalogue as the page renders; without an answer the stage shows its terms alone.
 */
export default async function Page() {
  const discoveryPrice = await fetchPlanPrice("hotel_discovery");
  return <HowItWorksPage planPrices={{ hotel_discovery: discoveryPrice }} />;
}
