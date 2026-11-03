# AMPM Platform — Field Matrix

**Status:** DRAFT v0.1, generated 2026-11-03 from [data-model.md](data-model.md) by `docs/tools/field_matrix_build.py`. Do not edit by hand; change the data model or `docs/tools/field_rules.py` and rebuild.
**Companions:** [requirements-audit.md](requirements-audit.md) (Q numbers), [data-model.md](data-model.md) (assumptions A-1 to A-30), [permission-matrix.md](permission-matrix.md) (role codes, visibility classes, assumptions P-1 to P-11).
**Spreadsheet version:** [field-matrix.csv](field-matrix.csv) has the same rows for filtering.

Implements the pattern in SPEC §5: for every field, its type and validation, options, who edits it, its visibility, when it becomes required, and its automation and report impact. Every field of every table in the data model appears here; standard columns (`created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`) are omitted because data-model.md §1 defines them once for all tables.

## 0. How to read

- **Edited by** uses the role codes of permission-matrix.md §2: SA, SM, HT, PM, CD, VC, RG, HL, FA for staff; CO, CA, CV for client users; GU for a guest token; DP for a demo prospect; SYS for the system. **(a)** means on assigned weddings only. "SYS (acting user)" means the field records whoever performed the action and is never typed in.
- **Visibility** is the field's class from permission-matrix.md §4: PUBLIC, CLIENT, INTERNAL, RESTRICTED-NOTES, RESTRICTED-FINANCE, RESTRICTED-CONTACT, RESTRICTED-BANK, SENSITIVE-GUEST, RESTRICTED-IDENTITY, SECRET. A qualifier such as "CLIENT when shared" means the class applies only once the owning record is shared; before that the field is INTERNAL.
- **Required** says when a value must exist: *At creation* (the record cannot be saved without it), *Before <state>* (the transition is refused without it), *System* (set by the platform), or *Optional*. This is how BIZ rule 2 and SPEC §5 ("avoid making all fields mandatory at project creation") are honoured: requiredness attaches to the stage that needs the value.
- **Automation and report impact** names the job, notification, recalculation or report that the field drives. "—" means the field is stored and displayed only.
- **Assumptions** on each table header tie the choices to the audit questions (Q) through the assumption registers (A, P).

Global conventions that apply to every row: money is `numeric(14,2)` with a sibling currency defaulting to INR (A-16, Q16); timestamps are UTC and displayed in the project time zone (A-16); soft delete only, with physical deletion by retention jobs (A-17, Q17); restricted and secret fields are never serialised to a principal outside their class (SPEC §4 security note).

## 1. Summary

| Module | Tables | Fields | Required at creation | Client or public visible | Restricted, sensitive or secret |
|---|---|---|---|---|---|
| A — Identity, access and administration | 19 | 116 | 59 | 10 | 1 |
| B — CRM, subscriptions and commercial agreements | 13 | 139 | 55 | 90 | 4 |
| C — Hotel intelligence | 10 | 100 | 38 | 82 | 11 |
| D — Hotel consultancy | 6 | 70 | 28 | 65 | 3 |
| E — Wedding project | 3 | 36 | 13 | 29 | 3 |
| F — Functions, programme and run-of-show | 4 | 43 | 17 | 27 | 1 |
| G — Budget and finance | 7 | 91 | 36 | 59 | 17 |
| H — Vendors, artists and production | 10 | 110 | 41 | 48 | 21 |
| I — Creative, approvals and client requests | 6 | 60 | 30 | 59 | 0 |
| J — Invitations, guests and RSVP | 9 | 100 | 41 | 52 | 5 |
| K — Rooms, travel and transport | 9 | 93 | 45 | 44 | 3 |
| L — Menus and food service | 4 | 31 | 15 | 25 | 0 |
| M — Tasks, staffing and incidents | 4 | 46 | 20 | 16 | 17 |
| N — Documents, media and identity documents | 4 | 56 | 31 | 0 | 18 |
| O — Checklists, closure and feedback | 4 | 30 | 17 | 7 | 0 |
| P — Public website content (dormant) | 2 | 17 | 8 | 17 | 0 |
| Q — Live chat | 2 | 16 | 6 | 16 | 0 |
| **Total** | **116** | **1154** | **500** | **646** | **104** |

Fields by visibility class: CLIENT 613, INTERNAL 347, Other (per record, recipient or parent) 57, RESTRICTED-NOTES 34, PUBLIC 33, RESTRICTED-FINANCE 31, RESTRICTED-CONTACT 13, RESTRICTED-IDENTITY 13, SECRET 7, RESTRICTED-BANK 4, SENSITIVE-GUEST 2.

---

## 2. Module A — Identity, access and administration

### `users`

Created at stage: **Account setup** · Default editor: SA; SM and PM (a) for client logins · Default visibility: INTERNAL · Assumptions: A-13 (Q13), P-6 (Q13)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `user_type` | one of the listed options; fixed at creation | staff, client, demo | SA; SM and PM (a) for client logins | INTERNAL | At creation | — |
| `name` | string, up to 255 characters |  | SA; SM and PM (a) for client logins | INTERNAL | At creation | — |
| `email` (unique) | valid email address, stored lowercase; unique |  | SA; SM and PM (a) for client logins | INTERNAL | At creation | Invite or activation email on creation |
| `phone` | E.164 format, default +91; required when OTP is enabled |  | SA; SM and PM (a) for client logins | INTERNAL | Optional | — |
| `status` | one of the listed options | invited, active, disabled, locked | SA; SM and PM (a) for client logins | INTERNAL | At creation | disabled or locked refuses sign-in at once and revokes sessions |
| `identity_subject` (unique) | string, up to 255 characters; the identity service's subject (Cognito sub, T-6); null until activated |  | SA; SM and PM (a) for client logins | INTERNAL | Optional | — |
| `mfa_enabled` | true or false; mandatory true for staff (A-13); enforced by the identity service, mirrored here |  | SYS; must be true for staff before first sign-in | INTERNAL | At creation for staff | — |
| `last_login_at` | timestamp (UTC) |  | SYS | INTERNAL | System | Inactive accounts reported for review |

### `roles`

Created at stage: **Configuration** · Default editor: SA · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `role_key` (unique) | lowercase snake_case; unique; super_admin, sales, hotel_team, project_manager, creative, vendor_coordinator, rsvp_team, hospitality, finance |  | SA | INTERNAL | At creation | — |
| `name` | string, up to 255 characters |  | SA | INTERNAL | At creation | — |
| `is_system` | true or false |  | SA | INTERNAL | Optional | System roles cannot be deleted or renamed |

### `permissions`

Created at stage: **Configuration** · Default editor: SA · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `permission_key` (unique) | module.resource.action with optional :assigned or :own suffix; unique |  | SA | INTERNAL | At creation | — |
| `description` | string, up to 255 characters |  | SA | INTERNAL | Optional | — |

### `role_permissions`

Created at stage: **Configuration** · Default editor: SA · Default visibility: INTERNAL · unique pair

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `role_id` (FK) | references roles |  | SA | INTERNAL | At creation | Change recomputes effective permissions; audited |
| `permission_id` (FK) | references permissions |  | SA | INTERNAL | At creation | — |

### `user_roles`

Created at stage: **Configuration** · Default editor: SA · Default visibility: INTERNAL · unique pair

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `user_id` (FK) | references see data model |  | SA | INTERNAL | At creation | — |
| `role_id` (FK) | references roles |  | SA | INTERNAL | At creation | Change recomputes effective permissions; audited |

### `grantable_capabilities`

Created at stage: **Configuration** · Default editor: SYS · Default visibility: INTERNAL · code-generated from packages/policy capabilities.json (D-036); not hand-edited

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `capability_key` (unique) | module.resource.action:scope, with #<condition-signature> when conditioned; unique |  | SYS | INTERNAL | At creation | — |
| `module` | string, up to 255 characters |  | SYS | INTERNAL | At creation | — |
| `resource` | string, up to 255 characters |  | SYS | INTERNAL | At creation | — |
| `action` | string, up to 255 characters |  | SYS | INTERNAL | At creation | — |
| `scope` | one of the listed options | all, assigned, own | SYS | INTERNAL | At creation | — |
| `conditions` | valid JSON matching the registered schema; packages/policy Condition[]; empty is a plain grant |  | SYS | INTERNAL | Optional | — |
| `source_roles` | valid JSON matching the registered schema; the StaffRole codes that hold this grant, for the class ceiling |  | SYS | INTERNAL | Optional | — |
| `is_staff_only` | true or false |  | SYS | INTERNAL | Optional | — |
| `is_escalation_locked` | true or false; role/account admin and identity: never assignable to a custom role |  | SYS | INTERNAL | Optional | Escalation-locked capabilities are never offered to a custom role |
| `label` | string, up to 255 characters |  | SYS | INTERNAL | At creation | — |

### `permission_sets`

Created at stage: **Configuration** · Default editor: SA · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `set_key` (unique) | lowercase snake_case; unique |  | SA | INTERNAL | At creation | — |
| `name` | string, up to 255 characters |  | SA | INTERNAL | At creation | — |
| `description` | string, up to 255 characters |  | SA | INTERNAL | Optional | — |
| `is_system` | true or false |  | SA | INTERNAL | Optional | System sets cannot be deleted or renamed |

### `role_grants`

Created at stage: **Configuration** · Default editor: SA · Default visibility: INTERNAL · unique pair

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `role_id` (FK) | references roles |  | SA | INTERNAL | At creation | Change recomputes effective permissions; audited; revokes sessions |
| `grantable_capability_id` (FK) | references see data model |  | SA | INTERNAL | At creation | — |
| `created_by` | UUID; who granted it |  | SA | INTERNAL | Optional | — |

### `permission_set_grants`

Created at stage: **Configuration** · Default editor: SA · Default visibility: INTERNAL · unique pair

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `permission_set_id` (FK) | references see data model |  | SA | INTERNAL | At creation | — |
| `grantable_capability_id` (FK) | references see data model |  | SA | INTERNAL | At creation | — |
| `created_by` | UUID |  | SA | INTERNAL | Optional | — |

### `role_permission_sets`

Created at stage: **Configuration** · Default editor: SA · Default visibility: INTERNAL · unique pair

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `role_id` (FK) | references roles |  | SA | INTERNAL | At creation | Change recomputes effective permissions; audited; revokes sessions |
| `permission_set_id` (FK) | references see data model |  | SA | INTERNAL | At creation | — |
| `created_by` | UUID |  | SA | INTERNAL | Optional | — |

### `project_members`

Created at stage: **Project setup** · Default editor: SA; PM (a); SM for client members · Default visibility: CLIENT · Assumptions: A-5 (Q5), P-2 (Q5) · unique on project_id and user_id

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `project_id` (FK) | references wedding_projects |  | SA; PM (a); SM for client members | CLIENT | At creation | — |
| `user_id` (FK) | references see data model |  | SA; PM (a); SM for client members | CLIENT | At creation | — |
| `project_role` | one of the listed options; (A-5 changed by Q5: two per wedding, one per side) | project_lead, staff, client_representative | SA; PM (a); SM for client members | CLIENT | At creation | Drives project-scoped permissions; change audited |
| `client_side` | one of the listed options; for client representatives (Q5) | bride, groom | SA; PM (a); SM for client members | CLIENT | Optional | — |
| `can_view_finance` | true or false; configuration, true for representatives pending Q4 |  | SA; PM (a); SM for client members | CLIENT | Optional | Gates the client finance serialisers (P-2) |
| `can_approve` | true or false; configuration, true for representatives |  | SA; PM (a); SM for client members | CLIENT | Optional | Gates approval decisions and vendor selections |
| `status` | one of the listed options | invited, active, removed | SA; PM (a); SM for client members | CLIENT | At creation | removed revokes access at once; set by the retention job after client_access_until (A-23) |
| `invited_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |
| `accepted_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |

### `auth_tokens`

Created at stage: **System** · Default editor: SYS · Default visibility: INTERNAL · Assumptions: A-13 (Q13)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `user_id` (FK) | references see data model |  | SYS | INTERNAL | At creation | — |
| `purpose` | one of the listed options | invite, password_reset, otp, magic_link | SYS | INTERNAL | At creation | — |
| `token_hash` | string, up to 255 characters |  | SYS | SECRET | At creation | — |
| `expires_at` | invite 7 days; password reset 1 hour; OTP 10 minutes |  | SYS | INTERNAL | System | Refused after expiry |
| `used_at` | timestamp (UTC) |  | SYS (when the action happens) | INTERNAL | System | Single use; a used token is refused |

### `notifications`

Created at stage: **System** · Default editor: SYS · Default visibility: Recipient only · Assumptions: A-11 (Q11)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | Recipient only | System | — |
| `recipient_type` | one of the listed options | user, guest | SYS | Recipient only | At creation | — |
| `recipient_id` | UUID |  | SYS | Recipient only | At creation | — |
| `channel` | one of the listed options; (A-11) | in_app, email, whatsapp, sms, push | SYS | Recipient only | At creation | — |
| `template_key` | string, up to 255 characters |  | SYS | Recipient only | At creation | — |
| `entity_type` | string, up to 255 characters |  | SYS | Recipient only | Optional | — |
| `entity_id` | UUID |  | SYS | Recipient only | Optional | — |
| `status` | one of the listed options | queued, sent, delivered, failed, read | SYS | Recipient only | At creation | Delivery webhooks update the status; failed sends retry per channel policy |
| `provider_ref` | provider message identifier |  | SYS | Recipient only | Optional | — |
| `sent_at` | timestamp (UTC) |  | SYS (when the action happens) | Recipient only | System | — |
| `delivered_at` | timestamp (UTC) |  | SYS (when the action happens) | Recipient only | System | — |
| `data` | valid JSON matching the registered schema; server-only render variables e.g. the activation link (5.2); never in a view |  | SYS | Recipient only | Optional | — |

### `notification_preferences`

Created at stage: **User self-service** · Default editor: Owner user · Default visibility: Owner only

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | Owner only | System | — |
| `user_id` (FK) | references see data model |  | Owner user | Owner only | At creation | — |
| `event_type` | string, up to 255 characters |  | Owner user | Owner only | At creation | — |
| `channel` | string, up to 255 characters |  | Owner user | Owner only | At creation | — |
| `enabled` | true or false |  | Owner user | Owner only | At creation | — |

### `audit_events`

Created at stage: **System** · Default editor: SYS (append-only; never updated or deleted) · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `actor_user_id` (FK) | references users |  | SYS (acting user) | INTERNAL | System | — |
| `actor_type` | one of the listed options | user, guest_token, system | SYS (append-only; never updated or deleted) | INTERNAL | At creation | — |
| `action` | one of the listed options | create, update, delete, approve, share, export, restricted_read | SYS (append-only; never updated or deleted) | INTERNAL | At creation | — |
| `entity_type` | string, up to 255 characters |  | SYS (append-only; never updated or deleted) | INTERNAL | At creation | — |
| `entity_id` | UUID |  | SYS (append-only; never updated or deleted) | INTERNAL | At creation | — |
| `project_id` | references wedding_projects; denormalised |  | SYS (append-only; never updated or deleted) | INTERNAL | Optional | Project-scoped history for PM (a) |
| `before_json` | valid JSON; restricted and secret fields masked before storage |  | SYS (append-only; never updated or deleted) | INTERNAL | Optional | — |
| `after_json` | valid JSON; restricted and secret fields masked before storage |  | SYS (append-only; never updated or deleted) | INTERNAL | Optional | — |
| `ip_address` | string, up to 255 characters |  | SYS (append-only; never updated or deleted) | INTERNAL | Optional | — |
| `occurred_at` | timestamp (UTC) |  | SYS | INTERNAL | System | — |

### `configurations`

Created at stage: **Configuration** · Default editor: SA · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `config_key` (unique) | lowercase snake_case; unique; e.g. hotel_verification_max_age_days, material_change_threshold_pct |  | SA | INTERNAL | At creation | — |
| `value_json` | valid JSON matching the schema registered for config_key |  | SA | INTERNAL | At creation | Takes effect on the next job run or request; change audited |
| `scope` | one of the listed options | global, project | SA | INTERNAL | At creation | — |
| `scope_id` | references wedding_projects when scope is project |  | SA | INTERNAL | Optional | — |

### `import_jobs`

Created at stage: **Any (import)** · Default editor: SA; HT (hotels); VC (vendors); RG and PM (a) (guests) · Default visibility: INTERNAL · Assumptions: A-9 (Q9), GP-22

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `import_type` | one of the listed options; (A-9) | hotels, guests, vendors | SA; HT (hotels); VC (vendors); RG and PM (a) (guests) | INTERNAL | At creation | — |
| `project_id` | references wedding_projects; required when import_type is guests |  | SA; HT (hotels); VC (vendors); RG and PM (a) (guests) | INTERNAL | At creation for guest imports | — |
| `file_document_id` (FK) | references documents |  | SA; HT (hotels); VC (vendors); RG and PM (a) (guests) | INTERNAL | At creation | — |
| `status` | one of the listed options | uploaded, validating, failed, applied | SA; HT (hotels); VC (vendors); RG and PM (a) (guests) | INTERNAL | At creation | validating runs in a worker; applied writes rows plus audit events; failed keeps the error report |
| `row_count` | integer, 0 or more |  | SYS | INTERNAL | Optional | — |
| `error_report_json` | valid JSON matching the registered schema |  | SYS | INTERNAL | Optional | — |

### `sessions`

Created at stage: **System** · Default editor: SYS · Default visibility: INTERNAL · Assumptions: D-033; security.md server-side sessions

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `user_id` (FK) | references see data model |  | SYS | INTERNAL | At creation | — |
| `token_id` (unique) | the access token's jti; unique per session |  | SYS | INTERNAL | System | — |
| `idle_timeout_minutes` | integer, 0 or more; staff 720 / client 43200 from configurations session.idle_timeouts |  | SYS | INTERNAL | At creation | Staff 720, client 43200, from configurations session.idle_timeouts |
| `last_seen_at` | timestamp (UTC) |  | SYS | INTERNAL | At creation | Advanced on each authenticated request |
| `revoked_at` | timestamp (UTC); set on sign-out or a role or membership change; idle is enforced against last_seen_at, not written |  | SYS | INTERNAL | System | Set on sign-out or a role or membership change; idle is enforced against last_seen_at, not written |
| `revoked_reason` | string, up to 255 characters |  | SYS | INTERNAL | Optional | — |

### `job_runs`

Created at stage: **Operational** · Default editor: SYS · Default visibility: INTERNAL · append-only; the recorded outcome of a background job run (D-047)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `job_name` | string, up to 255 characters; e.g. demo.restore |  | SYS | INTERNAL | At creation | — |
| `idempotency_key` | unique within the job; correlates a retry to its attempts |  | SYS | INTERNAL | At creation | — |
| `status` | one of the listed options | running, succeeded, failed | SYS | INTERNAL | At creation | running then succeeded or failed; alerts on failure or stale age |
| `detail_json` | valid JSON matching the registered schema; per-table counts or other outcome detail |  | SYS | INTERNAL | Optional | — |
| `error` | string, up to 255 characters; nullable; the sanitised failure message |  | SYS | INTERNAL | Optional | — |
| `started_at` | timestamp (UTC) |  | SYS (when the action happens) | INTERNAL | System | — |
| `finished_at` | timestamp (UTC); nullable until the run ends |  | SYS (when the action happens) | INTERNAL | System | Set when the run ends |

---

## 3. Module B — CRM, subscriptions and commercial agreements

### `lead_sources`

Created at stage: **Configuration** · Default editor: SA · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `source_key` (unique) | lowercase snake_case; unique; website, instagram, advertisement, referral, call, other |  | SA | INTERNAL | At creation | — |
| `name` | string, up to 255 characters |  | SA | INTERNAL | At creation | — |
| `is_active` | true or false |  | SA | INTERNAL | Optional | — |

### `leads`

