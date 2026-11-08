import { errors } from "@ampm/core";

import { defineStories } from "../../stories/define";
import { SectionError } from "./section-error";

const noop = () => undefined;

export const stories = defineStories({
  title: "Section error",
  stories: [
    {
      name: "Failed load",
      description:
        "A detail sub-section whose query failed: the retryable error state under its heading.",
      render: () => <SectionError title="Subscriptions" error={errors.internal()} onRetry={noop} />,
    },
    {
      name: "Offline",
      description: "A network failure shows the offline state under the heading.",
      render: () => <SectionError title="Subscriptions" error={errors.network()} onRetry={noop} />,
    },
  ],
});
