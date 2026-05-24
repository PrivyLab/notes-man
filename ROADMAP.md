# NoteTakerApp Roadmap

## Phase 1: Stability and Trust

- Replace placeholder timestamps like `Just now` with real relative or formatted dates.
- Polish import/export UX and error messaging.
- Add a settings/backups screen showing:
  - current export folder
  - last export time
  - import/export actions
- Add undo for delete.
- Add archive for regular notes instead of only permanent delete.
- Add tests for:
  - local storage read/write
  - vault lock/unlock
  - import/export
  - note deduplication

## Phase 2: Note Organization

- Add tags.
- Add sort options:
  - newest
  - oldest
  - alphabetical
  - pinned first
- Add filters for:
  - pinned notes
  - archived notes
  - tags
- Add duplicate note action.
- Add a note detail screen for long notes.

## Phase 3: Vault Improvements

- Auto-lock vault when the app goes to the background.
- Auto-lock vault after inactivity timeout.
- Add password change flow with vault re-encryption.
- Add biometric unlock for Android.
- Improve vault import/export warnings and locked-vault messaging.

## Phase 4: Editing Experience

- Auto-save draft while editing.
- Add checklist note type.
- Add markdown or lightweight formatting support.
- Add character count and word count.
- Improve empty states and onboarding guidance.

## Phase 5: Backup and Restore Maturity

- Add JSON import/export alongside XLSX.
- Add backup metadata/history.
- Add schema migration support for future app versions.
- Make storage writes safer with temp-file swap before replace.
- Later: optional encrypted backup format as a separate backup mode.

## Recommended Delivery Order

1. Real timestamps
2. Settings/backups screen
3. Undo delete and archive
4. Tags and sorting/filtering
5. Vault auto-lock
6. Biometric unlock
7. Checklist or markdown notes
8. JSON backup support
9. Migration and test hardening

## Suggested Milestones

### v1.1

- Real timestamps
- Backup/settings screen
- Undo delete

### v1.2

- Archive
- Tags
- Sort and filter controls

### v1.3

- Vault auto-lock
- Biometric unlock

### v1.4

- Checklist and/or markdown notes

### v1.5

- Backup/restore hardening
- Schema migrations
- More test coverage

## Why This Order

- Start with reliability and trust.
- Then improve organization.
- Then improve security convenience.
- Then expand note-editing capability.
- Finish by hardening long-term maintenance and backup behavior.
