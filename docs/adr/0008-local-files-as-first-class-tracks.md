# 0008. Local files are first-class tracks

Date: 2026-10-17
Status: Accepted

## Context

A core promise is that music you already own sits next to catalog music in the same playlists and
the same player. If local files were a separate "folder" feature, the promise would be broken
and the recommendation model would ignore them.

## Decision

- A local file becomes a `Track` with `source.kind === 'local'`. It has the same shape as a catalog
  track and can appear anywhere a track can: playlists, queue, search, history.
- On import, metadata is inferred from the file name ("Artist - Title.mp3"), duration is read from
  the decoded media, and the vibe vector starts at a neutral centre. Reading embedded tags and
  estimating vibe from audio analysis are roadmap items (M1 P2, M2 P1).
- The audio bytes are stored in IndexedDB as a `Blob` keyed by track id and played through an
  `HTMLAudioElement` with an object URL. Supported formats are whatever the browser decodes; we
  accept MP3, WAV, FLAC, OGG, AAC and M4A by extension and MIME type.
- Local tracks never leave the device. Export and import of app data includes their metadata, not
  their audio.

## Consequences

- One playlist can mix a demo catalog track, a user's FLAC rip and a WAV sketch, and the player
  does not care.
- Storage is bounded by the browser's quota (typically a large share of free disk). We show
  usage on the settings page and fail imports gracefully when the quota is hit.
- Copying bytes into IndexedDB doubles disk use for imported files. The File System Access API
  (persisted handles, no copy) is the upgrade path on Chromium and the desktop shell; Safari and
  Firefox keep the Blob route.

## Alternatives considered

- Keep only a reference to the picked file: browsers drop file references on reload.
- Server upload: breaks privacy, costs money, and is not what collectors want.
