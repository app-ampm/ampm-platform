-- Monthly partitions of the two log tables for February to December 2027 (data.md). The first partition
-- migration (20261028050928_partition_audit_notifications) stopped at January 2027, so from February every
-- row would have gone to the DEFAULT partition. The maintenance job (admin.partitions.maintain) keeps the
-- current month and the six after it in place from now on; this migration makes production safe before
-- that job first runs, and leaves it nothing to do until mid-2027.
--
-- Same naming and bounds as the first migration: each partition inherits the parent's primary key,
-- indexes and foreign key. Expand-only: it adds empty tables and changes nothing else. A create scans the
-- DEFAULT partition and fails if it already holds rows of that month, which stops the deploy before the
-- new API starts instead of misfiling those rows.

-- audit_events: partitioned by occurred_at -----------------------------------
CREATE TABLE "audit_events_2027_02" PARTITION OF "audit_events" FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00');
CREATE TABLE "audit_events_2027_03" PARTITION OF "audit_events" FOR VALUES FROM ('2027-03-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');
CREATE TABLE "audit_events_2027_04" PARTITION OF "audit_events" FOR VALUES FROM ('2027-04-01 00:00:00+00') TO ('2027-05-01 00:00:00+00');
CREATE TABLE "audit_events_2027_05" PARTITION OF "audit_events" FOR VALUES FROM ('2027-05-01 00:00:00+00') TO ('2027-06-01 00:00:00+00');
CREATE TABLE "audit_events_2027_06" PARTITION OF "audit_events" FOR VALUES FROM ('2027-06-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');
CREATE TABLE "audit_events_2027_07" PARTITION OF "audit_events" FOR VALUES FROM ('2027-07-01 00:00:00+00') TO ('2027-08-01 00:00:00+00');
CREATE TABLE "audit_events_2027_08" PARTITION OF "audit_events" FOR VALUES FROM ('2027-08-01 00:00:00+00') TO ('2027-09-01 00:00:00+00');
CREATE TABLE "audit_events_2027_09" PARTITION OF "audit_events" FOR VALUES FROM ('2027-09-01 00:00:00+00') TO ('2027-10-01 00:00:00+00');
CREATE TABLE "audit_events_2027_10" PARTITION OF "audit_events" FOR VALUES FROM ('2027-10-01 00:00:00+00') TO ('2027-11-01 00:00:00+00');
CREATE TABLE "audit_events_2027_11" PARTITION OF "audit_events" FOR VALUES FROM ('2027-11-01 00:00:00+00') TO ('2027-12-01 00:00:00+00');
CREATE TABLE "audit_events_2027_12" PARTITION OF "audit_events" FOR VALUES FROM ('2027-12-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');

-- notifications: partitioned by created_at -----------------------------------
CREATE TABLE "notifications_2027_02" PARTITION OF "notifications" FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00');
CREATE TABLE "notifications_2027_03" PARTITION OF "notifications" FOR VALUES FROM ('2027-03-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');
CREATE TABLE "notifications_2027_04" PARTITION OF "notifications" FOR VALUES FROM ('2027-04-01 00:00:00+00') TO ('2027-05-01 00:00:00+00');
CREATE TABLE "notifications_2027_05" PARTITION OF "notifications" FOR VALUES FROM ('2027-05-01 00:00:00+00') TO ('2027-06-01 00:00:00+00');
CREATE TABLE "notifications_2027_06" PARTITION OF "notifications" FOR VALUES FROM ('2027-06-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');
CREATE TABLE "notifications_2027_07" PARTITION OF "notifications" FOR VALUES FROM ('2027-07-01 00:00:00+00') TO ('2027-08-01 00:00:00+00');
CREATE TABLE "notifications_2027_08" PARTITION OF "notifications" FOR VALUES FROM ('2027-08-01 00:00:00+00') TO ('2027-09-01 00:00:00+00');
CREATE TABLE "notifications_2027_09" PARTITION OF "notifications" FOR VALUES FROM ('2027-09-01 00:00:00+00') TO ('2027-10-01 00:00:00+00');
CREATE TABLE "notifications_2027_10" PARTITION OF "notifications" FOR VALUES FROM ('2027-10-01 00:00:00+00') TO ('2027-11-01 00:00:00+00');
CREATE TABLE "notifications_2027_11" PARTITION OF "notifications" FOR VALUES FROM ('2027-11-01 00:00:00+00') TO ('2027-12-01 00:00:00+00');
CREATE TABLE "notifications_2027_12" PARTITION OF "notifications" FOR VALUES FROM ('2027-12-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');
