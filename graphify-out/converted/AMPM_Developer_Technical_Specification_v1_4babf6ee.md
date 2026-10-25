<!-- converted from AMPM_Developer_Technical_Specification_v1.docx -->

AMPM
DEVELOPER TECHNICAL SPECIFICATION
Functional scope • Screen flows • Data model • Permissions • Acceptance criteria
Version 1.0 | 20 October 2026 | Private & Confidential
Purpose: provide one coherent starting specification for AMPM’s connected wedding platform. Subscription prices, service fees, legal terms, integrations and final visual design remain decisions for AMPM.

# 1. Product definition
AMPM is a connected wedding-planning and management platform covering the journey from enquiry and paid hotel discovery through optional hotel consultancy, complete wedding planning, guest management, on-site execution and final closure. It is not merely a public hotel or vendor directory.
## 1.1 Four connected experiences
| Experience | Purpose | Access rule |
| --- | --- | --- |
| Public website | Explain AMPM, showcase approved work, capture enquiries, explain demo/subscription. | Public pages only; no unrestricted private database access. |
| Client portal | Hotel discovery for subscribers; wedding workspace for engaged clients. | Access depends on subscription, service agreement and project permissions. |
| AMPM team workspace | Manage leads, hotels, projects, vendors, budgets, guests, approvals and execution. | Role-based and project-scoped access. |
| Guest RSVP portal | Collect invited guests’ RSVP and relevant travel/accommodation information. | Wedding-specific access; no viewing other guests’ private records. |

## 1.2 Business journey
- Lead arrives through website, Instagram, advertisement, referral, call or another source.
- AMPM shares an introduction and demo. Demo access is controlled and limited.
- Client purchases hotel-discovery subscription; access activates after payment confirmation.
- Client explores Indian wedding destinations and curated hotels, saves favourites and requests information.
- Client may separately request availability checks, price negotiation, site visits and booking assistance.
- If the client engages AMPM for broader services, record scope, fees, agreement and payment status, then create a wedding project.
- Hotel contracting, creative design, save-the-dates and RSVP can proceed in parallel where appropriate.
- AMPM presents relevant vendor options—aiming for 5–10 per category where suitable options exist—and coordinates decisions.
- The project connects budgets, functions, design, invitations, RSVP, menus, vendors, rooms, transport, production and hospitality.
- AMPM tracks execution, departures, checkout, vendor closure and final accounts before closing the project.
Critical rule: hotel-discovery subscription does not automatically activate full wedding management. Clients may select only the services they want.
# 2. Screen map and user flows
## 2.1 Public website
| Screen | Main content/actions | Outcome |
| --- | --- | --- |
| Home | AMPM positioning, services, selected visuals and enquiry/demo CTA. | Enquiry/demo request. |
| How it works | Explain hotel discovery, optional consultancy and complete management separately. | Clear understanding of service stages. |
| Destinations / selected work | Approved public examples only; content managed by AMPM. | Build confidence without exposing private data. |
| Services | Hotel assistance, design, vendor coordination and full management. | Service enquiry. |
| Enquiry form | Name, contact, contact preference, tentative dates/destination, guest estimate, source/consent. | Lead record in CRM. |
| Demo / subscription | Demo access, plan inclusions, fee, term and AMPM-approved terms. | Controlled demo or payment journey. |

