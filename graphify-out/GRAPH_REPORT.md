# Graph Report - git-repo-setup-10512b  (2026-10-26)

## Corpus Check
- 2 files · ~143,116 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1660 nodes · 5055 edges · 64 communities (63 shown, 1 thin omitted)
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 901 edges (avg confidence: 0.89)
- Token cost: 105,976 input · 0 output

## Community Hubs (Navigation)
- Acceptance Tests and Traceability
- AMPM's Answers and Business Rules
- Technical Specification v1.0
- Vault and Decision Generators
- Containers, Integrations and Technology
- User Flows and Status Transitions
- Role and Permission Matrix
- Architecture Decisions and Delivery
- Specification Data Model and Phases
- Sign-in and RSVP Portal Screens
- Subscription and Customer Journey
- Specification Amendments and Rules
- Decisions on Accounts, RSVP and Requests
- Memory Hooks and Commit Automation
- Functions, Vendors and Tasks Tables
- Client Portal Request Loop
- Package Index and Vault
- Documents, Media and Audit Tables
- Technology and Operations Decisions
- Business Process and Account States
- Guest and Lead Screens
- Team App Flowchart and Operations
- Wedding Project, Rooms and Travel Tables
- Enquiry, Demo and Payment Findings
- Team Workspace Areas
- API Modules and Build Phases
- Guest RSVP Flow and Links
- Hotel Database and Rate Cards
- Open Decisions in the Brief
- Client Portal Approvals and Requests
- CRM, Subscription and Payment Tables
- Wedding Dashboards and Finance Screens
- Budget and Finance Tables
- Vault Sync Script
- Shared Page Builder
- Live Operations Screens
- Authorisation Pipeline and Security
- Public Website and Subscription Screens
- Background Jobs and Domain Events
- Hotel and Contract Tables
- Guest Identity and Privacy Decisions
- Field Matrix Generator
- Hotel Discovery Screens
- Identity, Access and Model Assumptions
- Platform, Subscription and Access Decisions
- Client-visible Finance Decision
- Hotel Data in the Brief
- Guest and RSVP Tables
- Requirements Audit and Sources
- Session Journal Script
- Approvals and Creative Tables
- Demo Mode, Phases and Roles
- Data Layer and Retention
- Hotel Data Findings
- Design Package Index
- Data Protection and Identity Documents
- Client Portal Flowchart (as supplied)
- Client Users and Roles Decisions
- Offline Operations and Readiness
- Requests, Threads and Live Chat
- Finance Visibility and Payments
- First Release Scope
- Website Content and Plans

## God Nodes (most connected - your core abstractions)
1. `wedding_projects` - 65 edges
2. `SPEC: AMPM Developer Technical Specification v1.0` - 58 edges
3. `AMPM Platform Data Model and ER Diagrams` - 57 edges
4. `Requirements Audit (requirements-audit.md)` - 57 edges
5. `T1 List and filter template` - 45 edges
6. `AMPM Management — Final App Decision Brief & Developer Requirements` - 42 edges
7. `Traceability matrix (criterion, source, tests, flows, screens, phase)` - 41 edges
8. `Permission Matrix (permission-matrix.md)` - 40 edges
9. `Suggested Relational Data Model (logical model; relational database for structured records plus secure object storage for media; developer finalises SQL types, indexes, constraints, migrations)` - 38 edges
10. `Wireframe specification (124 screens)` - 36 edges

## Surprising Connections (you probably didn't know these)
- `Change Requests (clients cannot directly alter approved items; AMPM reviews and accepts or rejects; an approved item that changes gets a new version with recorded approval)` --semantically_similar_to--> `Approval Tied to Exact Version (draft, submitted, revision requested, approved, rejected, superseded)`  [INFERRED] [semantically similar]
  reference_docs/answers/AMPM app brief updated answer.pdf → graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md
- `Department Teams (hotel team, vendor team, RSVP team, hospitality team, production team, project manager, senior authorised management)` --semantically_similar_to--> `User Roles and Permissions (Super Admin, Sales/Relationship Manager, Hotel/Destination Team, Wedding Project Manager, Creative/Design Team, Vendor Coordinator, RSVP/Guest Team, Hospitality/Logistics Team, Finance/Accounts, Client/Family Decision-Maker, Guest)`  [INFERRED] [semantically similar]
  reference_docs/answers/AMPM app brief updated answer.pdf → graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md
- `Developer Acceptance Checklist (first-release scenarios that must pass before approval)` --semantically_similar_to--> `Acceptance Test Scenarios (15 scenarios: enquiry capture, subscription scope, demo isolation, pricing freshness, private negotiation notes, project permissions, independent functions, vendor shortlist size, version-locked approvals, de-duplicated RSVP, attendance impacts, URL/API/file access control, readiness exceptions, incidents, closure checks)`  [INFERRED] [semantically similar]
  reference_docs/answers/AMPM app brief updated answer.pdf → graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md
- `Readiness Checks (a function cannot be marked ready with incomplete required checks unless an authorised manager records an exception; record unmet check, exception and reason, authorised person, date/time, resulting status; exception authority configurable)` --semantically_similar_to--> `Function Readiness Status (not started, in progress, blocked, ready, live, completed; requires the checklist or a documented authorised exception)`  [INFERRED] [semantically similar]
  reference_docs/answers/AMPM app brief updated answer.pdf → graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md
- `AMPM Team App and Department Access (individual authenticated staff accounts; role- and department-controlled; a department manager on mobile sees only the sections relevant to their work)` --semantically_similar_to--> `User Roles and Permissions (Super Admin, Sales/Relationship Manager, Hotel/Destination Team, Wedding Project Manager, Creative/Design Team, Vendor Coordinator, RSVP/Guest Team, Hospitality/Logistics Team, Finance/Accounts, Client/Family Decision-Maker, Guest)`  [INFERRED] [semantically similar]
  reference_docs/answers/AMPM app brief updated answer.pdf → graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **AMPM customer journey from public website to closure** — docs_review_decision_brief_journey_stage_public_website_learn_examples_request_a_demo, docs_review_decision_brief_journey_stage_demo_or_trial_granted_by_sales_expires, docs_review_decision_brief_journey_stage_subscription_ampm_invites_client_pays_hotel_discovery_opens, docs_review_decision_brief_journey_stage_hotel_discovery_and_assistance_search_verified_prices_enquiries_visits_proposals, docs_review_decision_brief_journey_stage_stays_a_subscriber_renews_or_expires_nothing_deleted, docs_review_decision_brief_journey_stage_wedding_project_functions_budget_vendors_designs_approvals, docs_review_decision_brief_journey_stage_guests_private_rsvp_link_per_household_rooms_travel, docs_review_decision_brief_journey_stage_wedding_day_readiness_checks_cue_sheet_incidents, docs_review_decision_brief_journey_stage_closure_checklist_final_accounts_feedback_archive [EXTRACTED 1.00]
