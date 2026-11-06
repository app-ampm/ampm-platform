import { stories as button } from "../components/button/button.stories";
import { stories as callout } from "../components/callout/callout.stories";
import { stories as card } from "../components/card/card.stories";
import { stories as glass } from "../components/glass-panel/glass-panel.stories";
import { stories as icon } from "../components/icon/icon.stories";
import { stories as image } from "../components/image/image.stories";
import { stories as input } from "../components/input/input.stories";
import { stories as layout } from "../components/layout/layout.stories";
import { stories as link } from "../components/link/link.stories";
import { stories as moneyText } from "../components/money-text/money-text.stories";
import { stories as sheet } from "../components/sheet/sheet.stories";
import { stories as skeleton } from "../components/skeleton/skeleton.stories";
import { stories as states } from "../components/state-view/state-view.stories";
import { stories as statusChip } from "../components/status-chip/status-chip.stories";
import { stories as text } from "../components/text/text.stories";
import { stories as toast } from "../components/toast/toast.stories";
import type { StoryModule } from "./define";
import { stories as tokens } from "./tokens.stories";

/** The living catalogue, in reading order; the gallery renders it on web and native. */
export const allStories: readonly StoryModule[] = [
  tokens,
  text,
  glass,
  icon,
  layout,
  button,
  input,
  card,
  link,
  image,
  statusChip,
  callout,
  moneyText,
  skeleton,
  states,
  sheet,
  toast,
];

export { defineStories } from "./define";
export type { Story, StoryModule } from "./define";
