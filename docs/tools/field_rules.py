"""Field rules for docs/tools/field_matrix_build.py.

One entry per table in docs/data-model.md. Role codes follow permission-matrix.md §2; visibility classes follow
permission-matrix.md §4; assumption ids follow data-model.md §0 (A-n) and permission-matrix.md §0 (P-n), each of
which cites its audit question (Q-n).

T(stage, editor, default_class, required, required_label, assumptions, table_class, note, **field_overrides)
F(editor, required, validation, validation_extra, automation, visibility)
"""


def F(**kw):
    return {k: v for k, v in kw.items() if v is not None}


def T(stage, editor, default_class="INTERNAL", required=(), required_label="At creation", assumptions="",
      table_class=None, note="", **fields):
    return dict(stage=stage, editor=editor, default_class=default_class, required=list(required),
                required_label=required_label, assumptions=assumptions, table_class=table_class, note=note,
                fields=fields)


SYS = "SYS"
TABLES = {}

# ---------------------------------------------------------------- Module A — identity, access, administration
TABLES["users"] = T(
    "Account setup", "SA; SM and PM (a) for client logins", "INTERNAL",
    required=["user_type", "name", "email", "status"], assumptions="A-13 (Q13), P-6 (Q13)",
    user_type=F(validation="one of the listed options; fixed at creation"),
    email=F(validation="valid email address, stored lowercase; unique", automation="Invite or activation email on creation"),
    phone=F(validation="E.164 format, default +91; required when OTP is enabled"),
    status=F(automation="disabled or locked refuses sign-in at once and revokes sessions"),
    mfa_enabled=F(editor="SYS; must be true for staff before first sign-in", required="At creation for staff"),
    last_login_at=F(editor=SYS, automation="Inactive accounts reported for review"),
)
TABLES["roles"] = T("Configuration", "SA", required=["role_key", "name"],
                    is_system=F(automation="System roles cannot be deleted or renamed"))
TABLES["permissions"] = T("Configuration", "SA", required=["permission_key"],
                          permission_key=F(validation="module.resource.action with optional :assigned or :own suffix; unique"))
TABLES["role_permissions"] = T("Configuration", "SA", required=["role_id", "permission_id"], note="unique pair",
                               role_id=F(automation="Change recomputes effective permissions; audited"))
TABLES["user_roles"] = T("Configuration", "SA", required=["user_id", "role_id"], note="unique pair",
                         role_id=F(automation="Change recomputes effective permissions; audited"))
TABLES["project_members"] = T(
    "Project setup", "SA; PM (a); SM for client members", "CLIENT",
    required=["project_id", "user_id", "project_role", "status"], assumptions="A-5 (Q5), P-2 (Q5)",
    note="unique on project_id and user_id",
    project_role=F(automation="Drives project-scoped permissions; change audited"),
    can_view_finance=F(automation="Gates the client finance serialisers (P-2)"),
    can_approve=F(automation="Gates approval decisions and vendor selections"),
    status=F(automation="removed revokes access at once; set by the retention job after client_access_until (A-23)"),
)
TABLES["auth_tokens"] = T(
    "System", SYS, required=["user_id", "purpose", "token_hash", "expires_at"], assumptions="A-13 (Q13)",
    expires_at=F(editor=SYS, validation="invite 7 days; password reset 1 hour; OTP 10 minutes", required="System"),
    used_at=F(automation="Single use; a used token is refused"),
)
TABLES["notifications"] = T(
    "System", SYS, "Recipient only", required=["recipient_type", "recipient_id", "channel", "template_key", "status"],
    assumptions="A-11 (Q11)",
    status=F(editor=SYS, automation="Delivery webhooks update the status; failed sends retry per channel policy"),
    provider_ref=F(validation="provider message identifier"),
)
TABLES["notification_preferences"] = T("User self-service", "Owner user", "Owner only",
                                       required=["user_id", "event_type", "channel", "enabled"])
TABLES["audit_events"] = T(
    "System", "SYS (append-only; never updated or deleted)",
    required=["actor_type", "action", "entity_type", "entity_id", "occurred_at"],
    before_json=F(validation="valid JSON; restricted and secret fields masked before storage"),
    after_json=F(validation="valid JSON; restricted and secret fields masked before storage"),
    project_id=F(validation="references wedding_projects; denormalised", automation="Project-scoped history for PM (a)"),
    occurred_at=F(editor=SYS, required="System"),
)
TABLES["configurations"] = T(
    "Configuration", "SA", required=["config_key", "value_json", "scope"],
    value_json=F(validation="valid JSON matching the schema registered for config_key",
                 automation="Takes effect on the next job run or request; change audited"),
    scope_id=F(validation="references wedding_projects when scope is project"),
)
TABLES["import_jobs"] = T(
    "Any (import)", "SA; HT (hotels); VC (vendors); RG and PM (a) (guests)",
    required=["import_type", "file_document_id", "status"], assumptions="A-9 (Q9), GP-22",
    status=F(automation="validating runs in a worker; applied writes rows plus audit events; failed keeps the error report"),
    row_count=F(editor=SYS), error_report_json=F(editor=SYS),
    project_id=F(validation="references wedding_projects; required when import_type is guests", required="At creation for guest imports"),
)

# ---------------------------------------------------------------- Module B — CRM, subscriptions, commercial
TABLES["lead_sources"] = T("Configuration", "SA", required=["source_key", "name"])
TABLES["leads"] = T(
    "Lead", "SM; SA; SYS from the public enquiry form", required=["source_id", "status", "name"],
    assumptions="A-12 (Q12), GP-39 consent (Q17)",
    email=F(validation="valid email address, stored lowercase", required="At creation (email or phone)"),
    phone=F(validation="E.164 format, default +91", required="At creation (email or phone)"),
    consent_marketing=F(required="At creation from the form", automation="Marketing messages suppressed when false"),
    requested_demo=F(automation="Creates a demo task for the lead owner"),
    owner_user_id=F(editor="SM; SA", required="Before status contacted", automation="Owner receives follow-up reminders"),
    converted_account_id=F(editor=SYS, automation="Set on conversion; the lead becomes read-only"),
    status=F(automation="Lead funnel report (SPEC §9); converted creates the client account"),
    guest_estimate=F(automation="Carried into the account and project"),
    closed_reason=F(required="Before status closed"),
)
TABLES["lead_activities"] = T(
    "Lead", "SM; SA", required=["lead_id", "activity_type", "occurred_at", "user_id"], assumptions="AM-15",
    occurred_at=F(editor="SM; SA", required="At creation"),
    next_follow_up_at=F(editor="SM; SA", automation="Reminder to the lead owner at that time"),
    questionnaire_json=F(required="When activity_type is questionnaire"),
    user_id=F(editor="SYS (acting user)", required="System"),
)
TABLES["client_accounts"] = T(
    "Conversion", "SM; SA; FA (billing fields)", "CLIENT", required=["name", "status"], assumptions="A-28 (AM-8), P-3 (Q4)",
    is_demo=F(editor="SM; SA", visibility="INTERNAL", validation="true or false; fixed at creation",
              automation="Scopes every query for demo users (A-28); demo data reset on schedule"),
    billing_name=F(visibility="RESTRICTED-BANK", editor="FA; SA; CO (own)"),
    billing_address=F(visibility="RESTRICTED-BANK", editor="FA; SA; CO (own)"),
    gstin=F(visibility="RESTRICTED-BANK", editor="FA; SA; CO (own)", validation="15-character GSTIN format"),
    primary_contact_user_id=F(editor="SM; SA", required="Before subscription activation"),
    lead_id=F(editor=SYS),
    status=F(automation="suspended refuses sign-in for every user of the account"),
)
TABLES["account_contacts"] = T(
    "Conversion / project setup", "SM; SA; PM (a); CO", "CLIENT", required=["account_id", "name", "relation"],
    assumptions="A-5 (Q5)",
    is_decision_maker=F(automation="Decision makers are listed on the wedding overview"),
    user_id=F(editor=SYS, validation="references users; set when a login is created for the contact"),
)
TABLES["plans"] = T(
    "Configuration", "SA", "PUBLIC when status is active",
    required=["plan_key", "name", "plan_type", "billing_type", "currency", "status"], assumptions="A-3 (Q3)",
    price_amount=F(validation="numeric(14,2), 0 or more; value set by AMPM, never hard-coded (Q3)", required="Before status active",
                   automation="Shown on the subscription page; charged at purchase"),
    term_days=F(required="Before status active for one_time plans"),
    trial_days=F(automation="Sets trial_ends_at on trial subscriptions"),
    is_demo=F(automation="Demo plans never charge and never grant real data"),
    terms_version=F(required="Before status active"),
    status=F(automation="retired plans stay attached to existing subscriptions"),
)
TABLES["plan_modules"] = T("Configuration", "SA", "PUBLIC", required=["plan_id", "module_key", "access_level"],
                           module_key=F(automation="Resolved into entitlements per request (permission-matrix §3)"))