- **Developer package behind the review** — docs_requirements_audit, docs_data_model, docs_permission_matrix, docs_field_matrix, docs_architecture, docs_user_flows, docs_wireframes, docs_test_cases [EXTRACTED 1.00]
- **AMPM's five source documents reviewed by the audit** — docs_review_annotated_brief_business_explanation, docs_review_annotated_brief_why_ampm_app_note, docs_review_annotated_brief_technical_specification_v1, docs_review_redesigned_flowcharts_team_app_as_supplied, docs_review_redesigned_flowcharts_client_portal_as_supplied [EXTRACTED 1.00]
- **Four connected experiences plus demo mode of one shared platform** — docs_review_annotated_brief_public_website, docs_review_annotated_brief_client_portal, docs_review_annotated_brief_team_workspace, docs_review_annotated_brief_guest_rsvp_portal, docs_review_annotated_brief_demo_trial_mode [EXTRACTED 1.00]
- **AMPM platform design principles settled by the 25 Oct 2026 answers** — docs_review_decision_brief_principle_nobody_can_self_register_ampm_invites_every_client_and_prospect, docs_review_decision_brief_principle_a_subscription_grants_hotel_modules_only_wedding_modules_come_only_from_a_service_agreement_and_a_project, docs_review_decision_brief_principle_expiry_or_cancellation_turns_access_read_only_and_never_deletes_records, docs_review_decision_brief_principle_a_wedding_project_is_created_when_an_agreement_for_anything_beyond_hotel_help_is_accepted, docs_review_decision_brief_principle_only_a_name_the_account_tentative_dates_and_a_lead_are_required_to_create_a_wedding, docs_review_decision_brief_principle_every_price_has_a_client_facing_amount_and_a_separate_internal_cost_that_never_leaves_the_server, docs_review_decision_brief_principle_vendor_contact_details_stay_internal_even_after_a_vendor_is_selected, docs_review_decision_brief_principle_five_to_ten_vendor_options_is_a_guideline_never_enforced, docs_review_decision_brief_principle_a_decision_locks_the_exact_version_a_revision_is_a_new_version_with_a_new_approval, docs_review_decision_brief_principle_guests_are_counted_one_person_at_a_time_grouped_into_households, docs_review_decision_brief_principle_caterer_headcounts_are_frozen_when_sent_while_expected_counts_keep_moving, docs_review_decision_brief_principle_a_function_cannot_go_live_with_a_required_check_unmet_unless_a_named_manager_records_an_exception, docs_review_decision_brief_principle_prices_fees_categories_and_thresholds_are_settings_the_team_changes_never_code, docs_review_decision_brief_principle_the_system_is_built_for_ampm_alone_not_for_licensing_to_other_planners [EXTRACTED 1.00]
- **Project closure checklist items backed by data (§17)** — docs_data_model_checklist_items, docs_data_model_guest_departures, docs_data_model_lost_and_found_items, docs_data_model_vendor_assignments, docs_data_model_project_final_accounts, docs_data_model_wedding_projects [EXTRACTED 1.00]
- **Client-facing responses never carry internal costs, margins, private rates, contacts or sensitive guest fields** — docs_test_cases_schema_assertion, docs_test_cases_v_8, docs_test_cases_ac_05, docs_test_cases_ac_08, docs_test_cases_ac_12, docs_test_cases_ac_36, docs_test_cases_ac_14, docs_test_cases_ac_38 [EXTRACTED 1.00]
- **Suites generated from the permission matrix and field matrix that fail the build on drift** — docs_permission_matrix, docs_field_matrix, docs_test_cases_generated_authorisation_suite, docs_test_cases_generated_validation_suite, docs_test_cases_v_16, docs_test_cases_automation_strategy, docs_test_cases_ac_12, docs_test_cases_ac_18, docs_test_cases_ac_31, docs_test_cases_ac_32 [EXTRACTED 1.00]
- **Criteria whose P1 and P2 tests gate the Phase 1 Foundation exit** — docs_test_cases_phase_1_foundation_exit_pack, docs_test_cases_ac_01, docs_test_cases_ac_02, docs_test_cases_ac_03, docs_test_cases_ac_04, docs_test_cases_ac_05, docs_test_cases_ac_12, docs_test_cases_ac_17, docs_test_cases_ac_18, docs_test_cases_ac_19, docs_test_cases_ac_20, docs_test_cases_ac_21, docs_test_cases_ac_24, docs_test_cases_ac_25, docs_test_cases_ac_26, docs_test_cases_ac_32, docs_test_cases_ac_35 [EXTRACTED 1.00]
- **Offline-capable live-operations screens (W-10, Q1)** — docs_wireframes_tw_73, docs_wireframes_tw_74, docs_wireframes_tw_76, docs_wireframes_tw_70, docs_wireframes_tw_56, docs_wireframes_offline_sync_indicator, docs_wireframes_w_10 [EXTRACTED 1.00]
- **Tables using polymorphic owner/entity/record references with a type check constraint (§1)** — docs_data_model_documents, docs_data_model_media_assets, docs_data_model_comments, docs_data_model_approvals, docs_data_model_audit_events, docs_data_model_notifications [EXTRACTED 1.00]
- **Preview as client: staff editors that render the real client screen** — docs_wireframes_tw_22, docs_wireframes_tw_27, docs_wireframes_tw_28, docs_wireframes_tw_39, docs_wireframes_tw_61, docs_wireframes_preview_as_client, docs_wireframes_forbidden_equals_absent [EXTRACTED 1.00]
- **Tier 1 decisions that block design sign-off (Q1 to Q10)** — docs_requirements_audit_q1_delivery_platform, docs_requirements_audit_q2_payment_mode_for_phase_1, docs_requirements_audit_q3_subscription_shape, docs_requirements_audit_q4_client_visible_finance, docs_requirements_audit_q5_client_side_users, docs_requirements_audit_q6_roles, docs_requirements_audit_q7_guest_identity_in_the_rsvp_portal, docs_requirements_audit_q8_identity_documents, docs_requirements_audit_q9_hotel_data, docs_requirements_audit_q10_phase_1_scope [EXTRACTED 1.00]
- **Version-lock approval flow (SPEC 12: approval refers to the exact version)** — docs_wireframes_cp_10, docs_wireframes_cp_27, docs_wireframes_cp_29, docs_wireframes_cp_34, docs_wireframes_tw_39, docs_wireframes_tw_40, docs_wireframes_tw_43, docs_wireframes_t5, docs_wireframes_approval_panel, docs_wireframes_version_timeline [EXTRACTED 1.00]
- **Versioned records immutable once shared and locked by approvals (§1, SPEC §12)** — docs_data_model_design_versions, docs_data_model_menu_versions, docs_data_model_invitation_versions, docs_data_model_vendor_proposals, docs_data_model_hotel_proposals, docs_data_model_approvals [EXTRACTED 1.00]
- **Client-facing vs internal commercial data separation principle** — reference_docs_ampm_website___app____business_explanation_for_developer_rule_different_access, reference_docs_ampm_website___app____business_explanation_for_developer_rule_client_internal_view_separation, reference_docs_ampm_app_visual_flowchart_for_team_access_control, reference_docs_ampm_client_portal_visual_flowchart_client_access_rules, reference_docs_why_ampm_app_access_control_rules, reference_docs_answers_ampm_app___compiled_questions___answers_q04_revenue_model_financial_visibility, reference_docs_answers_ampm_app_brief_updated_answer_commercial_privacy_rule, reference_docs_answers_ampm_app_brief_updated_answer_security_requirements, graphify_out_converted_ampm_developer_technical_specification_v1_4babf6ee_client_vs_internal_visibility, graphify_out_converted_ampm_developer_technical_specification_v1_4babf6ee_table_vendor_proposals [INFERRED 0.85]
- **Hotel discovery subscription lifecycle (purchase, activation, expiry, renewal)** — reference_docs_ampm_website___app____business_explanation_for_developer_hotel_discovery_subscription, reference_docs_why_ampm_app_stage3_paid_subscription, reference_docs_answers_ampm_app___compiled_questions___answers_q03_hotel_discovery_subscription, reference_docs_answers_ampm_app_brief_updated_answer_subscription_price_and_duration, reference_docs_answers_ampm_app_brief_updated_answer_payment_method, reference_docs_answers_ampm_app_brief_updated_answer_stage2_account_creation_and_subscription, graphify_out_converted_ampm_developer_technical_specification_v1_4babf6ee_table_subscriptions, graphify_out_converted_ampm_developer_technical_specification_v1_4babf6ee_table_payments, graphify_out_converted_ampm_developer_technical_specification_v1_4babf6ee_module_crm_subscriptions [INFERRED 0.85]
- **Versioned change-request and approval workflow** — reference_docs_ampm_client_portal_visual_flowchart_approval_loop, reference_docs_ampm_client_portal_visual_flowchart_ampm_team_reviews_request, reference_docs_answers_ampm_app___compiled_questions___answers_q21_change_requests, reference_docs_answers_ampm_app_brief_updated_answer_tracked_requests, reference_docs_answers_ampm_app_brief_updated_answer_change_requests, reference_docs_answers_ampm_app_brief_updated_answer_important_permission_rules, graphify_out_converted_ampm_developer_technical_specification_v1_4babf6ee_approval_tied_to_exact_version, graphify_out_converted_ampm_developer_technical_specification_v1_4babf6ee_table_approvals [INFERRED 0.85]
- **Authorisation enforcement chain from matrix rule to generated tests** — docs_permission_matrix_server_side_enforcement_rule, docs_permission_matrix_seven_layer_authorisation_model, docs_permission_matrix_permission_keys, docs_permission_matrix_field_visibility_classes, docs_architecture_policy_pipeline, docs_architecture_serialisers_per_class, docs_architecture_repository_scoping, docs_architecture_generated_authorisation_test_suite [INFERRED 0.85]
- **RSVP and attendance chain from guest link to downstream recalculation** — docs_user_flows_flow_7_invitations_and_rsvp, docs_user_flows_flow_8_rooms_travel_transport, docs_permission_matrix_guest_link_rules, docs_permission_matrix_p_4_guest_token_scope, docs_architecture_flow_rsvp_submission, docs_architecture_domain_events, docs_architecture_job_attendance_recalculation [INFERRED 0.85]
- **Subscription lifecycle across flows, transitions and jobs** — docs_user_flows_flow_1_lead_to_demo_to_subscription, docs_user_flows_flow_12_entitlement_changes, docs_permission_matrix_subscription_transitions, docs_permission_matrix_client_entitlement_resolution, docs_architecture_flow_subscription_purchase_and_activation, docs_architecture_job_payment_webhook_processing, docs_architecture_job_subscription_expiry_and_notices [INFERRED 0.85]
- **Decision propagation pipeline** — docs_readme_decisions_json, docs_tools_apply_decisions, docs_tools_decision_log_build, docs_tools_decision_register_build, docs_tools_assumptions_sheet_build, docs_tools_field_matrix_build, docs_tools_vault_build, docs_tools_site_build, docs_readme_published_artifact [EXTRACTED 1.00]
- **Session continuity stores (vault, palace, graph)** — docs_readme_obsidian_vault, docs_readme_mempalace_wing_ampm, docs_readme_graphify_out [EXTRACTED 1.00]
- **Committed session-memory configuration** — docs_readme_claude_settings_json, docs_readme_mcp_json, docs_readme_graphify_skill, docs_readme_graphifyignore, docs_readme_claude_md, docs_readme_graphify_out [EXTRACTED 1.00]

