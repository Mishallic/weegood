# 0015. The queue lives on the device, and a listen starts at play

Date: 2026-10-19
Status: Accepted.

## Context

The player store was in memory only. A refresh, a crash or a closed tab lost the queue, which for a
music player is the most annoying failure there is. At the same time the store began a listen
session, prefetched the next track and started audio analysis the moment a track finished loading,
which was fine while loading only ever happened because someone pressed play.

## Decision

- **The queue is saved on the device.** The play order, the unshuffled order, the current position
  in it, shuffle, repeat, the context label and the playback position are written to
  `localStorage` under `weegood:player`. Structure is saved on every change; the position every
  five seconds and whenever the page is hidden or unloaded.
- **Restore is silent.** On boot, after the profile and caches hydrate, the store fetches any
  tracks the saved queue references that the cache no longer holds, loads the current track paused
  at the saved position, and waits. Nothing autoplays: browsers would block it, and the listener
  should choose.
- **A listen begins when sound starts.** The listen session, the next-track prefetch and the audio
  analysis begin at the first `playing` snapshot after a load, not when loading finishes. A
  restored track that is never played records nothing and costs no bandwidth beyond the browser's
  initial buffer, and skipping past it is not a skip.
- `localStorage` rather than IndexedDB: the payload is a few kilobytes of ids, it must be written
  synchronously on `pagehide`, and reading it at boot must not wait on a database open.

## Consequences

- The queue survives refreshes and reopens, and the play button picks up where the listener left
  off.
- Tracks are referenced by id. Streamed tracks missing from the on-device cache are refetched in
  one batch request from the provider on boot, so an offline restore keeps only cached and local
  tracks.
- Tests run with persistence off (`persistKey: null`) so they do not share state through jsdom's
  storage.
- The store subscribes to itself for persistence; the comparison is by reference, so the four or so
  position updates per second cost nothing until five seconds have passed.

## Alternatives considered

- zustand's `persist` middleware: it would serialise the whole store, transient status and position
  included, on every tick, and knows nothing about the engine. A hand-rolled fifteen lines is
  clearer.
- Autoplaying on restore: blocked by every browser without a gesture, and presumptuous when allowed.
