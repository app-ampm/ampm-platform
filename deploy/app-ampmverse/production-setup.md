# app.ampmverse.com — production setup on the current VPS (local media, D-106)

Promoting the current box (31.97.62.74, the shared Plesk VPS) toward production with hotel media on the box's own disk, deferring the Hostinger-Mumbai + S3 move (D-106). The box override template is [`compose.test-override.example.yml`](compose.test-override.example.yml); the real file is copied to `infra/compose/local/compose.test-override.yml` on the box (box-specific, not committed).

## 1. Secrets — `infra/compose/local/.env` on the box (gitignored, mode 600)

Two HMAC keys live only on the box and are generated once:

```bash
umask 077
printf 'AMPM_BOX_IDENTITY_SECRET=%s\n'      "$(openssl rand -base64 48 | tr -d '/+=\n')" >  infra/compose/local/.env
printf 'AMPM_BOX_MEDIA_SIGNING_SECRET=%s\n' "$(openssl rand -base64 48 | tr -d '/+=\n')" >> infra/compose/local/.env
```

`AMPM_BOX_IDENTITY_SECRET` signs the interim local sign-in tokens; `AMPM_BOX_MEDIA_SIGNING_SECRET` → `MEDIA_SIGNING_SECRET` signs the 15-minute `/media/blob` download URLs (required for local media in production). Changing either invalidates existing tokens / signed links.

## 2. Media volume + backup

Media is a persistent host bind-mount, created once (chown to the container's `node` uid 1000):

```bash
sudo mkdir -p /var/www/vhosts/app.ampmverse.com/ampm-storage
sudo chown -R 1000:1000 /var/www/vhosts/app.ampmverse.com/ampm-storage
```

It is the only persistent state outside Postgres, so back it up nightly ([`backup-media.sh`](backup-media.sh)); the provider's daily disk backup is the second layer. When AMPM later moves to S3-in-Mumbai, set `STORAGE_PROVIDER=s3` and copy this dir into the bucket once.

## 3. The `env.ts` production contract — the honest caveat

`STORAGE_LOCAL_PERSISTENT=true` lets `env.ts` accept the local store once `NODE_ENV=production`. But storage is **one of seven** production gates; `NODE_ENV=production` _also_ requires:

| gate                 | needs                  | status       |
| -------------------- | ---------------------- | ------------ |
| `IDENTITY_PROVIDER`  | Cognito (no dev-login) | ❌ not built |
| `PAYMENT_PROVIDER`   | Razorpay               | ❌ not wired |
| `BOT_CHECK_PROVIDER` | Turnstile (siteverify) | ❌ not wired |
| `REDIS_URL`          | Redis on the box       | ❌           |
| `TRUST_PROXY`        | ≥1                     | ✓ (`1`)      |
| URLs / email         | non-localhost + SMTP   | partial      |

So the box **cannot** run `NODE_ENV=production` until client auth (Cognito) and payment are wired, and it **must stay behind its Basic-Auth gate** until then — dev-login must never be publicly reachable. This setup makes the **storage + env foundation** ready; the box keeps running its interim, gated profile meanwhile.

## 4. Apply

```bash
WEB_SSH=app_ampmverse@31.97.62.74 bash deploy/redeploy-box.sh
```

Applying now only picks up the storage sanction (inert until `NODE_ENV=production`), so it changes nothing on the interim box — it can also wait until the production flip alongside auth.
