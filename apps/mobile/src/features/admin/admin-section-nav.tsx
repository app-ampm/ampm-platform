import { useRouter } from "expo-router";

import { SegmentedControl, type SegmentedControlOption } from "@ampm/ui";

import { ADMIN_SECTIONS, type AdminSectionKey } from "./admin-sections";

const OPTIONS: readonly SegmentedControlOption[] = ADMIN_SECTIONS.map((section) => ({
  value: section.key,
  label: section.label,
}));

export interface AdminSectionNavProps {
  /** The section this page is: selected on the strip. */
  readonly current: AdminSectionKey;
}

/**
 * The settings sections as a pill strip (T12), for a section page's header `actions`: the current
 * section selected, another opening in its place (`replace`, so Back leaves the console rather than
 * walking every section visited). It scrolls sideways on a phone, where it spans the width under the
 * title. Beside the title on a tablet it is capped so the title keeps its room, the rest of the strip
 * a scroll away; from 1024 it shows every section.
 *
 *   <ScreenHeader title="Audit log" actions={<AdminSectionNav current="audit" />} />
 */
export function AdminSectionNav({ current }: AdminSectionNavProps) {
  const router = useRouter();
  const open = (key: string): void => {
    const section = ADMIN_SECTIONS.find((candidate) => candidate.key === key);
    if (section) router.replace(section.href);
  };
  return (
    <SegmentedControl
      accessibilityLabel="Settings sections"
      options={OPTIONS}
      value={current}
      onChange={open}
      size="sm"
      scrollable
      className="w-full md:w-auto md:max-w-64 lg:max-w-none"
      testID="admin-section-nav"
    />
  );
}
