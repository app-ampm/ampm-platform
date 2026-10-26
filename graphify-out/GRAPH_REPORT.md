# Graph Report - ampm-pending-decisions-015814  (2026-10-26)

## Corpus Check
- 6 files · ~152,656 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1813 nodes · 5438 edges · 68 communities (67 shown, 1 thin omitted)
- Extraction: 82% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 946 edges (avg confidence: 0.89)
- Token cost: 420,766 input · 0 output

## Community Hubs (Navigation)
- Acceptance Tests and Traceability
- AMPM's Answers and Business Rules
- Role and Permission Matrix
- Round-Two Open Questions (R1 to R19)
- Technical Specification v1.0
- Decision Brief Open Areas
- Containers, Integrations and Technology
- User Flows and Status Transitions
- Identity, Access and Administration Tables
- Package Index and Vault
- Memory Hooks and Commit Automation
- Specification Data Model and Phases
- Specification Amendments and Rules
- Vault and Decision Generators
- Subscription and Customer Journey
- Functions, Vendors and Tasks Tables
- Shared Page Builder
- Client Portal Request Loop
- Guest and Lead Screens
- Architecture Decisions and Delivery
- Technology and Operations Decisions
- API Modules and Build Phases
- Team Workspace Areas
- Vault Sync Script
- Guest and RSVP Tables
- Accounts, Roles and Sign-in Findings
- Business Process and Account States
- Team App Flowchart and Operations
- Decision Log and Source Documents
- Documents, Media and Audit Tables
- Platform, Subscription and Access Decisions
- Design Package Index
- Guest Identity and Privacy Decisions
- Client Portal Approvals and Requests
- Budget, Invoices and Closure Tables
- Requirements Audit and Sources
- Technology Register and Offline Sync
- Hotel Enquiry and Proposal Tables
- Hotel Database and Rate Cards
- Wedding Dashboards and Finance Screens
- Guest RSVP Flow and Links
- Sign-in and RSVP Portal Screens
- Hotel Discovery Screens
- Field Matrix Generator
- CRM, Subscription and Payment Tables
- Decision Propagation and Generated Files
- Background Jobs and Domain Events
- Decisions on Accounts, RSVP and Requests
- Hotel Data in the Brief
- Finance Visibility and Payments
- Session Journal Script
- Offline Operations and Readiness
- Live Operations Screens
- Approvals, Designs and Chat Tables
- Enquiry, Demo and Payment Findings
- Client-visible Finance Decision
- Wireframe Assumptions and Demo Mode
- Vendor and Configuration Screens
- Client Portal Flowchart (as supplied)
- Hotel Data Findings
- Requests, Threads and Live Chat
- Public Website and Subscription Screens
- Data Protection and Identity Documents
- First Release Scope
- Website Content and Plans
- Hotel and Contract Tables
- Vendor Availability and Access

## God Nodes (most connected - your core abstractions)
1. `wedding_projects` - 65 edges
2. `AMPM Platform Data Model and ER Diagrams` - 63 edges
3. `requirements-audit.md` - 61 edges
4. `SPEC: AMPM Developer Technical Specification v1.0` - 58 edges
5. `permission-matrix.md` - 47 edges
6. `T1 List and filter template` - 45 edges
7. `AMPM Management — Final App Decision Brief & Developer Requirements` - 42 edges
8. `Traceability matrix (criterion, source, tests, flows, screens, phase)` - 41 edges
9. `architecture.md` - 41 edges
10. `wireframes.md` - 41 edges

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
- **Developer package behind the review** — docs_requirements_audit, docs_data_model, docs_permission_matrix, docs_field_matrix, docs_architecture, docs_user_flows, docs_wireframes, docs_test_cases [EXTRACTED 1.00]
- **AMPM's five source documents reviewed by the audit** — docs_review_annotated_brief_business_explanation, docs_review_annotated_brief_why_ampm_app_note, docs_review_annotated_brief_technical_specification_v1, docs_review_redesigned_flowcharts_team_app_as_supplied, docs_review_redesigned_flowcharts_client_portal_as_supplied [EXTRACTED 1.00]
- **Four connected experiences plus demo mode of one shared platform** — docs_review_annotated_brief_public_website, docs_review_annotated_brief_client_portal, docs_review_annotated_brief_team_workspace, docs_review_annotated_brief_guest_rsvp_portal, docs_review_annotated_brief_demo_trial_mode [EXTRACTED 1.00]
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
- **Schedule and cost estimate wait on R4, R14 and R17** — docs_review_remaining_questions_r4, docs_review_remaining_questions_r14, docs_review_remaining_questions_r17, docs_review_remaining_questions_answer_sheet [EXTRACTED 1.00]
- **The nine questions that need a real decision from AMPM** — docs_review_remaining_questions_r1, docs_review_remaining_questions_r3, docs_review_remaining_questions_r4, docs_review_remaining_questions_r5, docs_review_remaining_questions_r6, docs_review_remaining_questions_r7, docs_review_remaining_questions_r8, docs_review_remaining_questions_r11, docs_review_remaining_questions_r17 [EXTRACTED 1.00]
- **Who approves what: representative identity, decision approval, material changes, archiving** — docs_review_remaining_questions_r5, docs_review_remaining_questions_r6, docs_review_remaining_questions_r18, docs_review_remaining_questions_r19 [INFERRED 0.85]
- **Tier 1: the ten decisions that unblock design sign-off** — docs_review_decision_brief_q1, docs_review_decision_brief_q2, docs_review_decision_brief_q3, docs_review_decision_brief_q4, docs_review_decision_brief_q5, docs_review_decision_brief_q6, docs_review_decision_brief_q7, docs_review_decision_brief_q8, docs_review_decision_brief_q9, docs_review_decision_brief_q10 [EXTRACTED 1.00]
- **The eleven points still to confirm and the round-two questions** — docs_review_decision_brief_still_to_confirm, docs_review_remaining_questions, docs_readme_part_a7, docs_readme_r1_to_r19, docs_review_decision_brief_q3, docs_review_decision_brief_q5, docs_review_decision_brief_q6, docs_review_decision_brief_q14, docs_review_decision_brief_q17, docs_review_decision_brief_q25, docs_review_decision_brief_q23 [EXTRACTED 1.00]
- **Part A: the seven documents AMPM reviews and decides on** — docs_readme_part_a1, docs_readme_part_a2, docs_readme_part_a3, docs_readme_part_a4, docs_readme_part_a5, docs_readme_part_a6, docs_readme_part_a7 [EXTRACTED 1.00]
- **Committed session-memory configuration** — docs_readme_claude_settings_json, docs_readme_mcp_json, docs_readme_graphify_skill, docs_readme_graphifyignore, docs_readme_claude_md, docs_readme_graphify_out [EXTRACTED 1.00]
- **Decision propagation pipeline** — docs_readme_decisions_json, docs_tools_apply_decisions, docs_tools_decision_log_build, docs_tools_decision_register_build, docs_tools_assumptions_sheet_build, docs_tools_field_matrix_build, docs_tools_vault_build, docs_tools_site_build, docs_readme_published_artifact, docs_tools_pdf_build [EXTRACTED 1.00]
- **Session continuity stores (vault, palace, graph)** — docs_readme_obsidian_vault, docs_readme_mempalace_wing_ampm, docs_readme_graphify_out [EXTRACTED 1.00]

