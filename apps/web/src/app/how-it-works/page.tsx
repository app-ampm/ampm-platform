import type { Metadata } from "next";

import { HowItWorksPage } from "@/features/how-it-works/how-it-works-page";

export const metadata: Metadata = {
  title: "How it works · AMPM",
  description:
    "Three stages. Pay for the one you need. Hotel discovery is a subscription on its own; hotel assistance and complete management come after, only if you want them.",
};

// Matches the layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/** PUB-02 + PUB-07, how it works and the plans (W2). */
export default function Page() {
  return <HowItWorksPage />;
}
