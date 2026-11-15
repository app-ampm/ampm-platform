import { Link, useSignInLayoutMode } from "@ampm/ui";

import { DevAccounts, type DevAccountsProps } from "./dev-accounts";
import { DemoProspectEntry, type DemoProspectEntryProps } from "./demo-prospect-entry";

export type DevSignInShortcutsProps = Omit<DevAccountsProps, "tone" | "columns"> &
  Omit<DemoProspectEntryProps, "tone">;

function GalleryLink() {
  return (
    <Link
      href="/gallery"
      variant="nav"
      accessibilityLabel="Component gallery"
      className="self-center"
    >
      Component gallery →
    </Link>
  );
}

/**
 * The development-only ways in after the client card: the demo prospect, the seeded accounts and the
 * gallery link. Each is a card of its own, glass on a phone (P1) and a flat tint inside the centred
 * card and under D1's card, quieter than the client form.
 */
export function DevSignInShortcuts(session: DevSignInShortcutsProps) {
  const mode = useSignInLayoutMode();
  const tone = mode === "phone" ? "glass" : "flat";
  return (
    <>
      <DemoProspectEntry {...session} tone={tone} />
      <DevAccounts {...session} tone={tone} columns={mode === "split" ? 2 : 1} />
      <GalleryLink />
    </>
  );
}
