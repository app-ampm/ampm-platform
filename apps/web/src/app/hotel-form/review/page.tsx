import { HotelFormReviewPage } from "@/features/hotel-form/review/review-page";

// Matches the root layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/**
 * HF-06, Review and submit (D-190 §5): the server renders the opening card; the answers are read in the
 * browser, inside the form's session, and submitted from there.
 */
export default function HotelFormReview() {
  return <HotelFormReviewPage />;
}
