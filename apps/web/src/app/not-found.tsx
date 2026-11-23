import type { Metadata } from "next";

import { NOT_FOUND_CONTENT } from "@/features/errors/errors-content";
import { NotFoundPage } from "@/features/errors/not-found-page";

export const metadata: Metadata = {
  title: NOT_FOUND_CONTENT.metaTitle,
  description: NOT_FOUND_CONTENT.body,
};

/** Every address without a page of its own, inside the site's frame (Next sends the 404 and noindex). */
export default function NotFound() {
  return <NotFoundPage />;
}