## Communities (64 total, 1 thin omitted)

### Community 0 - "Acceptance Tests and Traceability"
Cohesion: 0.06
Nodes (98): Architecture (architecture.md), AMPM Platform Data Model and ER Diagrams, Coverage against the audit (§20), Changes from AMPM's decisions of 25 October 2026 (§0a), Entity index with phases and restricted fields (§19), Module overview ER diagram (§2), Open modelling questions for review (§21), Decision Log (decision-log.md) (+90 more)

### Community 1 - "AMPM's Answers and Business Rules"
Cohesion: 0.09
Nodes (57): Decisions AMPM Must Confirm Before Implementation (commercial plans, service catalogue, approvals, financial visibility, hotel data governance, guest communications, identity documents, languages/currency, technology ownership, launch scope), Technical and Non-Functional Requirements (responsive desktop/tablet/mobile; shared backend with separate experiences; secure role-based project-scoped auth; server-side validation; encryption; private file storage; audit trail; backups; search/bulk operations; media optimisation; configurable commercial rules; duplicate-submission prevention; retention rules; documented integration boundaries), Decisions Still to Be Confirmed by AMPM (subscription price/duration/inclusions, cancellation and refund terms, hotel service fees, management fees and payment stages, release scope, roles and data-access rules), AMPM App — Compiled Questions & Answers (Q1-Q25 + hotel discovery demo requirements), EVA (AMPM team authority: maintains hotel data, approves operational exceptions, accesses guest counts), Hotel Discovery Demo Requirements (no independent registration; mobile + OTP login; max three locations with limited hotel info and street view; approximate pricing; optional 15-20 min Zoom call; AMPM-created account; INR 50,000 one-month fee; read-only after expiry; full modules only after confirming complete management), Q1 — iOS and Android apps with offline access and automatic sync on reconnect, Q2 — Subscription payment: AMPM creates the account or sends an invitation link; client enters basic wedding details; online card and UPI (+49 more)

