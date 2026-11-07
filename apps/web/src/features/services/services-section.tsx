import { Eyebrow, SectionHeading } from "@/components/site";

import { ServicePanel } from "./service-panel";
import { SERVICES } from "./services-content";
import { SERVICES_HEADING_ID } from "./services-ids";

/**
 * The page's opening (W3): the eyebrow and the hero heading with its gold trailing words, then the
 * four services, 96 below on a desktop and 56 on a phone. The heading names both, so the services'
 * list is labelled "What we take off your hands."
 */
export function ServicesSection() {
  return (
    <section aria-labelledby={SERVICES_HEADING_ID} className="flex flex-col gap-14 md:gap-24">
      <div className="flex flex-col gap-5 px-1.5 md:gap-6 md:px-0">
        <Eyebrow size="md">Services</Eyebrow>
        <SectionHeading
          as="h1"
          id={SERVICES_HEADING_ID}
          emphasis="take off your hands."
          className="text-5xl tracking-tight md:text-6xl lg:text-7xl"
        >
          What we
        </SectionHeading>
      </div>
      <ul aria-labelledby={SERVICES_HEADING_ID} className="flex flex-col gap-4 md:gap-5">
        {SERVICES.map((service, index) => (
          <ServicePanel key={service.number} service={service} isFlipped={index % 2 === 1} />
        ))}
      </ul>
    </section>
  );
}