Created at stage: **Lead** · Default editor: SM; SA; SYS from the public enquiry form · Default visibility: INTERNAL · Assumptions: A-12 (Q12), GP-39 consent (Q17)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `source_id` (FK) | references lead_sources |  | SM; SA; SYS from the public enquiry form | INTERNAL | At creation | — |
| `status` | one of the listed options | new, contacted, introduction_shared, demo_offered, demo_accessed, follow_up, converted, closed | SM; SA; SYS from the public enquiry form | INTERNAL | At creation | Lead funnel report (SPEC §9); converted creates the client account |
| `name` | string, up to 255 characters |  | SM; SA; SYS from the public enquiry form | INTERNAL | At creation | — |
| `email` | valid email address, stored lowercase |  | SM; SA; SYS from the public enquiry form | INTERNAL | At creation (email or phone) | — |
| `phone` | E.164 format, default +91 |  | SM; SA; SYS from the public enquiry form | INTERNAL | At creation (email or phone) | — |
| `contact_preference` | one of the listed options | phone, whatsapp, email | SM; SA; SYS from the public enquiry form | INTERNAL | Optional | — |
| `tentative_date_from` | date |  | SM; SA; SYS from the public enquiry form | INTERNAL | Optional | — |
| `tentative_date_to` | date; not before tentative_date_from |  | SM; SA; SYS from the public enquiry form | INTERNAL | Optional | — |
| `destination_id` (FK) | references destinations |  | SM; SA; SYS from the public enquiry form | INTERNAL | Optional | — |
| `destination_text` | string, up to 255 characters; free text when not in the database |  | SM; SA; SYS from the public enquiry form | INTERNAL | Optional | — |
| `guest_estimate` | integer, 0 or more |  | SM; SA; SYS from the public enquiry form | INTERNAL | Optional | Carried into the account and project |
| `requirements` | text, up to 10,000 characters |  | SM; SA; SYS from the public enquiry form | INTERNAL | Optional | — |
| `consent_marketing` | true or false |  | SM; SA; SYS from the public enquiry form | INTERNAL | At creation from the form | Marketing messages suppressed when false |
| `consent_at` | timestamp (UTC) |  | SYS (when the action happens) | INTERNAL | System | — |
| `consent_notice_version` | string, up to 32 characters |  | SYS | INTERNAL | Optional | Captured with consent; a notice change never alters a historical lead (AC-27.1) |
| `requested_demo` | true or false |  | SM; SA; SYS from the public enquiry form | INTERNAL | Optional | Creates a demo task for the lead owner |
| `owner_user_id` (FK) | references users |  | SM; SA | INTERNAL | Before status contacted | Owner receives follow-up reminders |
| `converted_account_id` (FK) | references client_accounts |  | SYS | INTERNAL | Optional | Set on conversion; the lead becomes read-only |
| `converted_at` | timestamp (UTC) |  | SYS (when the action happens) | INTERNAL | System | — |
| `closed_reason` | string, up to 255 characters |  | SM; SA; SYS from the public enquiry form | INTERNAL | Before status closed | — |
| `duplicate_of_lead_id` (FK) | references leads |  | SYS | INTERNAL | Optional | Set when an enquiry matches an existing lead or account; flagged for a Sales merge, never auto-merged (AC-01.6) |

### `lead_activities`

Created at stage: **Lead** · Default editor: SM; SA · Default visibility: INTERNAL · Assumptions: AM-15

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `lead_id` (FK) | references leads |  | SM; SA | INTERNAL | At creation | — |
| `activity_type` | one of the listed options; (AM-15; call_request for the pre-purchase Zoom call, Q3) | call, email, whatsapp, meeting, consultation, demo, questionnaire, call_request, note | SM; SA | INTERNAL | At creation | — |
| `occurred_at` | timestamp (UTC) |  | SM; SA | INTERNAL | At creation | — |
| `user_id` (FK) | references see data model |  | SYS (acting user) | INTERNAL | System | — |
| `summary` | text, up to 10,000 characters |  | SM; SA | INTERNAL | Optional | — |
| `questionnaire_json` | valid JSON matching the registered schema; structured answers when activity_type is questionnaire |  | SM; SA | INTERNAL | When activity_type is questionnaire | — |
| `next_follow_up_at` | timestamp (UTC) |  | SM; SA | INTERNAL | System | Reminder to the lead owner at that time |

### `client_accounts`

Created at stage: **Conversion** · Default editor: SM; SA; FA (billing fields) · Default visibility: CLIENT · Assumptions: A-28 (AM-8), P-3 (Q4)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `name` | string, up to 255 characters; couple or family name |  | SM; SA; FA (billing fields) | CLIENT | At creation | — |
| `couple_names` | string, up to 255 characters; entered at activation (Q2) |  | SM; SA; FA (billing fields) | CLIENT | Optional | — |
| `preferred_locations` | text, up to 10,000 characters; entered at activation (Q2) |  | SM; SA; FA (billing fields) | CLIENT | Optional | — |
| `is_demo` | true or false; fixed at creation |  | SM; SA | INTERNAL | Optional | Scopes every query for demo users (A-28); demo data reset on schedule |
| `status` | one of the listed options | prospect, active, suspended, closed | SM; SA; FA (billing fields) | CLIENT | At creation | suspended refuses sign-in for every user of the account |
| `primary_contact_user_id` (FK) | references users |  | SM; SA | CLIENT | Before subscription activation | — |
| `lead_id` (FK) | references leads |  | SYS | CLIENT | Optional | — |
| `billing_name` | string, up to 255 characters |  | FA; SA; CO (own) | RESTRICTED-BANK | Optional | — |
| `billing_address` | text, up to 10,000 characters |  | FA; SA; CO (own) | RESTRICTED-BANK | Optional | — |
| `gstin` | 15-character GSTIN format |  | FA; SA; CO (own) | RESTRICTED-BANK | Optional | — |
| `internal_notes` | text, up to 10,000 characters |  | SM; SA; FA (billing fields) | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |

### `account_contacts`

Created at stage: **Conversion / project setup** · Default editor: SM; SA; PM (a); CO · Default visibility: CLIENT · Assumptions: A-5 (Q5)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `account_id` (FK) | references client_accounts |  | SM; SA; PM (a); CO | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | SM; SA; PM (a); CO | CLIENT | At creation | — |
| `relation` | string, up to 255 characters; e.g. bride, groom, father of the bride |  | SM; SA; PM (a); CO | CLIENT | At creation | — |
| `phone` | E.164 format, default +91 |  | SM; SA; PM (a); CO | CLIENT | Optional | — |
| `email` | valid email address, stored lowercase |  | SM; SA; PM (a); CO | CLIENT | Optional | — |
| `is_decision_maker` | true or false |  | SM; SA; PM (a); CO | CLIENT | Optional | Decision makers are listed on the wedding overview |
| `user_id` (FK) | references users; set when a login is created for the contact |  | SYS | CLIENT | Optional | — |

### `plans`

Created at stage: **Configuration** · Default editor: SA · Default visibility: PUBLIC when status is active · Assumptions: A-3 (Q3)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | PUBLIC when status is active | System | — |
| `plan_key` (unique) | lowercase snake_case; unique |  | SA | PUBLIC when status is active | At creation | — |
| `name` | string, up to 255 characters |  | SA | PUBLIC when status is active | At creation | — |
| `plan_type` | one of the listed options | hotel_discovery, trial, demo, package | SA | PUBLIC when status is active | At creation | — |
| `billing_type` | one of the listed options; (A-3) | one_time, recurring | SA | PUBLIC when status is active | At creation | — |
| `price_amount` | numeric(14,2), 0 or more; value set by AMPM, never hard-coded (Q3) |  | SA | PUBLIC when status is active | Before status active | Shown on the subscription page; charged at purchase |
| `currency` | ISO 4217 code, default INR (A-16) |  | SA | PUBLIC when status is active | At creation | — |
| `term_days` | integer, 0 or more |  | SA | PUBLIC when status is active | Before status active for one_time plans | — |
| `trial_days` | integer, 0 or more |  | SA | PUBLIC when status is active | Optional | Sets trial_ends_at on trial subscriptions |
| `is_demo` | true or false |  | SA | PUBLIC when status is active | Optional | Demo plans never charge and never grant real data |
| `status` | one of the listed options | draft, active, retired | SA | PUBLIC when status is active | At creation | retired plans stay attached to existing subscriptions |
| `terms_version` | string, up to 255 characters |  | SA | PUBLIC when status is active | Before status active | — |

### `plan_modules`

Created at stage: **Configuration** · Default editor: SA · Default visibility: PUBLIC

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | PUBLIC | System | — |
| `plan_id` (FK) | references plans |  | SA | PUBLIC | At creation | — |
| `module_key` | one of the listed options | hotel_discovery, hotel_assistance, wedding_workspace, guest_rsvp, documents | SA | PUBLIC | At creation | Resolved into entitlements per request (permission-matrix §3) |
| `access_level` | one of the listed options | read, full | SA | PUBLIC | At creation | — |

### `subscriptions`

Created at stage: **Subscription** · Default editor: SM; SA; FA (status); SYS (activation and expiry) · Default visibility: CLIENT · Assumptions: A-2 (Q2), A-3 (Q3), A-29 (AM-9), GP-1

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `account_id` (FK) | references client_accounts |  | SM; SA; FA (status); SYS (activation and expiry) | CLIENT | At creation | — |
| `plan_id` (FK) | references plans |  | SM; SA; FA (status); SYS (activation and expiry) | CLIENT | At creation | — |
| `status` | one of the listed options; (GP-2) | trial, pending_payment, active, expiring, expired, suspended, cancelled | SM; SA; FA (status); SYS (activation and expiry) | CLIENT | At creation | Activated on payment; expiring and expired by job; entitlements recomputed; records never deleted (GP-1) |
| `starts_at` | timestamp (UTC) |  | SYS on activation; SA override | CLIENT | Before status active | — |
| `ends_at` | timestamp (UTC) |  | SYS from the plan term; SA override | CLIENT | Before status active | Expiry job and notice notifications |
| `trial_ends_at` | timestamp (UTC) |  | SYS from trial_days | CLIENT | Optional | Trial expiry job |
| `auto_renew` | true or false |  | CO; SM | CLIENT | Optional | Recurring billing only (A-3) |
| `activation_source` | one of the listed options; (A-2) | gateway_webhook, manual | SYS | CLIENT | Optional | — |
| `activated_by_user_id` (FK) | references users |  | SYS (acting user) | CLIENT | System | — |
| `cancelled_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |
| `cancel_reason` | string, up to 255 characters |  | SM; SA; FA (status); SYS (activation and expiry) | CLIENT | Before status cancelled | — |

### `service_types`

Created at stage: **Configuration** · Default editor: SA · Default visibility: CLIENT

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `service_key` (unique) | lowercase snake_case; unique; availability_check, negotiation, site_visit, contract_review, booking_assistance, design, vendor_coordination, full_management |  | SA | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | SA | CLIENT | At creation | — |
| `category` | one of the listed options | hotel_assistance, design, vendor_coordination, full_management, other | SA | CLIENT | At creation | — |
| `is_active` | true or false |  | SA | CLIENT | Optional | — |

### `service_agreements`

Created at stage: **Engagement** · Default editor: SM; SA; HT (hotel services); PM (a) · Default visibility: CLIENT · Assumptions: A-4 (Q4), GP-5, GP-27

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `account_id` (FK) | references client_accounts |  | SM; SA; HT (hotel services); PM (a) | CLIENT | At creation | — |
| `project_id` (FK) | references wedding_projects; nullable until a project exists |  | SM; SA; HT (hotel services); PM (a) | CLIENT | Optional | Back-filled when the project is created (GP-27) |
| `service_type_id` (FK) | references service_types |  | SM; SA; HT (hotel services); PM (a) | CLIENT | At creation | — |
| `hotel_enquiry_id` (FK) | references hotel_enquiries; nullable, links hotel assistance to its enquiry (GP-5) |  | SM; SA; HT (hotel services); PM (a) | CLIENT | Optional | Unblocks paid consultancy work on that enquiry (GP-5) |
| `scope_text` | text, up to 10,000 characters |  | SM; SA; HT (hotel services); PM (a) | CLIENT | Before status sent | — |
| `fee_amount` | numeric(14,2), 0 or more; set by AMPM (Q4) |  | SM; SA; HT (hotel services); PM (a) | CLIENT | Before status sent | Feeds payment milestones and the client finance summary |
| `fee_structure` | one of the listed options | fixed, percentage, milestones | SM; SA; HT (hotel services); PM (a) | CLIENT | Before status sent | — |
| `currency` | ISO 4217 code, default INR (A-16) |  | SM; SA; HT (hotel services); PM (a) | CLIENT | At creation | — |
| `terms_version` | string, up to 255 characters |  | SM; SA; HT (hotel services); PM (a) | CLIENT | Before status sent | — |
| `status` | one of the listed options | draft, sent, accepted, active, completed, cancelled | SM; SA; HT (hotel services); PM (a) | CLIENT | At creation | active grants the service module (permission-matrix §3); completed or cancelled removes it |
| `accepted_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |
| `accepted_by_user_id` (FK) | references users |  | SYS (acting user) | CLIENT | System | — |
| `document_id` (FK) | references see data model |  | SM; SA; HT (hotel services); PM (a) | CLIENT | Before status active (signed agreement) | — |

### `payment_milestones`

Created at stage: **Engagement** · Default editor: FA; SA · Default visibility: CLIENT · Assumptions: GP-6

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `service_agreement_id` (FK) | references service_agreements |  | FA; SA | CLIENT | At creation | — |
| `project_id` (FK) | references wedding_projects |  | FA; SA | CLIENT | Optional | — |
| `name` | string, up to 255 characters |  | FA; SA | CLIENT | At creation | — |
| `due_date` | date |  | FA; SA | CLIENT | At creation | Unpaid milestones appear on dashboards and notify the client (SPEC §8) |
| `amount` | numeric(14,2), 0 or more |  | FA; SA | CLIENT | At creation | — |
| `currency` | ISO 4217 code, default INR (A-16) |  | FA; SA | CLIENT | At creation | — |
| `status` | one of the listed options | pending, invoiced, paid, overdue, waived | FA; SA | CLIENT | At creation | invoiced when an invoice is issued; paid when its payment succeeds; overdue by job |
| `invoice_id` (FK) | references invoices |  | SYS | CLIENT | Optional | — |

### `payments`

Created at stage: **Subscription / engagement / vendor payment** · Default editor: FA; SA; SYS (gateway webhooks) · Default visibility: CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows · Assumptions: A-2 (Q2), A-4 (Q4), GP-17

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | System | — |
| `account_id` (FK) | references client_accounts |  | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | At creation | — |
| `project_id` (FK) | references wedding_projects; nullable |  | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | Optional | — |
| `direction` | inbound for client payments, outbound for vendor and hotel payments | inbound, outbound | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | At creation | — |
| `counterparty_type` | one of the listed options | client, vendor, hotel, other | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | At creation | — |
| `counterparty_id` | UUID |  | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | Optional | — |
| `purpose` | one of the listed options | subscription, service_fee, milestone, vendor_payment, hotel_payment, refund | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | At creation | — |
| `related_type` | string, up to 255 characters; subscription / invoice / payment_milestone |  | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | Optional | — |
| `related_id` | UUID |  | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | Optional | — |
| `amount` | numeric(14,2), more than 0 |  | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | At creation | Finance reports; refunds reduce the net |
| `currency` | ISO 4217 code, default INR (A-16) |  | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | At creation | — |
| `method` | one of the listed options | gateway, bank_transfer, upi, cheque, cash | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | At creation | — |
| `provider` | string, up to 255 characters |  | SYS | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | When method is gateway | — |
| `provider_ref` | gateway transaction id; unique |  | SYS | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | When method is gateway | — |
| `status` | one of the listed options | initiated, pending, succeeded, failed, refunded, cancelled | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | At creation | succeeded activates only the purchased entitlement (SPEC §8) and marks milestones paid; refunded requires refund_of_payment_id |
| `paid_at` | timestamp (UTC) |  | SYS from the gateway; FA for manual records | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | Before status succeeded | — |
| `recorded_by` (FK) | references users |  | SYS (acting user) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | System | — |
| `refund_of_payment_id` (FK) | references payments; must be a succeeded payment; refund total never exceeds it |  | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | Optional | — |
| `client_visible` | true or false; true for inbound client payments (A-4) |  | FA; SA; SYS (gateway webhooks) | CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows | Optional | true only for inbound client payments (A-4) |

### `webhook_events`

Created at stage: **Operational** · Default editor: SYS · Default visibility: INTERNAL · Assumptions: feature 8.3 · raw verified provider webhooks; append-only, no soft-delete, like job_runs

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `provider` | string, up to 255 characters; e.g. razorpay |  | SYS | INTERNAL | At creation | — |
| `event_id` | the provider's event id; unique per provider |  | SYS | INTERNAL | At creation | — |
| `event_type` | string, up to 255 characters; e.g. payment.captured |  | SYS | INTERNAL | At creation | — |
| `provider_ref` | string, up to 255 characters; the order the event is for; matches payments.provider_ref |  | SYS | INTERNAL | At creation | — |
| `payload` | valid JSON matching the registered schema; the raw verified event |  | SYS | INTERNAL | At creation | — |
| `status` | one of the listed options | received, processed, failed, ignored | SYS | INTERNAL | At creation | received then processed, failed or ignored; a bad signature writes nothing |
| `error` | nullable; sanitised |  | SYS | INTERNAL | Optional | — |
| `received_at` | timestamp (UTC) |  | SYS | INTERNAL | Optional | — |
| `processed_at` | nullable until processed |  | SYS | INTERNAL | System | — |

---

## 4. Module C — Hotel intelligence

### `destinations`

Created at stage: **Hotel data entry** · Default editor: HT; SA · Default visibility: CLIENT · Assumptions: A-12 (Q12)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `name` | string, up to 255 characters |  | HT; SA | CLIENT; PUBLIC when public_visible | At creation | — |
| `slug` (unique) | lowercase letters, digits and hyphens; unique |  | HT; SA | CLIENT; PUBLIC when public_visible | At creation | — |
| `region` | string, up to 255 characters |  | HT; SA | CLIENT | Optional | — |
| `state` | string, up to 255 characters |  | HT; SA | CLIENT | Optional | — |
| `country` | string, up to 255 characters |  | HT; SA | CLIENT | At creation | — |
| `description` | text, up to 10,000 characters |  | HT; SA | CLIENT | Optional | — |
| `status` | one of the listed options | draft, active, inactive | HT; SA | CLIENT | At creation | Transitions per permission-matrix §7; each transition audited; notifications per §8 |
| `public_visible` | true or false; shown on the public website |  | HT; SA | CLIENT | Optional | Publishes the destination page on the website; audited |
| `hero_media_id` (FK) | references media_assets |  | HT; SA | CLIENT; PUBLIC when public_visible | Optional | — |

### `hotels`

