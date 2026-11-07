import type { ViewProps } from "react-native";

import type { GlassRecipeName } from "./glass-panel.styles";

export interface GlassPanelProps extends ViewProps {
  /** base for cards and panels, peacock for selected and verified, gold for live and needs-you. */
  readonly recipe?: GlassRecipeName | undefined;
  /**
   * Top-level panels blur what is behind them; a panel inside another panel passes `false` and gets
   * the flat fill only (only top-level panels blur).
   */
  readonly blur?: boolean | undefined;
  /** Radius and padding come in here (`rounded-xl p-6`); the default radius is the phone card's 22. */
  readonly className?: string;
}