### Community 2 - "Technical Specification v1.0"
Cohesion: 0.09
Nodes (37): AMPM Developer Technical Specification v1.0 (20 October 2026), Acceptance Test Scenarios (15 scenarios: enquiry capture, subscription scope, demo isolation, pricing freshness, private negotiation notes, project permissions, independent functions, vendor shortlist size, version-locked approvals, de-duplicated RSVP, attendance impacts, URL/API/file access control, readiness exceptions, incidents, closure checks), AMPM Team Workspace (leads, hotels, projects, vendors, budgets, guests, approvals, execution; role-based and project-scoped access), Client Portal (hotel discovery for subscribers; wedding workspace for engaged clients; access depends on subscription, service agreement and project permissions), Client Portal — Engaged Wedding Client Screens (dashboard, overview and decision-maker contacts, functions, client-facing budget, vendor options, design studio, invitations/save-the-dates, RSVP progress, menus, documents and notifications), Deliverables Expected from the Development Team (wireframes, user-flow diagrams, ER diagram and schema/migrations, field matrix, role/permission matrix, architecture and integration plan, milestone schedule and cost, test cases, deployment/backup/handover documentation), Field Specification Pattern (name, type/validation, who edits, client/internal visibility, requiredness by stage, automation and report impact; example fields incl. hotel verification date, vendor decision, approval decision, identity document), Four Connected Experiences with Access Rules (public website, client portal, AMPM team workspace, guest RSVP portal) (+29 more)

### Community 3 - "Vault and Decision Generators"
Cohesion: 0.09
Nodes (19): decisions.json, main(), build(), q_titles(), audit_questions(), build(), load_old_graph(), main() (+11 more)

### Community 4 - "Containers, Integrations and Technology"
Cohesion: 0.10
Nodes (37): Architecture risks and mitigations (§14), api container: NestJS modular monolith (REST, OpenAPI, WebSocket), Edge: CloudFront CDN with signed URLs, WAF, load balancer with TLS termination, Object storage: three S3 buckets by sensitivity, PostgreSQL 16 on RDS Multi-AZ with PITR, Redis (ElastiCache): queues, sessions, rate limits, caches, chat bus, S3 restricted identity bucket (separate KMS key, no CDN, access audited), Video delivery: Cloudflare Stream or Mux with signed playback (+29 more)

### Community 5 - "User Flows and Status Transitions"
Cohesion: 0.11
Nodes (31): Job: material-change impact flags, Real-time chat channel: Socket.IO on the API with a Redis message bus, Client entitlement resolution by account state (§3), Client request status transitions, Project closure checklist transitions, Hotel enquiry status transitions, SYS — System principal (jobs, webhooks, automation), Retention jobs propose deletions; Super Admin approves (+23 more)

### Community 6 - "Role and Permission Matrix"
Cohesion: 0.08
Nodes (29): Export pipeline in the worker with class stripping and audit, Identity document controls, Integration: accounting export (CSV, Tally XML if used), Job: export build, Phase 5 Stabilisation, Actions that must be audited (§9), Super Admin break-glass identity-document read (audited and alerted), Permission-matrix changes from AMPM decisions of 25 October 2026 (+21 more)

### Community 7 - "Architecture Decisions and Delivery"
Cohesion: 0.09
Nodes (24): Architecture principles (§1), Backups and disaster recovery table, Capacity and indicative running cost (USD 450 to 900 per month), Architecture changes from AMPM decisions of 25 October 2026, Client app: React Native iOS and Android (web build open), Team app: React Native iOS and Android, offline-first, department-scoped, Decisions for AMPM that this plan depends on (§15), Delivery: trunk-based development, staging auto-deploy, tagged production releases (+16 more)

### Community 8 - "Specification Data Model and Phases"
Cohesion: 0.14
Nodes (39): Function Readiness Status (not started, in progress, blocked, ready, live, completed; requires the checklist or a documented authorised exception), Module: Administration (user, role, permission, notification, audit event, configuration -> secure configurable operation), Module: Budget / Finance (budget category/line, quote, contract, invoice, payment, cost entry -> estimate, approval, actuals, variance), Module: Creative / Approvals (design brief, version, comment, approval, change request -> versioned creative decisions), Module: Food / Entertainment / Production (menu version, artist booking, technical rider, production item, readiness check -> function readiness), Module: Functions (function, schedule, checklist, venue, run-of-show -> function-level plans connected to the wedding), Module Inventory (14 modules with core records and outcomes), Module: Invitations / RSVP (invitation, recipient, guest, family group, response, attendance -> invitation-to-attendance workflow) (+31 more)

### Community 9 - "Sign-in and RSVP Portal Screens"
Cohesion: 0.13
Nodes (28): Wireframes assumptions register W-1 to W-15 (section 0), AUTH-01 Sign in, AUTH-02 Account activation, AUTH-03 Password reset, AUTH-04 Access help, AUTH-05 Authenticator enrolment (staff), AUTH-06 Mobile OTP sign-in (prospects and clients), Authentication screens AUTH (sign-in, activation, recovery, OTP) (+20 more)

### Community 10 - "Subscription and Customer Journey"
Cohesion: 0.11
Nodes (30): Enquiry Form (name, contact, contact preference, tentative dates/destination, guest estimate, source/consent -> lead record in CRM), Module: CRM / Subscriptions (lead, contact, account, subscription, payment, service agreement -> lead conversion and access control), Table: client_accounts (id, primary_contact_id, status; subscriptions, service agreements, projects), Table: leads (id, source, status, contact, requirements, owner_user_id; can convert to client account), Table: service_agreements (id, account_id, service_type, scope, fee, terms_version, status; determines service access), Table: subscriptions (id, account_id, plan_id, status, starts_at, ends_at; controls hotel-discovery entitlement), CLIENTS tab — leads, profiles, follow-ups (enquiry/lead -> consultation -> questionnaire), Client Enquiry (Step 1: Instagram, ads, referrals, website; record contact, requirements, source) (+22 more)

### Community 11 - "Specification Amendments and Rules"
Cohesion: 0.10
Nodes (20): Added requirement: configurable settings for subscription price and duration, demo limits, categories, thresholds and approval rules, Added requirement: tracked request statuses submitted, under review, accepted, rejected, implemented, closed, Decision Q21: change requests submitted, reviewed, accepted or rejected, implemented, closed; new version on a change to an approved item, Decision Q25: material-change thresholds configurable; values and approval rules to be defined by AMPM, Open: final material-change thresholds and approval rules, AM-4 Material changes undefined, BIZ: AMPM Website and App Business Explanation for Developer, CF-7 Roles: proposal or decision (+12 more)

### Community 12 - "Decisions on Accounts, RSVP and Requests"
Cohesion: 0.09
Nodes (28): Added requirement: public website limited to company information, enquiries, demo requests, contact, login and invitation entry points, with no staff editing, data-model.md, Decision Q12: no website editing in the app, Decision Q18: a wedding can involve multiple hotels and venues, Decision Q19: room blocks by hotel, category and dates; team-managed allocation; room-wise and person-wise counts, Decision Q22: no vendor or hotel logins in the current version, Decision Q5: two nominated family representatives, one per side, with equal rights and no cost visibility, Decision Q6: AMPM controls permissions; department-based staff access; internal finance restricted to authorised personnel (+20 more)