Created at stage: **Hotel data entry** · Default editor: HT; SA · Default visibility: CLIENT · Assumptions: A-9 (Q9), A-28 (AM-8), RK-1

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `destination_id` (FK) | references destinations |  | HT; SA | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | HT; SA | CLIENT; PUBLIC when public_showcase | At creation | — |
| `slug` (unique) | lowercase letters, digits and hyphens; unique |  | HT; SA | CLIENT | At creation | — |
| `brand` | string, up to 255 characters |  | HT; SA | CLIENT | Optional | — |
| `star_category` | string, up to 255 characters |  | HT; SA | CLIENT | Optional | — |
| `address` | text, up to 10,000 characters |  | HT; SA | CLIENT | Optional | — |
| `latitude` | decimal between -90 and 90 |  | HT; SA | CLIENT | Optional | — |
| `longitude` | decimal between -180 and 180 |  | HT; SA | CLIENT | Optional | — |
| `description_client` | text, up to 10,000 characters |  | HT; SA | CLIENT | Before status active | — |
| `website` | string, up to 255 characters |  | HT; SA | CLIENT | Optional | — |
| `status` | one of the listed options | draft, active, inactive | HT; SA | CLIENT | At creation | inactive hotels leave search results but stay on existing enquiries and projects |
| `demo_visible` | true or false; A-28 |  | HT; SA | CLIENT | Optional | Scopes demo search (A-28) |
| `public_showcase` | true or false; approved for the public website |  | HT; SA | CLIENT | Optional | Exposes name, destination and hero media on the website only |
| `internal_rating` | integer 1 to 5 |  | HT; SA | RESTRICTED-NOTES | Optional | — |
| `internal_notes` | text, up to 10,000 characters |  | HT; SA | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |
| `total_rooms` | integer, 0 or more |  | HT; SA | CLIENT | Optional | — |
| `street_view_ref` | string, up to 255 characters; map or street view reference (Q9) |  | HT; SA | CLIENT | Optional | — |
| `last_verified_at` | timestamp (UTC); denormalised from hotel_verifications |  | SYS | CLIENT | System | Denormalised by the verification job; drives the freshness label |

### `hotel_contacts`

Created at stage: **Hotel data entry** · Default editor: HT; SA · Default visibility: INTERNAL · Whole table: **RESTRICTED-CONTACT** · Assumptions: P-3 contact tier

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | RESTRICTED-CONTACT | System | — |
| `hotel_id` (FK) | references hotels |  | HT; SA | RESTRICTED-CONTACT | At creation | — |
| `name` | string, up to 255 characters; whole table, clients contact hotels through AMPM |  | HT; SA | RESTRICTED-CONTACT | At creation | — |
| `role_title` | string, up to 255 characters |  | HT; SA | RESTRICTED-CONTACT | Optional | — |
| `phone` | E.164 format, default +91 |  | HT; SA | RESTRICTED-CONTACT | Optional | — |
| `email` | valid email address, stored lowercase |  | HT; SA | RESTRICTED-CONTACT | Optional | — |
| `is_primary` | true or false |  | HT; SA | RESTRICTED-CONTACT | Optional | — |

### `hotel_room_categories`

Created at stage: **Hotel data entry** · Default editor: HT; SA · Default visibility: CLIENT · Assumptions: A-27 (AM-5)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `hotel_id` (FK) | references hotels |  | HT; SA | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | HT; SA | CLIENT | At creation | — |
| `room_count` | integer, 0 or more; inventory in this category (A-27) |  | HT; SA | CLIENT | At creation | Upper bound for room blocks at this hotel |
| `max_occupancy` | integer, 1 or more |  | HT; SA | CLIENT | At creation | Upper bound for occupants per allocation |
| `size_sqm` | integer, 0 or more |  | HT; SA | CLIENT | Optional | — |
| `facilities_json` | valid JSON matching the registered schema |  | HT; SA | CLIENT | Optional | — |
| `description` | text, up to 10,000 characters |  | HT; SA | CLIENT | Optional | — |

### `hotel_venues`

Created at stage: **Hotel data entry** · Default editor: HT; SA · Default visibility: CLIENT

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `hotel_id` (FK) | references hotels |  | HT; SA | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | HT; SA | CLIENT | At creation | — |
| `venue_type` | one of the listed options | ballroom, lawn, poolside, rooftop, courtyard, beach, other | HT; SA | CLIENT | At creation | — |
| `is_indoor` | true or false |  | HT; SA | CLIENT | Optional | — |
| `area_sqm` | integer, 0 or more |  | HT; SA | CLIENT | Optional | — |
| `capacity_banquet` | integer, 0 or more |  | HT; SA | CLIENT | Optional | Compared with function guest_estimate; mismatch flagged |
| `capacity_theatre` | integer, 0 or more |  | HT; SA | CLIENT | Optional | Compared with function guest_estimate; mismatch flagged |
| `capacity_reception` | integer, 0 or more |  | HT; SA | CLIENT | Optional | Compared with function guest_estimate; mismatch flagged |
| `facilities_json` | valid JSON matching the registered schema |  | HT; SA | CLIENT | Optional | — |
| `description` | text, up to 10,000 characters |  | HT; SA | CLIENT | Optional | — |

### `hotel_rate_cards`

Created at stage: **Hotel data entry** · Default editor: HT; SA · Default visibility: CLIENT · Assumptions: A-9 (Q9), GP-8

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `hotel_id` (FK) | references hotels |  | HT; SA | CLIENT | At creation | — |
| `name` | string, up to 255 characters; e.g. Wedding season 2027 |  | HT; SA | CLIENT | At creation | — |
| `valid_from` | date |  | HT; SA | CLIENT | At creation | — |
| `valid_to` | date; not before valid_from |  | HT; SA | CLIENT | At creation | — |
| `currency` | ISO 4217 code, default INR (A-16) |  | HT; SA | CLIENT | At creation | — |
| `status` | one of the listed options | draft, verified, stale, retired | HT; SA | CLIENT | At creation | verified requires a verification row; stale set by job after the configured age; stale cards are never shown as confirmed (SPEC §12) |
| `verification_id` (FK) | references hotel_verifications |  | HT; SA | INTERNAL | Before status verified | — |
| `source` | string, up to 255 characters; e.g. hotel sales email |  | HT; SA | RESTRICTED-NOTES | Optional | — |
| `internal_notes` | text, up to 10,000 characters |  | HT; SA | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |

### `hotel_rate_items`

Created at stage: **Hotel data entry** · Default editor: HT; SA · Default visibility: CLIENT when client_visible and the card is verified · Assumptions: A-9 (Q9), GP-8

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when client_visible and the card is verified | System | — |
| `rate_card_id` (FK) | references hotel_rate_cards |  | HT; SA | CLIENT when client_visible and the card is verified | At creation | — |
| `item_type` | one of the listed options; (A-9, Q9) | room_rate, venue_rental, per_plate_veg, per_plate_non_veg, wedding_package, beverage_package, service_charge, tax, other | HT; SA | CLIENT when client_visible and the card is verified | At creation | — |
| `room_category_id` (FK) | references hotel_room_categories; nullable |  | HT; SA | CLIENT when client_visible and the card is verified | Optional | — |
| `venue_id` (FK) | references hotel_venues; nullable |  | HT; SA | CLIENT when client_visible and the card is verified | Optional | — |
| `amount` | numeric(14,2), 0 or more |  | HT; SA | CLIENT when client_visible and the card is verified | At creation | Client sees it with the card's freshness label |
| `amount_max` | numeric(14,2), 0 or more; upper bound of an indicative range, nullable (Q9) |  | HT; SA | CLIENT when client_visible and the card is verified | Optional | — |
| `is_indicative` | true or false; true for ranges shown to clients; confirmed quotations live in hotel_proposals |  | HT; SA | CLIENT when client_visible and the card is verified | Optional | — |
| `unit` | one of the listed options | per_night, per_plate, per_event, percent | HT; SA | CLIENT when client_visible and the card is verified | At creation | — |
| `min_quantity` | integer, 0 or more; for example minimum plates |  | HT; SA | CLIENT when client_visible and the card is verified | Optional | — |
| `inclusions_text` | text, up to 10,000 characters |  | HT; SA | CLIENT when client_visible and the card is verified | Optional | — |
| `client_visible` | true or false; when true and card is verified |  | HT; SA | CLIENT | Optional | Hidden items are internal references only |

### `hotel_verifications`

Created at stage: **Verification** · Default editor: HT; SA · Default visibility: INTERNAL · Assumptions: SPEC §8 stale rule

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `hotel_id` (FK) | references hotels |  | HT; SA | INTERNAL | At creation | — |
| `field_group` | one of the listed options | profile, rooms, venues, rates, availability, media, contacts | HT; SA | CLIENT (freshness label) | At creation | — |
| `verified_at` | timestamp (UTC) |  | SYS when recorded; HT may backdate with a note | CLIENT (freshness label) | At creation | Stale job compares with the configured age and sets the freshness label |
| `verified_by` (FK) | references users |  | SYS (acting user) | INTERNAL | At creation | — |
| `source` | one of the listed options | phone, email, site_visit, website, contract | HT; SA | INTERNAL | At creation | — |
| `status` | one of the listed options | verified, unverified, stale | HT; SA | CLIENT (freshness label) | At creation | stale set by the daily job; shown as a label |
| `next_due_at` | timestamp (UTC); verified_at plus configurable age |  | SYS | INTERNAL | System | Set to verified_at plus the configured age |
| `notes` | text, up to 10,000 characters |  | HT; SA | INTERNAL | Optional | — |

### `hotel_wedding_references`

Created at stage: **Hotel data entry** · Default editor: HT; SA · Default visibility: CLIENT when client_visible · Assumptions: GP-20 (Q9)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when client_visible | System | — |
| `hotel_id` (FK) | references hotels |  | HT; SA | CLIENT when client_visible | At creation | — |
| `project_id` (FK) | references wedding_projects; nullable, the AMPM wedding it refers to |  | HT; SA | CLIENT when client_visible | Optional | — |
| `event_year` | four-digit year |  | HT; SA | CLIENT when client_visible | At creation | — |
| `guest_count` | integer, 0 or more |  | HT; SA | CLIENT when client_visible | Optional | — |
| `description_client` | text, up to 10,000 characters |  | HT; SA | CLIENT | Optional | — |
| `client_visible` | true only when consent_document_id is set |  | HT; SA | CLIENT when client_visible | Optional | Sharing audited |
| `consent_document_id` (FK) | references documents; consent from the referenced client (GP-20) |  | HT; SA | CLIENT when client_visible | Before client_visible | — |

### `saved_hotels`

Created at stage: **Discovery (client)** · Default editor: CO, CA, CV (own account); DP (demo); SYS back-fills project_id · Default visibility: CLIENT · Assumptions: GP-10, GP-27 · unique on account_id and hotel_id

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `account_id` (FK) | references client_accounts |  | CO, CA, CV (own account); DP (demo); SYS back-fills project_id | CLIENT | At creation | — |
| `hotel_id` (FK) | references hotels |  | CO, CA, CV (own account); DP (demo); SYS back-fills project_id | CLIENT | At creation | — |
| `project_id` (FK) | references wedding_projects; nullable, set when linked to a wedding (GP-27) |  | CO, CA, CV (own account); DP (demo); SYS back-fills project_id | CLIENT | Optional | Back-filled when a project is created (GP-27) |
| `saved_by_user_id` (FK) | references users |  | SYS (acting user) | CLIENT | At creation | — |
| `note` | text, up to 10,000 characters |  | CO, CA, CV (own account); DP (demo); SYS back-fills project_id | CLIENT | Optional | — |

---

## 5. Module D — Hotel consultancy

### `hotel_enquiries`

Created at stage: **Discovery (client request)** · Default editor: CO, CA (client fields at creation); HT; SA; PM (a) · Default visibility: CLIENT · Assumptions: A-9 (Q9), GP-5, GP-27

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `account_id` (FK) | references client_accounts |  | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | At creation | — |
| `project_id` (FK) | references wedding_projects; nullable before a project exists |  | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | Optional | Back-filled when the project is created (GP-27) |
| `hotel_id` (FK) | references hotels |  | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | At creation | — |
| `requested_by_user_id` (FK) | references users |  | SYS (acting user) | CLIENT | At creation | — |
| `assigned_user_id` (FK) | references users |  | HT; SA | INTERNAL | Before status awaiting_hotel | Assignee notified |
| `service_agreement_id` (FK) | references service_agreements; nullable (GP-5) |  | CO, CA (client fields at creation); HT; SA; PM (a) | INTERNAL | Optional | Paid work beyond availability checks waits for an active agreement (GP-5) |
| `status` | one of the listed options | draft, submitted, awaiting_hotel, response_received, negotiating, visit_scheduled, proposal_received, client_decision, confirmed, closed | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | At creation | Per §7; confirmed requires a confirmed booking milestone and a signed contract; client notified on each change |
| `date_from` | date |  | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | At creation | — |
| `date_to` | date; not before date_from |  | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | At creation | — |
| `dates_flexible` | true or false |  | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | Optional | — |
| `guest_estimate` | integer, 0 or more |  | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | At creation | — |
| `rooms_required` | integer, 0 or more |  | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | Optional | Starting point for room blocks |
| `functions_summary` | text, up to 10,000 characters |  | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | Optional | — |
| `contact_preference` | string, up to 255 characters |  | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | Optional | — |
| `notes_client` | text, up to 10,000 characters |  | CO, CA; HT | CLIENT | Optional | — |
| `notes_internal` | text, up to 10,000 characters |  | CO, CA (client fields at creation); HT; SA; PM (a) | RESTRICTED-NOTES | Optional | — |
| `submitted_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |
| `closed_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |
| `outcome` | one of the listed options | booked, declined, no_availability, withdrawn | CO, CA (client fields at creation); HT; SA; PM (a) | CLIENT | Before status closed | Hotel conversion report |

### `hotel_enquiry_events`

Created at stage: **Consultancy** · Default editor: HT; SA; PM (a); SYS for status changes · Default visibility: CLIENT unless internal_only · Assumptions: SPEC §12 negotiation test

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT unless internal_only | System | — |
| `enquiry_id` (FK) | references hotel_enquiries |  | HT; SA; PM (a); SYS for status changes | CLIENT unless internal_only | At creation | — |
| `event_type` | one of the listed options | submitted, sent_to_hotel, hotel_response, negotiation_note, client_update, status_change, visit, proposal | HT; SA; PM (a); SYS for status changes | CLIENT unless internal_only | At creation | — |
| `occurred_at` | timestamp (UTC) |  | HT; SA | CLIENT unless internal_only | At creation | — |
| `user_id` (FK) | references see data model |  | SYS (acting user) | CLIENT unless internal_only | System | — |
| `summary` | text, up to 10,000 characters |  | HT; SA; PM (a); SYS for status changes | CLIENT unless internal_only | Optional | — |
| `internal_only` | true or false; true hides the event from the client entirely |  | HT; SA; PM (a); SYS for status changes | CLIENT unless internal_only | Optional | Hidden from the client serialiser; defaults to true for negotiation_note |
| `document_id` (FK) | references see data model |  | HT; SA; PM (a); SYS for status changes | CLIENT unless internal_only | Optional | — |

### `site_visits`

Created at stage: **Consultancy** · Default editor: HT; SA; PM (a); CO, CA for client_feedback · Default visibility: CLIENT

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `enquiry_id` (FK) | references hotel_enquiries |  | HT; SA; PM (a); CO, CA for client_feedback | CLIENT | At creation | — |
| `hotel_id` (FK) | references hotels |  | HT; SA; PM (a); CO, CA for client_feedback | CLIENT | At creation | — |
| `scheduled_at` | timestamp (UTC) |  | HT; PM (a) | CLIENT | At creation | Reminder to attendees; enquiry status visit_scheduled |
| `status` | one of the listed options | proposed, confirmed, completed, cancelled | HT; SA; PM (a); CO, CA for client_feedback | CLIENT | At creation | Transitions per permission-matrix §7; each transition audited; notifications per §8 |
| `attendees_text` | text, up to 10,000 characters |  | HT; SA; PM (a); CO, CA for client_feedback | CLIENT | Optional | — |
| `outcome_internal` | text, up to 10,000 characters |  | HT; SA; PM (a); CO, CA for client_feedback | RESTRICTED-NOTES | Optional | — |
| `client_feedback` | text, up to 10,000 characters |  | CO, CA | CLIENT | Optional | — |

### `hotel_proposals`

Created at stage: **Consultancy** · Default editor: HT; SA; PM (a) · Default visibility: CLIENT when shared · Assumptions: A-4 (Q4), P-3 (Q4)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when shared | System | — |
| `enquiry_id` (FK) | references hotel_enquiries |  | HT; SA; PM (a) | CLIENT when shared | At creation | — |
| `hotel_id` (FK) | references hotels |  | HT; SA; PM (a) | CLIENT when shared | At creation | — |
| `version_number` | integer, 1 or more; increments by 1 within its parent; immutable once shared |  | HT; SA; PM (a) | CLIENT when shared | At creation | A new version supersedes earlier approvals (SPEC §12) |
| `status` | one of the listed options | draft, shared, revision_requested, accepted, declined, superseded | HT; SA; PM (a) | CLIENT when shared | At creation | shared notifies client approvers; accepted locks the version; a new version supersedes |
| `valid_until` | date |  | HT; SA; PM (a) | CLIENT when shared | Optional | Expired proposals flagged on the enquiry |
| `client_total_amount` | numeric(14,2), 0 or more; (A-4) |  | HT; SA; PM (a) | CLIENT | Before status shared | Client decision and budget line |
| `internal_total_amount` | numeric(14,2), 0 or more; hotel net or commission basis |  | HT; SA; PM (a) | RESTRICTED-FINANCE | Optional | Hotel margin report |
| `currency` | ISO 4217 code, default INR (A-16) |  | HT; SA; PM (a) | CLIENT when shared | At creation | — |
| `document_id` (FK) | references see data model |  | HT; SA; PM (a) | CLIENT when shared | Before status shared | — |
| `shared_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT when shared | System | — |
| `decided_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT when shared | System | — |
| `decided_by_user_id` (FK) | references users |  | SYS (acting user) | CLIENT when shared | System | — |
| `approval_id` (FK) | references approvals |  | SYS | CLIENT when shared | Optional | — |
| `supersedes_proposal_id` (FK) | references hotel_proposals |  | SYS | CLIENT when shared | Optional | — |

### `hotel_proposal_lines`

Created at stage: **Consultancy** · Default editor: HT; SA; PM (a) · Default visibility: CLIENT when client_visible

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when client_visible | System | — |
| `proposal_id` (FK) | references hotel_proposals |  | HT; SA; PM (a) | CLIENT when client_visible | At creation | — |
| `item_type` | string, up to 255 characters; same enumeration as hotel_rate_items |  | HT; SA; PM (a) | CLIENT when client_visible | At creation | — |
| `description` | text, up to 10,000 characters |  | HT; SA; PM (a) | CLIENT when client_visible | At creation | — |
| `quantity` | numeric, more than 0 |  | HT; SA; PM (a) | CLIENT when client_visible | At creation | — |
| `unit_amount` | numeric(14,2), 0 or more |  | HT; SA; PM (a) | CLIENT when client_visible | At creation | — |
| `total_amount` | quantity multiplied by unit_amount |  | HT; SA; PM (a) | CLIENT when client_visible | At creation | — |
| `client_visible` | true or false |  | HT; SA; PM (a) | CLIENT when client_visible | Optional | Sharing change audited; switches the client serialiser |

### `booking_milestones`

