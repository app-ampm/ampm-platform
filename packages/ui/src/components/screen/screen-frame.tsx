import { createContext, useContext, type ReactNode } from "react";

/**
 * What a screen sits in on a wide window: the portal's top navigation (the D and C artboards), the
 * workspace's rail (the T artboards), or nothing (sign-in, the gallery, a phone with its tab bar).
 */
export type ScreenFrame = "none" | "topNav" | "rail";

const ScreenFrameContext = createContext<ScreenFrame>("none");

export interface ScreenFrameProviderProps {
  readonly frame: ScreenFrame;
  readonly children?: ReactNode;
}

/**
 * Tells the screens below what navigation surrounds them, so `Screen`'s `wide` and `split` pages take
 * the artboards' gutters: 72 or 32 at the sides under the top navigation, 18 and 30 beside the rail.
 * The app's chrome provides it; a screen outside it is in no frame.
 *
 *   <ScreenFrameProvider frame={audience === "staff" ? "rail" : "topNav"}>
 *     <Stack />
 *   </ScreenFrameProvider>
 */
export function ScreenFrameProvider({ frame, children }: ScreenFrameProviderProps) {
  return <ScreenFrameContext.Provider value={frame}>{children}</ScreenFrameContext.Provider>;
}

/** The frame the nearest `ScreenFrameProvider` names; "none" without one. */
export function useScreenFrame(): ScreenFrame {
  return useContext(ScreenFrameContext);
}
