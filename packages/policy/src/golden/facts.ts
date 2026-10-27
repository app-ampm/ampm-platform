import { FIELD_GROUPS, SIDES, SUBJECTS, type ConditionFacts } from "../conditions";

/*
 * Shared by the golden tables. The facts a table gives a conditioned grant are the whole of what
 * its note allows (every field of "attendance and dietary"), so each variant below must be
 * refused: a regenerated parse that drops or widens a condition then fails the table.
 */

function withoutItem<T>(items: readonly T[], index: number): readonly T[] {
  return items.filter((_, at) => at !== index);
}

function outside<T>(all: readonly T[], listed: readonly T[]): T | undefined {
  return all.find((item) => !listed.includes(item));
}

/** A list fact refused when emptied, or widened by one value the note does not name. */
function listVariants(facts: ConditionFacts): ConditionFacts[] {
  const variants: ConditionFacts[] = [];
  const { subjects, fields } = facts;
  if (subjects !== undefined && subjects.length > 0) {
    variants.push({ ...facts, subjects: [] });
    const extra = outside(SUBJECTS, subjects);
    if (extra !== undefined) variants.push({ ...facts, subjects: [...subjects, extra] });
  }
  if (fields !== undefined && fields.length > 0) {
    variants.push({ ...facts, fields: [] });
    const extra = outside(FIELD_GROUPS, fields);
    if (extra !== undefined) variants.push({ ...facts, fields: [...fields, extra] });
  }
  return variants;
}

/**
 * Facts that must not meet the grant the given facts meet: each check left out, the view or the
 * side left out or changed, and each list emptied or widened by one value outside it.
 *
 * @example
 * refusedVariants({ view: "summary", checks: ["approved"] });
 * // → [{ view: undefined, checks: ["approved"] }, { view: "summary", checks: [] }]
 */
export function refusedVariants(facts: ConditionFacts): ConditionFacts[] {
  const variants: ConditionFacts[] = [];
  const { side, view, checks = [] } = facts;
  if (side !== undefined) {
    variants.push({ ...facts, side: undefined });
    variants.push({ ...facts, side: outside(SIDES, [side]) });
  }
  if (view !== undefined) variants.push({ ...facts, view: undefined });
  checks.forEach((_, index) => variants.push({ ...facts, checks: withoutItem(checks, index) }));
  return [...variants, ...listVariants(facts)];
}