Created at stage: **Consultancy / booking** · Default editor: HT; SA; PM (a); FA for amounts and paid milestones · Default visibility: CLIENT · Assumptions: A-4 (Q4) for amounts

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `enquiry_id` (FK) | references hotel_enquiries |  | HT; SA; PM (a); FA for amounts and paid milestones | CLIENT | At creation | — |
| `project_id` (FK) | references wedding_projects; nullable |  | HT; SA; PM (a); FA for amounts and paid milestones | CLIENT | Optional | — |
| `milestone_type` | one of the listed options | hold_placed, contract_sent, contract_signed, advance_paid, rooming_list_due, balance_due, confirmed | HT; SA; PM (a); FA for amounts and paid milestones | CLIENT | At creation | — |
| `due_at` | timestamp (UTC) |  | HT; PM (a) | CLIENT | Optional | Overdue items appear on dashboards (SPEC §8) |
| `completed_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |
| `status` | one of the listed options | pending, done, overdue, cancelled | HT; SA; PM (a); FA for amounts and paid milestones | CLIENT | At creation | done on the confirmed milestone enables enquiry status confirmed |
| `amount` | numeric(14,2), 0 or more |  | HT; SA; PM (a); FA for amounts and paid milestones | CLIENT when the client pays the hotel directly; confirm (Q4) | Optional | — |
| `currency` | ISO 4217 code, default INR (A-16) |  | HT; SA; PM (a); FA for amounts and paid milestones | CLIENT | Optional | — |
| `contract_id` (FK) | references contracts |  | HT; SA; PM (a); FA for amounts and paid milestones | CLIENT | Before the confirmed milestone is done | — |
| `document_id` (FK) | references see data model |  | HT; SA; PM (a); FA for amounts and paid milestones | CLIENT | Optional | — |

---

## 6. Module E — Wedding project

### `wedding_projects`

Created at stage: **Project setup** · Default editor: SA; SM (create); PM (a) · Default visibility: CLIENT · Assumptions: A-16 (Q16), A-18 (Q18), A-23 (Q23), A-28 (AM-8), SPEC §5 example rows

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `code` (unique) | generated AMPM-YYYY-NNN; unique |  | SYS | CLIENT | System | — |
| `account_id` (FK) | references client_accounts |  | SA; SM (create); PM (a) | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | SA; SM (create); PM (a) | CLIENT | At creation | — |
| `status` | one of the listed options | setup, planning, approvals, pre_production, ready, live, closure, closed, on_hold | SA; SM (create); PM (a) | CLIENT | At creation | closed requires the closure checklist complete and final accounts approved (permission-matrix §7) |
| `date_from` | date; tentative allowed early (SPEC §5) |  | SA; SM (create); PM (a) | CLIENT | At creation | Milestones, countdown and function date checks |
| `date_to` | date; not before date_from |  | SA; SM (create); PM (a) | CLIENT | At creation | Milestones, countdown and function date checks |
| `dates_tentative` | true or false; SPEC section 5, tentative allowed early |  | SA; SM (create); PM (a) | CLIENT | Optional | Tentative flag on the dashboard; cleared when confirmed |
| `destination_id` (FK) | references destinations |  | SA; SM (create); PM (a) | CLIENT | Optional | — |
| `primary_hotel_id` (FK) | references hotels; convenience pointer only (A-18) |  | SA; SM (create); PM (a) | CLIENT | Optional | — |
| `guest_estimate` | integer, 0 or more |  | SA; SM (create); PM (a) | CLIENT | Optional | Capacity checks and planning; replaced by confirmed attendance later |
| `guest_estimate_confirmed` | true or false |  | SA; SM (create); PM (a) | CLIENT | Optional | — |
| `timezone` | IANA time zone name; default Asia/Kolkata |  | SA; SM (create); PM (a) | CLIENT | At creation | — |
| `currency` | ISO 4217 code, default INR (A-16) |  | SA; SM (create); PM (a) | CLIENT | At creation | — |
| `primary_service_agreement_id` (FK) | references service_agreements |  | SA; SM (create); PM (a) | INTERNAL | Optional | — |
| `project_lead_user_id` (FK) | references users |  | SA; SM; PM (a) | CLIENT | At creation | Lead receives all project notifications |
| `is_demo` | true or false; fixed at creation |  | SA; SM (create); PM (a) | INTERNAL | Optional | — |
| `on_hold_reason` | string, up to 255 characters |  | SA; SM (create); PM (a) | INTERNAL | Before status on_hold | — |
| `closed_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |
| `archived_at` | timestamp (UTC); A-24, set on AMPM approval (Q23) |  | SYS | INTERNAL | System | — |
| `archived_by` (FK) | references users; nullable; the approving user (Q23) |  | SYS (acting user) | CLIENT | System | — |
| `client_access_until` | timestamp (UTC); closed_at plus three months (Q23) |  | SYS at closure (closed_at plus the configured window); SA override | CLIENT | System | Client memberships removed after this date (A-23) |
| `internal_notes` | text, up to 10,000 characters |  | SA; SM (create); PM (a) | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |

### `project_hotels`

Created at stage: **Project setup** · Default editor: PM (a); HT; SA · Default visibility: CLIENT · Assumptions: A-18 (Q18) · unique on project_id and hotel_id

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `project_id` (FK) | references wedding_projects |  | PM (a); HT; SA | CLIENT | At creation | — |
| `hotel_id` (FK) | references hotels |  | PM (a); HT; SA | CLIENT | At creation | — |
| `hotel_role` | one of the listed options; (A-18) | primary, overflow, venue_only | PM (a); HT; SA | CLIENT | At creation | — |
| `notes` | text, up to 10,000 characters |  | PM (a); HT; SA | CLIENT | Optional | — |

### `external_venues`

Created at stage: **Planning** · Default editor: PM (a); SA; HL (a) · Default visibility: CLIENT · Assumptions: A-18 (Q18)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `project_id` (FK) | references wedding_projects |  | PM (a); SA; HL (a) | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | PM (a); SA; HL (a) | CLIENT | At creation | — |
| `address` | text, up to 10,000 characters |  | PM (a); SA; HL (a) | CLIENT | Optional | — |
| `contact_name` | string, up to 255 characters |  | PM (a); SA; HL (a) | RESTRICTED-CONTACT | Optional | — |
| `contact_phone` | E.164 format, default +91 |  | PM (a); SA; HL (a) | RESTRICTED-CONTACT | Optional | — |
| `capacity` | integer, 0 or more |  | PM (a); SA; HL (a) | CLIENT | Optional | — |
| `notes` | text, up to 10,000 characters |  | PM (a); SA; HL (a) | CLIENT | Optional | — |

---

## 7. Module F — Functions, programme and run-of-show

### `function_types`

Created at stage: **Configuration** · Default editor: SA · Default visibility: CLIENT

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `type_key` (unique) | lowercase snake_case; unique; mehendi, haldi, sangeet, ceremony, reception, brunch, other |  | SA | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | SA | CLIENT | At creation | — |
| `sort_order` | integer, 0 or more; unique within its parent |  | SA | CLIENT | Optional | — |
| `is_active` | true or false |  | SA | CLIENT | Optional | — |

### `functions`

Created at stage: **Planning** · Default editor: PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics · Default visibility: CLIENT · Assumptions: A-26 (AM-3), AM-2, P-8 (Q10)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `project_id` (FK) | references wedding_projects |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | At creation | — |
| `function_type_id` (FK) | references function_types |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | At creation | — |
| `function_date` | date within the project range unless dates_tentative |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | At creation | Countdown, programme, attendance invites, capacity checks |
| `start_time` | time of day in the project time zone |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | Optional | — |
| `end_time` | time; after start_time |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | Optional | — |
| `venue_kind` | hotel_venue requires hotel_venue_id; external_venue requires external_venue_id | hotel_venue, external_venue, tbd | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | At creation | — |
| `hotel_venue_id` (FK) | references hotel_venues; nullable |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | Optional | — |
| `external_venue_id` (FK) | references external_venues; nullable |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | Optional | — |
| `guest_estimate` | integer, 0 or more |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | Optional | Compared with venue capacity; replaced by confirmed attendance |
| `theme` | string, up to 255 characters |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | Optional | — |
| `dress_code` | string, up to 255 characters |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | Optional | — |
| `status` | one of the listed options; (A-26) | planned, confirmed, cancelled | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | CLIENT | At creation | Transitions per permission-matrix §7; each transition audited; notifications per §8 |
| `readiness_status` | one of the listed options; derived from checklist (A-26) | not_started, in_progress, blocked, ready, live, completed | SYS from the readiness checklist; live and completed by PM (a) | CLIENT | System | ready needs every required item done or excepted (A-26) |
| `readiness_exception_note` | text, up to 10,000 characters; documented authorised exception (SPEC section 7) |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | INTERNAL | When an exception is authorised | — |
| `readiness_exception_by` (FK) | references users |  | SYS (authorising user) | INTERNAL | System | — |
| `internal_notes` | text, up to 10,000 characters |  | PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |

### `function_programme_items`

Created at stage: **Planning** · Default editor: PM (a); SA; HL (a) · Default visibility: CLIENT when client_visible

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when client_visible | System | — |
| `function_id` (FK) | references functions |  | PM (a); SA; HL (a) | CLIENT when client_visible | At creation | — |
| `start_time` | time of day in the project time zone |  | PM (a); SA; HL (a) | CLIENT when client_visible | At creation | — |
| `end_time` | time; after start_time |  | PM (a); SA; HL (a) | CLIENT when client_visible | Optional | — |
| `title` | string, up to 255 characters |  | PM (a); SA; HL (a) | CLIENT | At creation | — |
| `description` | text, up to 10,000 characters |  | PM (a); SA; HL (a) | CLIENT | Optional | — |
| `client_visible` | true or false; default true |  | PM (a); SA; HL (a) | CLIENT when client_visible | Optional | Shared programme for the client and guests |

### `run_of_show_items`

Created at stage: **Pre-production** · Default editor: PM (a); HL (a); SA; VC (a) for vendor cues · Default visibility: INTERNAL · Assumptions: A-1 (Q1) offline read cache

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `function_id` (FK) | references functions |  | PM (a); HL (a); SA; VC (a) for vendor cues | INTERNAL | At creation | — |
| `sequence` | integer, 0 or more; unique within its parent |  | PM (a); HL (a); SA; VC (a) for vendor cues | INTERNAL | At creation | — |
| `planned_start` | timestamp (UTC) |  | PM (a); HL (a); SA; VC (a) for vendor cues | INTERNAL | At creation | — |
| `planned_end` | timestamp (UTC); not before planned_start |  | PM (a); HL (a); SA; VC (a) for vendor cues | INTERNAL | Optional | — |
| `cue` | string, up to 255 characters |  | PM (a); HL (a); SA; VC (a) for vendor cues | INTERNAL | At creation | — |
| `description` | text, up to 10,000 characters |  | PM (a); HL (a); SA; VC (a) for vendor cues | INTERNAL | Optional | — |
| `owner_user_id` (FK) | references users |  | PM (a); HL (a) | INTERNAL | At creation | Owner sees the cue on the live view |
| `vendor_assignment_id` (FK) | references vendor_assignments; nullable |  | PM (a); HL (a); SA; VC (a) for vendor cues | INTERNAL | Optional | — |
| `status` | one of the listed options | pending, in_progress, done, skipped | PM (a); HL (a); SA; VC (a) for vendor cues | INTERNAL | At creation | Live execution view; skipped cues reported |
| `actual_start` | timestamp (UTC) |  | HL (a); PM (a) on the day | INTERNAL | Optional | Live timeline and post-event report |
| `actual_end` | timestamp (UTC) |  | HL (a); PM (a) on the day | INTERNAL | Optional | Live timeline and post-event report |
| `notes` | text, up to 10,000 characters |  | PM (a); HL (a); SA; VC (a) for vendor cues | INTERNAL | Optional | — |

---

## 8. Module G — Budget and finance

### `budget_categories`

Created at stage: **Configuration** · Default editor: SA; FA · Default visibility: CLIENT

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `category_key` (unique) | lowercase snake_case; unique |  | SA; FA | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | SA; FA | CLIENT | At creation | — |
| `parent_id` (FK) | references budget_categories; no cycles |  | SA; FA | CLIENT | Optional | — |
| `sort_order` | integer, 0 or more; unique within its parent |  | SA; FA | CLIENT | Optional | — |
| `is_active` | true or false |  | SA; FA | CLIENT | Optional | — |

### `budget_lines`

Created at stage: **Planning** · Default editor: PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines · Default visibility: CLIENT when client_visible · Assumptions: A-4 (Q4), P-3 (Q4), A-25 (Q25)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when client_visible | System | — |
| `project_id` (FK) | references wedding_projects |  | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | CLIENT when client_visible | At creation | — |
| `function_id` (FK) | references functions; nullable |  | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | CLIENT when client_visible | Optional | — |
| `category_id` (FK) | references budget_categories |  | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | CLIENT when client_visible | At creation | — |
| `title` | string, up to 255 characters |  | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | CLIENT | At creation | — |
| `description` | text, up to 10,000 characters |  | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | CLIENT | Optional | — |
| `estimate_amount` | numeric(14,2), 0 or more; planning estimate |  | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | CLIENT | Before status proposed | Client budget summary; estimate change beyond the threshold sets a material flag (A-25) |
| `approved_amount` | numeric(14,2), 0 or more; locked by approval |  | SYS from the approval that locked it; FA override is audited | CLIENT | Before status approved | Locked by approval; later changes go through a change request |
| `actual_amount` | numeric(14,2), 0 or more; amount billed to the client |  | FA; SA | CLIENT | Optional | Client variance = actual minus approved (SPEC §9) |
| `internal_cost_estimate` | numeric(14,2), 0 or more; (A-4) |  | PM (a); VC (a); HT; FA | RESTRICTED-FINANCE | Optional | Internal variance and margin |
| `internal_cost_actual` | numeric(14,2), 0 or more; (A-4) |  | FA; SYS from cost entries | RESTRICTED-FINANCE | Optional | Internal variance and margin |
| `currency` | ISO 4217 code, default INR (A-16) |  | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | CLIENT when client_visible | At creation | — |
| `status` | one of the listed options | draft, proposed, approved, committed, invoiced, paid, closed | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | CLIENT when client_visible | At creation | approved needs an approval row; committed when a contract is signed; invoiced and paid follow invoices and payments |
| `vendor_assignment_id` (FK) | references vendor_assignments; nullable |  | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | CLIENT when client_visible | Optional | — |
| `hotel_enquiry_id` (FK) | references hotel_enquiries; nullable |  | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | CLIENT when client_visible | Optional | — |
| `approval_id` (FK) | references approvals; nullable |  | SYS | CLIENT when client_visible | Optional | — |
| `client_visible` | true or false |  | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | CLIENT when client_visible | Optional | Sharing audited; hidden lines are excluded from the client summary |
| `internal_notes` | text, up to 10,000 characters |  | PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |

### `cost_entries`

Created at stage: **Execution / closure** · Default editor: FA; SA; PM (a); VC (a); HT · Default visibility: INTERNAL · Whole table: **RESTRICTED-FINANCE** · Assumptions: A-4 (Q4)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | RESTRICTED-FINANCE | System | — |
| `project_id` (FK) | references wedding_projects |  | FA; SA; PM (a); VC (a); HT | RESTRICTED-FINANCE | At creation | — |
| `budget_line_id` (FK) | references budget_lines |  | FA; SA; PM (a); VC (a); HT | RESTRICTED-FINANCE | At creation | — |
| `vendor_assignment_id` (FK) | references vendor_assignments; nullable |  | FA; SA; PM (a); VC (a); HT | RESTRICTED-FINANCE | Optional | — |
| `description` | text, up to 10,000 characters; whole table |  | FA; SA; PM (a); VC (a); HT | RESTRICTED-FINANCE | At creation | — |
| `amount` | numeric(14,2), 0 or more |  | FA; SA; PM (a); VC (a); HT | RESTRICTED-FINANCE | At creation | Summed into budget_lines.internal_cost_actual and final accounts |
| `currency` | ISO 4217 code, default INR (A-16) |  | FA; SA; PM (a); VC (a); HT | RESTRICTED-FINANCE | At creation | — |
| `incurred_at` | date |  | FA; PM (a); VC (a) | RESTRICTED-FINANCE | At creation | — |
| `invoice_id` (FK) | references invoices; nullable, vendor invoice |  | FA; SA; PM (a); VC (a); HT | RESTRICTED-FINANCE | Optional | — |
| `payment_id` (FK) | references payments; nullable, outbound payment |  | FA; SA; PM (a); VC (a); HT | RESTRICTED-FINANCE | Optional | — |

### `contracts`

Created at stage: **Approvals** · Default editor: FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) · Default visibility: CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts · Assumptions: A-4 (Q4), P-3 (Q4)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | System | — |
| `project_id` (FK) | references wedding_projects; nullable for account-level client contracts |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | Optional | — |
| `party_type` | one of the listed options | client, vendor, hotel | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | At creation | — |
| `party_id` | references client_accounts, vendors or hotels per party_type |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | At creation | — |
| `vendor_assignment_id` (FK) | references vendor_assignments; nullable |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | Optional | — |
| `hotel_enquiry_id` (FK) | references hotel_enquiries; nullable |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | Optional | — |
| `title` | string, up to 255 characters |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | At creation | — |
| `amount` | numeric(14,2), 0 or more |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | At creation | — |
| `currency` | ISO 4217 code, default INR (A-16) |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | At creation | — |
| `start_date` | date |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | Optional | — |
| `end_date` | date; not before start_date |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | Optional | — |
| `status` | one of the listed options | draft, sent, signed, active, completed, terminated | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | At creation | signed moves linked budget lines to committed and vendor assignments to contracted; audited |
| `signed_at` | timestamp (UTC) |  | FA; VC; HT | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | Before status signed | — |
| `document_id` (FK) | references see data model |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | Before status signed | — |
| `client_visible` | true only when party_type is client |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts | Optional | Sharing audited |
| `internal_notes` | text, up to 10,000 characters |  | FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a) | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |

### `invoices`

Created at stage: **Approvals / closure** · Default editor: FA; SA; VC (a) and HT for received invoices · Default visibility: CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise · Assumptions: A-16 (Q16), GP-17, GP-18

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | System | — |
| `account_id` (FK) | references client_accounts |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | At creation | — |
| `project_id` (FK) | references wedding_projects; nullable |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | Optional | — |
| `direction` | one of the listed options; (GP-17) | issued_to_client, received_from_vendor, received_from_hotel | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | At creation | — |
| `counterparty_type` | string, up to 255 characters |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | At creation | — |
| `counterparty_id` | references client_accounts, vendors or hotels per counterparty_type |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | At creation | — |
| `invoice_number` (unique) | sequential per financial year; unique; assigned at issue |  | SYS | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | System at issue | — |
| `issue_date` | date |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | At creation | — |
| `due_date` | date; not before issue_date |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | At creation | Overdue by job; dashboards and client notice |
| `subtotal_amount` | numeric(14,2), 0 or more |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | At creation | — |
| `tax_rate` | percentage 0 to 100 with 2 decimals |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | Optional | — |
| `tax_amount` | subtotal multiplied by tax_rate |  | SYS | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | Optional | — |
| `total_amount` | subtotal plus tax |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | At creation | — |
| `currency` | ISO 4217 code, default INR (A-16) |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | At creation | — |
| `supplier_gstin` | 15-character GSTIN format |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | When GST invoicing is enabled (Q16) | — |
| `recipient_gstin` | 15-character GSTIN format |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | Optional | — |
| `place_of_supply` | Indian state code |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | When GST invoicing is enabled (Q16) | — |
| `status` | one of the listed options | draft, issued, partially_paid, paid, overdue, cancelled, credited | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | At creation | issued notifies the client and sets the milestone invoiced; paid from payments; overdue by job |
| `payment_milestone_id` (FK) | references payment_milestones; nullable |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | Optional | — |
| `document_id` (FK) | references see data model |  | SYS | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | Before status issued (generated PDF) | — |
| `client_visible` | true only when direction is issued_to_client |  | FA; SA; VC (a) and HT for received invoices | CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise | Optional | Sharing change audited; switches the client serialiser |

### `invoice_lines`

Created at stage: **Approvals / closure** · Default editor: FA; SA · Default visibility: Same class as the invoice

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | Same class as the invoice | System | — |
| `invoice_id` (FK) | references invoices |  | FA; SA | Same class as the invoice | At creation | — |
| `description` | text, up to 10,000 characters |  | FA; SA | Same class as the invoice | At creation | — |
| `budget_line_id` (FK) | references budget_lines; nullable |  | FA; SA | Same class as the invoice | Optional | — |
| `hsn_sac_code` | 4 to 8 digits |  | FA; SA | Same class as the invoice | When GST invoicing is enabled (Q16) | — |
| `quantity` | numeric, more than 0 |  | FA; SA | Same class as the invoice | At creation | — |
| `unit_amount` | numeric(14,2), 0 or more |  | FA; SA | Same class as the invoice | At creation | — |
| `tax_rate` | percentage 0 to 100 |  | FA; SA | Same class as the invoice | Optional | — |
| `line_total` | quantity multiplied by unit_amount plus tax |  | FA; SA | Same class as the invoice | At creation | — |

