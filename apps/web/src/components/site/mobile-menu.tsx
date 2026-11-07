"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { MobileMenuPanel } from "./mobile-menu-panel";
import { SITE_COPY } from "./site-copy";
import { roundButtonStyles } from "./site.styles";

const MENU_ID = "site-menu";

const subscribeNever = () => () => undefined;

/** True in the browser, false on the server and while hydrating, so the markup matches the server's. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

/**
 * The phone bar's MENU button (W8) and the full-screen menu it opens. The panel is portalled to
 * <body>: the bar's glass blur would otherwise become the containing block of a fixed panel and trap
 * it inside the pill. Closing it, by CLOSE, Escape or a link, puts focus back on MENU.
 */
export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isClient = useIsClient();
  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={MENU_ID}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
        className={roundButtonStyles}
      >
        {SITE_COPY.menu}
      </button>
      {isClient
        ? createPortal(
            <MobileMenuPanel id={MENU_ID} isOpen={isOpen} onClose={close} />,
            document.body,
          )
        : null}
    </>
  );
}
