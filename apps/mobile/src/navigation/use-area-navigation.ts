import { useRouter, type Href } from "expo-router";

import { useToast } from "@ampm/ui";

import { LOCKED_AREA_NOTICE } from "./client-areas";

export interface AreaNavigation {
  /** Opens an area's top-level screen from a tab, the rail or the top navigation. */
  readonly open: (href: Href) => void;
  /** Says why a locked area does not open (a toast), instead of navigating. */
  readonly explainLock: () => void;
}

/**
 * Moving between areas: back down the stack to the area's screen when it is already there, otherwise
 * in place of the current screen. Switching areas never piles screens up, and detail screens opened
 * inside an area still go back to it.
 */
export function useAreaNavigation(): AreaNavigation {
  const router = useRouter();
  const toast = useToast();
  return {
    open: (href) => router.dismissTo(href),
    explainLock: () => {
      toast.show({ title: LOCKED_AREA_NOTICE, tone: "info" });
    },
  };
}
