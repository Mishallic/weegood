# Roadmap

Priorities: **P0** blocks the milestone, **P1** should ship with it, **P2** nice to have.
Each item has a one-line summary so the list is readable without opening tickets.

## M0: Foundation

- [x] npm-workspaces monorepo with shared TypeScript, ESLint and Prettier config.
- [x] Product brief, architecture overview and founding ADRs.
- [ ] `packages/core` with domain model, vibe math and a deterministic seeded catalog.
- [ ] Taste profile and explainable content-based recommendation engine, fully tested.
- [ ] Playlist, follow and local-track domain logic with repository contracts.

## M1: Web MVP

- [ ] **P0** App shell: layout, routing, design tokens, dark and light themes, player bar.
- [ ] **P0** IndexedDB persistence behind the core repository contracts.
- [ ] **P0** Onboarding questionnaire that seeds the taste profile; returning users skip it.
- [ ] **P0** Home feed with "For you", "Because you follow", "From people you follow", "Fresh vibes".
- [ ] **P0** Browse genres and artists with follow and unfollow.
- [ ] **P0** Playlists: create, rename, delete, add, remove, reorder.
- [ ] **P0** Local file import (MP3, WAV, FLAC, OGG, AAC) stored on-device and playable.
- [ ] **P0** Player: play, pause, previous, next, seek, volume, shuffle, repeat, queue.
- [ ] **P1** Likes and listen history continuously update the taste profile.
- [ ] **P1** People: demo profiles with public playlists; follow them.
- [ ] **P1** Search across tracks, artists, genres and people.
- [ ] **P1** Settings: export and import all data as JSON, reset profile.
- [ ] **P1** Keyboard shortcuts (space, arrows, `/` for search). Small, high perceived quality.
- [ ] **P1** Media Session API so lock screens and headsets control playback.
- [ ] **P2** Drag-and-drop reordering in playlists (buttons exist today, drag is nicer).
- [ ] **P2** Read ID3 and Vorbis tags from imported files instead of inferring from file names.

## M2: Concept validation

- [ ] **P0** Opt-in local analytics: count onboarding completion, recommendation acceptance,
      playlist creation. Shown to the user on the settings page; exportable for tester
      interviews. No network.
- [ ] **P0** In-app feedback on recommendations ("more like this", "not for me") wired into the
      profile with stronger weights than implicit signals.
- [ ] **P1** Service worker for offline shell and installability as a PWA.
- [ ] **P1** Accessibility audit: focus order, contrast, screen reader labels on the player.
- [ ] **P1** Vibe extraction for local files: estimate energy and tempo with Web Audio analysis so
      imported tracks participate in recommendations instead of sitting outside the model.
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
