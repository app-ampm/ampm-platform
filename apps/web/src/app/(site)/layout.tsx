import type { ReactNode } from "react";

import { SiteFrame } from "@/components/site";

/**
 * The marketing pages' frame (W1–W8): every page in this group sits between the glass top bar and the
 * footer, with the chat pill floating over it (SiteFrame). The group adds nothing to the address.
 */
export default function SiteLayout({ children }: { readonly children: ReactNode }) {
  return <SiteFrame>{children}</SiteFrame>;
}
