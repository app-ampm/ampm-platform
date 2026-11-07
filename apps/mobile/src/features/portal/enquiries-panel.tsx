import { useRouter } from "expo-router";

import { EntryPanel } from "./entry-panel";

/** The way into the hotel-consultancy journey (Flow-2), for a client entitled to hotel assistance. */
export function EnquiriesPanel({ className }: { readonly className?: string | undefined }) {
  const router = useRouter();
  return (
    <EntryPanel
      heading="Enquiries"
      title="Your hotel requests"
      subtitle="Track your hotel requests, proposals and booking milestones."
      icon="clipboard"
      onPress={() => router.push("/portal/requests")}
      className={className}
    />
  );
}