## Communities (68 total, 1 thin omitted)

### Community 0 - "Acceptance Tests and Traceability"
Cohesion: 0.06
Nodes (95): architecture.md, AMPM Platform Data Model and ER Diagrams, Changes from AMPM's decisions of 25 October 2026 (§0a), Entity index with phases and restricted fields (§19), Module overview ER diagram (§2), field-matrix.md, permission-matrix.md, Test identifiers AC-nn.m (+87 more)

### Community 1 - "AMPM's Answers and Business Rules"
Cohesion: 0.09
Nodes (57): Decisions AMPM Must Confirm Before Implementation (commercial plans, service catalogue, approvals, financial visibility, hotel data governance, guest communications, identity documents, languages/currency, technology ownership, launch scope), Technical and Non-Functional Requirements (responsive desktop/tablet/mobile; shared backend with separate experiences; secure role-based project-scoped auth; server-side validation; encryption; private file storage; audit trail; backups; search/bulk operations; media optimisation; configurable commercial rules; duplicate-submission prevention; retention rules; documented integration boundaries), Decisions Still to Be Confirmed by AMPM (subscription price/duration/inclusions, cancellation and refund terms, hotel service fees, management fees and payment stages, release scope, roles and data-access rules), AMPM App — Compiled Questions & Answers (Q1-Q25 + hotel discovery demo requirements), EVA (AMPM team authority: maintains hotel data, approves operational exceptions, accesses guest counts), Hotel Discovery Demo Requirements (no independent registration; mobile + OTP login; max three locations with limited hotel info and street view; approximate pricing; optional 15-20 min Zoom call; AMPM-created account; INR 50,000 one-month fee; read-only after expiry; full modules only after confirming complete management), Q1 — iOS and Android apps with offline access and automatic sync on reconnect, Q2 — Subscription payment: AMPM creates the account or sends an invitation link; client enters basic wedding details; online card and UPI (+49 more)

### Community 2 - "Role and Permission Matrix"
Cohesion: 0.06
Nodes (41): Export pipeline in the worker with class stripping and audit, Authorisation test suite generated from the permission matrix, Identity document controls, Integration: accounting export (CSV, Tally XML if used), Job: export build, Phase 5 Stabilisation, Policy pipeline: eight-step enforcement of the permission matrix (§6), Security and privacy controls by layer (§11) (+33 more)

