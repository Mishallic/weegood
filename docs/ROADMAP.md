# Roadmap

Priorities: **P0** blocks the milestone, **P1** should ship with it, **P2** nice to have.
Each item has a one-line summary so the list is readable without opening tickets.

## M0: Foundation (done 2026-10-17)

- [x] npm-workspaces monorepo with shared TypeScript, ESLint and Prettier config.
- [x] Product brief, architecture overview and founding ADRs.
- [x] `packages/core` with domain model and vibe math.
- [x] Taste profile and explainable recommendation engine, fully tested.
- [x] Playlist, follow and local-track domain logic with repository contracts.

## M1: Web MVP on real music (done 2026-10-17, two P2 items open)

- [x] **P0** Real, full-length music from Audius behind a provider interface; synthesiser and fake
      catalog removed from the product (ADR 0010).
- [x] **P0** Streaming through plain HTML5 audio with next-track prefetch and automatic skip past
      broken streams.
- [x] **P0** Genre taxonomy mapped to the provider, mood vocabulary, metadata vibe prior from
      genre, mood, tags, BPM and key.
- [x] **P0** Per-listener learned ranker (online logistic regression, prior-regularised) with
      reasons read from feature contributions (ADR 0011).
- [x] **P0** On-device audio analysis of the first 45 s of each played track, cached per track.
- [x] **P0** App shell, routing, design tokens, dark and light themes, player bar.
- [x] **P0** IndexedDB persistence v2: profile, playlists, follows, local tracks, streamed track
      and artist caches, measurements, listens.
- [x] **P0** Onboarding with live artists for the chosen genres; returning users skip it.
- [x] **P0** Home feed: for you, because you follow, from people you follow, big right now, fresh.
- [x] **P0** Browse, genre and artist pages on live data; follow and unfollow.
- [x] **P0** Playlists: own, liked, and any Audius playlist; save to library; vibe-seeded suggestions.
- [x] **P0** Local file import (MP3, WAV, FLAC, OGG, AAC) stored on-device and playable.
- [x] **P1** People: search, followed, related, curators behind trending playlists.
- [x] **P1** Search across Audius tracks, artists and playlists plus local files and own playlists.
- [x] **P1** Settings: profile and model insight, export and import with referenced tracks, reset.
- [x] **P1** Keyboard shortcuts and Media Session API.
- [ ] **P2** Drag-and-drop reordering in playlists (move buttons exist today).
- [ ] **P2** Read ID3 and Vorbis tags from imported files instead of inferring from file names.

Bundle at M1: see the CI job summary; the budget is 150 KB gzipped JavaScript.

## M2: Smarter, and validated

- [ ] **P0** Tester round: 20 to 30 people, two weeks, against the success criteria in PRODUCT.md.
- [ ] **P0** Real-browser end-to-end tests (Playwright) for onboarding, play, import and playlist
      flows. Unit and jsdom coverage exists; audio and file pickers need a real browser.
- [ ] **P0** Opt-in local analytics: onboarding completion, recommendation acceptance, playlist
      creation. Shown on the settings page; exportable for interviews. No network.
- [ ] **P1** Neural audio embeddings on device (YAMNet class probabilities or a small CLAP-style
      model, lazy-loaded and cached) to measure instrumentalness and genre far better than DSP
      features, behind the existing `MeasuredVibe` cache.
- [ ] **P1** AI DJ: a sentence ("something warm for a rainy drive") becomes a structured query,
      a ranked set and an explanation, using a model API with the listener's own key, stored on
      device. Optional layer; the local model stays the default.
- [ ] **P1** Spotify provider: Web Playback SDK for Premium subscribers with their own client id,
      so mainstream catalogs appear behind the same interface.
- [ ] **P1** Jamendo provider (free client id) for a second open catalog.
- [ ] **P1** Vibe analysis for imported local files at import time, so they participate in
      recommendations.
- [ ] **P1** "More like this" on every track, and "Not for me" feedback weighted above implicit
      signals ("Not for me" exists; the weighting review does not).
- [ ] **P1** Service worker for offline shell and installability as a PWA (manifest exists).
- [ ] **P1** Accessibility audit: focus order, contrast, screen reader labels on the player.
- [ ] **P2** Visual polish pass once tester feedback lands.

## M3: Platform

- [ ] **P0** Backend: accounts, sync of profile, playlists and follows. Repository contracts stay;
      an HTTP implementation is added and reconciled with the local one.
- [ ] **P0** Real social graph between Weegood listeners, on top of following Audius people.
- [ ] **P1** Collaborative filtering blended into the ranker as another feature once there is
      enough listening data. The device model stays as the cold-start path.
- [ ] **P2** Shared and collaborative playlists.

## M4: More platforms

- [ ] **P0** Mobile app with Expo reusing `packages/core` and the provider adapters, SQLite repos,
      native audio with background playback.
- [ ] **P1** Desktop with Tauri wrapping the web app; watch folders for local music.
- [ ] **P2** Car and TV surfaces once the mobile app is stable.

## Ideas parking lot

- Mood-of-the-day prompt that nudges the profile for a session without changing it permanently.
- "Vibe blend" playlists generated between two people who follow each other.
- Import listening history from other services to skip onboarding.
