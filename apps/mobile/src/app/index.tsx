import { Gallery, Link, Stack } from "@ampm/ui";

/** The component gallery is the app's first screen until sprint 2; the account route shows `/me`. */
export default function GalleryScreen() {
  return (
    <Stack className="flex-1">
      <Gallery />
      <Stack className="absolute bottom-6 right-6">
        {/* Absolute: a floating shortcut to the /me screen over the gallery during the bootstrap. */}
        <Link
          href="/account"
          variant="standalone"
          className="rounded bg-surface-elevated px-3 shadow-md"
        >
          Account
        </Link>
      </Stack>
    </Stack>
  );
}
