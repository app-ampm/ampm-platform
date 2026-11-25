import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/*
 * Reading the fields' markup in tests: each field is rendered as the server sends it, and its tags are
 * found by an attribute whatever order React writes the attributes in. Imported by tests only.
 */

/** A field as the server renders it. */
export function markupOf(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

/** The opening tags of one element type that carry `attribute`, in document order. */
export function tagsWith(html: string, element: string, attribute: string): string[] {
  return [...html.matchAll(new RegExp(`<${element}[^>]*>`, "g"))]
    .map((match) => match[0])
    .filter((tag) => tag.includes(attribute));
}

/** Does nothing: the fields are rendered, never changed, in these tests. */
export const noop = (): undefined => undefined;
