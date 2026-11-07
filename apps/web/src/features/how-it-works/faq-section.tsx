import { cardStyles, cn, focusRingStyles, textStyles } from "@ampm/ui/styles";

import { SectionHeading } from "@/components/site";

import { FAQ_ITEMS, type FaqItem } from "./how-it-works-content";
import { FAQ_HEADING_ID } from "./how-it-works-ids";
import { BODY_TEXT } from "./how-it-works.styles";

/**
 * One question in a base glass panel: a native details and summary, so the keyboard (Tab, then Enter
 * or Space) and screen readers get the disclosure without script, with the browser's own marker.
 * It opens with the answer showing, as the mock draws every answer; from a tablet the question and
 * the answer sit side by side (the mock's 1fr / 1.4fr as halves) and a folded question takes the
 * full width. Browsers that cannot lay out a details element as a grid stack the two.
 */
function FaqQuestion({ item }: { readonly item: FaqItem }) {
  return (
    <details
      open
      className={cn(
        cardStyles({ padding: "none" }),
        "group block px-5.5 py-3 md:grid md:grid-cols-2 md:gap-x-10 md:px-9 md:py-5",
      )}
    >
      <summary
        className={cn(
          textStyles({ variant: "heading" }),
          "cursor-pointer rounded border border-transparent py-2.5 md:col-span-2 md:group-open:col-span-1",
          "transition-colors duration-base hover:text-brand motion-reduce:transition-none",
          // The browser's own disclosure marker, smaller and in pearl 58% beside the Gilda question.
          "marker:text-sm marker:text-muted",
          focusRingStyles,
        )}
      >
        {item.question}
      </summary>
      <p className={cn(BODY_TEXT, "pb-2.5 pt-1 md:py-2.5 md:text-lg")}>{item.answer}</p>
    </details>
  );
}

/** "Questions" (W2): three answers to what people ask before they subscribe. */
export function FaqSection() {
  return (
    <section aria-labelledby={FAQ_HEADING_ID} className="flex flex-col gap-3 md:gap-3.5">
      <SectionHeading id={FAQ_HEADING_ID} className="px-1.5 pb-2 md:px-0 md:pb-4.5">
        Questions
      </SectionHeading>
      {FAQ_ITEMS.map((item) => (
        <FaqQuestion key={item.question} item={item} />
      ))}
    </section>
  );
}