### Community 3 - "Round-Two Open Questions (R1 to R19)"
Cohesion: 0.07
Nodes (50): Milestone schedule and cost estimate, Part A7: The questions still open, Part A8: Short version, Identifier family R1 to R19 (open after the 25 October answers), Q23: client access after closure, Eleven points still to confirm (AMPM's own list, 25 October 2026), remaining-questions.md - the questions still open (R1 to R19), Group 1: Getting in — the demo, payment and refunds (+42 more)

### Community 4 - "Technical Specification v1.0"
Cohesion: 0.09
Nodes (37): AMPM Developer Technical Specification v1.0 (20 October 2026), Acceptance Test Scenarios (15 scenarios: enquiry capture, subscription scope, demo isolation, pricing freshness, private negotiation notes, project permissions, independent functions, vendor shortlist size, version-locked approvals, de-duplicated RSVP, attendance impacts, URL/API/file access control, readiness exceptions, incidents, closure checks), AMPM Team Workspace (leads, hotels, projects, vendors, budgets, guests, approvals, execution; role-based and project-scoped access), Client Portal (hotel discovery for subscribers; wedding workspace for engaged clients; access depends on subscription, service agreement and project permissions), Client Portal — Engaged Wedding Client Screens (dashboard, overview and decision-maker contacts, functions, client-facing budget, vendor options, design studio, invitations/save-the-dates, RSVP progress, menus, documents and notifications), Deliverables Expected from the Development Team (wireframes, user-flow diagrams, ER diagram and schema/migrations, field matrix, role/permission matrix, architecture and integration plan, milestone schedule and cost, test cases, deployment/backup/handover documentation), Field Specification Pattern (name, type/validation, who edits, client/internal visibility, requiredness by stage, automation and report impact; example fields incl. hotel verification date, vendor decision, approval decision, identity document), Four Connected Experiences with Access Rules (public website, client portal, AMPM team workspace, guest RSVP portal) (+29 more)

### Community 5 - "Decision Brief Open Areas"
Cohesion: 0.06
Nodes (33): Screen prefixes PUB, AUTH, DM, CP, TW, GR, Demo reached by mobile OTP, Four experiences in one system, Guest identity documents, never Aadhaar, Margin model with separate internal cost, Offline wedding-day operations, Private RSVP link per household, Q1 - Website or native app, and is offline use required (+25 more)

### Community 6 - "Containers, Integrations and Technology"
Cohesion: 0.10
Nodes (37): Architecture risks and mitigations (§14), api container: NestJS modular monolith (REST, OpenAPI, WebSocket), Edge: CloudFront CDN with signed URLs, WAF, load balancer with TLS termination, Object storage: three S3 buckets by sensitivity, PostgreSQL 16 on RDS Multi-AZ with PITR, Redis (ElastiCache): queues, sessions, rate limits, caches, chat bus, S3 restricted identity bucket (separate KMS key, no CDN, access audited), Video delivery: Cloudflare Stream or Mux with signed playback (+29 more)

### Community 7 - "User Flows and Status Transitions"
Cohesion: 0.11
Nodes (32): Deployment freeze while any project is live, Job: incident escalation timer, Job: material-change impact flags, Client request status transitions, Project closure checklist transitions, Hotel enquiry status transitions, Incident status transitions, SYS — System principal (jobs, webhooks, automation) (+24 more)

### Community 8 - "Identity, Access and Administration Tables"
Cohesion: 0.11
Nodes (15): Assumptions register (§0), audit_events, auth_tokens, import_jobs, Module A — Identity, access and administration, notification_preferences, notifications, Open modelling questions for review (§21) (+7 more)

### Community 9 - "Package Index and Vault"
Cohesion: 0.11
Nodes (36): Acceptance-criterion test cases (AC-nn.m), AMPM Dashboard.base, Architecture (architecture.md), Assumption registers (A, P, T, U, W, V), Assumptions taken (review/assumptions-taken.md), Audit findings (CF, GP, AM, RK), Build decision records (notes/Build decisions/, D-nnn), Data model (data-model.md) (+28 more)

### Community 10 - "Memory Hooks and Commit Automation"
Cohesion: 0.09
Nodes (33): ampm-platform repository, Automatic checkpoint, vault sync and journal hooks, CLAUDE.md, .claude/settings.json, graphify 0.9, graphify knowledge graph (graphify-out/), graphify-out/ (knowledge graph), /graphify skill (.claude/skills/graphify/) (+25 more)

### Community 11 - "Specification Data Model and Phases"
Cohesion: 0.14
Nodes (39): Function Readiness Status (not started, in progress, blocked, ready, live, completed; requires the checklist or a documented authorised exception), Module: Administration (user, role, permission, notification, audit event, configuration -> secure configurable operation), Module: Budget / Finance (budget category/line, quote, contract, invoice, payment, cost entry -> estimate, approval, actuals, variance), Module: Creative / Approvals (design brief, version, comment, approval, change request -> versioned creative decisions), Module: Food / Entertainment / Production (menu version, artist booking, technical rider, production item, readiness check -> function readiness), Module: Functions (function, schedule, checklist, venue, run-of-show -> function-level plans connected to the wedding), Module Inventory (14 modules with core records and outcomes), Module: Invitations / RSVP (invitation, recipient, guest, family group, response, attendance -> invitation-to-attendance workflow) (+31 more)

### Community 12 - "Specification Amendments and Rules"
Cohesion: 0.09
Nodes (24): Added requirement: configurable settings for subscription price and duration, demo limits, categories, thresholds and approval rules, Added requirement: tracked request statuses submitted, under review, accepted, rejected, implemented, closed, Decision Q21: change requests submitted, reviewed, accepted or rejected, implemented, closed; new version on a change to an approved item, Decision Q25: material-change thresholds configurable; values and approval rules to be defined by AMPM, AM-4 Material changes undefined, BIZ: AMPM Website and App Business Explanation for Developer, CF-7 Roles: proposal or decision, GP-10 Saved hotels, favourites and compare have no entity (+16 more)

### Community 13 - "Vault and Decision Generators"
Cohesion: 0.11
Nodes (18): decisions.json, build(), q_titles(), audit_questions(), build(), load_old_graph(), main(), current_session() (+10 more)

### Community 14 - "Subscription and Customer Journey"
Cohesion: 0.11
Nodes (30): Enquiry Form (name, contact, contact preference, tentative dates/destination, guest estimate, source/consent -> lead record in CRM), Module: CRM / Subscriptions (lead, contact, account, subscription, payment, service agreement -> lead conversion and access control), Table: client_accounts (id, primary_contact_id, status; subscriptions, service agreements, projects), Table: leads (id, source, status, contact, requirements, owner_user_id; can convert to client account), Table: service_agreements (id, account_id, service_type, scope, fee, terms_version, status; determines service access), Table: subscriptions (id, account_id, plan_id, status, starts_at, ends_at; controls hotel-discovery entitlement), CLIENTS tab — leads, profiles, follow-ups (enquiry/lead -> consultation -> questionnaire), Client Enquiry (Step 1: Instagram, ads, referrals, website; record contact, requirements, source) (+22 more)

### Community 15 - "Functions, Vendors and Tasks Tables"
Cohesion: 0.13
Nodes (26): artist_bookings, checklist_items, checklist_templates, checklists, client_feedback, function_programme_items, function_types, functions (+18 more)

### Community 16 - "Shared Page Builder"
Cohesion: 0.08
Nodes (29): marked (npm package), Published claude.ai artifact for AMPM, Published brief page (claude.ai artifact), Published package page (claude.ai artifact), Published questions page (claude.ai artifact), site/brief.html (decision brief page), site_build.mjs --brief, site_build.mjs --questions (+21 more)

### Community 17 - "Client Portal Request Loop"
Cohesion: 0.11
Nodes (19): AM-12: invitations are design work (Phase 2) and distribution work (Phase 3), CF-2: client-portal flowchart has no hotel area although hotel discovery is the subscription product, CF-6: client-portal flowchart shows invoices and payment status the specification leaves undecided, Client portal, GP-1: no definition of what each account state may see, GP-10: save favourites had no record, GP-14: change request named but has no record, statuses or rules, GP-15: 'messages, questions' implies a chat feature no other document mentions (+11 more)

### Community 18 - "Guest and Lead Screens"
Cohesion: 0.11
Nodes (30): CP-31 Guest list, CP-38 Documents and schedules, CP-39 Notifications and preferences, GR-03 Attendance, T1 List and filter template, T4 Board template, TW-10 Lead pipeline, TW-26 Enquiry queue (+22 more)

### Community 19 - "Architecture Decisions and Delivery"
Cohesion: 0.09
Nodes (23): Architecture principles (§1), Backups and disaster recovery table, Capacity and indicative running cost (USD 450 to 900 per month), Data layer (§8), Delivery: trunk-based development, staging auto-deploy, tagged production releases, Demo isolation by is_demo scoping and nightly seed restore, Digital Personal Data Protection Act 2023 controls, Environments: development, staging, production (+15 more)

### Community 20 - "Technology and Operations Decisions"
Cohesion: 0.12
Nodes (24): architecture.md, Decision Q11: email and WhatsApp required, SMS proposed, live chat on the home page, Decision Q13: mobile OTP sign-in for prospects, demo users and clients; no unrestricted self-registration, Decision Q14: hosting, backup frequency and recovery timelines still to be confirmed with the developer, Decision Q15: about 200 hotels and 20 concurrent weddings as the planning assumption, Decision Q16: Indian rupees, English, no GST invoices from the platform, Open: communication provider for WhatsApp and SMS, Open: initial capacity for staff, hotels, weddings and guests (+16 more)

### Community 21 - "API Modules and Build Phases"
Cohesion: 0.16
Nodes (27): Build-out by phase (§13), Key flow 7.5: daily hotel freshness job, Maintained hotel search view (tsvector and trigram index), Job: media processing, Module boundaries inside the API (§5), Budget and finance module (G), Checklists, closure, feedback module (O), Public content module (P) (+19 more)

### Community 22 - "Team Workspace Areas"
Cohesion: 0.12
Nodes (15): AM-6: 'Database' under More read as the hotel database, CF-3: team-app flowchart lacks the Hotels and Guests areas listed in the brief and specification, CF-8: consultation and questionnaire appear only in the team-app flowchart, GP-28: schedule and calendar on the Home tab appear only in the flowchart, GP-29: feedback and archive at closure appear only in the flowchart with no records, Q24: archive after the access window, AMPM team workspace, FINANCE AND REPORTS area: payments, invoices, milestones, reports, final accounts (+7 more)

### Community 23 - "Vault Sync Script"
Cohesion: 0.14
Nodes (16): ampm-vault repository, app-ampm GitHub account, launchd agent com.ampm.vault-sync, post-commit hook, git-credential-ampm.sh script, main(), configure(), setup_git.sh script (+8 more)

### Community 24 - "Guest and RSVP Tables"
Cohesion: 0.22
Nodes (20): family_groups, guest_departures, guest_function_attendance, guest_support_requests, guests, invitation_recipients, invitation_versions, invitations (+12 more)

### Community 25 - "Accounts, Roles and Sign-in Findings"
Cohesion: 0.13
Nodes (18): Fifteen acceptance test scenarios, AM-1: 'a link' - one link for the whole wedding or a private link per household, CF-5: AMPM creates every account (Why note) versus a payment journey from the website (specification), CF-7: specification lists eleven roles as final while the brief says roles must not be assumed, Decisions AMPM must confirm (specification §13), Field specification pattern, GP-18: no tax fields, GP-25: what the couple may see of their guests and who maintains the list is unstated (+10 more)

### Community 26 - "Business Process and Account States"
Cohesion: 0.15
Nodes (17): AM-14: 'a paid business asset' could hint at licensing to other planners, AM-8: 'three distinct environments' - three hosted systems or three experiences of one, AMPM business process (Steps 1-10), CF-1: the demo belongs to neither the four experiences nor the three environments, and to no phase, CF-4: team-app flowchart starts at a qualified client, omitting demo, subscription and hotel work, CF-9: three distinct environments (Why note) versus one shared backend (specification), Customer journey stages 1-5 (website, demo, subscription, project, full access), GP-2: demo undefined (how granted, what it shows, when it ends) and no trial status (+9 more)

### Community 27 - "Team App Flowchart and Operations"
Cohesion: 0.13
Nodes (26): Business Journey (lead -> controlled demo -> subscription after payment -> destination/hotel discovery -> optional consultancy -> scope/fees/agreement and wedding project -> parallel planning -> 5-10 vendor options per category -> execution, departures, closure), Module: Closure (departure record, lost-and-found item, vendor completion, final account -> formal closeout), Module: Tasks / Risk (task, dependency, staff assignment, incident, resolution -> operational accountability), Notifications and Automation (payment activates only the purchased entitlement; stale pricing flagged after configurable age; approval notifications; material-change flags on budgets/contracts/tasks/run-of-show; RSVP changes recalculate attendance; logistics alerts; dashboard exceptions; incident escalation; notification log), Table: tasks / incidents (id, project_id, owner, due_at/severity, status, outcome; accountability and response), Table: travel_segments / transfers (id, guest/group_id, mode, pickup, destination, time, status; feeds transport planning), AMPM Team App — Level 1 Visual Flowchart, Access Control (role-based permissions, internal vs client data, activity history) (+18 more)

### Community 28 - "Decision Log and Source Documents"
Cohesion: 0.11
Nodes (22): Added requirement: public website limited to company information, enquiries, demo requests, contact, login and invitation entry points, with no staff editing, AMPM App Compiled Questions and Answers (PDF, 25 Oct 2026), AMPM Management Final App Decision Brief and Developer Requirements (PDF, 25 Oct 2026), AMPM Platform Decision Log (25 Oct 2026), data-model.md, Decision Q12: no website editing in the app, Decision Q18: a wedding can involve multiple hotels and venues, Decision Q19: room blocks by hotel, category and dates; team-managed allocation; room-wise and person-wise counts (+14 more)

### Community 29 - "Documents, Media and Audit Tables"
Cohesion: 0.14
Nodes (13): AMPM Developer Technical Specification v1.0 (SPEC), Coverage against the audit (§20), Modelling conventions (§1), document_access_links, documents, hotel_wedding_references, identity_documents, media_assets (+5 more)

### Community 30 - "Platform, Subscription and Access Decisions"
Cohesion: 0.13
Nodes (21): Added requirement: demo after mobile OTP with up to three locations and sample hotels with indicative prices, Added requirement: staff offline scope with visible sync state, conflict detection and role-limited local data, Decision Q1: native iOS and Android apps with offline wedding-day access and sync, Decision Q23: three months read-only client access after the wedding, then archive on AMPM approval, Decision Q3: hotel-discovery subscription Rs 50,000 one-time for one month; demo via OTP instead of a trial, Open: exact demo duration and final hotel and location limits, Open: exact workflow for archiving projects and restoring access after archiving, Open: final material-change thresholds and approval rules (+13 more)

### Community 31 - "Design Package Index"
Cohesion: 0.13
Nodes (24): AMPM (client), AMPM's answers of 25 October 2026 (reference_docs/answers/), AMPM Platform Design Package, Annotated brief (review/annotated-brief.md), BIZ: business explanation, Identifier family CF, GP, AM, RK (audit findings), decisions.json, Open decisions (review/open-decisions.md) (+16 more)

### Community 32 - "Guest Identity and Privacy Decisions"
Cohesion: 0.15
Nodes (19): Decision Q17: AMPM decides privacy wording and retention; no automatic deletion, Decision Q7: RSVP links per side or combined; RSVP team loads the list; guests cannot edit after submission; per-person counting, Decision Q8: identity documents only where a hotel requires them, never Aadhaar, restricted storage, no automatic deletion, Open: final RSVP link structure, per side or one combined link, Open: privacy wording and retention periods for leads, guest records and identity documents, wireframes.md, AM-1 RSVP link model: shared wedding link vs per-guest token, GP-13 Guest atomic unit: individual vs family group (+11 more)

### Community 33 - "Client Portal Approvals and Requests"
Cohesion: 0.26
Nodes (20): CP-10 Hotel proposal detail and decision, CP-21 Wedding overview and contacts, CP-22 Functions list, CP-23 Function workspace, CP-26 Vendor options, CP-27 Vendor proposal detail, CP-28 Design studio, CP-29 Design item detail (+12 more)

### Community 34 - "Budget, Invoices and Closure Tables"
Cohesion: 0.20
Nodes (14): budget_categories, budget_lines, cost_entries, external_venues, invoice_lines, invoices, lost_and_found_items, Module E — Wedding project (+6 more)

### Community 35 - "Requirements Audit and Sources"
Cohesion: 0.21
Nodes (18): Added requirement: platform for AMPM's internal business use, not for licensing to other wedding planners, Decision Q20: tracked requests with conversation history and live chat both required, AM-14 Tenancy: AMPM only or future licensing, AM-8 Demo data separation, AMPM Platform Requirements Audit (23 Oct 2026), CF-2 Client-portal flowchart omits hotel discovery, CF-3 Team flowchart hides Hotels and Guests, CF-4 Team flowchart shows one linear path with no subscription or consultancy branch (+10 more)

### Community 36 - "Technology Register and Offline Sync"
Cohesion: 0.17
Nodes (14): Architecture changes from AMPM decisions of 25 October 2026, Client app: React Native iOS and Android (web build open), Team app: React Native iOS and Android, offline-first, department-scoped, Decisions for AMPM that this plan depends on (§15), Identity and sessions module (A), Offline sync conflict handling, Real-time chat channel: Socket.IO on the API with a Redis message bus, Server-side sessions in Redis with secure HttpOnly SameSite cookies (+6 more)

### Community 37 - "Hotel Enquiry and Proposal Tables"
Cohesion: 0.23
Nodes (18): booking_milestones, configurations, contracts, hotel_contacts, hotel_enquiries, hotel_enquiry_events, hotel_proposal_lines, hotel_proposals (+10 more)

### Community 38 - "Hotel Database and Rate Cards"
Cohesion: 0.13
Nodes (15): AM-2: a function's venue may be outside the hotel database and a wedding may use more than one hotel, AM-5: room category capacity - number of rooms or people per room (now two fields), AMPM Website & App — Simple Business Explanation for Developer, GP-11: rooms allocated with nothing to allocate them from, GP-12: wedding_projects.hotel_id allows only one hotel per wedding, GP-20: media has a visibility flag but no record of rights or consent, GP-39: external hotel systems not defined, GP-8: data model has no place to store hotel prices or their verification dates (+7 more)

### Community 39 - "Wedding Dashboards and Finance Screens"
Cohesion: 0.19
Nodes (19): CP-11 Subscription, plans and agreements, CP-20 Wedding dashboard, CP-24 Budget, CP-25 Invoice detail and payment, PUB-07 Demo and subscription, T6 Dashboard template, TW-12 Client accounts, TW-13 Account detail (+11 more)

### Community 40 - "Guest RSVP Flow and Links"
Cohesion: 0.15
Nodes (14): AM-4: 'material changes' has no definition, GP-13: counting guests by family or by person left open, GP-24: meal preferences and allergies not mentioned though menus and caterers need them, GP-32: notifications have no channels or preferences defined, Guest RSVP portal, Notification and automation rules, Q11: notification channels and messaging integrations, Q25: material change thresholds (+6 more)

### Community 41 - "Sign-in and RSVP Portal Screens"
Cohesion: 0.21
Nodes (18): AUTH-01 Sign in, AUTH-02 Account activation, AUTH-03 Password reset, AUTH-04 Access help, AUTH-05 Authenticator enrolment (staff), AUTH-06 Mobile OTP sign-in (prospects and clients), Authentication screens AUTH (sign-in, activation, recovery, OTP), CP-40 Feedback (+10 more)

### Community 42 - "Hotel Discovery Screens"
Cohesion: 0.26
Nodes (18): Client portal (CP screens), CP-01 Subscriber home, CP-02 Destination list, CP-03 Destination detail, CP-04 Hotel search results, CP-05 Hotel detail, CP-06 Saved hotels and compare, CP-07 Request hotel assistance (+10 more)

### Community 43 - "Field Matrix Generator"
Cohesion: 0.19
Nodes (11): automation(), build(), canonical_class(), classify(), editor(), fk_target(), is_actor(), parse_model() (+3 more)

### Community 44 - "CRM, Subscription and Payment Tables"
Cohesion: 0.22
Nodes (11): account_contacts, client_accounts, lead_activities, lead_sources, leads, Module B — CRM, subscriptions and commercial agreements, plan_modules, plans (+3 more)

### Community 45 - "Decision Propagation and Generated Files"
Cohesion: 0.13
Nodes (12): decision-log.md, decision-register.md, Assumption prefixes A, P, T, U, W, V, Part A6: Assumptions we took, Part B0: decision-log.md, Part B2: decision-register.md, ASSUMED placeholder (A/U/W/T/P), Assumptions sheet (+4 more)

### Community 46 - "Background Jobs and Domain Events"
Cohesion: 0.17
Nodes (14): Monthly partitioning of audit_events and notifications, Background jobs (§9): idempotent and outcome-recorded, Domain events (attendance.changed, approval.requested, approval.decided, client_request.accepted), Key flow 7.3: approval of a vendor proposal version, Job: attendance recalculation (totals, headcounts, room and transfer flags), Job: import apply, Job: notification dispatch on domain events, Job: overdue surfacing (tasks, milestones, vendors, readiness) (+6 more)

### Community 47 - "Decisions on Accounts, RSVP and Requests"
Cohesion: 0.17
Nodes (14): Decision Q22: no vendor or hotel logins in the current version, Decision Q5: two nominated family representatives, one per side, with equal rights and no cost visibility, Decision Q6: AMPM controls permissions; department-based staff access; internal finance restricted to authorised personnel, Open: final staff roles and which internal users may access hotel costs or vendor costs, Open: whether one representative's approval completes a decision or both must approve, permission-matrix.md, user-flows.md, AM-10 Vendors and hotels as users (+6 more)

### Community 48 - "Hotel Data in the Brief"
Cohesion: 0.22
Nodes (16): Client Portal — Hotel Discovery Screens (sign-in/activation, subscriber home, destinations, hotel search/filter, hotel detail with last-verified commercial information, compare and save, request assistance, track enquiry/negotiation/visit/proposal/booking status), Module: Hotel Consultancy (availability enquiry, response, negotiation, site visit, proposal, booking milestone -> traceable hotel assistance), Module: Hotel Intelligence (destination, hotel, room category, inventory snapshot, venue, media, verification -> curated discovery with freshness labels), Table: destinations (id, name, region, country, status; has many hotels), Table: hotel_enquiries (id, account/project_id, hotel_id, dates, guest_count, status; responses, visits, proposals, negotiation events), Table: hotel_rooms / venues (id, hotel_id, category/type, capacity, facilities; may be proposed for a wedding), Table: hotel_verifications (id, hotel_id, field_group, verified_at, source, status; freshness of price/facility information), Table: hotels (id, destination_id, profile, address, contact, status; rooms, venues, media, verification history) (+8 more)

### Community 49 - "Finance Visibility and Payments"
Cohesion: 0.18
Nodes (9): Client vs internal visibility rule (server-side enforcement), GP-17: payments and invoices have no direction, GP-6: no records or rules for wedding-management payment stages, GP-7: no refund handling, Q3: subscription price, duration, inclusions, recurrence, cancellation and refund terms, demo, Q4: financial visibility and fees - margin or visible fee, hotel service fees, management fees and payment stages, MY WEDDING tab: overview and contacts, functions, vendors, designs, invitations, guest list, RSVP progress, menus, R3: Subscription cancellation and refund rule (+1 more)

### Community 50 - "Session Journal Script"
Cohesion: 0.28
Nodes (11): commits_since(), create_note(), find_note(), first_timestamp(), git(), local_time(), main(), repo_url() (+3 more)

### Community 51 - "Offline Operations and Readiness"
Cohesion: 0.20
Nodes (10): AM-3: function readiness versus a function's own status, Cost estimate and milestone schedule (held), GP-19: twelve record kinds have no statuses and nobody is named to move statuses, GP-22: bulk operations required but no import, GP-33: responsive interface versus 'app', GP-34: no mention of working offline on the wedding day, Q1: delivery platform - responsive website or native app, and offline use on the wedding day, Q15: expected volumes that size the platform (cost estimate dependency) (+2 more)

### Community 52 - "Live Operations Screens"
Cohesion: 0.35
Nodes (13): Changes from AMPM's decisions of 25 Oct 2026 (section 0a), CP-41 Closed project state, T8 Live console template, TW-35 Function workspace, TW-45 Closure checklist and final accounts, TW-56 Travel and transport, TW-70 Tasks, TW-72 Staffing roster (+5 more)

### Community 53 - "Approvals, Designs and Chat Tables"
Cohesion: 0.33
Nodes (10): approval_decisions, approvals, client_requests, comments, conversations, design_items, design_versions, messages (+2 more)

### Community 54 - "Enquiry, Demo and Payment Findings"
Cohesion: 0.23
Nodes (11): Added requirement: client completes basic wedding details before paying, Decision Q2: AMPM creates or invites the account; client enters basic wedding details and pays online by card or UPI, Open: payment gateway provider and transaction-handling requirements, CF-1 Three environments vs four experiences, GP-2 Trial mechanics, GP-4 One-time vs recurring subscription, Q2 Payment mode for Phase 1, Q3 Subscription shape (+3 more)

### Community 55 - "Client-visible Finance Decision"
Cohesion: 0.23
Nodes (10): Added requirement: vendor categories with contact details internal by default, Decision Q4: hotel discovery is a separate paid service; internal costs and margins never shown; no online milestone payments in the first release, Open: which hotel-assistance services beyond availability checks carry a fee, CF-6 Client-visible finance, GP-17 Payments and invoices lack direction, parties and client/internal split, GP-5 Hotel-assistance commercial flow, GP-6 Client payments for wedding milestones, Q4 Client-visible finance (+2 more)

### Community 56 - "Wireframe Assumptions and Demo Mode"
Cohesion: 0.16
Nodes (9): Wireframes assumptions register W-1 to W-15 (section 0), Demo mode (DM), DM-01 Demo banner and landing, Team workspace (TW screens), TW-01 Team dashboard, TW-02 Calendar, TW-11 Lead detail, Team workspace area: Home (TW-0x) (+1 more)

### Community 57 - "Vendor and Configuration Screens"
Cohesion: 0.23
Nodes (12): CP-32 Household and guest detail, GR-05 Travel and accommodation, T2 Record detail with tabs template, TW-33 Project settings and members, TW-55 Rooming, TW-60 Vendor master, TW-61 Vendor profile editor, TW-62 Vendor quotes (+4 more)

### Community 58 - "Client Portal Flowchart (as supplied)"
Cohesion: 0.35
Nodes (13): AMPM Client Portal — Level 1 Visual Flowchart, Access Verified? gate (secure sign-in; otherwise contact AMPM for access help), AMPM Team Reviews Request (approve, respond, request clarification), Approval Loop (approval required? -> submit decision/change request -> AMPM team reviews -> updated wedding information), APPROVALS — proposals & selections, budget/design approvals, change requests, Client Access Rules (only own wedding; visible, approved information), Client Action (view, submit details, review, approve, ask a question), Client Portal Navigation (Home, My Wedding, Approvals, More) (+5 more)

### Community 59 - "Hotel Data Findings"
Cohesion: 0.32
Nodes (11): Added requirement: adding a hotel to the selection or cart can trigger an availability request to the hotel team, Added requirement: hotel page content distinguishing indicative, requested, verified and awaiting-confirmation information, Decision Q9: Eva maintains about 200 hotels with indicative price ranges verified about three times a year, GP-20 Media rights for previous clients' wedding photos, GP-22 Bulk import and migration, GP-8 Hotel prices have nowhere to live, GP-9 Availability has no entity or calendar, Q9 Hotel data (+3 more)

### Community 60 - "Requests, Threads and Live Chat"
Cohesion: 0.39
Nodes (9): CP-36 Requests, CP-37 Request detail, CP-42 Live chat, T7 Thread and timeline template, TW-27 Enquiry detail, TW-42 Client requests queue and detail, TW-57 Guest support requests, TW-71 Task detail (+1 more)

### Community 61 - "Public Website and Subscription Screens"
Cohesion: 0.38
Nodes (9): PUB-01 Home, PUB-02 How it works, PUB-03 Services, PUB-04 Destinations and selected work, PUB-05 About, PUB-06 Contact, enquiry and demo request, PUB-08 Privacy notice and terms, PUB-09 Enquiry submitted (+1 more)

### Community 62 - "Data Protection and Identity Documents"
Cohesion: 0.36
Nodes (6): Digital Personal Data Protection Act, GP-40: Digital Personal Data Protection Act obligations to guests not addressed, GP-41: Indian rules restrict storing Aadhaar numbers, GP-44: retention and deletion rules left to AMPM, Q17: consent wording, privacy notice and retention periods, Q8: identity document use case, authorised access, retention and deletion

### Community 63 - "First Release Scope"
Cohesion: 0.33
Nodes (7): Added requirement: readiness exceptions record the unmet check, reason, authorised person, time and resulting status, Decision Q10: first release includes demo, discovery, wedding management, vendors, portal, department access, RSVP, requests, live chat and offline operations, Eva (AMPM; maintains the hotel data; her authorised personnel approve operational exceptions), Open: single release or hotel discovery first with the wedding modules following, AM-11 Phase 1 consultancy depth, GP-23 Public website content management, Q10 Phase 1 scope

### Community 64 - "Website Content and Plans"
Cohesion: 0.31
Nodes (5): GP-23: no document says who edits website content, GP-3: subscriptions.plan_id references a plan table that does not exist, GP-4: recurring versus one-time subscription not stated, Public website, Stage 1: public website (learn, examples, request a demo or access)

### Community 65 - "Hotel and Contract Tables"
Cohesion: 0.52
Nodes (5): AMPM Business Rules (BIZ), cms_pages, cms_showcase_items, destinations, Module P — Public website content (dormant)

### Community 66 - "Vendor Availability and Access"
Cohesion: 0.33
Nodes (3): GP-21: vendor availability listed but had no record, Q22: whether vendors or hotels ever log in, VENDORS area: master list, availability, quotes, contracts, deliverables

## Ambiguous Edges - Review These
- `Technical and Non-Functional Requirements (responsive desktop/tablet/mobile; shared backend with separate experiences; secure role-based project-scoped auth; server-side validation; encryption; private file storage; audit trail; backups; search/bulk operations; media optimisation; configurable commercial rules; duplicate-submission prevention; retention rules; documented integration boundaries)` → `Application Platforms (iOS and Android applications; offline operational use on the wedding day with automatic synchronisation; final architecture agreed with the development team)`  [AMBIGUOUS]
  graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md · relation: conceptually_related_to
- `Technical and Non-Functional Requirements (responsive desktop/tablet/mobile; shared backend with separate experiences; secure role-based project-scoped auth; server-side validation; encryption; private file storage; audit trail; backups; search/bulk operations; media optimisation; configurable commercial rules; duplicate-submission prevention; retention rules; documented integration boundaries)` → `Wedding-Day Operations and Offline Access (iOS/Android; offline access to assigned tasks, department info, readiness checklists, cue sheets, arrival lists; record updates offline; sync on reconnect; show offline and pending-sync state; no silent loss; conflict detection and resolution; protect locally stored data; limited to the user's role)`  [AMBIGUOUS]
  graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md · relation: conceptually_related_to
- `First Release Scope (Q10): demo and subscription-based hotel discovery, wedding management after appointment, vendor selection, client portal, department-based team access, RSVP, tracked requests, live chat, offline wedding-day operations; only Eva authorises exceptions` → `Recommended Implementation Phases (1 Foundation: website/CRM, accounts/subscriptions, hotel database, search, shortlist, enquiry; 2 Wedding planning; 3 Guest operations; 4 Live execution; 5 Stabilisation)`  [AMBIGUOUS]
  graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md · relation: conceptually_related_to
- `BIZ: AMPM Website and App Business Explanation for Developer` → `Principle: vendor contact details stay internal even after a vendor is selected`  [AMBIGUOUS]
  docs/review/decision-brief.md · relation: cites
- `Added requirement: public website limited to company information, enquiries, demo requests, contact, login and invitation entry points, with no staff editing` → `Decision Q20: tracked requests with conversation history and live chat both required`  [AMBIGUOUS]
  docs/decision-log.md · relation: conceptually_related_to
- `vendor_category_links` → `project_hotels`  [AMBIGUOUS]
  docs/data-model.md · relation: semantically_similar_to
- `Table: wedding_projects (id, account_id, dates, destination_id, hotel_id, status; parent for wedding records)` → `Q18 — A wedding can involve multiple hotels and venues`  [AMBIGUOUS]
  graphify-out/converted/AMPM_Developer_Technical_Specification_v1_4babf6ee.md · relation: conceptually_related_to

## Knowledge Gaps
- **55 isolated node(s):** `PATH`, `PATH`, `PATH`, `Module overview ER diagram (§2)`, `COVERED requirement` (+50 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 105 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AMPM Platform Data Model and ER Diagrams` connect `Acceptance Tests and Traceability` to `Hotel and Contract Tables`, `Budget, Invoices and Closure Tables`, `Round-Two Open Questions (R1 to R19)`, `Hotel Enquiry and Proposal Tables`, `Hotel Database and Rate Cards`, `Decision Brief Open Areas`, `Identity, Access and Administration Tables`, `Package Index and Vault`, `CRM, Subscription and Payment Tables`, `Decision Propagation and Generated Files`, `Functions, Vendors and Tasks Tables`, `Client Portal Request Loop`, `Approvals, Designs and Chat Tables`, `Guest and RSVP Tables`, `Documents, Media and Audit Tables`, `Data Protection and Identity Documents`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `AMPM Platform Data Model and ER Diagrams` (e.g. with `AM-5: room category capacity - number of rooms or people per room (now two fields)` and `Seasonal rate card with verification date`) actually correct?**
  _`AMPM Platform Data Model and ER Diagrams` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PATH`, `PATH`, `PATH` to the rest of the system?**
  _55 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Acceptance Tests and Traceability` be split into smaller, more focused modules?**
  _Cohesion score 0.06261923465379868 - nodes in this community are weakly interconnected._
- **Why does `Part 3 decisions: 25 questions with assumed defaults and AMPM's 25 Oct 2026 answers` connect `Decision Log and Source Documents` to `Guest Identity and Privacy Decisions`, `Requirements Audit and Sources`, `Specification Amendments and Rules`, `Decisions on Accounts, RSVP and Requests`, `Technology and Operations Decisions`, `Enquiry, Demo and Payment Findings`, `Client-visible Finance Decision`, `Hotel Data Findings`, `Platform, Subscription and Access Decisions`, `First Release Scope`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Technical and Non-Functional Requirements (responsive desktop/tablet/mobile; shared backend with separate experiences; secure role-based project-scoped auth; server-side validation; encryption; private file storage; audit trail; backups; search/bulk operations; media optimisation; configurable commercial rules; duplicate-submission prevention; retention rules; documented integration boundaries)` and `Application Platforms (iOS and Android applications; offline operational use on the wedding day with automatic synchronisation; final architecture agreed with the development team)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Technical and Non-Functional Requirements (responsive desktop/tablet/mobile; shared backend with separate experiences; secure role-based project-scoped auth; server-side validation; encryption; private file storage; audit trail; backups; search/bulk operations; media optimisation; configurable commercial rules; duplicate-submission prevention; retention rules; documented integration boundaries)` and `Wedding-Day Operations and Offline Access (iOS/Android; offline access to assigned tasks, department info, readiness checklists, cue sheets, arrival lists; record updates offline; sync on reconnect; show offline and pending-sync state; no silent loss; conflict detection and resolution; protect locally stored data; limited to the user's role)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._