### Community 13 - "Memory Hooks and Commit Automation"
Cohesion: 0.10
Nodes (30): ampm-platform repository, CLAUDE.md, .claude/settings.json, graphify 0.9, graphify-out/ (knowledge graph), /graphify skill (.claude/skills/graphify/), .graphifyignore, .mcp.json (+22 more)

### Community 14 - "Functions, Vendors and Tasks Tables"
Cohesion: 0.13
Nodes (25): artist_bookings, checklist_items, checklist_templates, checklists, function_programme_items, functions, incidents, menus (+17 more)

### Community 15 - "Client Portal Request Loop"
Cohesion: 0.11
Nodes (19): CF-2: client-portal flowchart has no hotel area although hotel discovery is the subscription product, CF-6: client-portal flowchart shows invoices and payment status the specification leaves undecided, Client portal, GP-1: no definition of what each account state may see, GP-10: save favourites had no record, GP-14: change request named but has no record, statuses or rules, GP-15: 'messages, questions' implies a chat feature no other document mentions, GP-26: 'clients' is one word for several people with no definition of client logins (+11 more)

### Community 16 - "Package Index and Vault"
Cohesion: 0.13
Nodes (30): Acceptance-criterion test cases (AC-nn.m), AMPM Dashboard.base, Architecture (architecture.md), Assumption registers (A, P, T, U, W, V), Assumptions taken (review/assumptions-taken.md), Audit findings (CF, GP, AM, RK), Build decision records (notes/Build decisions/, D-nnn), Data model (data-model.md) (+22 more)

### Community 17 - "Documents, Media and Audit Tables"
Cohesion: 0.12
Nodes (16): AMPM Developer Technical Specification v1.0 (SPEC), approval_decisions, approvals, Modelling conventions (§1), design_items, design_versions, document_access_links, documents (+8 more)

### Community 18 - "Technology and Operations Decisions"
Cohesion: 0.11
Nodes (26): architecture.md, Decision Q11: email and WhatsApp required, SMS proposed, live chat on the home page, Decision Q13: mobile OTP sign-in for prospects, demo users and clients; no unrestricted self-registration, Decision Q14: hosting, backup frequency and recovery timelines still to be confirmed with the developer, Decision Q15: about 200 hotels and 20 concurrent weddings as the planning assumption, Decision Q16: Indian rupees, English, no GST invoices from the platform, Open: communication provider for WhatsApp and SMS, Open: hosting provider, backup location and recovery targets (+18 more)

### Community 19 - "Business Process and Account States"
Cohesion: 0.14
Nodes (14): AM-14: 'a paid business asset' could hint at licensing to other planners, AMPM Website & App — Simple Business Explanation for Developer, AMPM business process (Steps 1-10), CF-4: team-app flowchart starts at a qualified client, omitting demo, subscription and hotel work, CF-5: AMPM creates every account (Why note) versus a payment journey from the website (specification), Customer journey stages 1-5 (website, demo, subscription, project, full access), GP-27: attaching pre-project saved hotels and enquiries to a new project not specified, GP-5: no path from a hotel-help request to agreed, possibly paid, work (+6 more)

### Community 20 - "Guest and Lead Screens"
Cohesion: 0.13
Nodes (26): CP-31 Guest list, CP-32 Household and guest detail, CP-38 Documents and schedules, CP-39 Notifications and preferences, GR-03 Attendance, T1 List and filter template, T4 Board template, TW-10 Lead pipeline (+18 more)

### Community 21 - "Team App Flowchart and Operations"
Cohesion: 0.13
Nodes (26): Business Journey (lead -> controlled demo -> subscription after payment -> destination/hotel discovery -> optional consultancy -> scope/fees/agreement and wedding project -> parallel planning -> 5-10 vendor options per category -> execution, departures, closure), Module: Closure (departure record, lost-and-found item, vendor completion, final account -> formal closeout), Module: Tasks / Risk (task, dependency, staff assignment, incident, resolution -> operational accountability), Notifications and Automation (payment activates only the purchased entitlement; stale pricing flagged after configurable age; approval notifications; material-change flags on budgets/contracts/tasks/run-of-show; RSVP changes recalculate attendance; logistics alerts; dashboard exceptions; incident escalation; notification log), Table: tasks / incidents (id, project_id, owner, due_at/severity, status, outcome; accountability and response), Table: travel_segments / transfers (id, guest/group_id, mode, pickup, destination, time, status; feeds transport planning), AMPM Team App — Level 1 Visual Flowchart, Access Control (role-based permissions, internal vs client data, activity history) (+18 more)

### Community 22 - "Wedding Project, Rooms and Travel Tables"
Cohesion: 0.17
Nodes (18): client_feedback, external_venues, guest_departures, hotel_contacts, lost_and_found_items, Module E — Wedding project, Module K — Rooms, travel and transport, project_hotels (+10 more)

### Community 23 - "Enquiry, Demo and Payment Findings"
Cohesion: 0.15
Nodes (20): Added requirement: client completes basic wedding details before paying, Added requirement: demo after mobile OTP with up to three locations and sample hotels with indicative prices, Added requirement: platform for AMPM's internal business use, not for licensing to other wedding planners, Decision Q2: AMPM creates or invites the account; client enters basic wedding details and pays online by card or UPI, Decision Q3: hotel-discovery subscription Rs 50,000 one-time for one month; demo via OTP instead of a trial, AM-14 Tenancy: AMPM only or future licensing, AM-8 Demo data separation, CF-1 Three environments vs four experiences (+12 more)

### Community 24 - "Team Workspace Areas"
Cohesion: 0.13
Nodes (14): AM-6: 'Database' under More read as the hotel database, CF-3: team-app flowchart lacks the Hotels and Guests areas listed in the brief and specification, CF-8: consultation and questionnaire appear only in the team-app flowchart, GP-22: bulk operations required but no import, GP-28: schedule and calendar on the Home tab appear only in the flowchart, GP-29: feedback and archive at closure appear only in the flowchart with no records, GP-30: execution needs to know who is on site and when (no staff rosters), AMPM team workspace (+6 more)

### Community 25 - "API Modules and Build Phases"
Cohesion: 0.22
Nodes (24): Build-out by phase (§13), Key flow 7.5: daily hotel freshness job, Maintained hotel search view (tsvector and trigram index), Module boundaries inside the API (§5), Budget and finance module (G), Checklists, closure, feedback module (O), Public content module (P), Hotel consultancy module (D) (+16 more)

### Community 26 - "Guest RSVP Flow and Links"
Cohesion: 0.14
Nodes (14): AM-1: 'a link' - one link for the whole wedding or a private link per household, AM-4: 'material changes' has no definition, GP-13: counting guests by family or by person left open, GP-24: meal preferences and allergies not mentioned though menus and caterers need them, GP-25: what the couple may see of their guests and who maintains the list is unstated, GP-32: notifications have no channels or preferences defined, Guest RSVP portal, Notification and automation rules (+6 more)

