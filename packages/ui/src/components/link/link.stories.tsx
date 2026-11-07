import { defineStories } from "../../stories/define";
import { GlassPanel } from "../glass-panel";
import { Row, Stack } from "../layout";
import { Text } from "../text";
import { Link } from "./link";

export const stories = defineStories({
  title: "Link",
  stories: [
    {
      name: "Standalone",
      description: "Gold Manrope 700 on a 44px target; the arrow is part of the copy.",
      render: () => (
        <Stack gap={1}>
          <Link href="/" variant="standalone">
            Sign in →
          </Link>
          <Link href="/" variant="standalone" textVariant="label">
            Compare →
          </Link>
          <Link href="/" variant="standalone" tone="muted">
            Skip for now
          </Link>
        </Stack>
      ),
    },
    {
      name: "Inline",
      description: "Underlined in running text, so colour is never the only cue.",
      render: () => (
        <Text>
          Read the <Link href="/">privacy notice</Link> before continuing.
        </Text>
      ),
    },
    {
      name: "Navigation",
      description: "Pearl 80%, gold on hover, the focus halo on the web.",
      render: () => (
        <GlassPanel className="rounded-full px-6">
          <Row gap={6} wrap>
            <Link href="/" variant="nav">
              How it works
            </Link>
            <Link href="/" variant="nav">
              Destinations
            </Link>
            <Link href="/" variant="nav">
              Services
            </Link>
            <Link href="/" variant="nav">
              About
            </Link>
            <Link href="/" variant="nav" tone="muted" textVariant="bodySmall">
              Client sign-in
            </Link>
          </Row>
        </GlassPanel>
      ),
    },
    {
      name: "External",
      description: "Opens the browser; standalone and nav links show the external icon.",
      render: () => (
        <Stack gap={1}>
          <Link href="https://expo.dev" external variant="standalone">
            Hotel website
          </Link>
          <Link href="https://expo.dev" external variant="nav">
            Instagram
          </Link>
        </Stack>
      ),
    },
  ],
});
