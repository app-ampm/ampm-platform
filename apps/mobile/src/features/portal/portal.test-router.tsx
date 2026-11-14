import { cloneElement, type ReactElement } from "react";

export interface RouterStub {
  readonly push: (href: unknown) => void;
  readonly replace?: ((href: unknown) => void) | undefined;
  readonly back?: (() => void) | undefined;
}

interface StubLinkProps {
  readonly href: unknown;
  readonly children: ReactElement<{ onPress?: () => void }>;
}

/**
 * `expo-router` for the portal's tests: `useRouter` hands back the stub, and `Link` (the shared Link
 * renders Expo Router's with `asChild`) presses through to the same `push`, so a test asserts where a
 * link goes the way it asserts a button's navigation. The factory runs before the test's own `const`s
 * are set, so the stub's functions read the mocks when called, not when built.
 *
 *   const mockPush = jest.fn();
 *   jest.mock("expo-router", () =>
 *     jest
 *       .requireActual<typeof import("./portal.test-router")>("./portal.test-router")
 *       .expoRouterStub({ push: (href) => mockPush(href) }),
 *   );
 */
export function expoRouterStub(router: RouterStub) {
  return {
    useRouter: () => router,
    Link: ({ href, children }: StubLinkProps) =>
      cloneElement(children, { onPress: () => router.push(href) }),
  };
}