TABLES["subscriptions"] = T(
    "Subscription", "SM; SA; FA (status); SYS (activation and expiry)", "CLIENT",
    required=["account_id", "plan_id", "status"], assumptions="A-2 (Q2), A-3 (Q3), A-29 (AM-9), GP-1",
    status=F(automation="Activated on payment; expiring and expired by job; entitlements recomputed; records never deleted (GP-1)"),
    starts_at=F(editor="SYS on activation; SA override", required="Before status active"),
    ends_at=F(editor="SYS from the plan term; SA override", required="Before status active",
              automation="Expiry job and notice notifications"),
    trial_ends_at=F(editor="SYS from trial_days", automation="Trial expiry job"),
    auto_renew=F(editor="CO; SM", automation="Recurring billing only (A-3)"),
    activation_source=F(editor=SYS), activated_by_user_id=F(editor="SYS (acting user)"),
    cancel_reason=F(required="Before status cancelled"),
)
TABLES["service_types"] = T("Configuration", "SA", "CLIENT", required=["service_key", "name", "category"])
TABLES["service_agreements"] = T(
    "Engagement", "SM; SA; HT (hotel services); PM (a)", "CLIENT",
    required=["account_id", "service_type_id", "status", "currency"], assumptions="A-4 (Q4), GP-5, GP-27",
    scope_text=F(required="Before status sent"),
    fee_amount=F(validation="numeric(14,2), 0 or more; set by AMPM (Q4)", required="Before status sent",
                 automation="Feeds payment milestones and the client finance summary"),
    fee_structure=F(required="Before status sent"),
    terms_version=F(required="Before status sent"),
    status=F(automation="active grants the service module (permission-matrix §3); completed or cancelled removes it"),
    document_id=F(required="Before status active (signed agreement)"),
    project_id=F(automation="Back-filled when the project is created (GP-27)"),
    hotel_enquiry_id=F(automation="Unblocks paid consultancy work on that enquiry (GP-5)"),
)
TABLES["payment_milestones"] = T(
    "Engagement", "FA; SA", "CLIENT",
    required=["service_agreement_id", "name", "due_date", "amount", "currency", "status"], assumptions="GP-6",
    due_date=F(automation="Unpaid milestones appear on dashboards and notify the client (SPEC §8)"),
    status=F(automation="invoiced when an invoice is issued; paid when its payment succeeds; overdue by job"),
    invoice_id=F(editor=SYS),
)
TABLES["payments"] = T(
    "Subscription / engagement / vendor payment", "FA; SA; SYS (gateway webhooks)",
    "CLIENT when client_visible; RESTRICTED-FINANCE for outbound rows",
    required=["account_id", "direction", "counterparty_type", "purpose", "amount", "currency", "method", "status"],
    assumptions="A-2 (Q2), A-4 (Q4), GP-17",
    direction=F(validation="inbound for client payments, outbound for vendor and hotel payments"),
    amount=F(validation="numeric(14,2), more than 0", automation="Finance reports; refunds reduce the net"),
    provider=F(editor=SYS, required="When method is gateway"),
    provider_ref=F(editor=SYS, validation="gateway transaction id; unique", required="When method is gateway"),
    status=F(automation="succeeded activates only the purchased entitlement (SPEC §8) and marks milestones paid; refunded requires refund_of_payment_id"),
    paid_at=F(editor="SYS from the gateway; FA for manual records", required="Before status succeeded"),
    refund_of_payment_id=F(validation="references payments; must be a succeeded payment; refund total never exceeds it"),
    client_visible=F(automation="true only for inbound client payments (A-4)"),
)

# ---------------------------------------------------------------- Module C — hotel intelligence
TABLES["destinations"] = T(
    "Hotel data entry", "HT; SA", "CLIENT", required=["name", "slug", "country", "status"], assumptions="A-12 (Q12)",
    name=F(visibility="CLIENT; PUBLIC when public_visible"), slug=F(visibility="CLIENT; PUBLIC when public_visible"),
    hero_media_id=F(visibility="CLIENT; PUBLIC when public_visible"),
    public_visible=F(automation="Publishes the destination page on the website; audited"),
)
TABLES["hotels"] = T(
    "Hotel data entry", "HT; SA", "CLIENT", required=["destination_id", "name", "slug", "status"],
    assumptions="A-9 (Q9), A-28 (AM-8), RK-1",
    name=F(visibility="CLIENT; PUBLIC when public_showcase"),
    description_client=F(required="Before status active"),
    latitude=F(validation="decimal between -90 and 90"), longitude=F(validation="decimal between -180 and 180"),
    status=F(automation="inactive hotels leave search results but stay on existing enquiries and projects"),
    demo_visible=F(automation="Scopes demo search (A-28)"),
    public_showcase=F(automation="Exposes name, destination and hero media on the website only"),
    internal_rating=F(validation="integer 1 to 5"),
    last_verified_at=F(editor=SYS, automation="Denormalised by the verification job; drives the freshness label"),
)
TABLES["hotel_contacts"] = T("Hotel data entry", "HT; SA", table_class="RESTRICTED-CONTACT",
                             required=["hotel_id", "name"], assumptions="P-3 contact tier")