### `project_final_accounts`

Created at stage: **Closure** · Default editor: FA; SA; PM (a) compiles · Default visibility: INTERNAL · Assumptions: A-4 (Q4), P-3 (Q4) · one row per project

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `project_id` (FK) | references wedding_projects |  | FA; SA; PM (a) compiles | INTERNAL | At creation | — |
| `total_client_billed` | numeric(14,2), 0 or more |  | SYS | CLIENT (closing statement) | Optional | Sum of issued client invoices |
| `total_client_paid` | numeric(14,2), 0 or more |  | SYS | CLIENT (closing statement) | Optional | Sum of succeeded inbound payments |
| `total_vendor_cost` | numeric(14,2), 0 or more |  | SYS | RESTRICTED-FINANCE | Optional | Sum of vendor cost entries |
| `total_hotel_cost` | numeric(14,2), 0 or more |  | SYS | RESTRICTED-FINANCE | Optional | Sum of hotel cost entries |
| `margin_amount` | billed minus vendor and hotel cost |  | SYS | RESTRICTED-FINANCE | Optional | Margin report (FA, SA only) |
| `status` | one of the listed options | draft, reconciled, approved, closed | FA; SA; PM (a) compiles | INTERNAL | At creation | approved is required before the project can close (permission-matrix §7) |
| `reconciled_by` (FK) | references users |  | SYS (acting user) | INTERNAL | System | — |
| `approved_by` (FK) | references users |  | SYS (acting user) | INTERNAL | System | — |
| `document_id` (FK) | references see data model |  | FA; SA; PM (a) compiles | INTERNAL | Optional | — |

---

## 9. Module H — Vendors, artists and production

### `vendor_categories`

Created at stage: **Configuration** · Default editor: SA; VC · Default visibility: CLIENT

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `category_key` (unique) | lowercase snake_case; unique; decor, photography, videography, sound_light, artists, catering, tents_props, sfx, transport, other |  | SA; VC | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | SA; VC | CLIENT | At creation | — |
| `parent_id` (FK) | references vendor_categories; no cycles |  | SA; VC | CLIENT | Optional | — |
| `is_active` | true or false |  | SA; VC | CLIENT | Optional | — |

### `vendors`

Created at stage: **Vendor onboarding** · Default editor: VC; SA · Default visibility: CLIENT · Assumptions: A-22 (Q22), P-11 (Q22), P-3 contact tier

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `name` | string, up to 255 characters; when presented |  | VC; SA | CLIENT | At creation | — |
| `primary_category_id` (FK) | references vendor_categories |  | VC; SA | CLIENT | At creation | — |
| `description_client` | text, up to 10,000 characters |  | VC; SA | CLIENT | Before the vendor is presented to a client | — |
| `contact_name` | string, up to 255 characters |  | VC; SA | RESTRICTED-CONTACT | Optional | — |
| `phone` | E.164 format, default +91 |  | VC; SA | RESTRICTED-CONTACT | Optional | — |
| `email` | valid email address, stored lowercase |  | VC; SA | RESTRICTED-CONTACT | Optional | — |
| `website` | valid URL |  | VC; SA | CLIENT | Optional | — |
| `instagram_handle` | handle without the at sign |  | VC; SA | CLIENT | Optional | — |
| `base_city` | string, up to 255 characters |  | VC; SA | CLIENT | Optional | — |
| `service_area` | string, up to 255 characters |  | VC; SA | CLIENT | Optional | — |
| `status` | one of the listed options | prospective, active, preferred, inactive, blacklisted | VC; SA | INTERNAL | At creation | blacklisted and inactive vendors cannot be assigned |
| `internal_rating` | integer 1 to 5 |  | VC; SA | RESTRICTED-NOTES | Optional | — |
| `internal_notes` | text, up to 10,000 characters |  | VC; SA | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |
| `gstin` | 15-character GSTIN format |  | VC; SA | INTERNAL | Optional | — |
| `bank_details_document_id` (FK) | references documents |  | VC; SA | RESTRICTED-BANK | Optional | — |
| `onboarded_at` | timestamp (UTC) |  | VC | INTERNAL | Optional | — |

### `vendor_category_links`

Created at stage: **Vendor onboarding** · Default editor: VC; SA · Default visibility: CLIENT · unique pair

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `vendor_id` (FK) | references vendors |  | VC; SA | CLIENT | At creation | — |
| `category_id` (FK) | references vendor_categories |  | VC; SA | CLIENT | At creation | — |

### `vendor_availability`

Created at stage: **Vendor onboarding / planning** · Default editor: VC; SA · Default visibility: INTERNAL · Assumptions: GP-21

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `vendor_id` (FK) | references vendors |  | VC; SA | INTERNAL | At creation | — |
| `date_from` | date |  | VC; SA | INTERNAL | At creation | — |
| `date_to` | date; not before date_from |  | VC; SA | INTERNAL | At creation | — |
| `status` | one of the listed options; (GP-21) | available, tentative, booked, unavailable | VC; SA | INTERNAL | At creation | booked windows warn when the vendor is assigned to an overlapping function |
| `verified_at` | timestamp (UTC) |  | VC | INTERNAL | Optional | Stale after the configured age (BIZ rule 6) |
| `verified_by` (FK) | references users |  | SYS (acting user) | INTERNAL | System | — |
| `source` | string, up to 255 characters |  | VC; SA | INTERNAL | Optional | — |
| `note` | text, up to 10,000 characters |  | VC; SA | INTERNAL | Optional | — |

### `vendor_assignments`

Created at stage: **Planning (presenting options)** · Default editor: VC; PM (a); SA; client decision by CO, CA · Default visibility: CLIENT once presented_at is set · Assumptions: A-4 (Q4), SPEC §5 vendor decision

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT once presented_at is set | System | — |
| `project_id` (FK) | references wedding_projects |  | VC; PM (a); SA; client decision by CO, CA | CLIENT once presented_at is set | At creation | — |
| `function_id` (FK) | references functions; nullable |  | VC; PM (a); SA; client decision by CO, CA | CLIENT once presented_at is set | Optional | — |
| `vendor_id` (FK) | references vendors |  | VC; PM (a); SA; client decision by CO, CA | CLIENT once presented_at is set | At creation | — |
| `category_id` (FK) | references vendor_categories |  | VC; PM (a); SA; client decision by CO, CA | CLIENT once presented_at is set | At creation | — |
| `scope_text` | text, up to 10,000 characters |  | VC; PM (a); SA; client decision by CO, CA | CLIENT | Before presented | — |
| `status` | one of the listed options | option, shortlisted, selected, contracted, delivering, completed, cancelled, declined | VC; PM (a); SA; client decision by CO, CA | CLIENT once presented_at is set | At creation | Per §7; selected links the vendor to the project; completed needs every deliverable accepted |
| `client_decision` | one of the listed options; (SPEC section 5) | none, interested, shortlisted, selected, declined | CO, CA; VC or PM (a) recording the decision | CLIENT once presented_at is set | At creation | selected moves status to selected; declined closes the option |
| `client_decision_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT once presented_at is set | System | — |
| `client_decision_by` (FK) | references users |  | SYS (acting user) | CLIENT once presented_at is set | System | — |
| `presented_at` | timestamp (UTC); sees the option from here |  | SYS when the option is shared | CLIENT | System | Makes the option client-visible |
| `contract_id` (FK) | references contracts; nullable |  | SYS | INTERNAL | Optional | — |
| `completion_confirmed_at` | timestamp (UTC); vendor completion for closure |  | SYS | INTERNAL | System | Closure checklist vendor completion item |
| `completion_confirmed_by` (FK) | references users |  | SYS (acting user) | CLIENT once presented_at is set | System | — |
| `share_contact` | true or false; true only in an AMPM-approved case (Q4) |  | VC; PM (a); SA; client decision by CO, CA | CLIENT once presented_at is set | Optional | — |
| `internal_notes` | text, up to 10,000 characters |  | VC; PM (a); SA; client decision by CO, CA | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |

### `vendor_quotes`

Created at stage: **Planning** · Default editor: VC; SA · Default visibility: INTERNAL · Whole table: **RESTRICTED-FINANCE** · Assumptions: A-4 (Q4), P-3 (Q4)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | RESTRICTED-FINANCE | System | — |
| `vendor_id` (FK) | references vendors |  | VC; SA | RESTRICTED-FINANCE | At creation | — |
| `project_id` (FK) | references wedding_projects |  | VC; SA | RESTRICTED-FINANCE | At creation | — |
| `vendor_assignment_id` (FK) | references vendor_assignments; nullable |  | VC; SA | RESTRICTED-FINANCE | Optional | — |
| `version_number` | integer, 1 or more; increments by 1 within its parent; immutable once shared |  | VC; SA | RESTRICTED-FINANCE | At creation | A new version supersedes earlier approvals (SPEC §12) |
| `amount` | numeric(14,2), 0 or more; whole table, raw quote to AMPM |  | VC; SA | RESTRICTED-FINANCE | At creation | — |
| `currency` | ISO 4217 code, default INR (A-16) |  | VC; SA | RESTRICTED-FINANCE | At creation | — |
| `received_at` | timestamp (UTC) |  | VC | RESTRICTED-FINANCE | At creation | — |
| `valid_until` | date |  | VC; SA | RESTRICTED-FINANCE | Optional | Expired quotes flagged |
| `document_id` (FK) | references see data model |  | VC; SA | RESTRICTED-FINANCE | Optional | — |
| `status` | one of the listed options | received, shortlisted, selected, rejected, expired | VC; SA | RESTRICTED-FINANCE | At creation | Transitions per permission-matrix §7; each transition audited; notifications per §8 |
| `internal_notes` | text, up to 10,000 characters |  | VC; SA | RESTRICTED-FINANCE | Optional | Never serialised to client, guest or demo principals |

### `vendor_proposals`

Created at stage: **Planning** · Default editor: VC; PM (a); SA · Default visibility: CLIENT when shared · Assumptions: A-4 (Q4), P-3 (Q4)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when shared | System | — |
| `vendor_assignment_id` (FK) | references vendor_assignments |  | VC; PM (a); SA | CLIENT when shared | At creation | — |
| `version_number` | integer, 1 or more; increments by 1 within its parent; immutable once shared |  | VC; PM (a); SA | CLIENT when shared | At creation | A new version supersedes earlier approvals (SPEC §12) |
| `title` | string, up to 255 characters |  | VC; PM (a); SA | CLIENT | At creation | — |
| `description_client` | text, up to 10,000 characters |  | VC; PM (a); SA | CLIENT | Optional | — |
| `inclusions_text` | text, up to 10,000 characters |  | VC; PM (a); SA | CLIENT | Optional | — |
| `client_visible_amount` | numeric(14,2), 0 or more; (A-4) |  | VC; PM (a); SA | CLIENT | Before status shared | Client budget and approval |
| `internal_cost` | numeric(14,2), 0 or more; (A-4) |  | VC; PM (a); SA | RESTRICTED-FINANCE | Before status shared (margin check) | Margin report |
| `currency` | ISO 4217 code, default INR (A-16) |  | VC; PM (a); SA | CLIENT when shared | At creation | — |
| `status` | one of the listed options | draft, shared, revision_requested, accepted, declined, superseded | VC; PM (a); SA | CLIENT when shared | At creation | shared notifies approvers; accepted locks the version and creates or updates the budget line; superseded on a new version |
| `shared_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT when shared | System | — |
| `decided_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT when shared | System | — |
| `decided_by_user_id` (FK) | references users |  | SYS (acting user) | CLIENT when shared | System | — |
| `approval_id` (FK) | references approvals |  | SYS | CLIENT when shared | Optional | — |
| `document_id` (FK) | references see data model |  | VC; PM (a); SA | CLIENT when shared | Before status shared | — |
| `supersedes_proposal_id` (FK) | references vendor_proposals |  | SYS | CLIENT when shared | Optional | — |

### `vendor_deliverables`

Created at stage: **Approvals** · Default editor: VC; PM (a); SA; HL (a) marks delivered · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `vendor_assignment_id` (FK) | references vendor_assignments |  | VC; PM (a); SA; HL (a) marks delivered | INTERNAL | At creation | — |
| `function_id` (FK) | references functions; nullable |  | VC; PM (a); SA; HL (a) marks delivered | INTERNAL | Optional | — |
| `title` | string, up to 255 characters |  | VC; PM (a); SA; HL (a) marks delivered | INTERNAL | At creation | — |
| `due_at` | timestamp (UTC) |  | VC; PM (a) | INTERNAL | Optional | Overdue items appear on dashboards (SPEC §8) |
| `status` | one of the listed options | pending, in_progress, delivered, accepted, rejected | VC; PM (a); SA; HL (a) marks delivered | INTERNAL | At creation | accepted by PM (a); when all are accepted, completion_confirmed_at is set on the assignment |
| `accepted_by` (FK) | references users |  | SYS (acting user) | INTERNAL | System | — |
| `accepted_at` | timestamp (UTC) |  | SYS (when the action happens) | INTERNAL | System | — |
| `notes` | text, up to 10,000 characters |  | VC; PM (a); SA; HL (a) marks delivered | INTERNAL | Optional | — |

### `artist_bookings`

Created at stage: **Pre-production** · Default editor: VC; PM (a); SA · Default visibility: INTERNAL · Assumptions: A-4 (Q4) for the fee

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `vendor_assignment_id` (FK) | references vendor_assignments |  | VC; PM (a); SA | INTERNAL | At creation | — |
| `function_id` (FK) | references functions |  | VC; PM (a); SA | INTERNAL | At creation | — |
| `artist_name` | string, up to 255 characters |  | VC; PM (a); SA | CLIENT | At creation | — |
| `performance_type` | string, up to 255 characters |  | VC; PM (a); SA | CLIENT | Optional | — |
| `slot_start` | timestamp (UTC) |  | VC; PM (a) | CLIENT | Optional | Run-of-show cue created |
| `slot_end` | timestamp (UTC); after slot_start; within the function |  | VC; PM (a) | CLIENT | Optional | — |
| `status` | one of the listed options | enquiry, held, confirmed, performed, cancelled | VC; PM (a); SA | INTERNAL | At creation | Transitions per permission-matrix §7; each transition audited; notifications per §8 |
| `technical_rider_document_id` (FK) | references documents |  | VC; PM (a); SA | INTERNAL | Optional | Production readiness item |
| `hospitality_requirements` | text, up to 10,000 characters |  | VC; PM (a); SA | INTERNAL | Optional | — |
| `travel_arrangements` | text, up to 10,000 characters |  | VC; PM (a); SA | INTERNAL | Optional | — |
| `fee_internal` | numeric(14,2), 0 or more |  | VC; PM (a); SA | RESTRICTED-FINANCE | Optional | — |
| `currency` | ISO 4217 code, default INR (A-16) |  | VC; PM (a); SA | INTERNAL | Optional | — |

### `production_items`

Created at stage: **Pre-production** · Default editor: VC; HL (a); PM (a); SA · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `function_id` (FK) | references functions |  | VC; HL (a); PM (a); SA | INTERNAL | At creation | — |
| `vendor_assignment_id` (FK) | references vendor_assignments; nullable |  | VC; HL (a); PM (a); SA | INTERNAL | Optional | — |
| `category` | one of the listed options | sound, lighting, stage, led, tent, props, sfx, power, other | VC; HL (a); PM (a); SA | INTERNAL | At creation | — |
| `description` | text, up to 10,000 characters |  | VC; HL (a); PM (a); SA | INTERNAL | At creation | — |
| `quantity` | integer, 1 or more |  | VC; HL (a); PM (a); SA | INTERNAL | At creation | — |
| `status` | one of the listed options | planned, ordered, delivered, installed, tested, struck | VC; HL (a); PM (a); SA | INTERNAL | At creation | tested feeds the readiness checklist; struck recorded at closure |
| `owner_user_id` (FK) | references users |  | PM (a); HL (a) | INTERNAL | At creation | — |
| `checklist_item_id` (FK) | references checklist_items; nullable, links to a readiness item |  | VC; HL (a); PM (a); SA | INTERNAL | Optional | Links the item to a readiness check |
| `notes` | text, up to 10,000 characters |  | VC; HL (a); PM (a); SA | INTERNAL | Optional | — |

---

## 10. Module I — Creative, approvals and client requests

### `design_items`

Created at stage: **Planning** · Default editor: CD (a); PM (a); SA · Default visibility: CLIENT when client_visible

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when client_visible | System | — |
| `project_id` (FK) | references wedding_projects |  | CD (a); PM (a); SA | CLIENT when client_visible | At creation | — |
| `function_id` (FK) | references functions; nullable |  | CD (a); PM (a); SA | CLIENT when client_visible | Optional | — |
| `category` | one of the listed options | concept, moodboard, render, invitation, save_the_date, stationery, signage, other | CD (a); PM (a); SA | CLIENT when client_visible | At creation | — |
| `title` | string, up to 255 characters |  | CD (a); PM (a); SA | CLIENT | At creation | — |
| `brief_text` | text, up to 10,000 characters; design brief |  | CD (a); PM (a); SA | INTERNAL | Optional | — |
| `status` | one of the listed options | briefing, in_progress, review, approved, archived | CD (a); PM (a); SA | CLIENT when client_visible | At creation | approved when the current version is approved |
| `owner_user_id` (FK) | references users |  | PM (a); CD (a) | CLIENT when client_visible | At creation | — |
| `client_visible` | true or false |  | CD (a); PM (a); SA | CLIENT when client_visible | Optional | Sharing change audited; switches the client serialiser |

### `design_versions`

Created at stage: **Planning** · Default editor: CD (a); PM (a); SA · Default visibility: CLIENT when shared · Assumptions: SPEC §12 version lock

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when shared | System | — |
| `design_item_id` (FK) | references design_items |  | CD (a); PM (a); SA | CLIENT when shared | At creation | — |
| `version_number` | integer, 1 or more; increments by 1 within its parent; immutable once shared |  | CD (a); PM (a); SA | CLIENT when shared | At creation | A new version supersedes earlier approvals (SPEC §12) |
| `summary` | text, up to 10,000 characters |  | CD (a); PM (a); SA | CLIENT | Optional | — |
| `status` | one of the listed options | draft, shared, revision_requested, approved, rejected, superseded | CD (a); PM (a); SA | CLIENT when shared | At creation | shared notifies approvers; approved locks the files; immutable once shared; superseded by the next version |
| `shared_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT when shared | System | — |
| `approval_id` (FK) | references approvals |  | SYS | CLIENT when shared | Optional | — |

### `comments`

Created at stage: **Any** · Default editor: Author; SA may delete · Default visibility: CLIENT unless is_internal

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT unless is_internal | System | — |
| `entity_type` | one of the listed options | design_version, vendor_proposal, menu_version, client_request, task, incident, hotel_enquiry | Author; SA may delete | CLIENT unless is_internal | At creation | — |
| `entity_id` | must exist and be reachable by the author |  | Author; SA may delete | CLIENT unless is_internal | At creation | — |
| `author_user_id` (FK) | references users |  | SYS (acting user) | CLIENT unless is_internal | At creation | — |
| `body` | text, up to 10,000 characters |  | Author; SA may delete | CLIENT unless is_internal | At creation | — |
| `is_internal` | true or false; true is never client-visible |  | Author at creation; cannot be changed later | CLIENT unless is_internal | Optional | Internal comments never reach client serialisers |
| `parent_comment_id` (FK) | references comments on the same entity |  | Author; SA may delete | CLIENT unless is_internal | Optional | — |
| `annotation_json` | x and y between 0 and 1 of the image |  | Author; SA may delete | CLIENT unless is_internal | Optional | — |

### `client_requests`

