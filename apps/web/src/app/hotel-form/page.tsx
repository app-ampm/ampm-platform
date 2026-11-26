import { HotelFormIdentityPage } from "@/features/hotel-form/identity-page";

// Matches the root layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/**
 * The hotel information form's identity step (D-189 §8): HF-01 Welcome and privacy notice, HF-02 Your
 * details, HF-03 Enter your code, and HF-08 for a link that is not active; signed in, the person goes on
 * to the overview (D-190 §5). Reached from AMPM's link, `/hotel-form#k=<secret>`; the page reads the
 * secret in the browser.
 */
export default function HotelFormPage() {
  return <HotelFormIdentityPage />;
}
