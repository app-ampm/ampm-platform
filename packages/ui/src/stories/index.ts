import { stories as avatar } from "../components/avatar/avatar.stories";
import { stories as badge } from "../components/badge/badge.stories";
import { stories as button } from "../components/button/button.stories";
import { stories as callout } from "../components/callout/callout.stories";
import { stories as card } from "../components/card/card.stories";
import { stories as checkbox } from "../components/checkbox/checkbox.stories";
import { stories as confirmSheet } from "../components/confirm-sheet/confirm-sheet.stories";
import { stories as dataTable } from "../components/data-table/data-table.stories";
import { stories as filterChip } from "../components/filter-chip/filter-chip.stories";
import { stories as glass } from "../components/glass-panel/glass-panel.stories";
import { stories as glowBackdrop } from "../components/glow-backdrop/glow-backdrop.stories";
import { stories as icon } from "../components/icon/icon.stories";
import { stories as image } from "../components/image/image.stories";
import { stories as input } from "../components/input/input.stories";
import { stories as internalPanel } from "../components/internal-panel/internal-panel.stories";
import { stories as layout } from "../components/layout/layout.stories";
import { stories as link } from "../components/link/link.stories";
import { stories as listItem } from "../components/list-item/list-item.stories";
import { stories as loadMore } from "../components/load-more/load-more.stories";
import { stories as moneyText } from "../components/money-text/money-text.stories";
import { stories as navRail } from "../components/nav-rail/nav-rail.stories";
import { stories as offlineBanner } from "../components/offline-banner/offline-banner.stories";
import { stories as otpInput } from "../components/otp-input/otp-input.stories";
import { stories as photoPlaceholder } from "../components/photo-placeholder/photo-placeholder.stories";
import { stories as progressBar } from "../components/progress-bar/progress-bar.stories";
import { stories as queryErrorState } from "../components/query-error-state/query-error-state.stories";
import { stories as screenHeader } from "../components/screen-header/screen-header.stories";
import { stories as sectionError } from "../components/section-error/section-error.stories";
import { stories as screen } from "../components/screen/screen.stories";
import { stories as segmentedControl } from "../components/segmented-control/segmented-control.stories";
import { stories as select } from "../components/select/select.stories";
import { stories as sheet } from "../components/sheet/sheet.stories";
import { stories as skeleton } from "../components/skeleton/skeleton.stories";
import { stories as stat } from "../components/stat/stat.stories";
import { stories as states } from "../components/state-view/state-view.stories";
import { stories as statusChip } from "../components/status-chip/status-chip.stories";
import { stories as stepper } from "../components/stepper/stepper.stories";
import { stories as tabBar } from "../components/tab-bar/tab-bar.stories";
import { stories as text } from "../components/text/text.stories";
import { stories as toast } from "../components/toast/toast.stories";
import { stories as toggle } from "../components/toggle/toggle.stories";
import type { StoryModule } from "./define";
import { stories as tokens } from "./tokens.stories";

/**
 * The living catalogue, in reading order: foundations, actions and forms, status, surfaces, feedback,
 * then the screen scaffold and navigation. The gallery renders it on web and native.
 */
export const allStories: readonly StoryModule[] = [
  tokens,
  text,
  glass,
  icon,
  layout,
  button,
  link,
  filterChip,
  segmentedControl,
  input,
  otpInput,
  toggle,
  checkbox,
  select,
  statusChip,
  badge,
  card,
  listItem,
  dataTable,
  loadMore,
  internalPanel,
  stat,
  avatar,
  progressBar,
  stepper,
  callout,
  offlineBanner,
  moneyText,
  photoPlaceholder,
  image,
  skeleton,
  states,
  queryErrorState,
  sectionError,
  sheet,
  confirmSheet,
  toast,
  screenHeader,
  screen,
  tabBar,
  navRail,
  glowBackdrop,
];

export { defineStories } from "./define";
export type { Story, StoryModule } from "./define";
