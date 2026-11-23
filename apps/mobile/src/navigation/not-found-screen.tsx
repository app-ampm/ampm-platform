import { useCanGoBack, useRouter } from "expo-router";

import { EmptyState, Screen, ScreenHeader } from "@ampm/ui";

/** The not-found screen's words, kept together until the app's i18n replaces them. */
export const NOT_FOUND_COPY = {
  title: "Page not found",
  stateTitle: "This page isn't here",
  description: "The link may be out of date, or the page may have moved.",
  home: "Go to home",
} as const;

/**
 * Any address the app has no route for (expo-router's `+not-found`): a mistyped or out-of-date link,
 * or a page that moved. Back returns to where the person came from, when there is somewhere to go;
 * "Go to home" opens the entry route, which sends each person to their own home (their first
 * workspace area, the portal, or sign-in). The pearl compass, not the gold of an error: nothing
 * failed, the address just leads nowhere.
 *
 *   export default function NotFoundRoute() {
 *     return <NotFoundScreen />;
 *   }
 */
export function NotFoundScreen() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const header = (
    <ScreenHeader
      title={NOT_FOUND_COPY.title}
      onBack={canGoBack ? () => router.back() : undefined}
    />
  );
  return (
    <Screen header={header} testID="not-found-screen">
      <EmptyState
        icon="compass"
        title={NOT_FOUND_COPY.stateTitle}
        description={NOT_FOUND_COPY.description}
        action={{
          label: NOT_FOUND_COPY.home,
          variant: "primary",
          onPress: () => router.replace("/"),
        }}
      />
    </Screen>
  );
}
