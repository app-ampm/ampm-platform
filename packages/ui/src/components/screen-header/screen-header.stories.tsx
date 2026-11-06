import { defineStories } from "../../stories/define";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { ScreenHeader } from "./screen-header";

const noop = () => undefined;

export const stories = defineStories({
  title: "ScreenHeader",
  stories: [
    {
      name: "One gold word (P1 sign in)",
      render: () => (
        <ScreenHeader
          title="Welcome"
          emphasis="back."
          subtitle="We sent a code to the number AMPM has for you."
        />
      ),
    },
    {
      name: "Eyebrow and trailing avatar (P2)",
      render: () => (
        <ScreenHeader
          eyebrow="Hello, Ananya"
          title="Find your venue"
          trailing={<Avatar name="Ananya Sharma" tone="highlight" />}
        />
      ),
    },
    {
      name: "Back button (P4)",
      render: () => (
        <ScreenHeader
          onBack={noop}
          eyebrow="Udaipur · Lake Pichola"
          title="Raj Niwas Palace"
          trailing={<Button variant="primary" icon="heart" accessibilityLabel="Save hotel" />}
        />
      ),
    },
    {
      name: "Admin greeting with an action (T1)",
      render: () => (
        <ScreenHeader
          eyebrow="Friday · 6 Nov 2026"
          title="Good morning, Eva."
          trailing={
            <Button variant="glass" size="sm" icon="bell">
              Alerts
            </Button>
          }
        />
      ),
    },
    {
      name: "Display size for wide pages",
      render: () => (
        <ScreenHeader
          size="display"
          eyebrow="Hello, Ananya"
          title="Where shall we look"
          emphasis="today?"
          subtitle="Udaipur, 12–14 Feb 2027, about 300 guests."
        />
      ),
    },
  ],
});
