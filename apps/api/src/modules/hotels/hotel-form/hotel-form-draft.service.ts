import { Injectable } from "@nestjs/common";
import {
  errors,
  HOTEL_CUISINE_OTHER,
  HOTEL_FACILITY_OPTIONS,
  HOTEL_FACILITY_OTHER,
  HOTEL_FORM_CAPS,
  HOTEL_FORM_SECTION_DRAFTS,
  hotelFormStateOf,
  isHotelFormSectionComplete,
  type HotelFormContributor,
  type HotelFormDraftRequest,
  type HotelFormDraftSections,
  type HotelFormDraftView,
  type HotelFormSectionAnswers,
  type HotelFormSectionKey,
} from "@ampm/core";
import type { z } from "zod";

import { ConfigService } from "../../admin/config/config.service.js";
import { HotelFormPeopleRepository, type ContributorRow } from "./hotel-form-people.repository.js";
import { HotelFormSectionsRepository, type SectionRow } from "./hotel-form-sections.repository.js";
import type { FormSession } from "./hotel-form-sessions.service.js";
import { linkClosesAt } from "./hotel-form-state.js";
import { formStatusOf, inForm } from "./hotel-form-submission-state.js";
import {
  HotelFormSubmissionsRepository,
  type FormSubmission,
} from "./hotel-form-submissions.repository.js";

/** Each section's draft, typed so a key's parse gives that section's answers. */
const DRAFTS: { readonly [K in HotelFormSectionKey]: z.ZodType<HotelFormSectionAnswers[K]> } =
  HOTEL_FORM_SECTION_DRAFTS;

type SectionView<K extends HotelFormSectionKey> = HotelFormDraftSections[K];

/**
 * A section as the draft answers it: a saved one read through its draft (a stored answer that no longer
 * reads is a fault, never shown as empty, so no save overwrites it unseen), an unsaved one at version 0.
 */
function sectionViewOf<K extends HotelFormSectionKey>(
  key: K,
  row: SectionRow | undefined,
): SectionView<K> {
  if (row === undefined) {
    const answers = DRAFTS[key].parse({});
    const isComplete = isHotelFormSectionComplete(key, answers, false);
    return {
      answers,
      version: 0,
      isComplete,
      noChanges: false,
      lastEditedBy: null,
      lastEditedAt: null,
    };
  }
  const answers = DRAFTS[key].safeParse(row.answers);
  if (!answers.success) throw errors.internal(`The saved ${key} section no longer reads`);
  return {
    answers: answers.data,
    version: row.version,
    // Counted on every read from the answers as stored, by the current schema: the stored flag is only
    // as current as its save.
    isComplete: isHotelFormSectionComplete(key, row.answers, row.noChanges),
    noChanges: row.noChanges,
    lastEditedBy: row.lastEditedBy,
    lastEditedAt: row.lastEditedAt.toISOString(),
  };
}

/**
 * A person helping as the caller sees them: by name and designation, unless another person who withdrew
 * their privacy notice consent, whom the page calls a colleague.
 */
function contributorOf(person: ContributorRow, session: FormSession): HotelFormContributor {
  const isYou = person.id === session.personId;
  if (!isYou && !person.isNamed) return { fullName: null, designation: null, isYou };
  return { fullName: person.fullName, designation: person.designation, isYou };
}

/** Every section, saved or not, in the form's model. */
function sectionsOf(rows: readonly SectionRow[]): HotelFormDraftSections {
  const byKey = new Map(rows.map((row) => [row.sectionKey, row]));
  const view = <K extends HotelFormSectionKey>(key: K): SectionView<K> =>
    sectionViewOf(key, byKey.get(key));
  return {
    property: view("property"),
    contact: view("contact"),
    rooms: view("rooms"),
    venues: view("venues"),
    booking_terms: view("booking_terms"),
    food_beverage: view("food_beverage"),
    fact_sheet_media: view("fact_sheet_media"),
  };
}

/** The request as the draft shows it: its reference, kind, status and state, and who submitted. */
function requestOf(request: FormSubmission): HotelFormDraftRequest {
  const status = formStatusOf(request);
  return {
    reference: request.reference,
    kind: request.kind,
    status,
    state: hotelFormStateOf(status),
    displayLabel: request.displayLabel,
    staffNote: request.staffNote,
    expiresAt: linkClosesAt(request).toISOString(),
    submittedAt: request.submittedAt?.toISOString() ?? null,
    submittedBy: request.submittedBy,
  };
}

/**
 * `GET /hotel-form/draft` (D-190 §3): what the hub, the section pages, the review page and the status page
 * draw from. Every section with its answers, version, completeness (counted on read), No changes and last
 * editor's name and time; the people helping, by name and designation (never a mobile; a colleague who
 * withdrew their privacy notice consent unnamed, as everywhere on the form); AMPM's label and note; the
 * request's reference, kind, status and state, and who submitted it and when; the caps; and the cuisine
 * choices (configuration `hotel.cuisine_options`) and facility choices, each with its Other. It reads
 * nothing from the catalogue (plan decision 16): the draft holds only what the hotel's people typed.
 */
@Injectable()
export class HotelFormDraft {
  constructor(
    private readonly submissions: HotelFormSubmissionsRepository,
    private readonly sections: HotelFormSectionsRepository,
    private readonly people: HotelFormPeopleRepository,
    private readonly config: ConfigService,
  ) {}

  async get(session: FormSession): Promise<HotelFormDraftView> {
    const [request, rows, people, cuisines] = await Promise.all([
      this.submissions.find(session.requestId),
      this.sections.list(session.requestId),
      this.people.contributors(session.requestId),
      this.config.get("hotel.cuisine_options"),
    ]);
    return {
      request: requestOf(inForm(request)),
      sections: sectionsOf(rows),
      contributors: people.map((person) => contributorOf(person, session)),
      caps: HOTEL_FORM_CAPS,
      options: {
        cuisines: { options: cuisines.options, other: HOTEL_CUISINE_OTHER },
        facilities: { options: [...HOTEL_FACILITY_OPTIONS], other: HOTEL_FACILITY_OTHER },
      },
    };
  }
}