## 2.2 Client portal: hotel discovery
- Sign in/account activation.
- Subscriber home: search destinations, recent searches, saved hotels and enquiry status.
- Destination list and detail.
- Hotel search/filter results.
- Hotel detail: profile, images/videos, rooms, venues/capacity, facilities, wedding references and last-verified commercial information.
- Compare hotels and save favourites.
- Request hotel assistance with dates, guest estimate, room requirements and preferred contact method.
- Track availability enquiry, negotiation, site visit, proposal and booking-assistance status.
## 2.3 Client portal: engaged wedding client
- Wedding dashboard: dates, destination/hotel, milestones, pending decisions, permitted budget summary and upcoming tasks.
- Wedding overview and authorised family/decision-maker contacts.
- Functions list and function workspaces.
- Budget summary showing only approved client-facing fields.
- Vendor options by category, portfolio, proposal and decision actions.
- Design studio with concepts, moodboards, renders, comments, revisions and approvals.
- Invitations/save-the-dates with version and distribution status.
- RSVP progress and authorised guest views.
- Menus and food-service approvals.
- Shared documents, schedules, AMPM contacts and notifications.
## 2.4 AMPM team workspace
| Area | Core screens |
| --- | --- |
| Home | Team dashboard, upcoming weddings, overdue tasks, pending approvals and alerts. |
| Leads / Clients | Lead pipeline, follow-up history, account/subscription and service engagement. |
| Hotels | Destinations, hotel profiles, rooms, venues, media, verification, enquiries, visits and negotiations. |
| Weddings | Project dashboard, functions, budgets, vendors, designs, guest operations, documents and closure. |
| Guests | Guest database, RSVP calls, family groups, attendance, rooming, travel and support requests. |
| Vendors | Vendor master, category, portfolio, quotes, availability, contracts and project assignments. |
| Tasks / Operations | Tasks, staffing, run-of-show, production readiness, incidents and event-day status. |
| Finance / Reports | Permitted payment records, budget variance, invoices, reconciliation and exports. |
| Settings | Users, roles, permissions, packages, statuses, categories, notifications and audit logs. |

## 2.5 Guest RSVP flow
- Guest opens a wedding-specific link and sees the relevant invitation/context.
- Guest confirms contact details and family group as needed.
- Guest responds for themselves and authorised accompanying family members.
- Guest confirms attendance for each invited function.
- Guest provides relevant travel and accommodation information if requested.
- Guest submits; system confirms submission and provides a contact route.
- AMPM RSVP team reviews/follows up and records call-assisted responses in the same database.
Privacy: do not require Aadhaar/passport uploads for every guest by default. Collect identity documents only for a defined necessary use case, make collection conditional and restrict access.
# 3. Module inventory
| Module | Core records | Outcome |
| --- | --- | --- |
| CRM/subscriptions | Lead, contact, account, subscription, payment, service agreement | Lead conversion and access control. |
| Hotel intelligence | Destination, hotel, room category, inventory snapshot, venue, media, verification | Curated discovery with freshness labels. |
| Hotel consultancy | Availability enquiry, response, negotiation, site visit, proposal, booking milestone | Traceable hotel assistance. |
| Wedding project | Project, client contacts, scope, team assignment | Single source of truth per wedding. |
| Budget/finance | Budget category/line, quote, contract, invoice, payment, cost entry | Estimate, approval, actuals and variance. |
| Functions | Function, schedule, checklist, venue, run-of-show | Function-level plans connected to wedding. |
| Creative/approvals | Design brief, version, comment, approval, change request | Versioned creative decisions. |
| Vendors | Vendor, category, portfolio, proposal, assignment, scope, contract | Curated vendor options and delivery tracking. |
| Invitations/RSVP | Invitation, recipient, guest, family group, response, attendance | Invitation-to-attendance workflow. |
| Rooms/logistics/hospitality | Room allocation, travel segment, transfer, vehicle, request/ticket | Guest movement and support. |
| Food/entertainment/production | Menu version, artist booking, technical rider, production item, readiness check | Function readiness. |
| Tasks/risk | Task, dependency, staff assignment, incident, resolution | Operational accountability. |
| Closure | Departure record, lost-and-found item, vendor completion, final account | Formal closeout. |
| Administration | User, role, permission, notification, audit event, configuration | Secure configurable operation. |

