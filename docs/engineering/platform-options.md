# AMPM Platform — Data Platform and Identity: Options and Prices

**For:** the developer, who decides · **Date:** 26 October 2026 · **Status:** analysis for a decision (R13 and the identity service). Prices are list prices found on 26 October 2026, mostly from secondary sources; the few marked "verify" need a look at the provider's own page before an account is opened. ₹84 to the US dollar.

## 1. Why Supabase is in the picture at all

Nothing in AMPM's documents names Supabase. The architecture draft (T-2, T-13, §3) chose AWS in Mumbai with copies in Hyderabad: a managed PostgreSQL with point-in-time recovery, three object-storage buckets under separate keys, containers, a content network, a firewall, secrets and monitoring. Supabase entered on 26 October through the engineering standards document, which uses it as the data, auth and storage layer for a universal app, and the AMPM edition kept it as "the solo-friendly variant" because one developer should spend days on the product, not on infrastructure.

What Supabase is: a hosted PostgreSQL (with extensions, backups and an optional point-in-time recovery add-on), an authentication service (email, phone OTP through your own SMS provider via its send-SMS hook, TOTP for a second factor), file storage with signed URLs, a realtime channel, a dashboard, and a Mumbai region. For a solo developer it removes most operations and bundles the identity service. What it does not give: a second Indian region for copies, customer-managed encryption keys per bucket, and the finer network controls; and its point-in-time recovery costs as much as its compute.

The standards keep every business rule in the API whatever the platform, so this choice is about operations, cost, residency and security posture, not about where the logic lives. The API, the apps and the schema are the same on every option below.

## 2. What the platform must provide

| Need | Source | Weight |
|---|---|---|
| PostgreSQL 16 with automated backups and point-in-time recovery; a rehearsed restore | Brief §14 "reliable backups and recovery"; T-13 | Must |
| Object storage with signed, expiring links; a separate restricted store for identity documents with its own key and audited reads | Brief §8; architecture §3 | Must (the separate key is the drafted design; a separate bucket with its own access policy is the minimum) |
| Identity: email and mobile verification at activation, sign-in by mobile OTP through an Indian DLT-registered SMS provider, TOTP for staff, no self-registration | Q13; 26 October decision | Must |
| Data stored in India | Architecture proposal T-2; R13 to confirm | Should, treated as must |
| A second Indian region for copies; recovery point 15 minutes, recovery time 4 hours | T-13 proposal | Should; the developer may trade it |
| Low operations load for one developer | D-012 | Should |
| Containers for the API and worker, Redis for queues and sessions, a content network for media | Architecture §3 | Must |
| Portability: plain PostgreSQL, S3-compatible storage, containers | Architecture §14 | Should |

## 3. The options for data, storage and hosting

Monthly costs are for AMPM's build-time scale (a small database, a few containers, under 500 GB of media) and, where different, for the launch topology. They exclude the identity service (part 4), provider fees for messages and payments, and the developer's time.

