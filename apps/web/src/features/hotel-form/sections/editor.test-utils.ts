import type { SectionEditor } from "./use-section-editor";

/*
 * A section's editor at a state, doing nothing when asked, so a section's page renders (as the server
 * would send it) without the API or a session. Imported by tests only.
 */

const noop = (): undefined => undefined;

/** An editor holding `fields`, idle unless `overrides` say otherwise. */
export function editorAt<F>(
  fields: F,
  overrides: Partial<SectionEditor<F>> = {},
): SectionEditor<F> {
  return {
    fields,
    noChanges: false,
    isReadOnly: false,
    save: { kind: "idle" },
    problem: null,
    hasMarked: false,
    update: noop,
    setNoChanges: noop,
    errorOf: () => undefined,
    onBlur: noop,
    retry: noop,
    keepMine: noop,
    takeTheirs: noop,
    newKey: () => "0192f3a0-7d3e-4b1a-9c2f-000000000099",
    ...overrides,
  };
}