# 4. Suggested relational data model
Use a relational database for structured records and secure file/object storage for media. This is a logical model; the developer should finalise SQL types, indexes, constraints and migrations during technical design.
| Entity/table | Key fields | Relationships |
| --- | --- | --- |
| users | id, name, email, phone, status | Roles and project assignments. |
| roles / permissions | role_id, permission_key, scope | Many-to-many user-role assignments. |
| leads | id, source, status, contact, requirements, owner_user_id | Can convert to client account. |
| client_accounts | id, primary_contact_id, status | Subscriptions, service agreements, projects. |
| subscriptions | id, account_id, plan_id, status, starts_at, ends_at | Controls hotel-discovery entitlement. |
| payments | id, account/project_id, purpose, amount, currency, status, provider_ref | Subscription/service/vendor payment record. |
| service_agreements | id, account_id, service_type, scope, fee, terms_version, status | Determines service access. |
| destinations | id, name, region, country, status | Has many hotels. |
| hotels | id, destination_id, profile, address, contact, status | Rooms, venues, media, verification history. |
| hotel_rooms / venues | id, hotel_id, category/type, capacity, facilities | May be proposed for a wedding. |
| hotel_verifications | id, hotel_id, field_group, verified_at, source, status | Freshness of price/facility information. |
| hotel_enquiries | id, account/project_id, hotel_id, dates, guest_count, status | Responses, visits, proposals, negotiation events. |
| wedding_projects | id, account_id, dates, destination_id, hotel_id, status | Parent for wedding records. |
| project_members | project_id, user_id, project_role, access_scope | Project-specific access. |
| functions | id, project_id, name, date/time, venue, guest_estimate, status | Budget, vendors, design, menu, schedule. |
| budget_lines | id, project_id, function_id, category_id, estimate, approved_amount, actual_amount | Links to quote/contract/invoice/payment. |
| vendors | id, name, category_id, contact, service_area, status | Portfolio, proposals and assignments. |
| vendor_assignments | id, project_id, function_id, vendor_id, scope, status | Links vendor to project/function. |
| vendor_proposals | id, assignment_id, version, client_visible_amount, internal_cost, status | Client and internal fields protected separately. |
| contracts / invoices | id, project_id, assignment_id, amount, due_date, status, document_ref | May link to payments. |
| design_items / versions | id, project_id, function_id, category, version, file_refs, status | Revision and approval history. |
| approvals | id, record_type/id, version_id, decision, user_id, timestamp | Decision tied to exact version. |
| guests | id, project_id, family_group_id, name, contact, restricted fields | One master guest record per wedding. |
| guest_function_attendance | guest_id, function_id, status, party_count | Attendance per function. |
| rsvp_responses | id, guest_id, channel, response, submitted_at, captured_by | Self-service or AMPM-assisted. |
| travel_segments / transfers | id, guest/group_id, mode, pickup, destination, time, status | Feeds transport planning. |
| room_allocations | id, project_id, guest/group_id, hotel_id, room_type, dates, status | Rooming/check-in/checkout. |
| menus / versions | id, function_id, version, status, submitted_by | Versioned menu and approval. |
| run_of_show_items | id, function_id, start/end, cue, owner, status, actual_times | Live execution timeline. |
| tasks / incidents | id, project_id, owner, due_at/severity, status, outcome | Accountability and response. |
| documents / media | id, owner_type/id, file_ref, visibility, version, uploader | Access follows owning record. |
| audit_events | id, actor_id, action, entity_type/id, timestamp, metadata | Important change history. |

Security note: internal cost, margin, private notes and identity-document references must be separately protected or guarded by strict server-side field permissions. Never send restricted data to a client and merely hide it in the interface.
# 5. Field specification pattern
For every field, maintain: field name, type, options/validation, who can edit, client/internal visibility, requiredness by stage, automation and report impact. Avoid making all fields mandatory at project creation.
| Field | Type/validation | Who edits | Visibility | Requiredness/automation |
| --- | --- | --- | --- | --- |
| Wedding project name | Text; non-empty; unique ID generated separately | AMPM admin/project lead | Client + assigned team | Required on project creation. |
| Wedding date range | Dates; end not before start | AMPM; client may request changes | Client + assigned team | Tentative allowed early; updates milestone views. |
| Guest estimate | Non-negative integer; estimated/confirmed flag | AMPM/client per permission | Client + assigned team | Optional at lead stage; feeds planning. |
| Hotel verification date | Timestamp, verifier and source | Hotel team/admin | Freshness label may be client-facing | Required for verified price claims; flags stale records. |
| Vendor decision | Interested/shortlisted/selected/declined | Client and AMPM per workflow | Client + assigned team | Selection links vendor to project. |
| Approval decision | Approved/revision requested/rejected | Authorised approver | Client + relevant team | Approval locks exact version. |
| Identity document | Secure file reference; conditional accepted types | Guest/authorised staff | Restricted | Never universally required; audit access and retention. |