### Community 27 - "Hotel Database and Rate Cards"
Cohesion: 0.12
Nodes (15): AM-2: a function's venue may be outside the hotel database and a wedding may use more than one hotel, AM-5: room category capacity - number of rooms or people per room (now two fields), GP-11: rooms allocated with nothing to allocate them from, GP-12: wedding_projects.hotel_id allows only one hotel per wedding, GP-16: twenty-five records in the module inventory have no table in the data model, GP-20: media has a visibility flag but no record of rights or consent, GP-21: vendor availability listed but had no record, GP-8: data model has no place to store hotel prices or their verification dates (+7 more)

### Community 28 - "Open Decisions in the Brief"
Cohesion: 0.12
Nodes (16): Decisions AMPM must confirm (specification §13), GP-18: no tax fields, GP-2: demo undefined (how granted, what it shows, when it ends) and no trial status, GP-31: secure authentication not specified (client sign-in, staff second factor, password reset), GP-4: recurring versus one-time subscription not stated, GP-6: no records or rules for wedding-management payment stages, GP-7: no refund handling, Q13: sign-in method and staff second factor (+8 more)

### Community 29 - "Client Portal Approvals and Requests"
Cohesion: 0.25
Nodes (20): CP-10 Hotel proposal detail and decision, CP-22 Functions list, CP-23 Function workspace, CP-26 Vendor options, CP-27 Vendor proposal detail, CP-28 Design studio, CP-29 Design item detail, CP-30 Invitations and save-the-dates (+12 more)

### Community 30 - "CRM, Subscription and Payment Tables"
Cohesion: 0.18
Nodes (15): account_contacts, budget_categories, client_accounts, function_types, lead_activities, lead_sources, leads, Module B — CRM, subscriptions and commercial agreements (+7 more)

### Community 31 - "Wedding Dashboards and Finance Screens"
Cohesion: 0.17
Nodes (19): CP-20 Wedding dashboard, CP-24 Budget, T6 Dashboard template, Team workspace (TW screens), TW-01 Team dashboard, TW-02 Calendar, TW-12 Client accounts, TW-13 Account detail (+11 more)

### Community 32 - "Budget and Finance Tables"
Cohesion: 0.21
Nodes (14): booking_milestones, budget_lines, contracts, cost_entries, hotel_enquiries, hotel_enquiry_events, hotel_proposal_lines, hotel_proposals (+6 more)

### Community 33 - "Vault Sync Script"
Cohesion: 0.17
Nodes (15): ampm-vault repository, app-ampm GitHub account, launchd agent com.ampm.vault-sync, post-commit hook, git-credential-ampm.sh script, configure(), setup_git.sh script, append_log() (+7 more)

### Community 34 - "Shared Page Builder"
Cohesion: 0.11
Nodes (16): marked (npm package), Published claude.ai artifact for AMPM, site/index.html (shared page), BRIEF, DOCS, esc(), LINKMAP, navHtml (+8 more)

### Community 35 - "Live Operations Screens"
Cohesion: 0.20
Nodes (20): T2 Record detail with tabs template, T8 Live console template, TW-35 Function workspace, TW-45 Closure checklist and final accounts, TW-56 Travel and transport, TW-60 Vendor master, TW-61 Vendor profile editor, TW-62 Vendor quotes (+12 more)

### Community 36 - "Authorisation Pipeline and Security"
Cohesion: 0.14
Nodes (15): Authorisation test suite generated from the permission matrix, Identity and sessions module (A), Policy and entitlements module, Policy pipeline: eight-step enforcement of the permission matrix (§6), Security and privacy controls by layer (§11), Serialisers per visibility class (BudgetLineClientView, InternalView, FinanceView), Server-side sessions in Redis with secure HttpOnly SameSite cookies, Testing: Vitest, Playwright, adapter contract tests, generated authorisation suite (+7 more)

### Community 37 - "Public Website and Subscription Screens"
Cohesion: 0.17
Nodes (18): CP-11 Subscription, plans and agreements, CP-25 Invoice detail and payment, PUB-01 Home, PUB-02 How it works, PUB-03 Services, PUB-04 Destinations and selected work, PUB-05 About, PUB-06 Contact, enquiry and demo request (+10 more)

### Community 38 - "Background Jobs and Domain Events"
Cohesion: 0.14
Nodes (17): Monthly partitioning of audit_events and notifications, Background jobs (§9): idempotent and outcome-recorded, Domain events (attendance.changed, approval.requested, approval.decided, client_request.accepted), Key flow 7.3: approval of a vendor proposal version, Job: attendance recalculation (totals, headcounts, room and transfer flags), Job: import apply, Job: incident escalation timer, Job: notification dispatch on domain events (+9 more)

### Community 39 - "Hotel and Contract Tables"
Cohesion: 0.22
Nodes (12): AMPM Business Rules (BIZ), cms_pages, cms_showcase_items, destinations, hotel_rate_cards, hotel_rate_items, hotel_room_categories, hotel_venues (+4 more)

### Community 40 - "Guest Identity and Privacy Decisions"
Cohesion: 0.18
Nodes (15): Decision Q17: AMPM decides privacy wording and retention; no automatic deletion, Decision Q8: identity documents only where a hotel requires them, never Aadhaar, restricted storage, no automatic deletion, Open: privacy wording and retention periods for leads, guest records and identity documents, AM-1 RSVP link model: shared wedding link vs per-guest token, GP-24 Dietary and allergy capture, GP-25 Guest list ownership, GP-40 Digital Personal Data Protection Act 2023, GP-41 Aadhaar (+7 more)

### Community 41 - "Field Matrix Generator"
Cohesion: 0.19
Nodes (11): automation(), build(), canonical_class(), classify(), editor(), fk_target(), is_actor(), parse_model() (+3 more)

### Community 42 - "Hotel Discovery Screens"
Cohesion: 0.31
Nodes (17): CP-01 Subscriber home, CP-02 Destination list, CP-03 Destination detail, CP-04 Hotel search results, CP-05 Hotel detail, CP-06 Saved hotels and compare, CP-07 Request hotel assistance, CP-08 Enquiry tracker (+9 more)

### Community 43 - "Identity, Access and Model Assumptions"
Cohesion: 0.21
Nodes (11): audit_events, auth_tokens, import_jobs, Module A — Identity, access and administration, notification_preferences, notifications, permissions, role_permissions (+3 more)

### Community 44 - "Platform, Subscription and Access Decisions"
Cohesion: 0.18
Nodes (15): Added requirement: staff offline scope with visible sync state, conflict detection and role-limited local data, Decision Q1: native iOS and Android apps with offline wedding-day access and sync, Decision Q23: three months read-only client access after the wedding, then archive on AMPM approval, Open: exact demo duration and final hotel and location limits, Open: exact workflow for archiving projects and restoring access after archiving, Open: payment gateway provider and transaction-handling requirements, Open: whether the client portal is also needed on the web, Open: whether the demo shows one or two sample hotels per location with indicative prices (+7 more)