TABLES["hotel_room_categories"] = T(
    "Hotel data entry", "HT; SA", "CLIENT", required=["hotel_id", "name", "room_count", "max_occupancy"],
    assumptions="A-27 (AM-5)",
    room_count=F(automation="Upper bound for room blocks at this hotel"),
    max_occupancy=F(validation="integer, 1 or more", automation="Upper bound for occupants per allocation"),
)
TABLES["hotel_venues"] = T(
    "Hotel data entry", "HT; SA", "CLIENT", required=["hotel_id", "name", "venue_type"],
    capacity_banquet=F(automation="Compared with function guest_estimate; mismatch flagged"),
    capacity_theatre=F(automation="Compared with function guest_estimate; mismatch flagged"),
    capacity_reception=F(automation="Compared with function guest_estimate; mismatch flagged"),
)
TABLES["hotel_rate_cards"] = T(
    "Hotel data entry", "HT; SA", "CLIENT", required=["hotel_id", "name", "valid_from", "valid_to", "currency", "status"],
    assumptions="A-9 (Q9), GP-8",
    status=F(automation="verified requires a verification row; stale set by job after the configured age; stale cards are never shown as confirmed (SPEC §12)"),
    verification_id=F(visibility="INTERNAL", required="Before status verified"),
)
TABLES["hotel_rate_items"] = T(
    "Hotel data entry", "HT; SA", "CLIENT when client_visible and the card is verified",
    required=["rate_card_id", "item_type", "amount", "unit"], assumptions="A-9 (Q9), GP-8",
    amount=F(validation="numeric(14,2), 0 or more", automation="Client sees it with the card's freshness label"),
    min_quantity=F(validation="integer, 0 or more; for example minimum plates"),
    client_visible=F(automation="Hidden items are internal references only"),
)
TABLES["hotel_verifications"] = T(
    "Verification", "HT; SA", "INTERNAL",
    required=["hotel_id", "field_group", "verified_at", "verified_by", "source", "status"], assumptions="SPEC §8 stale rule",
    field_group=F(visibility="CLIENT (freshness label)"),
    verified_at=F(editor="SYS when recorded; HT may backdate with a note", visibility="CLIENT (freshness label)", required="At creation"),
    status=F(visibility="CLIENT (freshness label)", automation="stale set by the daily job; shown as a label"),
    next_due_at=F(editor=SYS, required="System"),
)
TABLES["hotel_wedding_references"] = T(
    "Hotel data entry", "HT; SA", "CLIENT when client_visible", required=["hotel_id", "event_year"], assumptions="GP-20 (Q9)",
    client_visible=F(validation="true only when consent_document_id is set", automation="Sharing audited"),
    consent_document_id=F(required="Before client_visible"),
    event_year=F(validation="four-digit year"),
)
TABLES["saved_hotels"] = T(
    "Discovery (client)", "CO, CA, CV (own account); DP (demo); SYS back-fills project_id", "CLIENT",
    required=["account_id", "hotel_id", "saved_by_user_id"], assumptions="GP-10, GP-27", note="unique on account_id and hotel_id",
    project_id=F(automation="Back-filled when a project is created (GP-27)"),
)

# ---------------------------------------------------------------- Module D — hotel consultancy
TABLES["hotel_enquiries"] = T(
    "Discovery (client request)", "CO, CA (client fields at creation); HT; SA; PM (a)", "CLIENT",
    required=["account_id", "hotel_id", "requested_by_user_id", "status", "date_from", "date_to", "guest_estimate"],
    assumptions="A-9 (Q9), GP-5, GP-27",
    assigned_user_id=F(visibility="INTERNAL", editor="HT; SA", required="Before status awaiting_hotel", automation="Assignee notified"),
    service_agreement_id=F(visibility="INTERNAL", automation="Paid work beyond availability checks waits for an active agreement (GP-5)"),
    status=F(automation="Per §7; confirmed requires a confirmed booking milestone and a signed contract; client notified on each change"),
    outcome=F(required="Before status closed", automation="Hotel conversion report"),
    notes_client=F(editor="CO, CA; HT"),
    project_id=F(automation="Back-filled when the project is created (GP-27)"),
    rooms_required=F(automation="Starting point for room blocks"),
)
TABLES["hotel_enquiry_events"] = T(
    "Consultancy", "HT; SA; PM (a); SYS for status changes", "CLIENT unless internal_only",
    required=["enquiry_id", "event_type", "occurred_at", "user_id"], assumptions="SPEC §12 negotiation test",
    internal_only=F(automation="Hidden from the client serialiser; defaults to true for negotiation_note"),
    occurred_at=F(editor="HT; SA", required="At creation"),
    user_id=F(editor="SYS (acting user)", required="System"),
)
TABLES["site_visits"] = T(
    "Consultancy", "HT; SA; PM (a); CO, CA for client_feedback", "CLIENT", required=["enquiry_id", "hotel_id", "scheduled_at", "status"],
    scheduled_at=F(editor="HT; PM (a)", automation="Reminder to attendees; enquiry status visit_scheduled"),
    client_feedback=F(editor="CO, CA"),
)
TABLES["hotel_proposals"] = T(
    "Consultancy", "HT; SA; PM (a)", "CLIENT when shared", required=["enquiry_id", "hotel_id", "version_number", "status", "currency"],
    assumptions="A-4 (Q4), P-3 (Q4)",
    client_total_amount=F(required="Before status shared", automation="Client decision and budget line"),
    internal_total_amount=F(automation="Hotel margin report"),
    valid_until=F(automation="Expired proposals flagged on the enquiry"),
    status=F(automation="shared notifies client approvers; accepted locks the version; a new version supersedes"),
    document_id=F(required="Before status shared"),
    approval_id=F(editor=SYS), supersedes_proposal_id=F(editor=SYS),
)
TABLES["hotel_proposal_lines"] = T(
    "Consultancy", "HT; SA; PM (a)", "CLIENT when client_visible",
    required=["proposal_id", "item_type", "description", "quantity", "unit_amount", "total_amount"],
    quantity=F(validation="numeric, more than 0"), unit_amount=F(validation="numeric(14,2), 0 or more"),
    total_amount=F(validation="quantity multiplied by unit_amount"),
)
TABLES["booking_milestones"] = T(
    "Consultancy / booking", "HT; SA; PM (a); FA for amounts and paid milestones", "CLIENT",
    required=["enquiry_id", "milestone_type", "status"], assumptions="A-4 (Q4) for amounts",
    due_at=F(editor="HT; PM (a)"),
    amount=F(visibility="CLIENT when the client pays the hotel directly; confirm (Q4)"),
    status=F(automation="done on the confirmed milestone enables enquiry status confirmed"),
    contract_id=F(required="Before the confirmed milestone is done"),
)

# ---------------------------------------------------------------- Module E — wedding project
TABLES["wedding_projects"] = T(
    "Project setup", "SA; SM (create); PM (a)", "CLIENT",
    required=["code", "account_id", "name", "status", "date_from", "date_to", "project_lead_user_id", "timezone", "currency"],
    assumptions="A-16 (Q16), A-18 (Q18), A-23 (Q23), A-28 (AM-8), SPEC §5 example rows",
    code=F(editor=SYS, validation="generated AMPM-YYYY-NNN; unique", required="System"),
    date_from=F(validation="date; tentative allowed early (SPEC §5)", automation="Milestones, countdown and function date checks"),
    date_to=F(validation="date; not before date_from", automation="Milestones, countdown and function date checks"),
    dates_tentative=F(automation="Tentative flag on the dashboard; cleared when confirmed"),
    guest_estimate=F(automation="Capacity checks and planning; replaced by confirmed attendance later"),
    timezone=F(validation="IANA time zone name; default Asia/Kolkata"),
    primary_service_agreement_id=F(visibility="INTERNAL"),
    project_lead_user_id=F(editor="SA; SM; PM (a)", required="At creation", automation="Lead receives all project notifications"),
    is_demo=F(visibility="INTERNAL", validation="true or false; fixed at creation"),
    on_hold_reason=F(visibility="INTERNAL", required="Before status on_hold"),
    archived_at=F(editor=SYS, visibility="INTERNAL"),
    client_access_until=F(editor="SYS at closure (closed_at plus the configured window); SA override", required="System",
                          automation="Client memberships removed after this date (A-23)"),
    status=F(automation="closed requires the closure checklist complete and final accounts approved (permission-matrix §7)"),
)
TABLES["project_hotels"] = T("Project setup", "PM (a); HT; SA", "CLIENT", required=["project_id", "hotel_id", "hotel_role"],
                             assumptions="A-18 (Q18)", note="unique on project_id and hotel_id")