# 6. User roles and permissions
| Role | Permitted scope |
| --- | --- |
| AMPM Super Admin | System configuration, users, master data and permissions. |
| Sales / Relationship Manager | Leads, demos, accounts, subscriptions and service engagement. |
| Hotel / Destination Team | Hotel database, availability, site visits, proposals and booking assistance. |
| Wedding Project Manager | Assigned wedding, functions, budgets, tasks and coordination. |
| Creative / Design Team | Assigned design work, references, revisions and approvals. |
| Vendor Coordinator | Vendor profiles, proposals, contracts, assignments and deliverables. |
| RSVP / Guest Team | Authorised guest details, RSVP calls, attendance, travel and rooming. |
| Hospitality / Logistics Team | Assigned guest support, transport, rooming and schedules. |
| Finance / Accounts | Authorised budgets, invoices, payments and reconciliation. |
| Client / Family Decision-Maker | Own project’s approved information, proposals and decisions. |
| Guest | Own RSVP response and authorised submission fields only. |

## 6.1 Client vs internal visibility
- Client-facing: hotel profiles, approved proposals, relevant vendor details, designs, menus, invitations, approved budget views, shared documents and authorised project progress.
- Internal-only by default: confidential negotiations, internal cost/margins, candid vendor ratings, staff notes, internal risk assessments, draft proposals and other clients’ data.
- Backend APIs and file storage must enforce access; hiding frontend controls is not sufficient.
# 7. Statuses and workflow rules
| Object | Suggested statuses | Rule |
| --- | --- | --- |
| Lead | New, contacted, introduction shared, demo offered/accessed, follow-up, converted, closed | Record owner and timestamp. |
| Subscription | Pending payment, active, expiring, expired, suspended, cancelled | Entitlements follow confirmed payment/status. |
| Hotel enquiry | Draft, submitted, awaiting hotel, response received, negotiating, visit scheduled, proposal received, client decision, confirmed, closed | Enquiry is not a confirmed booking. |
| Wedding project | Setup, planning, approvals, pre-production, ready, live execution, closure, closed, on hold | Project status does not replace task/function statuses. |
| Approval | Draft, submitted, revision requested, approved, rejected, superseded | Tie to exact version. |
| Task | Not started, in progress, blocked, completed, cancelled | Overdue tasks can trigger reminders. |
| Room allocation | Requested, proposed, confirmed, checked in, checked out, cancelled | Keep change history. |
| Function readiness | Not started, in progress, blocked, ready, live, completed | Required checklist or documented authorised exception. |
| Incident | Open, assigned, in progress, escalated, resolved, closed | Critical incident needs resolution record. |
| Wedding closure | Open items, departure, vendor reconciliation, final accounts, closure review, closed | Use configured closure checklist. |

# 8. Notifications and automation
- Payment confirmation activates only the purchased entitlement.
- Stale hotel pricing/availability is flagged after configurable verification age.
- Approval requests notify authorised decision-makers and assigned staff.
- Material changes flag affected budgets, contracts, tasks and run-of-show items.
- RSVP changes recalculate attendance and flag relevant menu/room/transport impacts.
- Room or transfer changes notify authorised logistics/hospitality staff.
- Overdue tasks, unpaid milestones, unconfirmed vendors and incomplete readiness checks appear on dashboards.
- Critical incident alerts follow configurable escalation rules.
- Log notifications with recipient, channel, timestamp and delivery status where available.
# 9. Reports and exports
- Lead source and conversion funnel; subscription status and payment history.
- Hotel shortlist, enquiries, site visits and booking milestones.
- Wedding progress, upcoming deadlines and approval tracker.
- Budget estimate, approved commitments, payments, actual cost and variance.
- Vendor selection, contracts, deliverables and payment status.
- RSVP progress, function attendance, rooming and arrival/departure manifests.
- Function schedules, run-of-show and production readiness.
- Overdue tasks, incidents, final reconciliation and closure report.
Exports must respect permissions. Sensitive guest, identity, medical, commercial and finance data must not be included by default.
# 10. Technical and non-functional requirements
- Responsive desktop, tablet and mobile interface.
- Shared backend with separate user experiences and permission boundaries.
- Secure authentication; role-based and project-scoped access.
- Server-side validation and authorisation for every protected request.
- Encryption in transit and appropriate encryption at rest.
- Private file storage with authorised/expiring links where appropriate.
- Audit trail for approvals, financial changes, permissions and important edits.
- Backups and tested restoration process.
- Search, filters, pagination and bulk operations for large guest/vendor lists.
- Media optimisation and controlled video delivery.
- Configurable packages, categories, statuses and pricing; avoid hard-coded commercial rules.
- Clear errors, duplicate-submission prevention and safe form recovery.
- Data retention/deletion rules and privacy notice approved by AMPM.
- Documented integration boundaries for payment, email, messaging and external hotel systems.
# 11. Recommended implementation phases
| Phase | Scope | Exit criteria |
| --- | --- | --- |
| 1. Foundation | Website/CRM, accounts/subscriptions, hotel database, search, shortlist and hotel enquiry. | Lead-to-subscriber journey tested; private data protected. |
| 2. Wedding planning | Project, functions, budgets, vendors, design versions, approvals, contracts and client dashboard. | A sample wedding can be planned and approved end to end. |
| 3. Guest operations | RSVP, guest database, attendance, rooming, transport, menus and hospitality. | Guest data flows into operational reports. |
| 4. Live execution | Run-of-show, readiness, artist management, staffing, incidents, departure and final accounts. | Simulated event can be managed through closure. |
| 5. Stabilisation | Security, performance, backups, accessibility, reports and user acceptance tests. | Critical defects resolved; launch checklist signed. |