### Community 45 - "Client-visible Finance Decision"
Cohesion: 0.18
Nodes (13): Added requirement: vendor categories with contact details internal by default, Decision Q4: hotel discovery is a separate paid service; internal costs and margins never shown; no online milestone payments in the first release, Open: which client-facing amounts appear in the wedding portal, Open: which hotel-assistance services beyond availability checks carry a fee, user-flows.md, CF-6 Client-visible finance, GP-17 Payments and invoices lack direction, parties and client/internal split, GP-5 Hotel-assistance commercial flow (+5 more)

### Community 46 - "Hotel Data in the Brief"
Cohesion: 0.22
Nodes (16): Client Portal — Hotel Discovery Screens (sign-in/activation, subscriber home, destinations, hotel search/filter, hotel detail with last-verified commercial information, compare and save, request assistance, track enquiry/negotiation/visit/proposal/booking status), Module: Hotel Consultancy (availability enquiry, response, negotiation, site visit, proposal, booking milestone -> traceable hotel assistance), Module: Hotel Intelligence (destination, hotel, room category, inventory snapshot, venue, media, verification -> curated discovery with freshness labels), Table: destinations (id, name, region, country, status; has many hotels), Table: hotel_enquiries (id, account/project_id, hotel_id, dates, guest_count, status; responses, visits, proposals, negotiation events), Table: hotel_rooms / venues (id, hotel_id, category/type, capacity, facilities; may be proposed for a wedding), Table: hotel_verifications (id, hotel_id, field_group, verified_at, source, status; freshness of price/facility information), Table: hotels (id, destination_id, profile, address, contact, status; rooms, venues, media, verification history) (+8 more)

### Community 47 - "Guest and RSVP Tables"
Cohesion: 0.38
Nodes (11): family_groups, guest_function_attendance, guest_support_requests, guests, invitation_recipients, invitation_versions, invitations, menu_headcounts (+3 more)

### Community 48 - "Requirements Audit and Sources"
Cohesion: 0.32
Nodes (13): Decision Q20: tracked requests with conversation history and live chat both required, AMPM Platform Requirements Audit (23 Oct 2026), CF-2 Client-portal flowchart omits hotel discovery, CF-3 Team flowchart hides Hotels and Guests, CF-4 Team flowchart shows one linear path with no subscription or consultancy branch, CF-8 Vocabulary that exists in only one document, GP-15 Messaging and questions have no module, GP-33 Native app vs responsive web vs progressive web app (+5 more)

### Community 49 - "Session Journal Script"
Cohesion: 0.28
Nodes (11): commits_since(), create_note(), find_note(), first_timestamp(), git(), local_time(), main(), repo_url() (+3 more)

### Community 50 - "Approvals and Creative Tables"
Cohesion: 0.26
Nodes (7): Assumptions register (§0), client_requests, comments, configurations, conversations, messages, Module Q — Live chat

### Community 51 - "Demo Mode, Phases and Roles"
Cohesion: 0.21
Nodes (13): Fifteen acceptance test scenarios, AM-12: invitations are design work (Phase 2) and distribution work (Phase 3), AM-8: 'three distinct environments' - three hosted systems or three experiences of one, CF-1: the demo belongs to neither the four experiences nor the three environments, and to no phase, CF-7: specification lists eleven roles as final while the brief says roles must not be assumed, CF-9: three distinct environments (Why note) versus one shared backend (specification), Field specification pattern, Five implementation phases (foundation, planning, guest operations, live execution, stabilisation) (+5 more)

### Community 52 - "Data Layer and Retention"
Cohesion: 0.23
Nodes (10): Data layer (§8), Demo isolation by is_demo scoping and nightly seed restore, Digital Personal Data Protection Act 2023 controls, Job: retention (identity documents, guest data, leads, demo reset), Money as numeric(14,2) with a currency column, UTC storage, Repository-layer scoping by membership, is_demo, visibility and soft delete, Prisma soft-delete client extension, Prisma ORM and migrations (+2 more)

### Community 53 - "Hotel Data Findings"
Cohesion: 0.28
Nodes (12): Added requirement: adding a hotel to the selection or cart can trigger an availability request to the hotel team, Added requirement: hotel page content distinguishing indicative, requested, verified and awaiting-confirmation information, Decision Q9: Eva maintains about 200 hotels with indicative price ranges verified about three times a year, GP-10 Saved hotels, favourites and compare have no entity, GP-20 Media rights for previous clients' wedding photos, GP-22 Bulk import and migration, GP-8 Hotel prices have nowhere to live, GP-9 Availability has no entity or calendar (+4 more)

### Community 54 - "Design Package Index"
Cohesion: 0.26
Nodes (13): AMPM (client), AMPM's answers of 25 October 2026 (reference_docs/answers/), AMPM Platform Design Package, Annotated brief (review/annotated-brief.md), BIZ: business explanation, decisions.json, Part A: review package for AMPM, PORTAL-FLOW: Level-1 portal flowchart (+5 more)

### Community 55 - "Data Protection and Identity Documents"
Cohesion: 0.26
Nodes (8): Digital Personal Data Protection Act, GP-39: external hotel systems not defined, GP-40: Digital Personal Data Protection Act obligations to guests not addressed, GP-41: Indian rules restrict storing Aadhaar numbers, GP-44: retention and deletion rules left to AMPM, Q17: consent wording, privacy notice and retention periods, Q8: identity document use case, authorised access, retention and deletion, Technical and non-functional requirements

### Community 56 - "Client Portal Flowchart (as supplied)"
Cohesion: 0.35
Nodes (13): AMPM Client Portal — Level 1 Visual Flowchart, Access Verified? gate (secure sign-in; otherwise contact AMPM for access help), AMPM Team Reviews Request (approve, respond, request clarification), Approval Loop (approval required? -> submit decision/change request -> AMPM team reviews -> updated wedding information), APPROVALS — proposals & selections, budget/design approvals, change requests, Client Access Rules (only own wedding; visible, approved information), Client Action (view, submit details, review, approve, ask a question), Client Portal Navigation (Home, My Wedding, Approvals, More) (+5 more)

### Community 57 - "Client Users and Roles Decisions"
Cohesion: 0.23
Nodes (11): AMPM App Compiled Questions and Answers (PDF, 25 Oct 2026), AMPM Management Final App Decision Brief and Developer Requirements (PDF, 25 Oct 2026), AMPM Platform Decision Log (25 Oct 2026), Decision Q24: short feedback form and archived state preserving the records, GP-29 Closure extras: feedback and archive, Q24 Post-wedding feedback and archive expectations, AMPM Platform Decision Brief (24 Oct 2026, updated 25 Oct 2026), Journey stage: closure (checklist, final accounts, feedback, archive) (+3 more)

