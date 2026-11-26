import { notFound } from "next/navigation";

import { sectionKeyOf } from "@/features/hotel-form/hotel-form-routes";
import { HotelFormSectionPage } from "@/features/hotel-form/sections/section-page";

// Matches the root layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/**
 * HF-05, one of the hotel form's seven sections (D-190 §5): `/hotel-form/sections/<key>`, any other word
 * the form's not-found page. The server renders the opening card; the section is read in the browser,
 * inside the form's session, and saves itself as the person types.
 */
export default async function HotelFormSection({
  params,
}: PageProps<"/hotel-form/sections/[section]">) {
  const key = sectionKeyOf((await params).section);
  if (key === null) notFound();
  return <HotelFormSectionPage sectionKey={key} />;
}