# 12. Acceptance test scenarios
- Public enquiry saves source and owner; team tracks follow-up.
- Subscription activates hotel discovery without exposing full wedding modules.
- Demo account cannot access records outside demo scope.
- Hotel search shows freshness of pricing; unverified availability is not shown as confirmed.
- AMPM records negotiation and site visit without exposing internal notes.
- Engaged client receives correct project and permissions.
- Multiple functions have independent vendors, schedules, budgets and approvals.
- Vendor shortlist permits fewer than five options when fewer are suitable; it does not require exactly ten.
- Approval refers to exact design/menu/proposal version; revisions do not overwrite it.
- Self-service and AMPM-assisted RSVP update the same guest database without duplicates.
- Attendance changes update totals and flag downstream planning impacts.
- Unauthorised users cannot access restricted data by changing URLs, API requests or file links.
- Production readiness cannot be completed without required checks or an authorised exception.
- Incidents can be assigned, escalated and closed with resolution notes.
- Closure checks departure, lost-and-found, vendor completion and financial reconciliation.
# 13. Decisions AMPM must confirm before implementation
| Decision | Confirmation required |
| --- | --- |
| Commercial plans | Subscription fee, term, renewal, expiry and final cancellation/refund wording. |
| Service catalogue | Standalone services, package inclusions, fees and access rules. |
| Approvals | Who approves for the couple/family; whether multiple approvals are required. |
| Financial visibility | Which amounts clients see: vendor quote, negotiated quote, AMPM fee, tax and payment details. |
| Hotel data governance | Who enters/verifies data, verification cadence and media publication rights. |
| Guest communications | Selected email, SMS and messaging integrations. |
| Identity documents | Use cases, authorised access, retention and deletion. |
| Languages/currency | Initial language/currency and international expansion timing. |
| Technology ownership | Hosting, source-code ownership, maintenance and support responsibility. |
| Launch scope | Which phases are in the initial budget versus later releases. |

# 14. Deliverables expected from the development team
- Screen-by-screen wireframes for website, client portal, AMPM workspace and guest RSVP portal.
- User-flow diagrams for subscription, hotel assistance, wedding engagement, RSVP and execution.
- Approved database ER diagram and schema/migration documentation.
- Module-wise field matrix: type, options, requiredness, editor, visibility, validation and automation.
- Role/permission matrix, including financial and guest-data restrictions.
- Technical architecture and integration plan.
- Milestone schedule, cost estimate and exclusions.
- Test cases mapped to acceptance criteria.
- Deployment, backup, maintenance and handover documentation.
# 15. Final product instruction
Build AMPM as one connected wedding-management platform. Keep hotel discovery, optional hotel consultancy and complete wedding management as distinct but connected service stages. Once a full wedding project is active, connect creative planning, budgets, vendors, RSVP, accommodation, transport, hospitality and on-ground execution to the same project record. Do not create one giant mandatory form: capture information when relevant, reuse records, allow parallel work and keep client views simple while giving AMPM staff detailed operational controls.
Before full implementation begins, review and sign off the user flows, role/permission matrix, field matrix, wireframes and database schema.