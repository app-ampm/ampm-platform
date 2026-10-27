import { AccessibilityInfo } from "react-native";

/**
 * Spies on the iOS announcer that `useAnnounce` calls, cleared so a test counts only its own calls
 * (the preset's mock is shared across tests). Restore with `jest.restoreAllMocks()`.
 *
 *   const announce = spyOnAnnounce();
 *   await renderWithProviders(<ErrorState />);
 *   expect(announce).toHaveBeenCalledWith(expect.stringContaining("went wrong"), { queue: true });
 */
export function spyOnAnnounce(): jest.SpyInstance {
  const spy = jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions");
  spy.mockClear();
  return spy;
}
