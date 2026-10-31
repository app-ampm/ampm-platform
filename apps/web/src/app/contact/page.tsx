import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact AMPM",
  description: "Enquire about AMPM wedding planning, or request a demo of hotel discovery.",
};

// Matches the layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/** PUB-06 — the public enquiry and demo-request form (Module B CRM, feature 8.1). */
export default function ContactPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-primary">Plan your wedding with AMPM</h1>
        <p className="text-base text-muted">
          Tell us about your celebration and our team will be in touch. You can also ask for a demo
          of hotel discovery.
        </p>
      </header>
      <ContactForm />
    </main>
  );
}
