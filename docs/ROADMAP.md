# Roadmap

Priorities: **P0** blocks the milestone, **P1** should ship with it, **P2** nice to have.
Each item has a one-line summary so the list is readable without opening tickets.

## M0: Foundation (done 2026-10-17)

- [x] npm-workspaces monorepo with shared TypeScript, ESLint and Prettier config.
- [x] Product brief, architecture overview and founding ADRs.
- [x] `packages/core` with domain model, vibe math and a deterministic seeded catalog.
- [x] Taste profile and explainable content-based recommendation engine, fully tested.
- [x] Playlist, follow and local-track domain logic with repository contracts.

## M1: Web MVP (feature complete 2026-10-17, two P2 items open)

- [x] **P0** App shell: layout, routing, design tokens, dark and light themes, player bar.
- [x] **P0** IndexedDB persistence behind the core repository contracts.
- [x] **P0** Onboarding questionnaire that seeds the taste profile; returning users skip it.
- [x] **P0** Home feed with "For you", "Because you follow", "From people you follow", "Fresh vibes".
- [x] **P0** Browse genres and artists with follow and unfollow.
- [x] **P0** Playlists: create, rename, delete, add, remove, reorder.
- [x] **P0** Local file import (MP3, WAV, FLAC, OGG, AAC) stored on-device and playable.
- [x] **P0** Player: play, pause, previous, next, seek, volume, shuffle, repeat, queue.
- [x] **P1** Likes and listen history continuously update the taste profile.
- [x] **P1** People: demo profiles with public playlists; follow them.
- [x] **P1** Search across tracks, artists, genres and people.
- [x] **P1** Settings: export and import all data as JSON, reset profile.
- [x] **P1** Keyboard shortcuts (space, J/L, N/P, M, `/` for search).
- [x] **P1** Media Session API so lock screens and headsets control playback.
- [ ] **P2** Drag-and-drop reordering in playlists (move buttons exist today, drag is nicer).
- [ ] **P2** Read ID3 and Vorbis tags from imported files instead of inferring from file names.

Bundle at M1: 106 KB gzipped JavaScript, 5 KB CSS, against the 150 KB budget.

## M2: Concept validation

- [ ] **P0** Tester round: 20 to 30 people, two weeks, against the success criteria in PRODUCT.md.
- [ ] **P0** Opt-in local analytics: count onboarding completion, recommendation acceptance,
      playlist creation. Shown to the user on the settings page; exportable for tester
      interviews. No network.
- [ ] **P0** In-app feedback on recommendations ("more like this" next to "not for me") wired into
      the profile with stronger weights than implicit signals. "Not for me" exists today.
- [ ] **P1** Service worker for offline shell and installability as a PWA (manifest exists).
- [ ] **P1** Accessibility audit: focus order, contrast, screen reader labels on the player.
- [ ] **P1** Vibe extraction for local files: estimate energy and tempo with Web Audio analysis so
      imported tracks participate in recommendations instead of sitting outside the model.
- [ ] **P1** Real-browser end-to-end tests (Playwright) for onboarding, play, import and playlist
      flows. Unit and jsdom coverage exists; audio and file pickers need a real browser.
- [ ] **P2** Visual polish pass once tester feedback lands. The UI is intentionally plain today.

## M3: Platform

- [ ] **P0** Backend: accounts, sync of profile, playlists and follows. Repository contracts stay;
      an HTTP implementation is added and reconciled with the local one (last-writer-wins first,
      CRDT if conflicts prove common).
- [ ] **P0** Real social graph: follow real users, public playlists, activity feed.
- [ ] **P0** Catalog: licensing strategy (start with Creative Commons and direct-from-artist
      uploads), ingestion pipeline, audio feature extraction to replace hand-authored vibes.
- [ ] **P1** Collaborative filtering layer blended with the content-based engine once there is
      enough listening data to matter. Content-based stays as the cold-start path.
- [ ] **P1** Artist pages with real bios, releases and follower counts.
- [ ] **P2** Shared and collaborative playlists.

## M4: More platforms

- [ ] **P0** Mobile app with Expo reusing `packages/core`, SQLite repositories, native audio.
- [ ] **P1** Desktop with Tauri wrapping the web app; watch folders for local music.
- [ ] **P2** Car and TV surfaces once the mobile app is stable.

## Ideas parking lot

- Mood-of-the-day prompt that nudges the profile for a session without changing it permanently.
- "Vibe blend" playlists generated between two people who follow each other.
- Import listening history from other services to skip onboarding.
