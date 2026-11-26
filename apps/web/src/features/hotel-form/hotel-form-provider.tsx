"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { ApiProvider, createQueryClient } from "@ampm/api-client";

import { env } from "@/env";

import { HOTEL_FORM_ROUTES, innerPathOf } from "./hotel-form-routes";
import type { HeldSections } from "./sections/held-sections";
import { useHeldSections } from "./sections/use-held-sections";
import { useHotelFormFlow, type HotelFormFlow } from "./use-hotel-form-flow";

/** What every page of the form shares: the flow and its session, and where signing in leads. */
export interface HotelFormSite {
  readonly flow: HotelFormFlow;
  /**
   * Each section's answers not saved yet and its autosave, kept while the person moves between the form's
   * pages (review fixes E1 and E4): a section left is still saved, and opens again as it was left.
   */
  readonly sections: HeldSections;
  /** The Turnstile widget's site key, for a new code asked for on any page. */
  readonly siteKey: string;
  /** Remembers the page the person was sent to the sign-in from. */
  readonly rememberReturn: (path: string) => void;
  /** Where signing in leads: the page remembered, else the overview (HF-04). */
  readonly landing: () => string;
  /** Forgets the remembered page, and a notice carried to it, once the person is on it. */
  readonly arrived: (path: string) => void;
  /**
   * Hands the page the person is sent to a notice to show as it opens (a submit refused because the
   * form was submitted already, shown on the status page), kept in memory only.
   */
  readonly carryNotice: (path: string, message: string) => void;
  /** The notice carried to `path`, until that page has arrived. */
  readonly carriedNotice: (path: string) => string | null;
}

/** The form's shared state; a test provides its own. */
export const HotelFormSiteContext = createContext<HotelFormSite | null>(null);

/**
 * The page remembered across the sign-in, for the tab, and a notice carried to the next page: held by the
 * layout, which stays mounted while the person moves between the form's pages, so nothing about either is
 * written to storage or the address. Only the form's own pages behind the sign-in are remembered
 * (`innerPathOf`).
 *
 *   const { rememberReturn, landing, arrived, carryNotice, carriedNotice } = useReturnPage();
 */
export function useReturnPage() {
  const remembered = useRef<string | null>(null);
  const carried = useRef<{ readonly path: string; readonly message: string } | null>(null);
  const rememberReturn = useCallback((path: string) => {
    remembered.current = innerPathOf(path);
  }, []);
  const landing = useCallback(() => remembered.current ?? HOTEL_FORM_ROUTES.overview, []);
  const arrived = useCallback((path: string) => {
    if (remembered.current === path) remembered.current = null;
    if (carried.current?.path === path) carried.current = null;
  }, []);
  const carryNotice = useCallback((path: string, message: string) => {
    carried.current = { path, message };
  }, []);
  const carriedNotice = useCallback(
    (path: string) => (carried.current?.path === path ? carried.current.message : null),
    [],
  );
  return { rememberReturn, landing, arrived, carryNotice, carriedNotice };
}

/** The flow, run once for every page under the layout. */
function FlowHost({ children }: { readonly children: ReactNode }) {
  // The flow is a new object on every render, so the pages under it draw again with it; the return
  // page's three calls and the held sections stay the same, so an effect keyed on one runs once.
  const flow = useHotelFormFlow();
  const site: HotelFormSite = {
    flow,
    sections: useHeldSections(flow),
    siteKey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    ...useReturnPage(),
  };
  return <HotelFormSiteContext.Provider value={site}>{children}</HotelFormSiteContext.Provider>;
}

/**
 * The form's query client: a query refused with 429 is never tried again, since the pages count its
 * Retry-After down and a retry would only spend the window before it ends.
 *
 *   const [queryClient] = useState(hotelFormQueryClient);
 */
export function hotelFormQueryClient(): ReturnType<typeof createQueryClient> {
  return createQueryClient({ retryRateLimited: false });
}

/**
 * The hotel form's state for every page under /hotel-form (D-190 §5): the API through a provider of its
 * own (no staff or client token exists on the site; the form's calls pass their session explicitly), and
 * one flow, so the link, the session and what the person typed survive moving between the form's pages.
 * The server renders each page's opening card; the link is read once the page runs in the browser.
 *
 *   <HotelFormProvider>{children}</HotelFormProvider>
 */
export function HotelFormProvider({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(hotelFormQueryClient);
  return (
    <ApiProvider baseUrl={env.NEXT_PUBLIC_API_URL} queryClient={queryClient}>
      <FlowHost>{children}</FlowHost>
    </ApiProvider>
  );
}

/**
 * The form's shared state, on a page under the layout.
 *
 *   const { flow, siteKey } = useHotelFormSite();
 */
export function useHotelFormSite(): HotelFormSite {
  const site = useContext(HotelFormSiteContext);
  if (site === null) throw new Error("useHotelFormSite() needs the hotel form's layout above it");
  return site;
}
