import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Text } from "../text";
import { Link } from "./link";

export const stories = defineStories({
  title: "Link",
  stories: [
    {
      name: "Inline and standalone",
      render: () => (
        <Stack gap={3}>
          <Text>
            Read the <Link href="/">privacy notice</Link> before continuing.
          </Text>
          <Link href="/" variant="standalone">
            All hotels
          </Link>
          <Link href="https://expo.dev" external variant="standalone" tone="primary">
            Hotel website
          </Link>
        </Stack>
      ),
    },
  ],
});
