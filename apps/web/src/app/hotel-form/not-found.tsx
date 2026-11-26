import { HotelFormNotFound } from "@/features/hotel-form/hotel-form-not-found";

/**
 * A page of the hotel form that does not exist (a section's mistyped key), inside the form's own frame:
 * no site navigation, only the way back to the overview. Next answers it with a 404 and a noindex.
 */
export default function NotFound() {
  return <HotelFormNotFound />;
}
