# Architecture

## Shape

```
┌──────────────────────────────────────────────────────────────────────┐
│  apps/web  (React + Vite)                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐     │
│  │Onboarding│ │  Home    │ │ Browse   │ │ Library  │ │ People  │     │  features/
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘     │
│       └────────────┴───────────┬┴─────────────┴────────────┘         │
│            ┌───────────────────┴──────────┐   ┌────────────────────┐ │
│            │ app store · player store     │   │ useQuery cache     │ │  state/, hooks/
│            └──────┬────────────┬──────────┘   └─────────┬──────────┘ │
│   ┌───────────────┴──┐  ┌──────┴────────┐  ┌────────────┴─────────┐  │
│   │ IndexedDB repos  │  │ StreamEngine  │  │ MusicProvider (Audius)│  │  data/, audio/, providers/
│   └───────────────┬──┘  │ + analyzer    │  └────────────┬─────────┘  │
└───────────────────┼─────┴──────┬────────┴───────────────┼────────────┘
                    │ implements │ decodes & measures      │ fetches
┌───────────────────┴────────────┴─────────────────────────┴────────────┐
│  packages/core  (pure TypeScript, no DOM, no Node)                    │
│  domain types · vibe math · genre & mood taxonomy · vibe prior        │
│  learned ranker · taste profile · engine · home feed                  │
│  audio feature extraction (FFT, tempo, chroma) · playlists · follows  │
│  repository contracts · test fixture catalog                          │
└───────────────────────────────────────────────────────────────────────┘
```

The rule that keeps this honest: **`packages/core` never imports from a platform.** It exports
plain data types, pure functions and interfaces. Apps supply the implementations (storage, audio,
network, UI). Mobile (Expo) and desktop (Tauri) bring their own `data/`, `audio/` and
`providers/` folders and reuse everything else.

## packages/core

| Module                              | Responsibility                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `domain/`                           | Types (`Track`, `Artist`, `Genre`, `Playlist`, `Follow`, `ListenEvent`, `MeasuredVibe`) and vibe vector math |
| `catalog/genres.ts`                 | Genre taxonomy with provider name mapping, hues and vibe priors                                              |
| `recommendation/moods.ts`           | Listener-facing mood groups and provider mood labels with vibe hints                                         |
| `recommendation/vibePrior`          | Best vibe estimate from metadata: genre, mood, tags, BPM, key; popularity from engagement                    |
| `recommendation/ranker`             | Per-listener logistic ranking model: prior weights, SGD training, contributions for reasons                  |
| `recommendation/tasteProfile`       | Profile construction, learning from listens/likes/follows, migration of older profiles                       |
| `recommendation/engine`             | Feature computation, scoring with the ranker, seed mode, diversification, reason generation                  |
| `recommendation/feed`               | Home feed composition: for you, follows, people, trending, fresh                                             |
| `analysis/`                         | FFT and feature extraction over PCM: loudness, centroid, bass, flatness, tempo, beat, mode                   |
| `playlists/`, `social/`, `library/` | Playlist operations, follow toggling, local file inference                                                   |
| `repository/`                       | Storage contracts and the in-memory implementation used by tests                                             |
| `catalog/seed.ts`                   | Deterministic fictional catalog, **test fixture only**                                                       |

Everything here is unit-tested with Vitest, including synthetic-signal tests for the audio features
and convergence tests for the ranker.

## apps/web

| Folder        | Responsibility                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `providers/`  | `MusicProvider` interface, the Audius adapter (mapping, user cache, stream URLs), a fake for tests                 |
| `audio/`      | `StreamEngine` (HTML5 audio, object URLs for local files, prefetch of the next track), the analyzer and its worker |
| `data/`       | IndexedDB schema v2 and repository implementations                                                                 |
| `state/`      | `appStore` (user data, caches, persistence) and `playerStore` (queue, listen accounting, error skip)               |
| `hooks/`      | `useQuery` (shared async cache), `useHomeCandidates`, `useRecommendationInput`, Media Session, shortcuts           |
| `features/*`  | One folder per screen                                                                                              |
| `components/` | Shared primitives                                                                                                  |
| `app/`        | Services wiring, stores, routes, entry point                                                                       |

### Data flow

1. On boot `appStore.hydrate()` loads profile (migrated to the current version), playlists, follows,
   local tracks, cached streamed tracks, cached artists, measured vibes and recent listens from
   IndexedDB. No profile sends the user to onboarding.
2. Onboarding pulls trending artists for the chosen genres from the provider and seeds the profile.
3. Home loads a candidate pool through `useHomeCandidates`: trending in the listener's top genres,
   rising tracks, followed artists' tracks, and followed people's reposts and playlists. The core
   feed ranks it with the listener's ranker and attaches reasons.
4. Playing a track resolves its stream URL at play time; the engine pre-buffers the next one.
   On first play the analyzer fetches ~45 s, extracts features in a worker, and stores a measured
   vibe that replaces the metadata prior everywhere.
5. Each listen is recorded with the feature vector it was scored with, so the ranker learns from the
   outcome. Likes, dislikes and follows update the profile directly.
6. Anything the listener touched (played, liked, playlisted, followed) is persisted so the library
   and history render offline and survive sessions.

### Persistence (IndexedDB, database `weegood`, version 2)

| Store           | Key             | Contents                                        |
| --------------- | --------------- | ----------------------------------------------- |
| `profile`       | `me`            | taste profile (any version; normalised on load) |
| `playlists`     | `id`            | own playlists                                   |
| `follows`       | `kind:targetId` | artist and genre follows                        |
| `localTracks`   | `id`            | imported files' metadata                        |
| `tracks`        | `id`            | streamed tracks the listener touched            |
| `artists`       | `id`            | followed and viewed artists                     |
| `measuredVibes` | `trackId`       | on-device audio measurements                    |
| `audioBlobs`    | track `id`      | imported audio                                  |
| `listens`       | auto            | listen events, capped                           |

### Cross-platform plan

| Platform     | Shell                      | Reuses                                                              |
| ------------ | -------------------------- | ------------------------------------------------------------------- |
| Web (now)    | React + Vite               | core                                                                |
| Mobile (M4)  | Expo / React Native        | core, stores, provider adapters; new UI, SQLite repos, native audio |
| Desktop (M4) | Tauri wrapping the web app | core, web app as-is; native file access and tray                    |

## Testing strategy

- `core`: exhaustive unit tests, no mocks needed because everything is pure.
- `web`: provider mapping against a saved real API payload; store tests against in-memory
  repositories and the fake provider; repository tests against `fake-indexeddb`; a smoke render of
  the app; an opt-in live test against the real Audius API (`AUDIUS_LIVE=1`).
