"use client";

import { useRef, type RefObject } from "react";

import { cn, dividerStyles, glassStyles } from "@ampm/ui/styles";

import { ButtonLink } from "./button-link";
import { NavLinks } from "./nav-links";
import { SITE_COPY } from "./site-copy";
import { CLIENT_SIGN_IN_URL, DEMO_HREF } from "./site-links";
import { navLinkStyles, roundButtonStyles } from "./site.styles";
import { useDialogFocus } from "./use-dialog-focus";
import { Wordmark } from "./wordmark";

export interface MobileMenuPanelProps {
  /** The id the MENU button's aria-controls names. */
  readonly id: string;
  readonly isOpen: boolean;
  /** Closes the panel and returns focus to the MENU button. */
  readonly onClose: () => void;
}

interface MenuBarProps {
  readonly closeRef: RefObject<HTMLButtonElement | null>;
  readonly onClose: () => void;
}

/** The bar's own frame and padding (W8), so CLOSE lands exactly where MENU was. */
function MenuBar({ closeRef, onClose }: MenuBarProps) {
  return (
    <div className="mx-4 mt-4 flex items-center justify-between border border-transparent py-2 pl-4.5 pr-2 md:mx-10 md:mt-6">
      <Wordmark onNavigate={onClose} />
      <button
        ref={closeRef}
        type="button"
        aria-label={SITE_COPY.closeMenu}
        onClick={onClose}
        className={roundButtonStyles}
      >
        {SITE_COPY.close}
      </button>
    </div>
  );
}

/** The five pages in Gilda, then client sign-in and the gold demo request. */
function MenuLinks({ onClose }: { readonly onClose: () => void }) {
  return (
    <div className="flex flex-col gap-8 px-5.5 md:px-14">
      <NavLinks className="flex-col items-start gap-2" textVariant="title" onNavigate={onClose} />
      <div className={dividerStyles()} />
      <div className="flex flex-col gap-4">
        <a href={CLIENT_SIGN_IN_URL} className={navLinkStyles({ tone: "muted" })}>
          {SITE_COPY.clientSignIn}
        </a>
        <ButtonLink href={DEMO_HREF} size="lg" fullWidth onClick={onClose}>
          {SITE_COPY.requestDemo}
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * The phone and tablet menu: full-screen glass over a midnight 70% fill. A modal dialog: focus moves
 * in to CLOSE, Tab stays inside, Escape or any link closes it. Hidden from 1024, where the bar shows
 * every link.
 */
export function MobileMenuPanel({ id, isOpen, onClose }: MobileMenuPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus({ isOpen, panelRef, initialFocusRef: closeRef, onClose });
  return (
    <div
      id={id}
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={SITE_COPY.menuTitle}
      className={cn(
        glassStyles({ recipe: "base" }),
        // Fixed: the menu covers the whole window above the page, the bar and the chat pill.
        "fixed inset-0 z-modal flex-col gap-10 overflow-y-auto border-0 bg-overlay/70 pb-10 lg:hidden",
        isOpen ? "flex" : "hidden",
      )}
    >
      <MenuBar closeRef={closeRef} onClose={onClose} />
      <MenuLinks onClose={onClose} />
    </div>
  );
}
