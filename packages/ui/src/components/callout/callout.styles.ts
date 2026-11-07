/**
 * The callout's frame on top of its glass recipe (`glassStyles` from glass-panel): a phone card's
 * radius 22, the icon beside the text, padding 14 × 16. `flex` keeps the row on the web's DOM too.
 *
 *   <div className={cn(glassStyles({ recipe: "gold" }), calloutStyles)}>…</div>
 */
export const calloutStyles = "flex flex-row items-start gap-3 self-stretch rounded-lg px-4 py-3.5";
