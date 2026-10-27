import { Gallery, Link, Stack } from "@ampm/ui";

/** The component gallery is the app's first screen until sprint 2; the account route shows `/me`. */
export default function GalleryScreen() {
  return (
    <Stack className="flex-1">
      <Gallery />
      <Stack gap={2} className="absolute bottom-6 right-6">
        {/* Absolute: floating shortcuts over the gallery during the bootstrap. */}
        <Link
          href="/account"
          variant="standalone"
          className="rounded bg-surface-elevated px-3 shadow-md"
        >
          Account
        </Link>
        <Link
          href="/field-notes"
          variant="standalone"
          className="rounded bg-surface-elevated px-3 shadow-md"
        >
          Field notes
        </Link>
      </Stack>
    </Stack>
  );
}