### Community 58 - "Offline Operations and Readiness"
Cohesion: 0.26
Nodes (7): AM-3: function readiness versus a function's own status, Cost estimate and milestone schedule (held), GP-19: twelve record kinds have no statuses and nobody is named to move statuses, GP-33: responsive interface versus 'app', GP-34: no mention of working offline on the wedding day, Q1: delivery platform - responsive website or native app, and offline use on the wedding day, Q15: expected volumes that size the platform (cost estimate dependency)

### Community 59 - "Requests, Threads and Live Chat"
Cohesion: 0.45
Nodes (8): CP-36 Requests, CP-37 Request detail, CP-42 Live chat, T7 Thread and timeline template, TW-27 Enquiry detail, TW-42 Client requests queue and detail, TW-57 Guest support requests, TW-98 Chat console

### Community 60 - "Finance Visibility and Payments"
Cohesion: 0.22
Nodes (4): Client vs internal visibility rule (server-side enforcement), GP-17: payments and invoices have no direction, Reports and exports respecting permissions, MY WEDDING tab: overview and contacts, functions, vendors, designs, invitations, guest list, RSVP progress, menus

### Community 61 - "First Release Scope"
Cohesion: 0.33
Nodes (7): Added requirement: readiness exceptions record the unmet check, reason, authorised person, time and resulting status, Decision Q10: first release includes demo, discovery, wedding management, vendors, portal, department access, RSVP, requests, live chat and offline operations, Eva (AMPM; maintains the hotel data; her authorised personnel approve operational exceptions), Open: single release or hotel discovery first with the wedding modules following, AM-11 Phase 1 consultancy depth, GP-23 Public website content management, Q10 Phase 1 scope

### Community 62 - "Website Content and Plans"
Cohesion: 0.36
Nodes (5): GP-23: no document says who edits website content, GP-3: subscriptions.plan_id references a plan table that does not exist, Public website, Q12: who edits website content, Stage 1: public website (learn, examples, request a demo or access)

## Ambiguous Edges - Review These
- `Technical and Non-Functional Requirements (responsive desktop/tablet/mobile; shared backend with separate experiences; secure role-based project-scoped auth; server-side validation; encryption; private file storage; audit trail; backups; search/bulk operations; media optimisation; configurable commercial rules; duplicate-submission prevention; retention rules; documented integration boundaries)` → `Application Platforms (iOS and Android applications; offline operational use on the wedding day with automatic synchronisation; final architecture agreed with the development team)`  [AMBIGUOUS]
  graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md · relation: conceptually_related_to
- `Technical and Non-Functional Requirements (responsive desktop/tablet/mobile; shared backend with separate experiences; secure role-based project-scoped auth; server-side validation; encryption; private file storage; audit trail; backups; search/bulk operations; media optimisation; configurable commercial rules; duplicate-submission prevention; retention rules; documented integration boundaries)` → `Wedding-Day Operations and Offline Access (iOS/Android; offline access to assigned tasks, department info, readiness checklists, cue sheets, arrival lists; record updates offline; sync on reconnect; show offline and pending-sync state; no silent loss; conflict detection and resolution; protect locally stored data; limited to the user's role)`  [AMBIGUOUS]
  graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md · relation: conceptually_related_to
- `First Release Scope (Q10): demo and subscription-based hotel discovery, wedding management after appointment, vendor selection, client portal, department-based team access, RSVP, tracked requests, live chat, offline wedding-day operations; only Eva authorises exceptions` → `Recommended Implementation Phases (1 Foundation: website/CRM, accounts/subscriptions, hotel database, search, shortlist, enquiry; 2 Wedding planning; 3 Guest operations; 4 Live execution; 5 Stabilisation)`  [AMBIGUOUS]
  graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md · relation: conceptually_related_to
- `vendor_category_links` → `project_hotels`  [AMBIGUOUS]
  docs/data-model.md · relation: semantically_similar_to
- `BIZ: AMPM Website and App Business Explanation for Developer` → `Principle: vendor contact details stay internal even after a vendor is selected`  [AMBIGUOUS]
  docs/review/decision-brief.md · relation: cites
- `Added requirement: public website limited to company information, enquiries, demo requests, contact, login and invitation entry points, with no staff editing` → `Decision Q20: tracked requests with conversation history and live chat both required`  [AMBIGUOUS]
  docs/decision-log.md · relation: conceptually_related_to
- `Table: wedding_projects (id, account_id, dates, destination_id, hotel_id, status; parent for wedding records)` → `Q18 — A wedding can involve multiple hotels and venues`  [AMBIGUOUS]
  graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md · relation: conceptually_related_to

## Knowledge Gaps
- **47 isolated node(s):** `PATH`, `PATH`, `Module overview ER diagram (§2)`, `COVERED requirement`, `Sample wedding AMPM-2027-014 (four functions, 168 households, 412 guests, checklists in every state)` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 91 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Part 3 decisions: 25 questions with assumed defaults and AMPM's 25 Oct 2026 answers` connect `Client Users and Roles Decisions` to `Guest Identity and Privacy Decisions`, `Specification Amendments and Rules`, `Decisions on Accounts, RSVP and Requests`, `Platform, Subscription and Access Decisions`, `Client-visible Finance Decision`, `Requirements Audit and Sources`, `Technology and Operations Decisions`, `Hotel Data Findings`, `Enquiry, Demo and Payment Findings`, `First Release Scope`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `SPEC: AMPM Developer Technical Specification v1.0` (e.g. with `Brief section 8: technology and operations` and `Principle: a subscription grants hotel modules only; wedding modules come only from a service agreement and a project`) actually correct?**
  _`SPEC: AMPM Developer Technical Specification v1.0` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PATH`, `PATH`, `Module overview ER diagram (§2)` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Acceptance Tests and Traceability` be split into smaller, more focused modules?**
  _Cohesion score 0.06339869281045751 - nodes in this community are weakly interconnected._
- **Why does `AMPM Platform Decision Log (25 Oct 2026)` connect `Client Users and Roles Decisions` to `Vault and Decision Generators`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Technical and Non-Functional Requirements (responsive desktop/tablet/mobile; shared backend with separate experiences; secure role-based project-scoped auth; server-side validation; encryption; private file storage; audit trail; backups; search/bulk operations; media optimisation; configurable commercial rules; duplicate-submission prevention; retention rules; documented integration boundaries)` and `Application Platforms (iOS and Android applications; offline operational use on the wedding day with automatic synchronisation; final architecture agreed with the development team)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Technical and Non-Functional Requirements (responsive desktop/tablet/mobile; shared backend with separate experiences; secure role-based project-scoped auth; server-side validation; encryption; private file storage; audit trail; backups; search/bulk operations; media optimisation; configurable commercial rules; duplicate-submission prevention; retention rules; documented integration boundaries)` and `Wedding-Day Operations and Offline Access (iOS/Android; offline access to assigned tasks, department info, readiness checklists, cue sheets, arrival lists; record updates offline; sync on reconnect; show offline and pending-sync state; no silent loss; conflict detection and resolution; protect locally stored data; limited to the user's role)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._