TABLES["external_venues"] = T("Planning", "PM (a); SA; HL (a)", "CLIENT", required=["project_id", "name"], assumptions="A-18 (Q18)")

# ---------------------------------------------------------------- Module F — functions, programme, run-of-show
TABLES["function_types"] = T("Configuration", "SA", "CLIENT", required=["type_key", "name"])
TABLES["functions"] = T(
    "Planning", "PM (a); SA; CD (a) for theme and dress code; HL (a) for logistics", "CLIENT",
    required=["project_id", "function_type_id", "name", "function_date", "venue_kind", "status", "readiness_status"],
    assumptions="A-26 (AM-3), AM-2, P-8 (Q10)",
    function_date=F(validation="date within the project range unless dates_tentative", automation="Countdown, programme, attendance invites, capacity checks"),
    end_time=F(validation="time; after start_time"),
    venue_kind=F(validation="hotel_venue requires hotel_venue_id; external_venue requires external_venue_id"),
    guest_estimate=F(automation="Compared with venue capacity; replaced by confirmed attendance"),
    readiness_status=F(editor="SYS from the readiness checklist; live and completed by PM (a)", required="System",
                       automation="ready needs every required item done or excepted (A-26)"),
    readiness_exception_note=F(visibility="INTERNAL", required="When an exception is authorised"),
    readiness_exception_by=F(visibility="INTERNAL", editor="SYS (authorising user)"),
)
TABLES["function_programme_items"] = T(
    "Planning", "PM (a); SA; HL (a)", "CLIENT when client_visible", required=["function_id", "start_time", "title"],
    client_visible=F(validation="true or false; default true", automation="Shared programme for the client and guests"),
    end_time=F(validation="time; after start_time"),
)
TABLES["run_of_show_items"] = T(
    "Pre-production", "PM (a); HL (a); SA; VC (a) for vendor cues", "INTERNAL",
    required=["function_id", "sequence", "planned_start", "cue", "owner_user_id", "status"], assumptions="A-1 (Q1) offline read cache",
    planned_end=F(validation="timestamp (UTC); not before planned_start"),
    owner_user_id=F(editor="PM (a); HL (a)", required="At creation", automation="Owner sees the cue on the live view"),
    actual_start=F(editor="HL (a); PM (a) on the day", automation="Live timeline and post-event report"),
    actual_end=F(editor="HL (a); PM (a) on the day", automation="Live timeline and post-event report"),
    status=F(automation="Live execution view; skipped cues reported"),
)

# ---------------------------------------------------------------- Module G — budget and finance
TABLES["budget_categories"] = T("Configuration", "SA; FA", "CLIENT", required=["category_key", "name"],
                                parent_id=F(validation="references budget_categories; no cycles"))
TABLES["budget_lines"] = T(
    "Planning", "PM (a); FA; SA; VC (a) for vendor lines; HT for hotel lines", "CLIENT when client_visible",
    required=["project_id", "category_id", "title", "currency", "status"], assumptions="A-4 (Q4), P-3 (Q4), A-25 (Q25)",
    estimate_amount=F(required="Before status proposed", automation="Client budget summary; estimate change beyond the threshold sets a material flag (A-25)"),
    approved_amount=F(editor="SYS from the approval that locked it; FA override is audited", required="Before status approved",
                      automation="Locked by approval; later changes go through a change request"),
    actual_amount=F(editor="FA; SA", automation="Client variance = actual minus approved (SPEC §9)"),
    internal_cost_estimate=F(editor="PM (a); VC (a); HT; FA", automation="Internal variance and margin"),
    internal_cost_actual=F(editor="FA; SYS from cost entries", automation="Internal variance and margin"),
    status=F(automation="approved needs an approval row; committed when a contract is signed; invoiced and paid follow invoices and payments"),
    approval_id=F(editor=SYS),
    client_visible=F(automation="Sharing audited; hidden lines are excluded from the client summary"),
)
TABLES["cost_entries"] = T(
    "Execution / closure", "FA; SA; PM (a); VC (a); HT", table_class="RESTRICTED-FINANCE",
    required=["project_id", "budget_line_id", "description", "amount", "currency", "incurred_at"], assumptions="A-4 (Q4)",
    amount=F(automation="Summed into budget_lines.internal_cost_actual and final accounts"),
    incurred_at=F(editor="FA; PM (a); VC (a)", required="At creation"),
)
TABLES["contracts"] = T(
    "Approvals", "FA and SA for client contracts; VC for vendor contracts; HT for hotel contracts; PM (a)",
    "CLIENT when client_visible (client contracts); RESTRICTED-FINANCE for vendor and hotel contracts",
    required=["party_type", "party_id", "title", "amount", "currency", "status"], assumptions="A-4 (Q4), P-3 (Q4)",
    party_id=F(validation="references client_accounts, vendors or hotels per party_type"),
    document_id=F(required="Before status signed"),
    signed_at=F(editor="FA; VC; HT", required="Before status signed"),
    status=F(automation="signed moves linked budget lines to committed and vendor assignments to contracted; audited"),
    client_visible=F(validation="true only when party_type is client", automation="Sharing audited"),
)
TABLES["invoices"] = T(
    "Approvals / closure", "FA; SA; VC (a) and HT for received invoices",
    "CLIENT when direction is issued_to_client; RESTRICTED-FINANCE otherwise",
    required=["account_id", "direction", "counterparty_type", "counterparty_id", "issue_date", "due_date", "subtotal_amount", "total_amount", "currency", "status"],
    assumptions="A-16 (Q16), GP-17, GP-18",
    invoice_number=F(editor=SYS, validation="sequential per financial year; unique; assigned at issue", required="System at issue"),
    counterparty_id=F(validation="references client_accounts, vendors or hotels per counterparty_type"),
    due_date=F(validation="date; not before issue_date", automation="Overdue by job; dashboards and client notice"),
    tax_rate=F(validation="percentage 0 to 100 with 2 decimals"),
    tax_amount=F(editor=SYS, validation="subtotal multiplied by tax_rate"),
    total_amount=F(validation="subtotal plus tax"),
    supplier_gstin=F(validation="15-character GSTIN format", required="When GST invoicing is enabled (Q16)"),
    recipient_gstin=F(validation="15-character GSTIN format"),
    place_of_supply=F(validation="Indian state code", required="When GST invoicing is enabled (Q16)"),
    status=F(automation="issued notifies the client and sets the milestone invoiced; paid from payments; overdue by job"),
    document_id=F(editor=SYS, required="Before status issued (generated PDF)"),
    client_visible=F(validation="true only when direction is issued_to_client"),
)
TABLES["invoice_lines"] = T(
    "Approvals / closure", "FA; SA", "Same class as the invoice", required=["invoice_id", "description", "quantity", "unit_amount", "line_total"],
    hsn_sac_code=F(validation="4 to 8 digits", required="When GST invoicing is enabled (Q16)"),
    quantity=F(validation="numeric, more than 0"), tax_rate=F(validation="percentage 0 to 100"),
    line_total=F(validation="quantity multiplied by unit_amount plus tax"),
)
TABLES["project_final_accounts"] = T(
    "Closure", "FA; SA; PM (a) compiles", "INTERNAL", required=["project_id", "status"], assumptions="A-4 (Q4), P-3 (Q4)",
    note="one row per project",
    total_client_billed=F(editor=SYS, visibility="CLIENT (closing statement)", automation="Sum of issued client invoices"),
    total_client_paid=F(editor=SYS, visibility="CLIENT (closing statement)", automation="Sum of succeeded inbound payments"),
    total_vendor_cost=F(editor=SYS, automation="Sum of vendor cost entries"),
    total_hotel_cost=F(editor=SYS, automation="Sum of hotel cost entries"),
    margin_amount=F(editor=SYS, validation="billed minus vendor and hotel cost", automation="Margin report (FA, SA only)"),
    status=F(automation="approved is required before the project can close (permission-matrix §7)"),
)

