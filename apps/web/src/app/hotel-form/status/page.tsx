import { HotelFormStatusPage } from "@/features/hotel-form/status/status-page";

// Matches the root layout's per-request rendering so the strict-nonce CSP reaches Next's scripts (D-046).
export const dynamic = "force-dynamic";

/**
 * HF-07, where the request stands (D-190 §5): the server renders the opening card; the status, the
 * answers, a correction and the withdrawals are read and sent in the browser, inside the form's session.
 */
export default function HotelFormStatus() {
  return <HotelFormStatusPage />;
}
