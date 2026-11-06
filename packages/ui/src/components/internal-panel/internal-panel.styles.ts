import { variants } from "../../lib/variants";
import { internalPanelStyles } from "../glass-panel/glass-panel.styles";

/**
 * The internal-only panel (T5's cost and margin, T6's internal notes): the dashed gold 50% stroke on
 * gold 6% from the glass recipes, radius 22, padding 16, its header 8 above the content.
 */
export const internalPanelBoxStyles = variants([
  "flex flex-col gap-2 rounded-lg p-4",
  internalPanelStyles,
]);
