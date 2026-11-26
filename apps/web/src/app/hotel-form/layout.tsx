import type { ReactNode } from "react";
import type { Metadata } from "next";

import { HOTEL_FORM_COPY } from "@/features/hotel-form/hotel-form-copy";
import { HotelFormFrame } from "@/features/hotel-form/hotel-form-frame";
import { HotelFormProvider } from "@/features/hotel-form/hotel-form-provider";

/**
 * Generic words only: a link preview (a chat app, a mail scanner) shows these, never anything about the
 * hotel, and the secret in the fragment never reaches the server that answers it. The headers say the
 * same (no index, no referrer, no store: middleware.ts); the tags repeat them for whatever reads the page.
 */
export const metadata: Metadata = {
  title: HOTEL_FORM_COPY.metaTitle,
  description: HOTEL_FORM_COPY.metaDescription,
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

/**
 * The hotel form's pages (D-189 §8, D-190 §5) in their own frame (no site navigation, no chat pill),
 * sharing one provider: the API, the flow and its session, so moving between the sign-in, the overview
 * and the sections keeps the link, the session and what was typed.
 */
export default function HotelFormLayout({ children }: { readonly children: ReactNode }) {
  return (
    <HotelFormFrame>
      <HotelFormProvider>{children}</HotelFormProvider>
    </HotelFormFrame>
  );
}