| Option | Indian region | Database and recovery | Storage and keys | Monthly at build | Monthly at launch | Operations load | What you give up |
|---|---|---|---|---|---|---|---|
| **A · AWS as drafted** (RDS Multi-AZ, three S3 buckets with KMS keys, Fargate, CloudFront, WAF, ElastiCache, Secrets Manager, CloudWatch) | Mumbai, with Hyderabad as the second region | PITR 35 days, snapshots copied to Hyderabad; the drafted 15 minutes and 4 hours | Three buckets, three customer-managed keys, versioning and cross-region replication | — | US$450 to 900 (₹38,000 to 76,000) | High: infrastructure as code, patching windows, alarms; most of it designed already | Nothing in the design; the developer's time |
| **B · AWS lite, growing into A** (same services, smaller: single-AZ RDS db.t4g.medium about US$61 plus 20 GB storage; two small Fargate tasks about US$40; a small Redis about US$15; load balancer about US$20; S3 and CloudFront about US$20; secrets, logs, firewall about US$25) | Mumbai; Hyderabad switched on at launch | PITR 35 days from day one; Multi-AZ and the second-region copy turned on at launch by configuration | As A | US$180 to 250 (₹15,000 to 21,000) | Becomes A | Medium at first, high at launch; the same Terraform throughout, so no migration | Nothing; the launch posture is a flag change |
| **C · Supabase Pro in Mumbai** (Pro US$25; Small or Medium compute US$15 to 60; point-in-time recovery US$100; storage and egress) plus the API and worker on a small container host in Mumbai (Fly.io machines, about US$20 to 40) and a managed Redis (Upstash, about US$10) | Mumbai (verify the region on the project page when creating it) | Daily backups 7 days on Pro; PITR as an add-on; one region | Supabase Storage with signed URLs and per-bucket policies; no per-bucket customer key; the restricted identity store can be an S3 bucket in Mumbai with its own KMS key (a hybrid, about US$5) | US$170 to 240 (₹14,000 to 20,000) | US$250 to 400 with larger compute | Low: no servers to patch, dashboard, built-in auth | The second Indian region; customer-managed keys unless the hybrid is used; the firewall and network controls of A; sizing is per compute tier |
| **D · DigitalOcean in Bangalore** (Managed PostgreSQL 2 vCPU 4 GB about US$60, standby node about US$60; App Platform for API and worker about US$25 to 50; Managed Redis about US$15; Spaces about US$5) | Bangalore only | Daily backups and point-in-time recovery included; standby node for failover; no second Indian region | Spaces with signed URLs; no customer-managed keys | US$110 to 190 (₹9,000 to 16,000) | US$170 to 250 | Low to medium: managed everything, simpler console than AWS | The second region; KMS; identity service must come from elsewhere; verify standby availability on current plans |
| **E · Google Cloud in Mumbai** (Cloud SQL 2 vCPU 8 GB with high availability about US$180 to 250; Cloud Run for API and worker about US$30 to 60; Memorystore about US$35; Cloud Storage about US$10) | Mumbai, with Delhi as a second Indian region | PITR and HA on Cloud SQL; cross-region backups to Delhi | Buckets with customer-managed keys | US$260 to 360 (₹22,000 to 30,000) | US$300 to 450 | Medium: comparable to AWS; the drafted Terraform would be rewritten for GCP | A rewrite of the infrastructure design; Identity Platform's phone OTP costs about US$0.07 per SMS in India, so OTP would stay in the API with MSG91 |
| **F · Azure in Central India** (Flexible Server 2 vCPU about US$60 to 150, zone-redundant HA doubles it; Container Apps about US$30 to 60; Blob about US$10; Cache about US$15) | Central India (Pune) with South India (Chennai) as a second region | PITR and HA; geo-redundant backup | Blob with customer-managed keys | US$200 to 350 (₹17,000 to 29,000) | US$300 to 500 | Medium | A rewrite of the infrastructure design |
| **Not suitable on residency** | Neon (no Indian region found), Railway and Render (nearest Singapore), Fly.io Managed Postgres (Mumbai unconfirmed; app machines yes), Hetzner (none), Cloudflare R2 for identity documents (no Indian jurisdiction control) | | | | | | Use only if India residency is dropped, which the brief's security posture argues against |

### How to read the costs

- The drafted AWS topology is the only option that already has a design, controls and a Terraform plan written for it (architecture §3, §11, §12); every other option re-does that work, from a few days (Supabase, DigitalOcean) to a week or more (GCP, Azure).
- At build time, B, C and D cost about the same, US$110 to 250 a month. The difference is operations and posture, not money.
- At launch, A costs two to three times C or D because of Multi-AZ, the second region and the firewall. That is the price of the drafted recovery and security posture; the developer can decide to pay it at launch rather than now (option B), or not at all (C or D).
- Reserved pricing on AWS cuts the database by a quarter to a third once the size is stable.

## 4. The identity service

