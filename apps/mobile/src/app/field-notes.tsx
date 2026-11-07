import { FieldNotesScreen } from "@/features/field-notes/field-notes-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

/**
 * The staff workspace's Tasks area: the sprint 2 offline spike (docs/review/build-plan.md §11.4)
 * until the real task screens replace it.
 */
export default function FieldNotesRoute() {
  return <FieldNotesScreen tabBar={<AppTabBar />} />;
}
