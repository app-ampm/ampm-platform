import { useMemo, type ReactNode } from "react";

import type { HotelFormDraftView, HotelFormSectionKey } from "@ampm/core";

import type { HotelFormSite } from "../hotel-form-provider";
import { BOOKING_TERMS_MODEL } from "./booking-terms.form";
import { BookingTermsSection } from "./booking-terms-section";
import { CONTACT_MODEL } from "./contact.form";
import { ContactSection } from "./contact-section";
import { FACT_SHEET_MODEL } from "./fact-sheet.form";
import { FactSheetSection } from "./fact-sheet-section";
import { foodBeverageModel } from "./food-beverage.form";
import { FoodBeverageSection } from "./food-beverage-section";
import { PROPERTY_MODEL } from "./property.form";
import { PropertySection } from "./property-section";
import { ROOMS_MODEL } from "./rooms.form";
import { RoomsSection } from "./rooms-section";
import { SectionScreen } from "./section-screen";
import { useSectionEditor } from "./use-section-editor";
import { VENUES_MODEL } from "./venues.form";
import { VenuesSection } from "./venues-section";

/** What a section's host gets: the form's shared state, the draft, and a new code asked for in place. */
export interface SectionHostProps {
  readonly site: HotelFormSite;
  readonly draft: HotelFormDraftView;
  readonly reverify: ReactNode;
}

function PropertyHost({ site, draft, reverify }: SectionHostProps) {
  const editor = useSectionEditor("property", PROPERTY_MODEL, site, draft);
  return (
    <SectionScreen sectionKey="property" draft={draft} editor={editor} reverify={reverify}>
      <PropertySection editor={editor} draft={draft} />
    </SectionScreen>
  );
}

function ContactHost({ site, draft, reverify }: SectionHostProps) {
  const editor = useSectionEditor("contact", CONTACT_MODEL, site, draft);
  return (
    <SectionScreen sectionKey="contact" draft={draft} editor={editor} reverify={reverify}>
      <ContactSection
        editor={editor}
        person={site.flow.me.data?.person}
        mobile={site.flow.state.claim.mobile}
        max={draft.caps.contacts}
      />
    </SectionScreen>
  );
}

function RoomsHost({ site, draft, reverify }: SectionHostProps) {
  const editor = useSectionEditor("rooms", ROOMS_MODEL, site, draft);
  return (
    <SectionScreen sectionKey="rooms" draft={draft} editor={editor} reverify={reverify}>
      <RoomsSection editor={editor} caps={draft.caps} />
    </SectionScreen>
  );
}

function VenuesHost({ site, draft, reverify }: SectionHostProps) {
  const editor = useSectionEditor("venues", VENUES_MODEL, site, draft);
  return (
    <SectionScreen sectionKey="venues" draft={draft} editor={editor} reverify={reverify}>
      <VenuesSection editor={editor} caps={draft.caps} />
    </SectionScreen>
  );
}

function BookingTermsHost({ site, draft, reverify }: SectionHostProps) {
  const editor = useSectionEditor("booking_terms", BOOKING_TERMS_MODEL, site, draft);
  return (
    <SectionScreen sectionKey="booking_terms" draft={draft} editor={editor} reverify={reverify}>
      <BookingTermsSection editor={editor} />
    </SectionScreen>
  );
}

function FoodBeverageHost({ site, draft, reverify }: SectionHostProps) {
  const other = draft.options.cuisines.other;
  const model = useMemo(() => foodBeverageModel(other), [other]);
  const editor = useSectionEditor("food_beverage", model, site, draft);
  return (
    <SectionScreen sectionKey="food_beverage" draft={draft} editor={editor} reverify={reverify}>
      <FoodBeverageSection editor={editor} draft={draft} />
    </SectionScreen>
  );
}

function FactSheetHost({ site, draft, reverify }: SectionHostProps) {
  const editor = useSectionEditor("fact_sheet_media", FACT_SHEET_MODEL, site, draft);
  return (
    <SectionScreen sectionKey="fact_sheet_media" draft={draft} editor={editor} reverify={reverify}>
      <FactSheetSection editor={editor} />
    </SectionScreen>
  );
}

const HOSTS: Readonly<Record<HotelFormSectionKey, (props: SectionHostProps) => ReactNode>> = {
  property: PropertyHost,
  contact: ContactHost,
  rooms: RoomsHost,
  venues: VenuesHost,
  booking_terms: BookingTermsHost,
  food_beverage: FoodBeverageHost,
  fact_sheet_media: FactSheetHost,
};

/**
 * A section's page with its own fields and editor, by its key.
 *
 *   <SectionHost key={sectionKey} sectionKey={sectionKey} site={site} draft={draft} reverify={null} />
 */
export function SectionHost({
  sectionKey,
  ...props
}: SectionHostProps & { readonly sectionKey: HotelFormSectionKey }) {
  const Host = HOSTS[sectionKey];
  return <Host {...props} />;
}