# ---------------------------------------------------------------- Module H — vendors, artists, production
TABLES["vendor_categories"] = T("Configuration", "SA; VC", "CLIENT", required=["category_key", "name"],
                                parent_id=F(validation="references vendor_categories; no cycles"))
TABLES["vendors"] = T(
    "Vendor onboarding", "VC; SA", "CLIENT", required=["name", "primary_category_id", "status"],
    assumptions="A-22 (Q22), P-11 (Q22), P-3 contact tier",
    description_client=F(required="Before the vendor is presented to a client"),
    status=F(visibility="INTERNAL", automation="blacklisted and inactive vendors cannot be assigned"),
    internal_rating=F(validation="integer 1 to 5"),
    gstin=F(visibility="INTERNAL", validation="15-character GSTIN format"),
    onboarded_at=F(editor="VC", visibility="INTERNAL"),
    website=F(validation="valid URL"), instagram_handle=F(validation="handle without the at sign"),
)
TABLES["vendor_category_links"] = T("Vendor onboarding", "VC; SA", "CLIENT", required=["vendor_id", "category_id"], note="unique pair")
TABLES["vendor_availability"] = T(
    "Vendor onboarding / planning", "VC; SA", "INTERNAL", required=["vendor_id", "date_from", "date_to", "status"], assumptions="GP-21",
    verified_at=F(editor="VC", automation="Stale after the configured age (BIZ rule 6)"),
    status=F(automation="booked windows warn when the vendor is assigned to an overlapping function"),
)
TABLES["vendor_assignments"] = T(
    "Planning (presenting options)", "VC; PM (a); SA; client decision by CO, CA", "CLIENT once presented_at is set",
    required=["project_id", "vendor_id", "category_id", "status", "client_decision"], assumptions="A-4 (Q4), SPEC §5 vendor decision",
    scope_text=F(required="Before presented"),
    status=F(automation="Per §7; selected links the vendor to the project; completed needs every deliverable accepted"),
    client_decision=F(editor="CO, CA; VC or PM (a) recording the decision", automation="selected moves status to selected; declined closes the option"),
    presented_at=F(editor="SYS when the option is shared", automation="Makes the option client-visible"),
    contract_id=F(editor=SYS, visibility="INTERNAL"),
    completion_confirmed_at=F(editor=SYS, visibility="INTERNAL", automation="Closure checklist vendor completion item"),
)
TABLES["vendor_quotes"] = T(
    "Planning", "VC; SA", table_class="RESTRICTED-FINANCE",
    required=["vendor_id", "project_id", "version_number", "amount", "currency", "received_at", "status"], assumptions="A-4 (Q4), P-3 (Q4)",
    received_at=F(editor="VC", required="At creation"),
    valid_until=F(automation="Expired quotes flagged"),
)
TABLES["vendor_proposals"] = T(
    "Planning", "VC; PM (a); SA", "CLIENT when shared", required=["vendor_assignment_id", "version_number", "title", "currency", "status"],
    assumptions="A-4 (Q4), P-3 (Q4)",
    client_visible_amount=F(required="Before status shared", automation="Client budget and approval"),
    internal_cost=F(required="Before status shared (margin check)", automation="Margin report"),
    status=F(automation="shared notifies approvers; accepted locks the version and creates or updates the budget line; superseded on a new version"),
    document_id=F(required="Before status shared"),
    approval_id=F(editor=SYS), supersedes_proposal_id=F(editor=SYS),
)
TABLES["vendor_deliverables"] = T(
    "Approvals", "VC; PM (a); SA; HL (a) marks delivered", "INTERNAL", required=["vendor_assignment_id", "title", "status"],
    due_at=F(editor="VC; PM (a)"),
    status=F(automation="accepted by PM (a); when all are accepted, completion_confirmed_at is set on the assignment"),
)
TABLES["artist_bookings"] = T(
    "Pre-production", "VC; PM (a); SA", "INTERNAL", required=["vendor_assignment_id", "function_id", "artist_name", "status"],
    assumptions="A-4 (Q4) for the fee",
    artist_name=F(visibility="CLIENT"), performance_type=F(visibility="CLIENT"),
    slot_start=F(visibility="CLIENT", editor="VC; PM (a)", automation="Run-of-show cue created"),
    slot_end=F(visibility="CLIENT", editor="VC; PM (a)", validation="timestamp (UTC); after slot_start; within the function"),
    technical_rider_document_id=F(automation="Production readiness item"),
)
TABLES["production_items"] = T(
    "Pre-production", "VC; HL (a); PM (a); SA", "INTERNAL",
    required=["function_id", "category", "description", "quantity", "status", "owner_user_id"],
    quantity=F(validation="integer, 1 or more"),
    owner_user_id=F(editor="PM (a); HL (a)", required="At creation"),
    status=F(automation="tested feeds the readiness checklist; struck recorded at closure"),
    checklist_item_id=F(automation="Links the item to a readiness check"),
)

