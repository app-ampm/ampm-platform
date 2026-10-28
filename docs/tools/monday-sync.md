# monday.com board sync

Keeps the **AMPM Platform — Build Plan** board
(<https://thewebpaandas-team.monday.com/boards/5032167934>) in step with the
work automatically: when a PR is merged, the card it advances moves to
**Working on it** / **Done**, the **✅ Completed on** date is stamped, and a
short, founder-readable progress note is posted to the card. The static
*What it is / Why it matters* note on each card stays as the anchor; the
Updates feed becomes a running progress log.

## How it works

- `.github/workflows/monday-sync.yml` runs on **PR merged** and pipes the PR
  description into `docs/tools/monday_sync.py --from-pr`.
- The script reads `Monday:` trailers from the body and, per card, calls the
  monday API to set Status, stamp the completion date (for `done`), and post an
  update. Card keys → item ids live in `docs/tools/monday_board_map.json`.
- It is **post-merge and best-effort**: a monday hiccup or a missing token logs
  and exits green — it never blocks a merge or CI.

## The PR trailer (how Claude/you tell the board what moved)

Add one or more lines anywhere in the PR description:

```
Monday: <card-key> <state> [short note]
```

- `<state>` = `working` (set In progress + post note), `done` (set Done + stamp
  Completed + post note), or `progress` (just post a note, no status change).
- The note is optional; the PR title, a link to the PR, and the timestamp are
  added automatically.

Examples:

```
Monday: kernel done server-side sessions + audit-on-change landed; Sprint 3 complete
Monday: vps working Compose stack + pgBackRest up on the staging VM
Monday: hotels progress rate-card import done; search view next
```

A card finishing may span several PRs — use `working`/`progress` on the way and
`done` on the PR that completes it.

## Card keys

Grouped by phase (see `monday_board_map.json` for the ids):

- **Phase 0 (done):** `monorepo` `tokens` `tooling` `ui` `api-skeleton` `identity-seam` `permissions` `offline-spike` `audit` `hardening` `memory` `g0`
- **Phase 1:** `kernel` `vps` `crm` `hotels` `consultancy` `website` `demo` `chat` `client-screens` `team-screens` `flows-p1` `g1`
- **Phase 2:** `projects` `budget` `vendors` `creative` `tasks` `flows-p2` `g2`
- **Phase 3:** `guests` `rsvp` `rooms-travel` `menus-id` `flows-p3` `g3`
- **Phase 4:** `run-of-show` `staffing` `offline-first` `closure` `pilot-day` `g4`
- **Phase 5:** `hardening-pentest` `remediation` `store-launch` `launch`

## One-time setup (the only manual step)

1. **Get a monday API token.** In monday, click your avatar (bottom-left) →
   **Developers** → **My Access Tokens** → **Show** → copy. (Direct link:
   <https://thewebpaandas-team.monday.com/apps/manage/tokens>.) Use an admin
   user's token so it can write to the board.
2. **Add it as a GitHub Actions secret** named `MONDAY_API_TOKEN` on
   `app-ampm/ampm-platform`:
   ```bash
   gh secret set MONDAY_API_TOKEN --repo app-ampm/ampm-platform
   ```
   (Paste the token when prompted — it is never printed or committed.)
3. **Merge this workflow to the default branch.** `pull_request` workflows run
   from the base branch, so the sync only takes effect for merges *after* this
   lands on `main`.

That is all. From then on, every merge whose PR carries a `Monday:` trailer
updates the board on its own.

### Why a GitHub secret and not sops/age

`infra.md` keeps **application/host** secrets in `infra/secrets/*.enc.yaml`
(decrypted at deploy on the VPS). The monday token is a **CI-only** credential
that a GitHub-hosted runner needs at workflow time and that never reaches the
host or the app — so it belongs in GitHub Actions' encrypted secret store. The
workflow only references `${{ secrets.MONDAY_API_TOKEN }}`; no secret text is in
the file (per `infra.md`).

## Manual / local use

```bash
# dry run — prints what would be sent, no token needed
echo "Monday: kernel done test" | python3 docs/tools/monday_sync.py --from-pr --dry-run

# update one card by hand
MONDAY_API_TOKEN=... python3 docs/tools/monday_sync.py --card vps --state working --note "staging VM up"
```

## The connector / account gotcha

The board lives in the **thewebpaandas-team** monday account. This script uses
its own API token (above). Separately, if a Claude Code session edits the board
through the monday MCP connector, that connector must be signed into
**thewebpaandas-team** (not SpotLightLMS) — verify with `get_user_context`
(expect user *Yogesh*).

## Deeper narrative

The sync posts facts (status, date, PR link). The richer "what we built / what
we learned / what's next" summary is best refreshed by a Claude Code session at
each sprint or gate — a quick manual top-up, not something a git hook writes
well.
