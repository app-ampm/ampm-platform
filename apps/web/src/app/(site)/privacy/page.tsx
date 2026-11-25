import type { Metadata } from "next";

import { SITE_COPY } from "@/components/site";
import { LegalPlaceholder } from "@/features/legal/legal-placeholder";

export const metadata: Metadata = {
  title: SITE_COPY.privacyTitle,
  description: SITE_COPY.privacyPlaceholder,
};

// Matches the layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/** The privacy notice's page, holding its place until AMPM publishes the notice. */
export default function Page() {
  return <LegalPlaceholder title={SITE_COPY.privacy} body={SITE_COPY.privacyPlaceholder} />;
}
