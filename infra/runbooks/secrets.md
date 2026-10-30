# Secrets runbook (feature 6.4, D-051)

Secrets are encrypted with [sops](https://github.com/getsops/sops) + [age](https://github.com/FiloSottile/age)
and committed as ciphertext; the host decrypts them at deploy. The age **private** key lives only on the
host and in the password manager — never in the repo, a log, an image or a test fixture (`.claude/rules/security.md`).

## Layout

- `.sops.yaml` — creation rules; the age **public** key (recipient) every `infra/secrets/*.enc.yaml` is encrypted to.
- `infra/secrets/<env>.<zone>.enc.yaml` — the encrypted secrets, committed. `<env>` ∈ {production, staging}, `<zone>` ∈ {postgres, redis, app}.
- `infra/secrets/examples/<zone>.yaml` — plaintext templates listing the keys (placeholders only).
- `infra/scripts/decrypt-secrets.sh <env>` — run on the host at deploy; writes `infra/compose/<env>/{postgres,redis,app}.env` (gitignored).

One file per **trust zone**, so each container loads only the secrets it needs:

| Zone     | Encrypted file            | Consumed by          | Why separate                                                                |
| -------- | ------------------------- | -------------------- | --------------------------------------------------------------------------- |
| postgres | `<env>.postgres.enc.yaml` | postgres, pgbackrest | DB + backup tier; must not hold app/provider keys                           |
| redis    | `<env>.redis.enc.yaml`    | redis                | a cache compromise must not leak DB, S3 or app keys                         |
| app      | `<env>.app.enc.yaml`      | api, worker          | app + provider keys; must not hold the raw DB password or the backup cipher |

## Secret registry

| Secret                                    | Zone                    | Used by                                           | Rotation                                                                      |
| ----------------------------------------- | ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD` / `PGPASSWORD`        | postgres                | Postgres auth; pgBackRest + the job_runs recorder | on suspicion; yearly otherwise                                                |
| `DATABASE_URL`                            | postgres, app           | the app and the backup sidecar                    | follows `POSTGRES_PASSWORD`                                                   |
| `PGBACKREST_REPO1_CIPHER_PASS`            | postgres                | encrypts the backup repository                    | **never** rotate without re-encrypting the repo (losing it loses the backups) |
| `PGBACKREST_REPO1_S3_KEY` / `_KEY_SECRET` | postgres                | pgBackRest → the Mumbai S3 bucket                 | yearly; immediately if the IAM user is exposed                                |
| `REDIS_PASSWORD` / `REDIS_URL`            | redis, app              | Redis auth                                        | yearly                                                                        |
| `COGNITO_*`                               | app                     | identity verification                             | managed in Cognito; update on pool/client change                              |
| `SMTP_USER` / `SMTP_PASSWORD`             | app                     | transactional email (SES)                         | yearly; immediately on exposure                                               |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | app                     | payments (when they land)                         | per Razorpay policy; test keys on staging only                                |
| age private key                           | host + password manager | sops decrypt at deploy                            | on operator change or exposure (re-encrypt every file)                        |

Keep this table current: every new secret gets a row before it ships.

## One-time: the age key

```bash
age-keygen -o /etc/ampm/age.key   # on the host, OUTSIDE the repo checkout; prints the public key (age1...)
```

Put the public key in `.sops.yaml` (`age:`), commit that. Keep the private key at `/etc/ampm/age.key`
(mode 600) and in the password manager — never in the repo checkout. Point sops at it with
`SOPS_AGE_KEY_FILE=/etc/ampm/age.key`. Even if one is ever written inside the checkout it stays protected:
`.gitignore` blocks `age.key`/`*.key`/`*.agekey`, and the CI scan (`docs/tools/scan_secrets.py`) refuses
any `.key` file and any file whose body contains `AGE-SECRET-KEY-`.

## Create or edit a secret file

```bash
cp infra/secrets/examples/app.yaml /tmp/production.app.yaml   # fill real values in /tmp (not in the repo)
# --filename-override makes sops match the .sops.yaml creation rule (the target path ends .enc.yaml), so it
# encrypts to the real age recipient; without it sops matches the /tmp input path and finds no rule.
sops --encrypt --filename-override infra/secrets/production.app.enc.yaml /tmp/production.app.yaml \
  > infra/secrets/production.app.enc.yaml
shred -u /tmp/production.app.yaml                             # remove the plaintext

sops infra/secrets/production.app.enc.yaml                    # later edits: decrypts in your editor, re-encrypts on save
```

Commit only the `*.enc.yaml`.

## Deploy (on the host)

```bash
SOPS_AGE_KEY_FILE=/etc/ampm/age.key infra/scripts/decrypt-secrets.sh production
docker compose -f infra/compose/production/compose.yml up -d
```

`decrypt-secrets.sh` writes `postgres.env`, `redis.env` and `app.env` into the Compose directory (umask 077);
they are gitignored. The deploy workflow (feature 6.6) runs this between fetching the release and starting
the stack.

## Rotate a secret

A value duplicated across zones must change in every file that holds it, or the app keeps the stale copy
and fails to connect after redeploy. The split duplicates two: the DB password (postgres zone AND the app
zone's `DATABASE_URL`) and the Redis password (redis zone AND the app zone's `REDIS_URL`).

1. Change it at the source (the DB, Cognito, the IAM user, the provider).
2. Edit every zone file that holds it with `sops`, and commit:
   - DB password → `<env>.postgres.enc.yaml` (`POSTGRES_PASSWORD`, `PGPASSWORD`, `DATABASE_URL`) **and** `<env>.app.enc.yaml` (`DATABASE_URL`).
   - Redis password → `<env>.redis.enc.yaml` (`REDIS_PASSWORD`) **and** `<env>.app.enc.yaml` (`REDIS_URL`).
   - Anything else → its single zone file.
3. Re-deploy (decrypt + `up -d`); verify the app connects.
4. Append a dated line to the Rotation log below.

## Rotation log

One line per rotation — `YYYY-MM-DD <secret> <reason>` — so the registry's cadence column has a companion
record of when each secret was last changed. Empty until the first real rotation.

## CI guard

`docs/tools/scan_secrets.py` runs in CI (the `secrets-scan` job). It reuses the transcript redactor's
detector over every tracked file and refuses any plaintext-secret file by location, so no plaintext secret
can be committed. Run it locally before pushing: `python3 docs/tools/scan_secrets.py`.
