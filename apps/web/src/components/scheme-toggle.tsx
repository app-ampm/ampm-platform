"use client";

import { useEffect, useState } from "react";

type Scheme = "light" | "dark";

/**
 * Bootstrap check: switches the scheme by putting `dark` on <html> (Tailwind darkMode "class";
 * the tokens' preset swaps the CSS variables on `.dark:root`). The site's real toggle comes later.
 */
export function SchemeToggle() {
  const [scheme, setScheme] = useState<Scheme>("light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", scheme === "dark");
    document.documentElement.style.colorScheme = scheme;
  }, [scheme]);

  return (
    <button
      type="button"
      className="mt-2 flex min-h-touch items-center justify-center rounded bg-brand px-4 text-base font-semibold text-brand-ink"
      onClick={() => setScheme(scheme === "dark" ? "light" : "dark")}
      data-testid="tokens-toggle"
    >
      Switch to {scheme === "dark" ? "light" : "dark"}
    </button>
  );
}