Created at stage: **Any (client)** · Default editor: CO, CA, CV create; assigned staff respond; PM (a) and SA decide · Default visibility: CLIENT · Assumptions: A-20 (Q20), A-21 (Q21), A-25 (Q25)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `project_id` (FK) | references wedding_projects |  | CO, CA, CV create; assigned staff respond; PM (a) and SA decide | CLIENT | At creation | — |
| `account_id` (FK) | references client_accounts |  | CO, CA, CV create; assigned staff respond; PM (a) and SA decide | CLIENT | At creation | — |
| `request_type` | one of the listed options; (A-20, A-21) | question, change_request, support | CO, CA, CV create; assigned staff respond; PM (a) and SA decide | CLIENT | At creation | — |
| `requested_by_user_id` (FK) | references users |  | SYS (acting user) | CLIENT | At creation | — |
| `entity_type` | string, up to 255 characters; nullable, the record the request is about |  | CO, CA, CV create; assigned staff respond; PM (a) and SA decide | CLIENT | Optional | — |
| `entity_id` | must be reachable by the requester |  | CO, CA, CV create; assigned staff respond; PM (a) and SA decide | CLIENT | Optional | — |
| `title` | string, up to 255 characters |  | CO, CA, CV create; assigned staff respond; PM (a) and SA decide | CLIENT | At creation | — |
| `description` | text, up to 10,000 characters |  | CO, CA, CV create; assigned staff respond; PM (a) and SA decide | CLIENT | At creation | — |
| `status` | one of the listed options; (closed added by Q21) | submitted, under_review, clarification_requested, answered, accepted, rejected, implemented, closed, withdrawn | CO, CA, CV create; assigned staff respond; PM (a) and SA decide | CLIENT | At creation | Per §7; submitted notifies the project lead; accepted material changes raise impact flags (SPEC §8) |
| `is_material` | true or false; A-25 |  | SYS | CLIENT | Optional | Set from configurable thresholds (A-25) |
| `budget_impact_amount` | numeric(14,2), 0 or more |  | PM (a); FA | CLIENT | Optional | — |
| `impact_flags_json` | valid JSON matching the registered schema; budget, contract, task, run_of_show (SPEC section 8) |  | SYS | CLIENT | Optional | Creates review tasks on budgets, contracts, tasks and run-of-show items |
| `assigned_user_id` (FK) | references users |  | PM (a); SA | CLIENT | Optional | Assignee notified |
| `responded_by` (FK) | references users |  | SYS (acting user) | CLIENT | System | — |
| `responded_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |
| `response_text` | text, up to 10,000 characters |  | Assigned staff | CLIENT | Before status answered, accepted or rejected | — |

### `approvals`

Created at stage: **Approvals** · Default editor: Requester per permission-matrix §5.9; SYS supersedes · Default visibility: CLIENT · Assumptions: A-5 (Q5), AM-7, SPEC §12 version lock

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `project_id` (FK) | references wedding_projects |  | Requester per permission-matrix §5.9; SYS supersedes | CLIENT | At creation | — |
| `record_type` | one of the listed options | vendor_proposal, hotel_proposal, design_version, menu_version, invitation_version, budget_line, contract, client_request | Requester per permission-matrix §5.9; SYS supersedes | CLIENT | At creation | — |
| `record_id` | UUID |  | Requester per permission-matrix §5.9; SYS supersedes | CLIENT | At creation | — |
| `version_number` | integer; must equal the record's version at submission |  | Requester per permission-matrix §5.9; SYS supersedes | CLIENT | At creation | Locks that exact version |
| `requested_by_user_id` (FK) | references users |  | SYS (acting user) | CLIENT | At creation | — |
| `requested_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |
| `required_decisions` | integer, 1 or more; default 1; configurable per record_type |  | Requester per permission-matrix §5.9; SYS supersedes | CLIENT | At creation | Approval completes when approved decisions reach it |
| `status` | one of the listed options | draft, submitted, revision_requested, approved, rejected, superseded | Requester per permission-matrix §5.9; SYS supersedes | CLIENT | At creation | approved at the required count; one rejection or revision request moves it at once; superseded when a new version is created; requester notified |
| `decided_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |
| `superseded_by_approval_id` (FK) | references approvals |  | SYS | CLIENT | Optional | — |

### `approval_decisions`

Created at stage: **Approvals** · Default editor: CO, CA with can_approve; PM (a) and SA on behalf with evidence · Default visibility: CLIENT · Assumptions: P-9 (Q5)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `approval_id` (FK) | references approvals |  | CO, CA with can_approve; PM (a) and SA on behalf with evidence | CLIENT | At creation | — |
| `approver_user_id` (FK) | references users |  | CO, CA with can_approve; PM (a) and SA on behalf with evidence | CLIENT | At creation | — |
| `decision` | one of the listed options | approved, revision_requested, rejected | CO, CA with can_approve; PM (a) and SA on behalf with evidence | CLIENT | At creation | — |
| `comment` | text, up to 10,000 characters |  | CO, CA with can_approve; PM (a) and SA on behalf with evidence | CLIENT | When decision is revision_requested or rejected | — |
| `decided_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | At creation | — |
| `recorded_on_behalf_by` (FK) | references users; staff user when the decision was given offline |  | SYS (acting staff user) | CLIENT | System | Audit shows the decision was recorded by staff |
| `evidence_document_id` (FK) | references documents; required when recorded on behalf |  | CO, CA with can_approve; PM (a) and SA on behalf with evidence | CLIENT | When recorded on behalf | — |

---

## 11. Module J — Invitations, guests and RSVP

### `invitations`

Created at stage: **Planning** · Default editor: CD (a); PM (a); RG (a); SA · Default visibility: CLIENT · Assumptions: AM-12

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `project_id` (FK) | references wedding_projects |  | CD (a); PM (a); RG (a); SA | CLIENT | At creation | — |
| `invitation_type` | one of the listed options | save_the_date, invitation, reminder, update | CD (a); PM (a); RG (a); SA | CLIENT | At creation | — |
| `title` | string, up to 255 characters |  | CD (a); PM (a); RG (a); SA | CLIENT | At creation | — |
| `design_item_id` (FK) | references design_items; nullable |  | CD (a); PM (a); RG (a); SA | CLIENT | Optional | — |
| `channels_json` | subset of email, whatsapp, sms, print |  | CD (a); PM (a); RG (a); SA | CLIENT | Optional | — |
| `status` | one of the listed options | draft, approved, scheduled, sending, sent, closed | CD (a); PM (a); RG (a); SA | CLIENT | At creation | approved requires an approved version; sending creates recipients and tokens |
| `scheduled_at` | timestamp (UTC) |  | RG (a) | CLIENT | Optional | Send job at the scheduled time |
| `sent_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |

### `invitation_versions`

Created at stage: **Planning** · Default editor: CD (a); PM (a); SA · Default visibility: CLIENT when shared

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when shared | System | — |
| `invitation_id` (FK) | references invitations |  | CD (a); PM (a); SA | CLIENT when shared | At creation | — |
| `version_number` | integer, 1 or more; increments by 1 within its parent; immutable once shared |  | CD (a); PM (a); SA | CLIENT when shared | At creation | A new version supersedes earlier approvals (SPEC §12) |
| `content_media_id` (FK) | references media_assets |  | CD (a); PM (a); SA | CLIENT when shared | Before status approved | — |
| `message_text` | text, up to 10,000 characters |  | CD (a); PM (a); SA | CLIENT | Optional | — |
| `status` | one of the listed options | draft, shared, approved, superseded | CD (a); PM (a); SA | CLIENT when shared | At creation | Transitions per permission-matrix §7; each transition audited; notifications per §8 |
| `approval_id` (FK) | references approvals |  | SYS | CLIENT when shared | Optional | — |

### `invitation_recipients`

Created at stage: **Guest operations** · Default editor: RG (a); SA; SYS for delivery status · Default visibility: INTERNAL · Assumptions: A-7 (Q7), A-11 (Q11)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `invitation_id` (FK) | references invitations |  | RG (a); SA; SYS for delivery status | INTERNAL | At creation | — |
| `invitation_version_id` (FK) | references invitation_versions |  | RG (a); SA; SYS for delivery status | INTERNAL | At creation | — |
| `family_group_id` (FK) | references family_groups |  | RG (a); SA; SYS for delivery status | INTERNAL | At creation | — |
| `guest_id` (FK) | references guests; nullable, the addressee within the group |  | RG (a); SA; SYS for delivery status | INTERNAL | Optional | — |
| `channel` | string, up to 255 characters |  | RG (a); SA; SYS for delivery status | INTERNAL | At creation | — |
| `status` | one of the listed options | pending, sent, delivered, opened, failed, bounced | SYS | INTERNAL | At creation | Delivery webhooks; failed and bounced create follow-up tasks for RG |
| `sent_at` | timestamp (UTC) |  | SYS (when the action happens) | INTERNAL | System | — |
| `delivered_at` | timestamp (UTC) |  | SYS (when the action happens) | INTERNAL | System | — |
| `provider_ref` | string, up to 255 characters |  | SYS | INTERNAL | Optional | — |
| `rsvp_token_id` (FK) | references rsvp_tokens |  | SYS | INTERNAL | Optional | Token issued when the invitation is sent |

### `family_groups`

Created at stage: **Guest operations** · Default editor: RG (a); PM (a); CO; SA; import · Default visibility: CLIENT · Assumptions: A-7 (Q7), GP-13

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `project_id` (FK) | references wedding_projects |  | RG (a); PM (a); CO; SA; import | CLIENT | At creation | — |
| `name` | string, up to 255 characters; e.g. Mehta family, Mumbai |  | RG (a); PM (a); CO; SA; import | CLIENT | At creation | — |
| `side` | one of the listed options | partner_a, partner_b, both, other | RG (a); PM (a); CO; SA; import | CLIENT | At creation | — |
| `tier` | one of the configured tiers |  | RG (a); PM (a); CO; SA; import | CLIENT | Optional | — |
| `primary_guest_id` (FK) | references guests |  | SYS (first guest); RG (a) | CLIENT | Optional | — |
| `invited_by_contact_id` (FK) | references account_contacts; the account contact who added them |  | RG (a); PM (a); CO; SA; import | CLIENT | Optional | Shown on the client guest list |
| `max_additional_guests` | integer, 0 or more; default 0 |  | RG (a); CO | CLIENT | Optional | Caps self-added members through the RSVP portal |
| `source` | one of the listed options | client_list, ampm_entry, import | SYS | CLIENT | At creation | — |
| `internal_notes` | text, up to 10,000 characters |  | RG (a); PM (a); CO; SA; import | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |

### `guests`

Created at stage: **Guest operations** · Default editor: RG (a); PM (a); CO; GU for the own row; SA; import · Default visibility: CLIENT · Assumptions: A-7 (Q7), A-17 (Q17), GP-24, GP-25

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `project_id` (FK) | references wedding_projects |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | At creation | — |
| `family_group_id` (FK) | references family_groups |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | At creation | — |
| `salutation` | string, up to 255 characters |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | Optional | — |
| `first_name` | string, up to 255 characters |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | At creation | — |
| `last_name` | string, up to 255 characters |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | Optional | — |
| `relation_to_couple` | string, up to 255 characters |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | Optional | — |
| `age_band` | one of the listed options | adult, child, infant | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | At creation | Child and infant counts for menus and rooming |
| `email` | valid email address |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | At least one contact for the group primary | — |
| `phone` | E.164 format, default +91 |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | At least one contact for the group primary | — |
| `whatsapp_number` | E.164 format, default +91 |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | Optional | — |
| `city` | string, up to 255 characters |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | Optional | — |
| `country` | string, up to 255 characters |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | Optional | — |
| `is_group_primary` | exactly one per family group |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | Optional | — |
| `dietary_preference` | one of the listed options; (GP-24) | veg, non_veg, jain, vegan, eggetarian, other | RG (a); CO; GU for the own row | CLIENT | Optional | Feeds menu headcounts |
| `allergies_text` | text, up to 10,000 characters |  | RG (a); CO; GU for the own row | SENSITIVE-GUEST | Optional | Hospitality dietary request; never exported |
| `accessibility_needs` | text, up to 10,000 characters |  | RG (a); CO; GU for the own row | SENSITIVE-GUEST | Optional | Hospitality support request; never exported |
| `special_requests` | text, up to 10,000 characters |  | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | Optional | — |
| `status` | one of the listed options | draft, invited, confirmed, removed | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | At creation | removed keeps the row for audit and sets attendance to not_attending |
| `source` | self_added only through a token within the group allowance | client_list, ampm_entry, self_added, import | SYS | CLIENT | At creation | — |
| `identification_status` | one of the listed options; (self-identification on side or wedding links, Q7) | not_needed, pending, matched, review | RG (a); PM (a); CO; GU for the own row; SA; import | CLIENT | Optional | — |
| `internal_notes` | text, up to 10,000 characters |  | RG (a); PM (a); CO; GU for the own row; SA; import | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |

### `guest_function_attendance`

Created at stage: **Guest operations (on invite)** · Default editor: RG (a); PM (a); GU for the own group; CO; SYS for imports · Default visibility: CLIENT · Assumptions: A-7 (Q7), GP-13 · unique on guest_id and function_id

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `guest_id` (FK) | references guests |  | RG (a); PM (a); GU for the own group; CO; SYS for imports | CLIENT | At creation | — |
| `function_id` (FK) | references functions |  | RG (a); PM (a); GU for the own group; CO; SYS for imports | CLIENT | At creation | — |
| `is_invited` | true or false |  | RG (a); PM (a); GU for the own group; CO; SYS for imports | CLIENT | At creation | Only invited functions appear in the RSVP portal |
| `status` | one of the listed options | no_response, attending, not_attending, tentative | RG (a); PM (a); GU for the own group; CO; SYS for imports | CLIENT | At creation | Recalculates function totals and menu headcounts; flags room allocations and transfers for the guest (SPEC §8) |
| `responded_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |
| `response_source` | one of the listed options | self_service, ampm_call, client, import | SYS | CLIENT | System | — |
| `updated_by` (FK) | references users |  | SYS (acting user) | CLIENT | System | — |

### `rsvp_tokens`

Created at stage: **Guest operations (on send)** · Default editor: RG (a); PM (a); SA; SYS · Default visibility: INTERNAL · Assumptions: A-7 (Q7), P-4 (Q7)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `project_id` (FK) | references wedding_projects |  | RG (a); PM (a); SA; SYS | INTERNAL | At creation | — |
| `link_scope` | one of the listed options; (Q7: per side or one combined link) | household, side, wedding | RG (a); PM (a); SA; SYS | INTERNAL | Optional | — |
| `side` | one of the listed options | bride, groom, both | RG (a); PM (a); SA; SYS | INTERNAL | Optional | — |
| `family_group_id` (FK) | references family_groups; nullable for side or wedding links |  | RG (a); PM (a); SA; SYS | INTERNAL | At creation | — |
| `token_hash` (unique) | string, up to 255 characters |  | SYS | SECRET | At creation | — |
| `expires_at` | timestamp (UTC) |  | RG (a); default the first function date | INTERNAL | At creation | Link refused after expiry |
| `status` | one of the listed options | active, revoked, expired | RG (a); PM (a); SA; SYS | INTERNAL | At creation | revoked refuses the link immediately; a new token is issued |
| `last_accessed_at` | timestamp (UTC) |  | SYS | INTERNAL | System | — |
| `access_count` | system counter |  | SYS | INTERNAL | Optional | — |
| `revoked_at` | timestamp (UTC) |  | SYS (when the action happens) | INTERNAL | System | — |
| `revoked_by` (FK) | references users |  | SYS (acting user) | INTERNAL | System | — |

### `rsvp_responses`

Created at stage: **RSVP** · Default editor: SYS for self-service; RG (a) for assisted responses · Default visibility: INTERNAL · Assumptions: A-7 (Q7), SPEC §12 duplicate test

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `project_id` (FK) | references wedding_projects |  | SYS for self-service; RG (a) for assisted responses | INTERNAL | At creation | — |
| `family_group_id` (FK) | references family_groups |  | SYS for self-service; RG (a) for assisted responses | INTERNAL | At creation | — |
| `guest_id` (FK) | references guests; nullable |  | SYS for self-service; RG (a) for assisted responses | INTERNAL | Optional | — |
| `channel` | one of the listed options | web, phone, whatsapp, email, in_person | SYS for self-service; RG (a) for assisted responses | INTERNAL | At creation | — |
| `token_id` (FK) | references rsvp_tokens; nullable, set for self-service |  | SYS for self-service; RG (a) for assisted responses | INTERNAL | Optional | — |
| `captured_by_user_id` (FK) | references users; nullable, set for AMPM-assisted |  | SYS (acting user) | INTERNAL | System | — |
| `submitted_at` | timestamp (UTC) |  | SYS | INTERNAL | System | — |
| `payload_json` | valid JSON; immutable after insert |  | SYS | INTERNAL | At creation | Audit of what was submitted |
| `locked` | true or false; true after submission; corrections go through the RSVP team (Q7) |  | SYS for self-service; RG (a) for assisted responses | INTERNAL | Optional | — |
| `ip_address` | IPv4 or IPv6 |  | SYS | INTERNAL | Optional | — |

### `guest_support_requests`

Created at stage: **RSVP / live** · Default editor: GU creates; RG (a); HL (a); PM (a); SA · Default visibility: INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types | System | — |
| `project_id` (FK) | references wedding_projects |  | GU creates; RG (a); HL (a); PM (a); SA | INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types | At creation | — |
| `guest_id` (FK) | references guests |  | GU creates; RG (a); HL (a); PM (a); SA | INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types | At creation | — |
| `family_group_id` (FK) | references family_groups |  | GU creates; RG (a); HL (a); PM (a); SA | INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types | At creation | — |
| `request_type` | one of the listed options; (correction added by Q7) | travel, room, dietary, accessibility, correction, general, complaint | GU creates; RG (a); HL (a); PM (a); SA | INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types | At creation | — |
| `description` | text, up to 10,000 characters |  | GU creates; RG (a); HL (a); PM (a); SA | INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types | At creation | — |
| `status` | one of the listed options | open, assigned, in_progress, resolved, closed | GU creates; RG (a); HL (a); PM (a); SA | INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types | At creation | assigned notifies the assignee; open requests on the hospitality dashboard |
| `assigned_user_id` (FK) | references users |  | RG (a); HL (a); PM (a) | INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types | Optional | — |
| `resolved_at` | timestamp (UTC) |  | SYS (when the action happens) | INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types | System | — |
| `resolution_text` | text, up to 10,000 characters |  | GU creates; RG (a); HL (a); PM (a); SA | INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types | Before status resolved | — |

---

## 12. Module K — Rooms, travel and transport

### `room_blocks`

Created at stage: **Planning** · Default editor: HT; PM (a); SA · Default visibility: CLIENT · Assumptions: A-19 (Q19), GP-11, A-4 (Q4)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `project_id` (FK) | references wedding_projects |  | HT; PM (a); SA | CLIENT | At creation | — |
| `hotel_id` (FK) | references hotels |  | HT; PM (a); SA | CLIENT | At creation | — |
| `room_category_id` (FK) | references hotel_room_categories |  | HT; PM (a); SA | CLIENT | At creation | — |
| `date_from` | date |  | HT; PM (a); SA | CLIENT | At creation | — |
| `date_to` | date; not before date_from |  | HT; PM (a); SA | CLIENT | At creation | — |
| `rooms_blocked` | integer, 1 or more; not more than the category room_count |  | HT; PM (a); SA | CLIENT | At creation | — |
| `rooms_released` | integer, 0 or more; not more than rooms_blocked |  | HT; PM (a); SA | CLIENT | Optional | Allocations validated against blocked minus released |
| `release_deadline` | date |  | HT; PM (a); SA | CLIENT | Optional | Reminder to HT and PM (a) before the deadline |
| `internal_rate_amount` | numeric(14,2), 0 or more; (A-4) |  | HT; PM (a); SA | RESTRICTED-FINANCE | Optional | — |
| `client_rate_amount` | numeric(14,2), 0 or more; nullable |  | HT; PM (a); SA | CLIENT | Optional | — |
| `currency` | ISO 4217 code, default INR (A-16) |  | HT; PM (a); SA | CLIENT | At creation | — |
| `status` | one of the listed options | requested, held, contracted, partially_released, released, closed | HT; PM (a); SA | CLIENT | At creation | Transitions per permission-matrix §7; each transition audited; notifications per §8 |
| `contract_id` (FK) | references contracts |  | HT; PM (a); SA | INTERNAL | Optional | — |
| `internal_notes` | text, up to 10,000 characters |  | HT; PM (a); SA | RESTRICTED-NOTES | Optional | Never serialised to client, guest or demo principals |

