"use client";

import { ErrorPage } from "@/features/errors/error-page";

interface RouteErrorProps {
  readonly error: unknown;
  readonly retry: () => void;
}

/**
 * Next's error boundary for every page of the site's group: the top bar and footer stay, and the page
 * says what happened with a way to try again (D-160).
 */
export default function RouteError({ error, retry }: RouteErrorProps) {
  return <ErrorPage error={error} retry={retry} scope="page" />;
}
