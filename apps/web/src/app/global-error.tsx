"use client";

import { ErrorPage } from "@/features/errors/error-page";

import { fontVariables } from "./fonts";
import "./globals.css";

interface GlobalErrorProps {
  readonly error: unknown;
  readonly retry: () => void;
}

/**
 * Next's boundary for a crash in the root layout itself (D-160). It replaces the whole document, so it
 * brings its own html and body with the layout's midnight canvas, fonts and styles, and draws the
 * error page without the top bar and footer that failed; the frame is `relative` for the page's glow.
 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-surface font-sans text-primary antialiased">
        <main className="relative isolate flex min-h-screen flex-col">
          <ErrorPage error={error} retry={retry} scope="root" />
        </main>
      </body>
    </html>
  );
}
