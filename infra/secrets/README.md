# infra/secrets

sops + age encrypted secrets, decrypted on the host at deploy (feature 6.4, D-051). The full procedure,
the secret registry and rotation live in [../runbooks/secrets.md](../runbooks/secrets.md).

- `../../.sops.yaml` — creation rules and the age public recipient.
- `examples/<zone>.yaml` — plaintext templates (placeholders only) for each trust zone: `postgres`, `redis`, `app`.
- `<env>.<zone>.enc.yaml` — the encrypted secrets, committed (e.g. `production.app.enc.yaml`). Created from
  the templates with sops; the age **private** key never leaves the host and the password manager.
- `../scripts/decrypt-secrets.sh <env>` — writes the decrypted per-zone `.env` into the Compose directory at deploy.

Never commit a plaintext secret or an age private key — CI (`docs/tools/scan_secrets.py`) enforces it.