### `room_allocations`

Created at stage: **Guest operations** · Default editor: HL (a); RG (a); PM (a); SA · Default visibility: CLIENT for the client's own guests · Assumptions: A-19 (Q19)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT for the client's own guests | System | — |
| `project_id` (FK) | references wedding_projects |  | HL (a); RG (a); PM (a); SA | CLIENT for the client's own guests | At creation | — |
| `room_block_id` (FK) | references room_blocks; dates within the block; count within availability |  | HL (a); RG (a); PM (a); SA | CLIENT for the client's own guests | Optional | — |
| `hotel_id` (FK) | references hotels |  | HL (a); RG (a); PM (a); SA | CLIENT for the client's own guests | At creation | — |
| `room_category_id` (FK) | references hotel_room_categories |  | HL (a); RG (a); PM (a); SA | CLIENT for the client's own guests | At creation | — |
| `room_number` | string, up to 255 characters |  | HL (a) at check-in | CLIENT for the client's own guests | Optional | — |
| `check_in_date` | date |  | HL (a); RG (a); PM (a); SA | CLIENT for the client's own guests | At creation | — |
| `check_out_date` | date; after check_in_date |  | HL (a); RG (a); PM (a); SA | CLIENT for the client's own guests | At creation | — |
| `status` | one of the listed options | requested, proposed, confirmed, checked_in, checked_out, cancelled | HL (a); RG (a); PM (a); SA | CLIENT for the client's own guests | At creation | Per §7; every change audited (SPEC §7); confirmed notifies hospitality; checked_out feeds departures |
| `allocated_by` (FK) | references users |  | SYS (acting user) | CLIENT for the client's own guests | At creation | — |
| `special_requests` | text, up to 10,000 characters |  | HL (a); RG (a); PM (a); SA | CLIENT for the client's own guests | Optional | — |
| `notes` | text, up to 10,000 characters |  | HL (a); RG (a); PM (a); SA | CLIENT for the client's own guests | Optional | — |

### `room_allocation_occupants`

Created at stage: **Guest operations** · Default editor: HL (a); RG (a); SA · Default visibility: CLIENT for the client's own guests · occupants never exceed the category max_occupancy

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT for the client's own guests | System | — |
| `room_allocation_id` (FK) | references room_allocations |  | HL (a); RG (a); SA | CLIENT for the client's own guests | At creation | — |
| `guest_id` (FK) | references guests |  | HL (a); RG (a); SA | CLIENT for the client's own guests | At creation | — |
| `is_primary_occupant` | exactly one per room |  | HL (a); RG (a); SA | CLIENT for the client's own guests | Optional | — |

### `travel_segments`

Created at stage: **Guest operations** · Default editor: RG (a); HL (a); GU for the own group; SA · Default visibility: CLIENT for the client's own guests

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT for the client's own guests | System | — |
| `project_id` (FK) | references wedding_projects |  | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | At creation | — |
| `guest_id` (FK) | references guests |  | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | At creation | — |
| `family_group_id` (FK) | references family_groups; nullable, set when entered for the whole group |  | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | Optional | — |
| `direction` | one of the listed options | arrival, departure, internal | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | At creation | — |
| `mode` | one of the listed options | flight, train, car, bus, other | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | At creation | — |
| `carrier` | string, up to 255 characters |  | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | Optional | — |
| `reference_number` | string, up to 255 characters |  | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | Optional | — |
| `from_location` | string, up to 255 characters |  | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | Optional | — |
| `to_location` | string, up to 255 characters |  | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | Optional | — |
| `scheduled_at` | timestamp (UTC) |  | RG (a); GU | CLIENT for the client's own guests | At creation | Arrival and departure manifests; transfer planning |
| `actual_at` | timestamp (UTC) |  | HL (a) | CLIENT for the client's own guests | Optional | — |
| `status` | one of the listed options | planned, confirmed, arrived, delayed, cancelled | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | At creation | delayed flags the linked transfer |
| `booked_by` | one of the listed options | guest, client, ampm | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | Optional | — |
| `ticket_document_id` (FK) | references documents |  | GU; RG (a) | CLIENT for the client's own guests | Optional | — |
| `notes` | text, up to 10,000 characters |  | RG (a); HL (a); GU for the own group; SA | CLIENT for the client's own guests | Optional | — |

### `vehicles`

Created at stage: **Pre-production** · Default editor: HL (a); SA · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `project_id` (FK) | references wedding_projects |  | HL (a); SA | INTERNAL | At creation | — |
| `vendor_assignment_id` (FK) | references vendor_assignments; nullable |  | HL (a); SA | INTERNAL | Optional | — |
| `vehicle_type` | string, up to 255 characters |  | HL (a); SA | INTERNAL | At creation | — |
| `registration_number` | vehicle registration format |  | HL (a); SA | INTERNAL | Optional | — |
| `seat_capacity` | integer, 1 or more |  | HL (a); SA | INTERNAL | At creation | Passenger count validated against it |
| `driver_name` | string, up to 255 characters |  | HL (a); SA | INTERNAL | Optional | — |
| `driver_phone` | E.164 format, default +91 |  | HL (a); SA | RESTRICTED-CONTACT | Optional | — |
| `status` | one of the listed options | planned, available, in_service, released | HL (a); SA | INTERNAL | At creation | Transitions per permission-matrix §7; each transition audited; notifications per §8 |

### `transfers`

Created at stage: **Pre-production** · Default editor: HL (a); SA · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `project_id` (FK) | references wedding_projects |  | HL (a); SA | INTERNAL | At creation | — |
| `vehicle_id` (FK) | references vehicles; nullable |  | HL (a); SA | INTERNAL | Optional | — |
| `transfer_type` | one of the listed options | airport_pickup, airport_drop, venue_shuttle, other | HL (a); SA | INTERNAL | At creation | — |
| `pickup_location` | string, up to 255 characters |  | HL (a); SA | INTERNAL | At creation | — |
| `drop_location` | string, up to 255 characters |  | HL (a); SA | INTERNAL | At creation | — |
| `scheduled_at` | timestamp (UTC) |  | HL (a) | INTERNAL | At creation | — |
| `actual_departure_at` | timestamp (UTC) |  | HL (a) on the day | INTERNAL | Optional | — |
| `actual_arrival_at` | timestamp (UTC) |  | HL (a) on the day | INTERNAL | Optional | — |
| `status` | one of the listed options | planned, assigned, en_route, completed, cancelled | HL (a); SA | INTERNAL | At creation | Per §7; changes notify hospitality and RSVP staff (SPEC §8) |
| `coordinator_user_id` (FK) | references users |  | HL (a) | INTERNAL | Optional | — |
| `notes` | text, up to 10,000 characters |  | HL (a); SA | INTERNAL | Optional | — |

### `transfer_passengers`

Created at stage: **Pre-production** · Default editor: HL (a); SA · Default visibility: INTERNAL; the guest sees the own pickup time · passengers never exceed the vehicle seat_capacity

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL; the guest sees the own pickup time | System | — |
| `transfer_id` (FK) | references transfers |  | HL (a); SA | INTERNAL; the guest sees the own pickup time | At creation | — |
| `guest_id` (FK) | references guests |  | HL (a); SA | INTERNAL; the guest sees the own pickup time | At creation | — |
| `travel_segment_id` (FK) | references travel_segments; nullable |  | HL (a); SA | INTERNAL; the guest sees the own pickup time | Optional | — |
| `status` | one of the listed options | assigned, boarded, no_show | HL (a); SA | INTERNAL; the guest sees the own pickup time | At creation | Transitions per permission-matrix §7; each transition audited; notifications per §8 |

### `guest_departures`

Created at stage: **Live / closure** · Default editor: HL (a); RG (a); SA · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `project_id` (FK) | references wedding_projects |  | HL (a); RG (a); SA | INTERNAL | At creation | — |
| `guest_id` (FK) | references guests |  | HL (a); RG (a); SA | INTERNAL | At creation | — |
| `room_allocation_id` (FK) | references room_allocations; nullable |  | HL (a); RG (a); SA | INTERNAL | Optional | — |
| `transfer_id` (FK) | references transfers; nullable |  | HL (a); RG (a); SA | INTERNAL | Optional | — |
| `checked_out_at` | timestamp (UTC) |  | HL (a) | INTERNAL | Optional | Closure checklist departures item |
| `departure_confirmed` | true or false |  | HL (a); RG (a); SA | INTERNAL | At creation | All staying guests confirmed completes the departures item |
| `confirmed_by` (FK) | references users |  | SYS (acting user) | INTERNAL | System | — |
| `notes` | text, up to 10,000 characters |  | HL (a); RG (a); SA | INTERNAL | Optional | — |

### `lost_and_found_items`

Created at stage: **Live** · Default editor: HL (a); PM (a); SA · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `project_id` (FK) | references wedding_projects |  | HL (a); PM (a); SA | INTERNAL | At creation | — |
| `function_id` (FK) | references functions; nullable |  | HL (a); PM (a); SA | INTERNAL | Optional | — |
| `description` | text, up to 10,000 characters |  | HL (a); PM (a); SA | INTERNAL | At creation | — |
| `found_at` | timestamp (UTC) |  | HL (a) | INTERNAL | At creation | — |
| `found_location` | string, up to 255 characters |  | HL (a); PM (a); SA | INTERNAL | At creation | — |
| `found_by_user_id` (FK) | references users |  | SYS (acting user) | INTERNAL | At creation | — |
| `photo_media_id` (FK) | references media_assets |  | HL (a); PM (a); SA | INTERNAL | Optional | — |
| `status` | one of the listed options | logged, claimed, returned, disposed | HL (a); PM (a); SA | INTERNAL | At creation | logged or claimed items block the closure item until returned or disposed |
| `claimed_by_guest_id` (FK) | references guests |  | HL (a); PM (a); SA | INTERNAL | Optional | — |
| `returned_at` | timestamp (UTC) |  | HL (a) | INTERNAL | Before status returned | — |

---

## 13. Module L — Menus and food service

### `menus`

Created at stage: **Planning** · Default editor: PM (a); VC (a); SA · Default visibility: CLIENT when client_visible

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when client_visible | System | — |
| `project_id` (FK) | references wedding_projects |  | PM (a); VC (a); SA | CLIENT when client_visible | At creation | — |
| `function_id` (FK) | references functions |  | PM (a); VC (a); SA | CLIENT when client_visible | At creation | — |
| `title` | string, up to 255 characters |  | PM (a); VC (a); SA | CLIENT | At creation | — |
| `caterer_assignment_id` (FK) | references vendor_assignments; nullable |  | PM (a); VC (a); SA | CLIENT when client_visible | Optional | — |
| `service_style` | one of the listed options | buffet, plated, live_counters, mixed | PM (a); VC (a); SA | CLIENT when client_visible | At creation | — |
| `status` | one of the listed options | draft, shared, approved, final | PM (a); VC (a); SA | CLIENT when client_visible | At creation | approved when the current version is approved; final freezes the guaranteed headcount |
| `client_visible` | true or false |  | PM (a); VC (a); SA | CLIENT when client_visible | Optional | Sharing change audited; switches the client serialiser |

### `menu_versions`

Created at stage: **Planning** · Default editor: PM (a); VC (a); SA · Default visibility: CLIENT when shared

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when shared | System | — |
| `menu_id` (FK) | references menus |  | PM (a); VC (a); SA | CLIENT when shared | At creation | — |
| `version_number` | integer, 1 or more; increments by 1 within its parent; immutable once shared |  | PM (a); VC (a); SA | CLIENT when shared | At creation | A new version supersedes earlier approvals (SPEC §12) |
| `status` | one of the listed options | draft, shared, revision_requested, approved, superseded | PM (a); VC (a); SA | CLIENT when shared | At creation | shared notifies approvers; approved locks the version; superseded on the next version |
| `submitted_by` (FK) | references users |  | SYS (acting user) | CLIENT when shared | At creation | — |
| `submitted_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT when shared | System | — |
| `approval_id` (FK) | references approvals |  | SYS | CLIENT when shared | Optional | — |
| `document_id` (FK) | references see data model |  | PM (a); VC (a); SA | CLIENT when shared | Optional | — |
| `notes` | text, up to 10,000 characters |  | PM (a); VC (a); SA | CLIENT when shared | Optional | — |

### `menu_items`

Created at stage: **Planning** · Default editor: PM (a); VC (a); SA · Default visibility: CLIENT

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `menu_version_id` (FK) | references menu_versions |  | PM (a); VC (a); SA | CLIENT | At creation | — |
| `course` | string, up to 255 characters |  | PM (a); VC (a); SA | CLIENT | At creation | — |
| `name` | string, up to 255 characters |  | PM (a); VC (a); SA | CLIENT | At creation | — |
| `description` | text, up to 10,000 characters |  | PM (a); VC (a); SA | CLIENT | Optional | — |
| `dietary_tags_json` | subset of veg, jain, vegan, gluten_free, contains_nuts |  | PM (a); VC (a); SA | CLIENT | Optional | Headcount categories |
| `is_live_counter` | true or false |  | PM (a); VC (a); SA | CLIENT | Optional | — |
| `sort_order` | integer, 0 or more; unique within its parent |  | PM (a); VC (a); SA | CLIENT | Optional | — |

### `menu_headcounts`

Created at stage: **System** · Default editor: SYS; guaranteed_count by PM (a) · Default visibility: INTERNAL · Assumptions: A-7 (Q7), GP-24

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `menu_version_id` (FK) | references menu_versions |  | SYS; guaranteed_count by PM (a) | INTERNAL | At creation | — |
| `dietary_category` | string, up to 255 characters |  | SYS; guaranteed_count by PM (a) | INTERNAL | At creation | — |
| `expected_count` | integer, 0 or more; from attendance and dietary preference (A-7) |  | SYS | INTERNAL | At creation | Recalculated on attendance or dietary change |
| `guaranteed_count` | integer, 0 or more; the number given to the caterer |  | PM (a) | INTERNAL | Optional | Frozen when sent to the caterer; difference reported |
| `calculated_at` | timestamp (UTC) |  | SYS | INTERNAL | System | — |

---

## 14. Module M — Tasks, staffing and incidents

### `tasks`

Created at stage: **Any** · Default editor: Creator; owner; PM (a); SA · Default visibility: CLIENT when client_visible; INTERNAL otherwise

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT when client_visible; INTERNAL otherwise | System | — |
| `project_id` (FK) | references wedding_projects; nullable, global tasks allowed |  | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | Optional | — |
| `function_id` (FK) | references functions; nullable |  | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | Optional | — |
| `title` | string, up to 255 characters |  | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | At creation | — |
| `description` | text, up to 10,000 characters |  | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | Optional | — |
| `owner_user_id` (FK) | references users |  | Creator; PM (a) | CLIENT when client_visible; INTERNAL otherwise | At creation | Owner notified on assignment |
| `due_at` | timestamp (UTC) |  | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | Optional | Overdue items appear on dashboards (SPEC §8) |
| `priority` | one of the listed options | low, normal, high, urgent | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | At creation | — |
| `status` | one of the listed options | not_started, in_progress, blocked, completed, cancelled | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | At creation | Per §7; blocked requires blocked_reason; overdue on dashboards |
| `is_milestone` | true or false; shown on the client dashboard milestones |  | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | Optional | Shown on the client dashboard |
| `client_visible` | true or false; pending decisions the client must act on |  | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | Optional | Pending decisions list for the client |
| `blocked_reason` | text, up to 10,000 characters |  | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | Before status blocked | — |
| `completed_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT when client_visible; INTERNAL otherwise | System | — |
| `entity_type` | string, up to 255 characters; nullable, related record |  | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | Optional | — |
| `entity_id` | optional link to any record in the same project |  | Creator; owner; PM (a); SA | CLIENT when client_visible; INTERNAL otherwise | Optional | — |
| `checklist_item_id` (FK) | references checklist_items; nullable |  | SYS | CLIENT when client_visible; INTERNAL otherwise | Optional | — |

### `task_dependencies`

Created at stage: **Any** · Default editor: PM (a); SA; task creator · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `task_id` (FK) | references tasks |  | PM (a); SA; task creator | INTERNAL | At creation | — |
| `depends_on_task_id` (FK) | references tasks in the same project; no cycles |  | PM (a); SA; task creator | INTERNAL | At creation | Dependent task cannot start before the prerequisite completes |
| `dependency_type` | string, up to 255 characters; finish_to_start |  | PM (a); SA; task creator | INTERNAL | At creation | — |

### `staff_assignments`

Created at stage: **Pre-production** · Default editor: PM (a); HL (a); SA · Default visibility: INTERNAL · Assumptions: GP-30

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `project_id` (FK) | references wedding_projects |  | PM (a); HL (a); SA | INTERNAL | At creation | — |
| `function_id` (FK) | references functions; nullable |  | PM (a); HL (a); SA | INTERNAL | Optional | — |
| `user_id` (FK) | references see data model |  | PM (a); HL (a); SA | INTERNAL | At creation | — |
| `on_site_role` | string, up to 255 characters; function_lead, hospitality_desk, vendor_liaison, transport, floater |  | PM (a); HL (a); SA | INTERNAL | At creation | — |
| `shift_start` | timestamp (UTC) |  | PM (a); HL (a); SA | INTERNAL | At creation | — |
| `shift_end` | timestamp (UTC); after shift_start; no overlapping shifts for one user |  | PM (a); HL (a); SA | INTERNAL | At creation | — |
| `status` | one of the listed options | planned, confirmed, on_duty, off_duty, cancelled | PM (a); HL (a); SA | INTERNAL | At creation | on_duty set from the live view |
| `notes` | text, up to 10,000 characters |  | PM (a); HL (a); SA | INTERNAL | Optional | — |

### `incidents`