| Option | Fits AMPM's sign-in | Price at AMPM's scale (a few thousand users) | Notes |
|---|---|---|---|
| **Supabase Auth** (with option C) | Yes: email verification, phone OTP through the send-SMS hook to MSG91 or another DLT provider, TOTP MFA, admin-created users only | Included in Pro | Users live in your own PostgreSQL; the no-self-registration rule is enforced by disabling sign-ups and creating users from the API |
| **Amazon Cognito** (with A or B; usable from any host) | Yes: email and phone verification, custom SMS sender to a DLT provider through a Lambda, TOTP MFA, admin-created users | Lite and Essentials tiers: 10,000 monthly active users free; Essentials US$0.015 per user after that; effectively free for AMPM for years | Advanced security features and the hosted UI are not needed; the custom SMS sender is a small Lambda |
| **Firebase Authentication / Identity Platform** | Partly: phone OTP goes through Google's own SMS at about US$0.07 (about ₹6) per message to India and cannot use your DLT provider | 50,000 users free | The per-OTP cost makes it the wrong tool for mobile-OTP sign-in in India |
| **Clerk** | Partly: hosted components aimed at web and React Native; phone OTP through Clerk's SMS providers with per-message charges; admin-only creation possible | Free to 50,000 users; Pro US$25 a month | Data held by Clerk outside India; adds a dependency for little gain here |
| **Auth0** | Yes technically | US$70 a month at 1,000 users rising steeply; US$700 at 10,000 | Priced for enterprises; not justified |
| **Self-hosted Keycloak or Zitadel** | Yes | Free software; a container and a database to run | More operations for one developer; the right answer only if a self-hosted IdP is wanted for other reasons |
| **In the API** (the architecture's original T-6: Argon2id, OTP, TOTP, sessions, with a maintained library such as Better Auth) | Yes | Free | Bounded scope, but the developer owns password, OTP and MFA code and its security; the standards review recommended a managed service |

Recommendation: Cognito with AWS (A or B), Supabase Auth with Supabase (C). With DigitalOcean, GCP or Azure, Cognito is still usable from Mumbai and costs nothing at this scale. AMPM's principals, guest token sessions, entitlements and the no-self-registration rule stay in the API in every case.

## 5. What you get on each path, in plain terms

- **A, the drafted AWS.** The posture the architecture designed: two Indian regions, keys per bucket, a firewall, rehearsed recovery. Highest operations load and the highest bill, but no redesign and every control the brief's security requirements ask for. Right if AMPM's clients or the founder expect the full enterprise posture from day one.
- **B, AWS lite growing into A.** The same design at a quarter of the cost during the build, with Multi-AZ and the Hyderabad copy switched on at launch. No migration, one Terraform, Cognito for identity at no cost. The operations load is real but front-loaded in sprint 0 and then routine. Right if the developer is, or is willing to become, comfortable on AWS (K4).
- **C, Supabase in Mumbai.** The least operations and a bundled identity service; a dashboard for data and auth from day one; cost similar to B during the build. Gives up the second region and the finer controls, and still needs a container host and Redis for the API. The hybrid, an S3 bucket in Mumbai with its own key for identity documents, keeps the one control that matters most for the sensitive data. Right if minimal operations is the priority and a single Indian region with daily backups plus PITR is acceptable to AMPM.
- **D, DigitalOcean in Bangalore.** The simplest console and the lowest bill, with managed PostgreSQL including PITR and a standby. No second region, no key management, and identity must come from Cognito or Supabase Auth anyway. Right if cost and simplicity outrank posture.
- **E and F, Google Cloud or Azure.** Equivalent to AWS in posture (both have a second Indian region) with a redesign of the infrastructure plan and, for GCP, an identity service whose phone OTP is priced wrongly for India. Right only if the developer already knows one of them well.

## 6. Recommendation

Option B unless the developer's stack answer (K4) says AWS is unfamiliar territory; then option C with the S3 identity bucket hybrid. If a dedicated VPS in an Indian datacentre is already available, G1 (the VPS for the application, a managed database and S3 for the data, Cognito for identity) is the cheapest sound build-time platform, with the launch posture decided at phase 5 (part 7). Both keep the schema, the API and the apps identical; both cost about US$200 a month during the build. B preserves the drafted design and grows into the full posture at launch without a migration; C trades the second region and key management for the least operations. Whichever is chosen is recorded as R13 answered and as a build-decision record, and the architecture draft's T-2 and T-13 are updated in version 0.3.

What to verify on the provider's page before opening the account: the region (Mumbai for AWS and Supabase; Bangalore for DigitalOcean), the current price of the database tier and of point-in-time recovery, and, for DigitalOcean, whether a standby node is offered on the plan.

## 7. A dedicated VPS of your own

> **DECIDED.** 26 October 2026: the developer locked R13 as G2, everything on AMPM's dedicated VPS with pgBackRest archives to a Mumbai bucket and rehearsed restores. The four facts in 7.4 are still to be recorded in `docs/engineering/vps-setup.md`; an Indian datacentre is a condition of the lock.

Asked on 26 October 2026: can the platform run on a dedicated VPS? Technically yes, without changing a line of the design: the API and worker are containers, the database is plain PostgreSQL, the queue is Redis, the files need any S3-compatible store, and the identity service can stay managed (Cognito works from anywhere) or be self-hosted. The question is not whether it runs but who runs it, and what the brief's "reliable backups and recovery" and "protect client, guest, hotel, vendor and financial data" mean when the whole platform sits on one machine you patch yourself.

### 7.1 Two ways to do it

| | G1 · Hybrid: the VPS runs the application, managed services hold the data | G2 · Everything on the VPS |
|---|---|---|
| On the VPS | API, worker, Redis, the public website, staging as a second small VPS or a second Docker project | All of G1 plus PostgreSQL, the file store (MinIO) and, if chosen, a self-hosted identity server (Keycloak or Zitadel) |
| Managed elsewhere | PostgreSQL with point-in-time recovery (AWS RDS single-AZ in Mumbai about US$61 plus storage, or Supabase Pro at US$25 plus compute, or DigitalOcean Bangalore from US$15); S3 in Mumbai for files, with its own key for identity documents; Cognito for identity | Only the off-site backup target (an S3 bucket in Mumbai, a few dollars) and, recommended, Cognito |
| Monthly | VPS ₹3,000 to 8,000; managed database US$40 to 120; S3 and backups under US$10; Sentry US$26 → about ₹8,000 to 20,000 | VPS ₹3,000 to 8,000; backup bucket and Sentry → about ₹5,000 to 11,000 |
| Recovery | Database recovery is the provider's (PITR, snapshots); the VPS is rebuilt from the repository's Compose files in an hour | Yours: pgBackRest or WAL-G streaming archives to the bucket with a tested restore, provider snapshots nightly; recovery time is how fast you can rebuild and restore, realistically two to four hours if rehearsed |
| Availability | One box for the application: a reboot or a provider incident takes the apps offline until it is back; the data is safe | One box for everything; a disk failure without a tested restore loses data since the last archive |
| Security posture | Data at rest under the provider's encryption and keys; the box holds no sensitive files | Full-disk encryption, the file store's encryption and key handling, database hardening, all yours; identity documents on the same host as everything else |
| Operations load | Medium: operating system patching, Docker, TLS, firewall, monitoring, deploys | High: all of that plus database administration, backup verification, storage, upgrades |

### 7.2 What a correct VPS setup needs, either way

- A provider with a datacentre in India (data residency) and nightly snapshots; 4 vCPU, 8 to 16 GB RAM, NVMe disk, a static IP; a second small VPS or a separate Compose project for staging, never staging on the production database.
- Docker Compose checked into the repository (infrastructure as code still applies), Caddy or Traefik for TLS, a firewall allowing only 80, 443 and SSH by key, fail2ban, unattended security updates, no passwords on SSH, no root login.
- Secrets outside the repository: Docker secrets or `sops` with `age`, injected at deploy; never in `.env` files committed.
- GitHub Actions deploying by SSH on a tagged release, with the same expand-and-contract migration rule and the same deployment freeze during live weddings.
- Monitoring from outside the box: Sentry for errors, an uptime monitor (Better Stack, UptimeRobot or a Grafana Cloud free tier) that pages you, disk and memory alarms.
- For G2: PostgreSQL 16 in a container with a data volume, pgBackRest or WAL-G shipping WAL archives to an S3 bucket in Mumbai every few minutes (recovery point minutes, as the architecture proposed), a monthly restore rehearsal into staging, Redis with persistence off (nothing in Redis is the only copy), MinIO or an S3 bucket in Mumbai for files, with identity documents preferably in the bucket and not on the box.
- The architecture's principle 7, "managed, boring infrastructure, nothing hand-built on a server", is deliberately set aside; that is a build-decision record, not a silent change.

### 7.3 When it is the right call

- During the build, G1 is a sound and cheap choice: the application is rebuilt from code in an hour, the data sits on a provider that handles recovery, and the monthly bill is a third of AWS lite. It also keeps the launch decision open: at launch the same containers move to Fargate or stay on a bigger VPS, and the database is already managed.
- G2 is right only if you want to own database operations and will rehearse the restore. It is the cheapest option by far and the one with the most ways to lose a wedding's data on a bad day; the brief's security requirements are met only if 7.2 is done in full and kept up.
- On the wedding day the team app works offline, but the client portal, chat and notifications do not; a single-box outage is visible to clients. A warm standby VPS with streaming replication (G2) or the managed database's own failover (G1) is the answer when launch approaches.

### 7.4 What decides it

Before choosing, four facts about the VPS: the provider and the datacentre's city (residency), the specification (vCPU, RAM, disk, bandwidth, snapshots), whether it is shared with other projects or dedicated to AMPM (isolation), and who holds root and patches it today. With those, G1 can be the build-time platform from sprint 0 and the launch posture is decided at phase 5; without an Indian datacentre, the VPS is out while residency stands.

## Sources consulted on 26 October 2026

Supabase regions and send-SMS hook (supabase.com docs); Supabase pricing summaries (makerkit.dev, jetadmin.io); Neon pricing (jetadmin.io, bytebase.com); DigitalOcean managed PostgreSQL pricing summaries (selfhost.dev, infratally.com, northflank.com); Fly.io and Railway pricing summaries (dev.to, pethost.dev, bex.co); AWS RDS db.t4g.medium Mumbai pricing (bytebase.com dbcost, instances.vantage.sh); Cognito tiers (dev.to, skycloak.io); Firebase and Identity Platform phone pricing (metacto.com, logto.io, minimoth.dev); Clerk and Auth0 pricing (clerk.com, costbench.com, guptadeepak.com); Cloud SQL and Azure India figures (opsiocloud.com, cloud.google.com). Secondary sources disagree in places; the ranges above are deliberately wide.