# ---------------------------------------------------------------- Module I — creative, approvals, client requests
TABLES["design_items"] = T(
    "Planning", "CD (a); PM (a); SA", "CLIENT when client_visible", required=["project_id", "category", "title", "status", "owner_user_id"],
    brief_text=F(visibility="INTERNAL"),
    owner_user_id=F(editor="PM (a); CD (a)", required="At creation"),
    status=F(automation="approved when the current version is approved"),
)
TABLES["design_versions"] = T(
    "Planning", "CD (a); PM (a); SA", "CLIENT when shared", required=["design_item_id", "version_number", "status"], assumptions="SPEC §12 version lock",
    status=F(automation="shared notifies approvers; approved locks the files; immutable once shared; superseded by the next version"),
    approval_id=F(editor=SYS),
)
TABLES["comments"] = T(
    "Any", "Author; SA may delete", "CLIENT unless is_internal", required=["entity_type", "entity_id", "author_user_id", "body"],
    is_internal=F(editor="Author at creation; cannot be changed later", automation="Internal comments never reach client serialisers"),
    annotation_json=F(validation="x and y between 0 and 1 of the image"),
    parent_comment_id=F(validation="references comments on the same entity"),
    entity_id=F(validation="must exist and be reachable by the author"),
)
TABLES["client_requests"] = T(
    "Any (client)", "CO, CA, CV create; assigned staff respond; PM (a) and SA decide", "CLIENT",
    required=["project_id", "account_id", "request_type", "requested_by_user_id", "title", "description", "status"],
    assumptions="A-20 (Q20), A-21 (Q21), A-25 (Q25)",
    status=F(automation="Per §7; submitted notifies the project lead; accepted material changes raise impact flags (SPEC §8)"),
    is_material=F(editor=SYS, automation="Set from configurable thresholds (A-25)"),
    budget_impact_amount=F(editor="PM (a); FA"),
    impact_flags_json=F(editor=SYS, automation="Creates review tasks on budgets, contracts, tasks and run-of-show items"),
    assigned_user_id=F(editor="PM (a); SA", automation="Assignee notified"),
    response_text=F(editor="Assigned staff", required="Before status answered, accepted or rejected"),
    entity_id=F(validation="must be reachable by the requester"),
)
TABLES["approvals"] = T(
    "Approvals", "Requester per permission-matrix §5.9; SYS supersedes", "CLIENT",
    required=["project_id", "record_type", "record_id", "version_number", "requested_by_user_id", "required_decisions", "status"],
    assumptions="A-5 (Q5), AM-7, SPEC §12 version lock",
    version_number=F(validation="integer; must equal the record's version at submission", automation="Locks that exact version"),
    required_decisions=F(validation="integer, 1 or more; default 1; configurable per record_type", automation="Approval completes when approved decisions reach it"),
    status=F(automation="approved at the required count; one rejection or revision request moves it at once; superseded when a new version is created; requester notified"),
    superseded_by_approval_id=F(editor=SYS),
)
TABLES["approval_decisions"] = T(
    "Approvals", "CO, CA with can_approve; PM (a) and SA on behalf with evidence", "CLIENT",
    required=["approval_id", "approver_user_id", "decision", "decided_at"], assumptions="P-9 (Q5)",
    comment=F(required="When decision is revision_requested or rejected"),
    recorded_on_behalf_by=F(editor="SYS (acting staff user)", automation="Audit shows the decision was recorded by staff"),
    evidence_document_id=F(required="When recorded on behalf"),
)

# ---------------------------------------------------------------- Module J — invitations, guests, RSVP
TABLES["invitations"] = T(
    "Planning", "CD (a); PM (a); RG (a); SA", "CLIENT", required=["project_id", "invitation_type", "title", "status"], assumptions="AM-12",
    channels_json=F(validation="subset of email, whatsapp, sms, print"),
    scheduled_at=F(editor="RG (a)", automation="Send job at the scheduled time"),
    status=F(automation="approved requires an approved version; sending creates recipients and tokens"),
)
TABLES["invitation_versions"] = T(
    "Planning", "CD (a); PM (a); SA", "CLIENT when shared", required=["invitation_id", "version_number", "status"],
    content_media_id=F(required="Before status approved"),
    approval_id=F(editor=SYS),
)
TABLES["invitation_recipients"] = T(
    "Guest operations", "RG (a); SA; SYS for delivery status", "INTERNAL",
    required=["invitation_id", "invitation_version_id", "family_group_id", "channel", "status"], assumptions="A-7 (Q7), A-11 (Q11)",
    status=F(editor=SYS, automation="Delivery webhooks; failed and bounced create follow-up tasks for RG"),
    rsvp_token_id=F(editor=SYS, automation="Token issued when the invitation is sent"),
    provider_ref=F(editor=SYS),
)
TABLES["family_groups"] = T(
    "Guest operations", "RG (a); PM (a); CO; SA; import", "CLIENT", required=["project_id", "name", "side", "source"],
    assumptions="A-7 (Q7), GP-13",
    max_additional_guests=F(editor="RG (a); CO", validation="integer, 0 or more; default 0", automation="Caps self-added members through the RSVP portal"),
    primary_guest_id=F(editor="SYS (first guest); RG (a)"),
    tier=F(validation="one of the configured tiers"),
    invited_by_contact_id=F(automation="Shown on the client guest list"),
    source=F(editor=SYS),
)
TABLES["guests"] = T(
    "Guest operations", "RG (a); PM (a); CO; GU for the own row; SA; import", "CLIENT",
    required=["project_id", "family_group_id", "first_name", "age_band", "status", "source"],
    assumptions="A-7 (Q7), A-17 (Q17), GP-24, GP-25",
    email=F(validation="valid email address", required="At least one contact for the group primary"),
    phone=F(validation="E.164 format, default +91", required="At least one contact for the group primary"),
    whatsapp_number=F(validation="E.164 format, default +91"),
    dietary_preference=F(editor="RG (a); CO; GU for the own row", automation="Feeds menu headcounts"),
    allergies_text=F(editor="RG (a); CO; GU for the own row", automation="Hospitality dietary request; never exported"),
    accessibility_needs=F(editor="RG (a); CO; GU for the own row", automation="Hospitality support request; never exported"),
    status=F(automation="removed keeps the row for audit and sets attendance to not_attending"),
    source=F(editor=SYS, validation="self_added only through a token within the group allowance"),
    is_group_primary=F(validation="exactly one per family group"),
    age_band=F(automation="Child and infant counts for menus and rooming"),
)
TABLES["guest_function_attendance"] = T(
    "Guest operations (on invite)", "RG (a); PM (a); GU for the own group; CO; SYS for imports", "CLIENT",
    required=["guest_id", "function_id", "is_invited", "status"], assumptions="A-7 (Q7), GP-13", note="unique on guest_id and function_id",
    status=F(automation="Recalculates function totals and menu headcounts; flags room allocations and transfers for the guest (SPEC §8)"),
    is_invited=F(automation="Only invited functions appear in the RSVP portal"),
    response_source=F(editor=SYS, required="System"),
)
TABLES["rsvp_tokens"] = T(
    "Guest operations (on send)", "RG (a); PM (a); SA; SYS", "INTERNAL",
    required=["project_id", "family_group_id", "token_hash", "expires_at", "status"], assumptions="A-7 (Q7), P-4 (Q7)",
    expires_at=F(editor="RG (a); default the first function date", required="At creation", automation="Link refused after expiry"),
    status=F(automation="revoked refuses the link immediately; a new token is issued"),
    last_accessed_at=F(editor=SYS), access_count=F(editor=SYS, validation="system counter"),
)
TABLES["rsvp_responses"] = T(
    "RSVP", "SYS for self-service; RG (a) for assisted responses", "INTERNAL",
    required=["project_id", "family_group_id", "channel", "submitted_at", "payload_json"], assumptions="A-7 (Q7), SPEC §12 duplicate test",
    payload_json=F(editor=SYS, validation="valid JSON; immutable after insert", automation="Audit of what was submitted"),
    submitted_at=F(editor=SYS, required="System"),
    ip_address=F(editor=SYS, validation="IPv4 or IPv6"),
)
TABLES["guest_support_requests"] = T(
    "RSVP / live", "GU creates; RG (a); HL (a); PM (a); SA", "INTERNAL; SENSITIVE-GUEST for dietary, accessibility and complaint types",
    required=["project_id", "guest_id", "family_group_id", "request_type", "description", "status"],
    status=F(automation="assigned notifies the assignee; open requests on the hospitality dashboard"),
    resolution_text=F(required="Before status resolved"),
    assigned_user_id=F(editor="RG (a); HL (a); PM (a)"),
)

