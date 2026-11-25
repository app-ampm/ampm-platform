import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";
import { reachableChannels } from "@/components/contact/contact-channels";
import { ContactIntro } from "@/components/contact/contact-intro";
import { isDemoRequest } from "@/components/contact/contact-request";
import { GlowOrbs, SiteContainer } from "@/components/site";

export const metadata: Metadata = {
  title: "Contact · AMPM",
  description: "Enquire about AMPM wedding planning, or request a demo of hotel discovery.",
};

// Matches the layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/**
 * PUB-06 — the public enquiry and demo-request form (Module B CRM, feature 8.1), W6; the confirmation
 * (PUB-09, W7) replaces it in place. `?type=demo` opens it on the demo request.
 */
export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const { type } = await searchParams;
  const channels = reachableChannels();
  return (
    <>
      <GlowOrbs />
      <SiteContainer className="pb-14 pt-14 md:pb-24 md:pt-24">
        <ContactForm
          intro={<ContactIntro channels={channels} />}
          initialRequestedDemo={isDemoRequest(type)}
          isChatAnchor={channels.length === 0}
        />
      </SiteContainer>
    </>
  );
}
