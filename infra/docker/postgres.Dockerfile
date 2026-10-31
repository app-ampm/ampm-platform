# syntax=docker/dockerfile:1
# PostgreSQL 16 plus pgBackRest in one image (vps-setup.md §1/§4, D-050). The postgres service uses it so
# its archive_command can run `pgbackrest archive-push`; the pgbackrest service uses the same image to run
# the scheduled backups and the daily check. pgBackRest ships in Debian bookworm's repositories, so no
# third-party source is added.
ARG POSTGRES_VERSION=16-bookworm
FROM postgres:${POSTGRES_VERSION}
RUN apt-get update \
	&& apt-get install -y --no-install-recommends pgbackrest \
	&& rm -rf /var/lib/apt/lists/*
# The spool (archive-async) and the local repo live under directories pgBackRest owns as the postgres user.
# /var/lib/node-metrics is the textfile directory the db-metrics collector (feature 6.7) writes; owned by
# postgres here so the shared node-metrics volume is seeded with that ownership (the collector runs as the
# postgres user), and node-exporter reads it read-only.
RUN install -d -o postgres -g postgres /var/spool/pgbackrest /var/lib/pgbackrest /var/lib/node-metrics