# ---------------------------------------------------------------- Module K — rooms, travel, transport
TABLES["room_blocks"] = T(
    "Planning", "HT; PM (a); SA", "CLIENT",
    required=["project_id", "hotel_id", "room_category_id", "date_from", "date_to", "rooms_blocked", "currency", "status"],
    assumptions="A-19 (Q19), GP-11, A-4 (Q4)",
    rooms_blocked=F(validation="integer, 1 or more; not more than the category room_count"),
    rooms_released=F(validation="integer, 0 or more; not more than rooms_blocked", automation="Allocations validated against blocked minus released"),
    release_deadline=F(automation="Reminder to HT and PM (a) before the deadline"),
    contract_id=F(visibility="INTERNAL"),
)
TABLES["room_allocations"] = T(
    "Guest operations", "HL (a); RG (a); PM (a); SA", "CLIENT for the client's own guests",
    required=["project_id", "hotel_id", "room_category_id", "check_in_date", "check_out_date", "status", "allocated_by"],
    assumptions="A-19 (Q19)",
    check_out_date=F(validation="date; after check_in_date"),
    room_block_id=F(validation="references room_blocks; dates within the block; count within availability"),
    room_number=F(editor="HL (a) at check-in"),
    status=F(automation="Per §7; every change audited (SPEC §7); confirmed notifies hospitality; checked_out feeds departures"),
)
TABLES["room_allocation_occupants"] = T(
    "Guest operations", "HL (a); RG (a); SA", "CLIENT for the client's own guests", required=["room_allocation_id", "guest_id"],
    note="occupants never exceed the category max_occupancy",
    is_primary_occupant=F(validation="exactly one per room"),
)
TABLES["travel_segments"] = T(
    "Guest operations", "RG (a); HL (a); GU for the own group; SA", "CLIENT for the client's own guests",
    required=["project_id", "guest_id", "direction", "mode", "scheduled_at", "status"],
    scheduled_at=F(editor="RG (a); GU", required="At creation", automation="Arrival and departure manifests; transfer planning"),
    actual_at=F(editor="HL (a)"),
    status=F(automation="delayed flags the linked transfer"),
    ticket_document_id=F(editor="GU; RG (a)"),
)
TABLES["vehicles"] = T(
    "Pre-production", "HL (a); SA", "INTERNAL", required=["project_id", "vehicle_type", "seat_capacity", "status"],
    seat_capacity=F(validation="integer, 1 or more", automation="Passenger count validated against it"),
    driver_phone=F(visibility="RESTRICTED-CONTACT"),
    registration_number=F(validation="vehicle registration format"),
)
TABLES["transfers"] = T(
    "Pre-production", "HL (a); SA", "INTERNAL", required=["project_id", "transfer_type", "pickup_location", "drop_location", "scheduled_at", "status"],
    scheduled_at=F(editor="HL (a)", required="At creation"),
    actual_departure_at=F(editor="HL (a) on the day"), actual_arrival_at=F(editor="HL (a) on the day"),
    status=F(automation="Per §7; changes notify hospitality and RSVP staff (SPEC §8)"),
    coordinator_user_id=F(editor="HL (a)"),
)
TABLES["transfer_passengers"] = T(
    "Pre-production", "HL (a); SA", "INTERNAL; the guest sees the own pickup time", required=["transfer_id", "guest_id", "status"],
    note="passengers never exceed the vehicle seat_capacity",
)
TABLES["guest_departures"] = T(
    "Live / closure", "HL (a); RG (a); SA", "INTERNAL", required=["project_id", "guest_id", "departure_confirmed"],
    checked_out_at=F(editor="HL (a)", automation="Closure checklist departures item"),
    departure_confirmed=F(automation="All staying guests confirmed completes the departures item"),
)
TABLES["lost_and_found_items"] = T(
    "Live", "HL (a); PM (a); SA", "INTERNAL", required=["project_id", "description", "found_at", "found_location", "found_by_user_id", "status"],
    found_at=F(editor="HL (a)", required="At creation"),
    status=F(automation="logged or claimed items block the closure item until returned or disposed"),
    returned_at=F(editor="HL (a)", required="Before status returned"),
)

# ---------------------------------------------------------------- Module L — menus
TABLES["menus"] = T(
    "Planning", "PM (a); VC (a); SA", "CLIENT when client_visible", required=["project_id", "function_id", "title", "service_style", "status"],
    status=F(automation="approved when the current version is approved; final freezes the guaranteed headcount"),
)
TABLES["menu_versions"] = T(
    "Planning", "PM (a); VC (a); SA", "CLIENT when shared", required=["menu_id", "version_number", "status", "submitted_by"],
    status=F(automation="shared notifies approvers; approved locks the version; superseded on the next version"),
    approval_id=F(editor=SYS),
)
TABLES["menu_items"] = T(
    "Planning", "PM (a); VC (a); SA", "CLIENT", required=["menu_version_id", "course", "name"],
    dietary_tags_json=F(validation="subset of veg, jain, vegan, gluten_free, contains_nuts", automation="Headcount categories"),
)
TABLES["menu_headcounts"] = T(
    "System", "SYS; guaranteed_count by PM (a)", "INTERNAL", required=["menu_version_id", "dietary_category", "expected_count", "calculated_at"],
    assumptions="A-7 (Q7), GP-24",
    expected_count=F(editor=SYS, automation="Recalculated on attendance or dietary change"),
    guaranteed_count=F(editor="PM (a)", automation="Frozen when sent to the caterer; difference reported"),
    calculated_at=F(editor=SYS, required="System"),
)

# ---------------------------------------------------------------- Module M — tasks, staffing, incidents
TABLES["tasks"] = T(
    "Any", "Creator; owner; PM (a); SA", "CLIENT when client_visible; INTERNAL otherwise", required=["title", "owner_user_id", "status", "priority"],
    owner_user_id=F(editor="Creator; PM (a)", required="At creation", automation="Owner notified on assignment"),
    status=F(automation="Per §7; blocked requires blocked_reason; overdue on dashboards"),
    is_milestone=F(automation="Shown on the client dashboard"),
    client_visible=F(automation="Pending decisions list for the client"),
    blocked_reason=F(required="Before status blocked"),
    entity_id=F(validation="optional link to any record in the same project"),
    checklist_item_id=F(editor=SYS),
)
TABLES["task_dependencies"] = T(
    "Any", "PM (a); SA; task creator", "INTERNAL", required=["task_id", "depends_on_task_id", "dependency_type"],
    depends_on_task_id=F(validation="references tasks in the same project; no cycles", automation="Dependent task cannot start before the prerequisite completes"),
)
TABLES["staff_assignments"] = T(
    "Pre-production", "PM (a); HL (a); SA", "INTERNAL", required=["project_id", "user_id", "on_site_role", "shift_start", "shift_end", "status"],
    assumptions="GP-30",
    shift_end=F(validation="timestamp (UTC); after shift_start; no overlapping shifts for one user"),
    status=F(automation="on_duty set from the live view"),
)
TABLES["incidents"] = T(
    "Live", "Reporter; assignee; PM (a); HL (a); SA", "RESTRICTED-NOTES; title and status CLIENT when client_visible",
    required=["project_id", "reported_by", "reported_at", "title", "description", "severity", "status"], assumptions="SPEC §7 critical rule",
    severity=F(automation="critical starts the escalation timer (permission-matrix §8)"),
    status=F(automation="Per §7; resolved requires resolution_notes when critical"),
    assigned_user_id=F(editor="PM (a); HL (a); SA", automation="Assignee notified"),
    escalated_to_user_id=F(editor="SYS per escalation rules; PM (a)"),
    resolution_notes=F(required="Before status resolved when severity is critical"),
    client_visible=F(validation="true or false; default false"),
)

