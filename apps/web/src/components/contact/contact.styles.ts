/**
 * Layout and state classes the contact page's pieces share (PUB-06), next to the kit's recipes they
 * extend.
 */

/**
 * The kit's focus ring (gold border, gold 18% halo) on the visible part of a native control that is
 * hidden for sight but not for keyboards or screen readers (`peer sr-only`, just before the part):
 * the radios behind the pill choices and the checkboxes behind the Peacock Night boxes.
 */
export const peerFocusRingStyles = "peer-focus-visible:border-brand peer-focus-visible:shadow-halo";

/**
 * The fields' grid: two columns on a tablet (the form full width) and from 1280; one on a phone and
 * on a narrow desktop, where the form shares the row with the page's intro.
 */
export const formGridStyles = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2";

/** A field across the whole grid (dates, notes), whatever its column count. */
export const fullRowStyles = "md:col-span-2 lg:col-span-1 xl:col-span-2";
