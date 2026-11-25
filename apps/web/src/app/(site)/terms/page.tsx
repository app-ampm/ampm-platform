import type { Metadata } from "next";

import { SITE_COPY } from "@/components/site";
import { LegalPlaceholder } from "@/features/legal/legal-placeholder";

export const metadata: Metadata = {
  title: SITE_COPY.termsTitle,
  description: SITE_COPY.termsPlaceholder,
};

// Matches the layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/** The terms of use's page, holding its place until AMPM publishes the terms. */
export default function Page() {
  return <LegalPlaceholder title={SITE_COPY.termsHeading} body={SITE_COPY.termsPlaceholder} />;
}