# ---------------------------------------------------------------- Module N — documents, media, identity
TABLES["documents"] = T(
    "Any", "Uploader; PM (a); SA; sharing per permission-matrix §5.14", "Per the visibility field",
    required=["owner_type", "owner_id", "title", "document_type", "storage_key", "mime_type", "size_bytes", "checksum", "version_number", "visibility", "uploaded_by", "retention_class"],
    assumptions="A-17 (Q17), A-14 (Q14)",
    owner_id=F(validation="must exist; access follows the owning record"),
    mime_type=F(validation="allowed list per document_type; file scanned on upload"),
    size_bytes=F(validation="integer; within the configured limit (25 MB for documents)"),
    checksum=F(editor=SYS, validation="SHA-256 hex"),
    version_number=F(editor=SYS, automation="A new upload with previous_version_id increments it"),
    visibility=F(automation="Sharing audited; guest and public need explicit permission"),
    retention_class=F(editor="SYS from document_type; SA override"),
    retention_until=F(editor=SYS, automation="Retention job deletes the file after this date (A-17)"),
)
TABLES["media_assets"] = T(
    "Any", "HT (hotels); VC (vendors); CD (a) (designs); SA; SM (rights, showcase)", "Per the visibility field",
    required=["owner_type", "owner_id", "kind", "storage_key", "visibility", "rights_status", "uploaded_by"], assumptions="GP-20 (Q9)",
    thumbnail_key=F(editor=SYS, automation="Generated by the media worker; video transcoded for controlled delivery"),
    rights_status=F(editor="HT; VC; SM; SA", validation="client, demo or public visibility requires owned, licensed or consent_obtained"),
    consent_source_project_id=F(required="When rights_status is consent_obtained for wedding media"),
    consent_document_id=F(required="When rights_status is consent_obtained"),
    caption=F(visibility="Same class as the asset"),
)
TABLES["identity_documents"] = T(
    "Guest operations (conditional)", "RG (a) with explicit grant; GU for the own document; SA break-glass", table_class="RESTRICTED-IDENTITY",
    required=["guest_id", "project_id", "document_type", "masked_reference", "file_document_id", "purpose", "consent_at", "retention_until"],
    assumptions="A-8 (Q8), P-5 (Q8), GP-41",
    document_type=F(validation="passport, voter_id, driving_licence or other; aadhaar is rejected (A-8)"),
    masked_reference=F(validation="last 4 characters only; the full number is never stored"),
    file_document_id=F(automation="Restricted bucket; every read audited"),
    consent_at=F(editor=SYS, required="At creation"),
    retention_until=F(editor="SYS: checkout plus 30 days", required="System", automation="Deletion job removes the file and nulls the reference"),
    expiry_date=F(validation="date; not in the past at collection"),
)
TABLES["document_access_links"] = T(
    "System on share", "SYS on share; the creator or SA may revoke", "INTERNAL",
    required=["document_id", "token_hash", "expires_at", "created_by"],
    expires_at=F(editor=SYS, validation="default 15 minutes; never more than 24 hours", required="System"),
    max_downloads=F(validation="integer, 1 or more"), download_count=F(editor=SYS, validation="system counter"),
    revoked_at=F(editor="Creator; SA"),
)

# ---------------------------------------------------------------- Module O — checklists, closure, feedback
TABLES["checklist_templates"] = T(
    "Configuration", "SA", "INTERNAL", required=["template_key", "entity_type", "name", "items_json"],
    items_json=F(validation="ordered items with item_key, title and is_required"),
)
TABLES["checklists"] = T(
    "System on function or project creation", SYS, "INTERNAL", required=["template_id", "entity_type", "entity_id", "name", "status"],
    status=F(editor=SYS, automation="Derived from the items; drives function readiness and project closure"),
)
TABLES["checklist_items"] = T(
    "System from template", "PM (a); HL (a); VC; FA; SA per item (permission-matrix §5.15)", "INTERNAL",
    required=["checklist_id", "item_key", "title", "is_required", "status"], assumptions="P-8 (Q10)",
    status=F(automation="done or exception on every required item completes the checklist; closure items are verified against data (data-model §17)"),
    exception_reason=F(required="When status is exception"),
    exception_authorised_by=F(editor="SYS (authorising user holding the exception permission)", required="When status is exception"),
    evidence_document_id=F(required="For closure items where the template demands evidence"),
)
TABLES["client_feedback"] = T(
    "Closure (client)", "CO, CA", "CLIENT", required=["project_id", "submitted_by_user_id", "overall_rating"], assumptions="A-24 (Q24)",
    overall_rating=F(validation="integer 1 to 5"),
    consent_to_publish=F(automation="Allows use in showcase content"),
)

# ---------------------------------------------------------------- Module P — public website content
TABLES["cms_pages"] = T(
    "Configuration", "SA; SM", "PUBLIC when published", required=["slug", "title", "status", "sections_json"], assumptions="A-12 (Q12)",
    sections_json=F(validation="valid JSON matching the page template schema"),
    status=F(automation="published renders on the website; audited"),
    seo_title=F(validation="up to 60 characters"), seo_description=F(validation="up to 160 characters"),
)
TABLES["cms_showcase_items"] = T(
    "Content", "SA; SM", "PUBLIC when is_published", required=["title", "media_asset_id", "is_published", "sort_order"],
    assumptions="A-12 (Q12), GP-20",
    is_published=F(validation="true only when the media rights are owned, licensed or consent_obtained", automation="Audited"),
    source_project_id=F(automation="Consent record for wedding media"),
)

# ---------------------------------------------------------------- Module Q — live chat (added 25 Oct 2026, Q20)
TABLES["conversations"] = T(
    "Any (client or staff opens a chat)", "CR opens; SM, PM (a), HT, RG (a), HL (a), SA handle", "CLIENT",
    required=["account_id", "subject", "status"], assumptions="A-20 changed (Q20)",
    status=F(automation="open and waiting_on_client surface on the team dashboard; closed after inactivity per configuration"),
    assigned_user_id=F(editor="SA; the handling team", automation="Assignee notified in real time"),
    last_message_at=F(editor=SYS, required="System"),
)
TABLES["messages"] = T(
    "Any", "Sender", "CLIENT", required=["conversation_id", "sender_type", "sender_id", "body"], assumptions="A-20 changed (Q20)",
    sender_id=F(validation="references users or the client representative per sender_type", editor="SYS (acting user)", required="System"),
    body=F(validation="text, up to 4,000 characters"),
    client_request_id=F(editor="Staff, when a message is turned into a tracked request", automation="Creates the request with this message as its description"),
    read_at=F(editor=SYS, automation="Read receipts per side"),
)
