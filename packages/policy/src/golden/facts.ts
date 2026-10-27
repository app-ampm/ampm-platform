import { FIELD_GROUPS, SIDES, SUBJECTS, VIEWS, type ConditionFacts } from "../conditions";

/*
 * Shared by the golden tables. The facts a table gives a conditioned grant are the whole of what
 * its note allows (every field of "attendance and dietary"), so each variant below must be
 * refused: a regenerated parse that drops or widens a condition then fails the table. A widening
 * is tried with every value outside the note, since a parse may widen by any one of them.
 */

function withoutItem<T>(items: readonly T[], index: number): readonly T[] {
  return items.filter((_, at) => at !== index);
}

function outside<T>(all: readonly T[], listed: readonly T[]): readonly T[] {
  return all.filter((item) => !listed.includes(item));
}

/** A list fact refused when emptied, or widened by any one value the note does not name. */
function listVariants(facts: ConditionFacts): ConditionFacts[] {
  const variants: ConditionFacts[] = [];
  const { subjects, fields } = facts;
  if (subjects !== undefined && subjects.length > 0) {
    variants.push({ ...facts, subjects: [] });
    for (const extra of outside(SUBJECTS, subjects)) {
      variants.push({ ...facts, subjects: [...subjects, extra] });
    }
  }
  if (fields !== undefined && fields.length > 0) {
    variants.push({ ...facts, fields: [] });
    for (const extra of outside(FIELD_GROUPS, fields)) {
      variants.push({ ...facts, fields: [...fields, extra] });
    }
  }
  return variants;
}

/**
 * Facts that must not meet the grant the given facts meet: each check left out, the view or the
 * side left out or changed to each other value, and each list emptied or widened by each value
 * outside it.
 *
 * @example
 * refusedVariants({ view: "summary", checks: ["approved"] });
 * // → [{ view: undefined, checks: ["approved"] }, { view: "status_only", checks: ["approved"] },
 * //    { view: "masked", checks: ["approved"] }, { view: "summary", checks: [] }]
 */
export function refusedVariants(facts: ConditionFacts): ConditionFacts[] {
  const variants: ConditionFacts[] = [];
  const { side, view, checks = [] } = facts;
  if (side !== undefined) {
    variants.push({ ...facts, side: undefined });
    for (const other of outside(SIDES, [side])) variants.push({ ...facts, side: other });
  }
  if (view !== undefined) {
    variants.push({ ...facts, view: undefined });
    for (const other of outside(VIEWS, [view])) variants.push({ ...facts, view: other });
  }
  checks.forEach((_, index) => variants.push({ ...facts, checks: withoutItem(checks, index) }));
  return [...variants, ...listVariants(facts)];
}
