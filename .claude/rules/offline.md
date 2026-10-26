---
paths:
  - "apps/mobile/**"
---
# Offline rules (team app, wedding day)

- The team app works without signal (brief §10, locked). The signed-in user's assigned weddings are available offline for their role: assigned tasks, department information, readiness checklists, cue sheets, arrival and operational lists. Nothing outside the role is stored on the device.
- Local store: SQLite (`expo-sqlite`, or the sync library chosen in phase 1), encrypted at rest, wiped on sign-out and on membership removal. No personal data in AsyncStorage.
- Reads come from the local store first and refresh when online; the interface always shows whether it is offline and how many changes are pending.
- Writes made offline go to a change queue with the device's original timestamp and the record version they were based on; the queue replays on reconnection in order.
- Conflicts: the server wins on status transitions; free-text and notes merge last-writer-wins with both versions kept in the conflict log for the project lead; a rejected change is shown to the user, never dropped silently.
- Every offline-capable mutation is idempotent on the server (client-generated id plus version), so a replayed queue never duplicates.
- Sync runs in the background on reconnection and on app foreground; large media uploads queue separately and never block operational updates.
- Offline screens handle the four states (loading, empty, error, offline) with the shared components; cue updates and incident reports must be recordable with no network at all.
- Tests: Maestro flows for airplane-mode cue updates and reconnection; unit tests for the queue, the conflict rules and the idempotency keys (AC-33 in the test plan).
