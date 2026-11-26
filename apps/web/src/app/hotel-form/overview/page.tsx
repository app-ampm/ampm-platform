import { HotelFormOverviewPage } from "@/features/hotel-form/overview-page";

// Matches the root layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/**
 * HF-04, the hotel form's overview (D-190 §5): where signing in lands. The server renders the opening
 * card; the request and its sections are read in the browser, inside the form's session.
 */
export default function HotelFormOverview() {
  return <HotelFormOverviewPage />;
}
