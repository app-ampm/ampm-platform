"use client";

import { ErrorPage } from "@/features/errors/error-page";

interface HotelFormErrorProps {
  readonly error: unknown;
  readonly retry: () => void;
}

/** Next's error boundary for the hotel form: its own frame stays, with a way to try again (D-160). */
export default function HotelFormError({ error, retry }: HotelFormErrorProps) {
  return <ErrorPage error={error} retry={retry} scope="page" />;
}