Created at stage: **Live** · Default editor: Reporter; assignee; PM (a); HL (a); SA · Default visibility: RESTRICTED-NOTES; title and status CLIENT when client_visible · Assumptions: SPEC §7 critical rule

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | RESTRICTED-NOTES; title and status CLIENT when client_visible | System | — |
| `project_id` (FK) | references wedding_projects |  | Reporter; assignee; PM (a); HL (a); SA | RESTRICTED-NOTES; title and status CLIENT when client_visible | At creation | — |
| `function_id` (FK) | references functions; nullable |  | Reporter; assignee; PM (a); HL (a); SA | RESTRICTED-NOTES; title and status CLIENT when client_visible | Optional | — |
| `reported_by` (FK) | references users |  | SYS (acting user) | RESTRICTED-NOTES; title and status CLIENT when client_visible | At creation | — |
| `reported_at` | timestamp (UTC) |  | SYS (when the action happens) | RESTRICTED-NOTES; title and status CLIENT when client_visible | At creation | — |
| `title` | string, up to 255 characters |  | Reporter; assignee; PM (a); HL (a); SA | RESTRICTED-NOTES; title and status CLIENT when client_visible | At creation | — |
| `description` | text, up to 10,000 characters |  | Reporter; assignee; PM (a); HL (a); SA | RESTRICTED-NOTES; title and status CLIENT when client_visible | At creation | — |
| `severity` | one of the listed options | low, medium, high, critical | Reporter; assignee; PM (a); HL (a); SA | RESTRICTED-NOTES; title and status CLIENT when client_visible | At creation | critical starts the escalation timer (permission-matrix §8) |
| `category` | string, up to 255 characters; guest, vendor, venue, safety, transport, other |  | Reporter; assignee; PM (a); HL (a); SA | RESTRICTED-NOTES; title and status CLIENT when client_visible | Optional | — |
| `status` | one of the listed options | open, assigned, in_progress, escalated, resolved, closed | Reporter; assignee; PM (a); HL (a); SA | RESTRICTED-NOTES; title and status CLIENT when client_visible | At creation | Per §7; resolved requires resolution_notes when critical |
| `assigned_user_id` (FK) | references users |  | PM (a); HL (a); SA | RESTRICTED-NOTES; title and status CLIENT when client_visible | Optional | Assignee notified |
| `escalated_to_user_id` (FK) | references users |  | SYS per escalation rules; PM (a) | RESTRICTED-NOTES; title and status CLIENT when client_visible | Optional | — |
| `escalated_at` | timestamp (UTC) |  | SYS (when the action happens) | RESTRICTED-NOTES; title and status CLIENT when client_visible | System | — |
| `resolved_at` | timestamp (UTC) |  | SYS (when the action happens) | RESTRICTED-NOTES; title and status CLIENT when client_visible | System | — |
| `resolution_notes` | text, up to 10,000 characters; required before resolved when severity is critical (SPEC section 7) |  | Reporter; assignee; PM (a); HL (a); SA | RESTRICTED-NOTES; title and status CLIENT when client_visible | Before status resolved when severity is critical | — |
| `closed_at` | timestamp (UTC) |  | SYS (when the action happens) | RESTRICTED-NOTES; title and status CLIENT when client_visible | System | — |
| `client_visible` | true or false; default false |  | Reporter; assignee; PM (a); HL (a); SA | RESTRICTED-NOTES; title and status CLIENT when client_visible | Optional | Sharing change audited; switches the client serialiser |

---

## 15. Module N — Documents, media and identity documents

### `documents`

Created at stage: **Any** · Default editor: Uploader; PM (a); SA; sharing per permission-matrix §5.14 · Default visibility: Per the visibility field · Assumptions: A-17 (Q17), A-14 (Q14)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | Per the visibility field | System | — |
| `project_id` (FK) | references wedding_projects; nullable |  | Uploader; PM (a); SA; sharing per permission-matrix §5.14 | Per the visibility field | Optional | — |
| `account_id` (FK) | references client_accounts; nullable |  | Uploader; PM (a); SA; sharing per permission-matrix §5.14 | Per the visibility field | Optional | — |
| `owner_type` | string, up to 255 characters; the record the file belongs to |  | Uploader; PM (a); SA; sharing per permission-matrix §5.14 | Per the visibility field | At creation | — |
| `owner_id` | must exist; access follows the owning record |  | Uploader; PM (a); SA; sharing per permission-matrix §5.14 | Per the visibility field | At creation | — |
| `title` | string, up to 255 characters |  | Uploader; PM (a); SA; sharing per permission-matrix §5.14 | Per the visibility field | At creation | — |
| `document_type` | one of the listed options | proposal, contract, invoice, design, menu, schedule, rooming_list, rider, ticket, consent, other | Uploader; PM (a); SA; sharing per permission-matrix §5.14 | Per the visibility field | At creation | — |
| `storage_key` | string, up to 255 characters; private object storage |  | SYS | SECRET | At creation | — |
| `mime_type` | allowed list per document_type; file scanned on upload |  | Uploader; PM (a); SA; sharing per permission-matrix §5.14 | Per the visibility field | At creation | — |
| `size_bytes` | integer; within the configured limit (25 MB for documents) |  | Uploader; PM (a); SA; sharing per permission-matrix §5.14 | Per the visibility field | At creation | — |
| `checksum` | SHA-256 hex |  | SYS | Per the visibility field | At creation | — |
| `version_number` | integer, 1 or more; increments by 1 within its parent; immutable once shared |  | SYS | Per the visibility field | At creation | A new upload with previous_version_id increments it |
| `previous_version_id` (FK) | references documents |  | Uploader; PM (a); SA; sharing per permission-matrix §5.14 | Per the visibility field | Optional | — |
| `visibility` | one of the listed options | internal, client, guest, public | Uploader; PM (a); SA; sharing per permission-matrix §5.14 | Per the visibility field | At creation | Sharing audited; guest and public need explicit permission |
| `uploaded_by` (FK) | references users |  | SYS (acting user) | Per the visibility field | At creation | — |
| `retention_class` | string, up to 255 characters; A-17 |  | SYS from document_type; SA override | Per the visibility field | At creation | — |
| `retention_until` | timestamp (UTC) |  | SYS | Per the visibility field | Optional | Retention job deletes the file after this date (A-17) |

### `media_assets`

Created at stage: **Any** · Default editor: HT (hotels); VC (vendors); CD (a) (designs); SA; SM (rights, showcase) · Default visibility: Per the visibility field · Assumptions: GP-20 (Q9)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | Per the visibility field | System | — |
| `owner_type` | one of the listed options | hotel, destination, vendor, design_version, invitation_version, project, cms | HT (hotels); VC (vendors); CD (a) (designs); SA; SM (rights, showcase) | Per the visibility field | At creation | — |
| `owner_id` | UUID |  | HT (hotels); VC (vendors); CD (a) (designs); SA; SM (rights, showcase) | Per the visibility field | At creation | — |
| `kind` | one of the listed options | image, video | HT (hotels); VC (vendors); CD (a) (designs); SA; SM (rights, showcase) | Per the visibility field | At creation | — |
| `storage_key` | string, up to 255 characters |  | SYS | SECRET | At creation | — |
| `thumbnail_key` | string, up to 255 characters |  | SYS | SECRET | Optional | Generated by the media worker; video transcoded for controlled delivery |
| `web_key` | string, up to 255 characters; web-size derivative (AC-24.1) |  | SYS | SECRET | Optional | Web-size derivative generated by the media worker with image metadata stripped; the client is served this, never the original (AC-24.1) |
| `mime_type` | detected by content, not extension; allowed list per kind (AC-20.2) |  | SYS | Per the visibility field | At creation | — |
| `size_bytes` | integer; within the configured media limit (AC-20.2) |  | SYS | Per the visibility field | At creation | — |
| `scan_status` | one of the listed options | pending / clean / rejected; only clean is downloadable (AC-20.3, fail-closed) | SYS | Per the visibility field | Optional | Antivirus scan on upload; only clean is downloadable, pending and rejected are quarantined (AC-20.3, fail-closed) |
| `caption` | string, up to 255 characters |  | HT (hotels); VC (vendors); CD (a) (designs); SA; SM (rights, showcase) | Same class as the asset | Optional | — |
| `sort_order` | integer, 0 or more; unique within its parent |  | HT (hotels); VC (vendors); CD (a) (designs); SA; SM (rights, showcase) | Per the visibility field | Optional | — |
| `visibility` | one of the listed options | internal, client, demo, public | HT (hotels); VC (vendors); CD (a) (designs); SA; SM (rights, showcase) | Per the visibility field | At creation | Sharing change audited; switches the serialiser per class |
| `rights_status` | client, demo or public visibility requires owned, licensed or consent_obtained | owned, licensed, consent_required, consent_obtained | HT; VC; SM; SA | Per the visibility field | At creation | Client, demo or public visibility refused unless owned, licensed or consent_obtained |
| `consent_source_project_id` (FK) | references wedding_projects; nullable, the wedding the media came from |  | HT (hotels); VC (vendors); CD (a) (designs); SA; SM (rights, showcase) | Per the visibility field | When rights_status is consent_obtained for wedding media | — |
| `consent_document_id` (FK) | references documents; nullable |  | HT (hotels); VC (vendors); CD (a) (designs); SA; SM (rights, showcase) | Per the visibility field | When rights_status is consent_obtained | — |
| `uploaded_by` (FK) | references users |  | SYS (acting user) | Per the visibility field | At creation | — |
| `upload_started_at` | timestamp (UTC); nullable; upload claim that serialises concurrent uploads (slice 5c) |  | SYS (when the action happens) | Per the visibility field | System | — |

### `identity_documents`

Created at stage: **Guest operations (conditional)** · Default editor: RG (a) with explicit grant; GU for the own document; SA break-glass · Default visibility: INTERNAL · Whole table: **RESTRICTED-IDENTITY** · Assumptions: A-8 (Q8), P-5 (Q8), GP-41

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | RESTRICTED-IDENTITY | System | — |
| `guest_id` (FK) | references guests |  | RG (a) with explicit grant; GU for the own document; SA break-glass | RESTRICTED-IDENTITY | At creation | — |
| `project_id` (FK) | references wedding_projects |  | RG (a) with explicit grant; GU for the own document; SA break-glass | RESTRICTED-IDENTITY | At creation | — |
| `document_type` | passport, voter_id, driving_licence or other; aadhaar is rejected (A-8) | passport, voter_id, driving_licence, other | RG (a) with explicit grant; GU for the own document; SA break-glass | RESTRICTED-IDENTITY | At creation | — |
| `masked_reference` | last 4 characters only; the full number is never stored |  | RG (a) with explicit grant; GU for the own document; SA break-glass | RESTRICTED-IDENTITY | At creation | — |
| `issuing_country` | string, up to 255 characters |  | RG (a) with explicit grant; GU for the own document; SA break-glass | RESTRICTED-IDENTITY | Optional | — |
| `expiry_date` | date; not in the past at collection |  | RG (a) with explicit grant; GU for the own document; SA break-glass | RESTRICTED-IDENTITY | Optional | — |
| `file_document_id` (FK) | references documents; stored in the restricted bucket |  | RG (a) with explicit grant; GU for the own document; SA break-glass | RESTRICTED-IDENTITY | At creation | Restricted bucket; every read audited |
| `purpose` | one of the listed options | hotel_checkin, visa, travel | RG (a) with explicit grant; GU for the own document; SA break-glass | RESTRICTED-IDENTITY | At creation | — |
| `consent_at` | timestamp (UTC) |  | SYS | RESTRICTED-IDENTITY | At creation | — |
| `collected_by` (FK) | references users; nullable, null when uploaded by the guest |  | SYS (acting user) | RESTRICTED-IDENTITY | System | — |
| `retention_until` | timestamp (UTC); nullable; set only when AMPM approves deletion (Q8, Q17) |  | SYS: checkout plus 30 days | RESTRICTED-IDENTITY | System | Deletion job removes the file and nulls the reference |
| `deletion_approved_by` (FK) | references users; nullable; AMPM approval record (Q17) |  | SYS (acting user) | RESTRICTED-IDENTITY | System | — |

### `document_access_links`

Created at stage: **System on share** · Default editor: SYS on share; the creator or SA may revoke · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `document_id` (FK) | references see data model |  | SYS on share; the creator or SA may revoke | INTERNAL | At creation | — |
| `token_hash` | string, up to 255 characters |  | SYS | SECRET | At creation | — |
| `expires_at` | default 15 minutes; never more than 24 hours |  | SYS | INTERNAL | System | Refused after expiry |
| `max_downloads` | integer, 1 or more |  | SYS on share; the creator or SA may revoke | INTERNAL | Optional | — |
| `download_count` | system counter |  | SYS | INTERNAL | Optional | — |
| `created_by` (FK) | references users |  | SYS (acting user) | INTERNAL | At creation | — |
| `revoked_at` | timestamp (UTC) |  | Creator; SA | INTERNAL | System | — |

---

## 16. Module O — Checklists, closure and feedback

### `checklist_templates`

Created at stage: **Configuration** · Default editor: SA · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `template_key` (unique) | lowercase snake_case; unique; function_readiness, project_closure |  | SA | INTERNAL | At creation | — |
| `entity_type` | one of the listed options | function, project | SA | INTERNAL | At creation | — |
| `name` | string, up to 255 characters |  | SA | INTERNAL | At creation | — |
| `items_json` | ordered items with item_key, title and is_required |  | SA | INTERNAL | At creation | — |
| `is_active` | true or false |  | SA | INTERNAL | Optional | — |

### `checklists`

Created at stage: **System on function or project creation** · Default editor: SYS · Default visibility: INTERNAL

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `template_id` (FK) | references checklist_templates |  | SYS | INTERNAL | At creation | — |
| `entity_type` | one of the listed options | function, project | SYS | INTERNAL | At creation | — |
| `entity_id` | UUID |  | SYS | INTERNAL | At creation | — |
| `name` | string, up to 255 characters |  | SYS | INTERNAL | At creation | — |
| `status` | one of the listed options | not_started, in_progress, blocked, complete, complete_with_exception | SYS | INTERNAL | At creation | Derived from the items; drives function readiness and project closure |

### `checklist_items`

Created at stage: **System from template** · Default editor: PM (a); HL (a); VC; FA; SA per item (permission-matrix §5.15) · Default visibility: INTERNAL · Assumptions: P-8 (Q10)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | INTERNAL | System | — |
| `checklist_id` (FK) | references checklists |  | PM (a); HL (a); VC; FA; SA per item (permission-matrix §5.15) | INTERNAL | At creation | — |
| `item_key` | string, up to 255 characters; e.g. departures, lost_and_found, vendor_completion, final_accounts |  | PM (a); HL (a); VC; FA; SA per item (permission-matrix §5.15) | INTERNAL | At creation | — |
| `title` | string, up to 255 characters |  | PM (a); HL (a); VC; FA; SA per item (permission-matrix §5.15) | INTERNAL | At creation | — |
| `is_required` | true or false |  | PM (a); HL (a); VC; FA; SA per item (permission-matrix §5.15) | INTERNAL | At creation | — |
| `status` | one of the listed options | pending, done, not_applicable, exception | PM (a); HL (a); VC; FA; SA per item (permission-matrix §5.15) | INTERNAL | At creation | done or exception on every required item completes the checklist; closure items are verified against data (data-model §17) |
| `completed_by` (FK) | references users |  | SYS (acting user) | INTERNAL | System | — |
| `completed_at` | timestamp (UTC) |  | SYS (when the action happens) | INTERNAL | System | — |
| `exception_reason` | text, up to 10,000 characters |  | PM (a); HL (a); VC; FA; SA per item (permission-matrix §5.15) | INTERNAL | When status is exception | — |
| `exception_authorised_by` (FK) | references users |  | SYS (authorising user holding the exception permission) | INTERNAL | When status is exception | — |
| `evidence_document_id` (FK) | references documents |  | PM (a); HL (a); VC; FA; SA per item (permission-matrix §5.15) | INTERNAL | For closure items where the template demands evidence | — |

### `client_feedback`

Created at stage: **Closure (client)** · Default editor: CO, CA · Default visibility: CLIENT · Assumptions: A-24 (Q24)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `project_id` (FK) | references wedding_projects |  | CO, CA | CLIENT | At creation | — |
| `submitted_by_user_id` (FK) | references users |  | SYS (acting user) | CLIENT | At creation | — |
| `overall_rating` | integer 1 to 5 |  | CO, CA | CLIENT | At creation | — |
| `comments_text` | text, up to 10,000 characters |  | CO, CA | CLIENT | Optional | — |
| `consent_to_publish` | true or false |  | CO, CA | CLIENT | Optional | Allows use in showcase content |
| `submitted_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |

---

## 17. Module P — Public website content (dormant)

### `cms_pages`

Created at stage: **Configuration** · Default editor: SA; SM · Default visibility: PUBLIC when published · Assumptions: A-12 (Q12)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | PUBLIC when published | System | — |
| `slug` (unique) | lowercase letters, digits and hyphens; unique; home, how_it_works, services, about, contact |  | SA; SM | PUBLIC when published | At creation | — |
| `title` | string, up to 255 characters |  | SA; SM | PUBLIC when published | At creation | — |
| `status` | one of the listed options | draft, published | SA; SM | PUBLIC when published | At creation | published renders on the website; audited |
| `sections_json` | valid JSON matching the page template schema |  | SA; SM | PUBLIC when published | At creation | — |
| `seo_title` | up to 60 characters |  | SA; SM | PUBLIC when published | Optional | — |
| `seo_description` | up to 160 characters |  | SA; SM | PUBLIC when published | Optional | — |
| `published_at` | timestamp (UTC) |  | SYS (when the action happens) | PUBLIC when published | System | — |

### `cms_showcase_items`

Created at stage: **Content** · Default editor: SA; SM · Default visibility: PUBLIC when is_published · Assumptions: A-12 (Q12), GP-20

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | PUBLIC when is_published | System | — |
| `title` | string, up to 255 characters |  | SA; SM | PUBLIC when is_published | At creation | — |
| `description` | text, up to 10,000 characters |  | SA; SM | PUBLIC when is_published | Optional | — |
| `media_asset_id` (FK) | references media_assets |  | SA; SM | PUBLIC when is_published | At creation | — |
| `destination_id` (FK) | references destinations; nullable |  | SA; SM | PUBLIC when is_published | Optional | — |
| `hotel_id` (FK) | references hotels; nullable |  | SA; SM | PUBLIC when is_published | Optional | — |
| `source_project_id` (FK) | references wedding_projects; nullable, consent (GP-20) |  | SA; SM | PUBLIC when is_published | Optional | Consent record for wedding media |
| `is_published` | true only when the media rights are owned, licensed or consent_obtained |  | SA; SM | PUBLIC when is_published | At creation | Audited |
| `sort_order` | integer, 0 or more; unique within its parent |  | SA; SM | PUBLIC when is_published | At creation | — |

---

## 18. Module Q — Live chat

### `conversations`

Created at stage: **Any (client or staff opens a chat)** · Default editor: CR opens; SM, PM (a), HT, RG (a), HL (a), SA handle · Default visibility: CLIENT · Assumptions: A-20 changed (Q20)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `account_id` (FK) | references client_accounts |  | CR opens; SM, PM (a), HT, RG (a), HL (a), SA handle | CLIENT | At creation | — |
| `project_id` (FK) | references wedding_projects; nullable, subscriber conversations have no project |  | CR opens; SM, PM (a), HT, RG (a), HL (a), SA handle | CLIENT | Optional | — |
| `subject` | string, up to 255 characters |  | CR opens; SM, PM (a), HT, RG (a), HL (a), SA handle | CLIENT | At creation | — |
| `status` | one of the listed options | open, waiting_on_client, closed | CR opens; SM, PM (a), HT, RG (a), HL (a), SA handle | CLIENT | At creation | open and waiting_on_client surface on the team dashboard; closed after inactivity per configuration |
| `assigned_user_id` (FK) | references users; nullable |  | SA; the handling team | CLIENT | Optional | Assignee notified in real time |
| `last_message_at` | timestamp (UTC) |  | SYS | CLIENT | System | — |
| `closed_at` | timestamp (UTC) |  | SYS (when the action happens) | CLIENT | System | — |

### `messages`

Created at stage: **Any** · Default editor: Sender · Default visibility: CLIENT · Assumptions: A-20 changed (Q20)

| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |
|---|---|---|---|---|---|---|
| `id` (PK) | UUID v7, generated |  | SYS | CLIENT | System | — |
| `conversation_id` (FK) | references see data model |  | Sender | CLIENT | At creation | — |
| `sender_type` | one of the listed options | client, staff, system | Sender | CLIENT | At creation | — |
| `sender_id` | references users or the client representative per sender_type |  | SYS (acting user) | CLIENT | System | — |
| `body` | text, up to 4,000 characters |  | Sender | CLIENT | At creation | — |
| `attachment_document_id` (FK) | references documents; nullable |  | Sender | CLIENT | Optional | — |
| `client_request_id` (FK) | references see data model; nullable; set when a message is turned into a tracked request |  | Staff, when a message is turned into a tracked request | CLIENT | Optional | Creates the request with this message as its description |
| `read_at` | timestamp (UTC) |  | SYS | CLIENT | System | Read receipts per side |

