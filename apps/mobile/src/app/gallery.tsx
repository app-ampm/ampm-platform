import { Gallery, Link, Row } from "@ampm/ui";

/**
 * The component gallery (the bootstrap showcase); reachable from the sign-in screen. Its shortcuts sit
 * in the Screen's sticky glass footer, which keeps them clear of the home indicator and keeps room for
 * them at the end of the scroll, so they never cover the last stories.
 */
export default function GalleryRoute() {
  return (
    <Gallery
      footer={
        <Row gap={2} justify="end">
          <Link href="/account" variant="nav" className="px-3">
            Account
          </Link>
          <Link href="/field-notes" variant="nav" className="px-3">
            Field notes
          </Link>
        </Row>
      }
    />
  );
}
