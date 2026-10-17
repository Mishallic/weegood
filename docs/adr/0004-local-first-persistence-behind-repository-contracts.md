# 0004. Local-first persistence behind repository contracts

Date: 2026-10-17
Status: Accepted

## Context

The MVP has no backend. Even when it does, the product promises privacy (the taste profile is
sensitive) and must work offline with local files. We also do not want features to know where
data lives, because the mobile app will use SQLite and the web app uses IndexedDB.

## Decision

- All user data (profile, playlists, follows, local track metadata, audio blobs, listen history)
  is stored on-device. The web app uses IndexedDB through the small `idb` wrapper.
- `packages/core/repository` defines the contracts (`ProfileRepository`, `PlaylistRepository`,
  `FollowRepository`, `LocalTrackRepository`, `ListenRepository`, `AudioBlobStore`) and ships an
  in-memory implementation used by tests.
- Features talk to the app store; the app store talks to repositories. Nothing else touches
  storage.
- Every record carries `updatedAt` so a future sync layer can do last-writer-wins without a schema
  change.

## Consequences

- Zero infrastructure cost and zero privacy exposure for the MVP.
- Adding sync (M3) means adding an HTTP-backed repository and a reconciliation step, not touching
  features.
- Data lives in one browser profile. Export and import to JSON is in the MVP so testers do not
  lose work when switching devices.

## Alternatives considered

- Firebase or Supabase from day one: fast, but puts taste data on a server before we have a
  privacy policy or a reason, and couples the MVP to a vendor.
- localStorage: synchronous, a few MB cap, cannot hold audio blobs.
- Dexie: excellent, but larger than `idb` and we need very little of its query layer today.
