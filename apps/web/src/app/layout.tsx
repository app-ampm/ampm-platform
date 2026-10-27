import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AMPM",
  description: "AMPM wedding platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // suppressHydrationWarning: the scheme toggle puts `dark` on <html> before React hydrates.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-surface font-sans text-primary antialiased">{children}</body>
    </html>
  );
}
