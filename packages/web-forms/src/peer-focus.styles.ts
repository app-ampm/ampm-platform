/**
 * The kit's focus ring (gold border, gold 18% halo) on the visible part of a native control that is
 * hidden for sight but not for keyboards or screen readers (`peer sr-only`, just before the part):
 * the radios behind the pill choices and the checkboxes behind the Peacock Night boxes.
 *
 *   <input type="checkbox" className="peer sr-only" />
 *   <span aria-hidden className={cn(checkboxBoxStyles({ checked }), peerFocusRingStyles)} />
 */
export const peerFocusRingStyles = "peer-focus-visible:border-brand peer-focus-visible:shadow-halo";
