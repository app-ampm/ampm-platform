import { errors } from "@ampm/core";

import { defineStories } from "../../stories/define";
import { Button } from "../button";
import { Stack } from "../layout";
import { QueryErrorState } from "./query-error-state";

const noop = () => undefined;

export const stories = defineStories({
  title: "Query errors",
  stories: [
    {
      name: "Offline",
      description: "The request never reached the API: the peacock offline state, with a retry.",
      render: () => <QueryErrorState error={errors.network()} onRetry={noop} />,
    },
    {
      name: "Signed out",
      description: "A 401 with the gold way back to sign-in; the app navigates in onSignIn.",
      render: () => <QueryErrorState error={errors.unauthenticated()} onSignIn={noop} />,
    },
    {
      name: "Signed out, in the screen's words",
      render: () => (
        <QueryErrorState
          error={errors.unauthenticated()}
          onSignIn={noop}
          signIn={{
            title: "Sign in to view leads",
            description: "Your session has ended. Sign in again to continue.",
          }}
        />
      ),
    },
    {
      name: "Not found",
      description: "A 404 the screen gives a meaning: nothing to retry.",
      render: () => (
        <QueryErrorState
          error={errors.notFound()}
          onRetry={noop}
          notFound={{ title: "Lead not found", description: "It may have been removed." }}
        />
      ),
    },
    {
      name: "Refused for the role",
      description: "A 403 the screen gives a meaning: a role without the grant.",
      render: () => (
        <QueryErrorState
          error={errors.forbidden()}
          onRetry={noop}
          forbidden={{ title: "Not available for your role" }}
        />
      ),
    },
    {
      name: "Any other failure",
      description:
        "Also a 401, 404 or 403 the screen gives no meaning: the generic error, never the raw message.",
      render: () => <QueryErrorState error={errors.internal()} onRetry={noop} />,
    },
    {
      name: "Any other failure, with a way out",
      description: "The account screens keep sign-out under the error while the account is unread.",
      render: () => (
        <Stack gap={3}>
          <QueryErrorState
            error={errors.internal()}
            onRetry={noop}
            errorFooter={
              <Button variant="secondary" icon="log-out" fullWidth onPress={noop}>
                Sign out
              </Button>
            }
          />
        </Stack>
      ),
    },
  ],
});
