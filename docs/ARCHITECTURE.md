# Architecture

## Shape

```
┌──────────────────────────────────────────────────────────────────┐
│  apps/web  (React + Vite)                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │Onboarding│ │  Home    │ │ Browse   │ │ Library  │ │ People  │ │  features/
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       └────────────┴───────────┬┴─────────────┴────────────┘      │
│                      ┌─────────┴─────────┐   ┌────────────────┐  │
│                      │ app store (zustand)│   │ player store   │  │  state/
│                      └─────────┬─────────┘   └───────┬────────┘  │
│                      ┌─────────┴─────────┐   ┌───────┴────────┐  │
│                      │ IndexedDB repos   │   │ audio engines  │  │  data/, audio/
│                      └─────────┬─────────┘   └───────┬────────┘  │
└────────────────────────────────┼─────────────────────┼───────────┘
                                 │ implements          │ plays
┌────────────────────────────────┴─────────────────────┴───────────┐
│  packages/core  (pure TypeScript, no DOM, no Node)               │
│  domain types · vibe math · taste profile · recommendation       │
│  playlists · follows · local tracks · repository contracts       │
│  seeded demo catalog                                             │
└──────────────────────────────────────────────────────────────────┘
```

The rule that keeps this honest: **`packages/core` never imports from a platform.** It exports
plain data types, pure functions and interfaces. Apps supply the implementations (storage, audio,
UI). When we build mobile (Expo) and desktop (Tauri), they bring their own `data/` and `audio/`
folders and reuse everything else.

## packages/core

| Module            | Responsibility                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| `domain/`         | Types (`Track`, `Artist`, `Genre`, `Playlist`, `User`, `Follow`, `TasteProfile`, `ListenEvent`) and vibe vector math |
| `recommendation/` | Taste profile construction and updates, mood anchors, the scoring and diversification engine, reason generation      |
| `playlists/`      | Pure playlist operations (create, add with de-duplication, remove, move, rename)                                     |
| `social/`         | Follow and unfollow helpers                                                                                          |
| `library/`        | Local file support: metadata inference from file names, supported formats, local `Track` construction                |
| `catalog/`        | Seeded demo catalog (genres, artists, tracks, demo people) generated deterministically                               |
| `repository/`     | Storage contracts and an in-memory implementation used by tests                                                      |
| `util/`           | Seeded PRNG, id generation                                                                                           |

Everything here is unit-tested with Vitest. The recommendation engine has property-style tests
(scores bounded, deterministic for a fixed input, diversity actually diversifies).

## apps/web

| Folder           | Responsibility                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`           | Root component, routes, layout shell                                                                                                                            |
| `features/*`     | One folder per screen; components that only that screen uses                                                                                                    |
| `components/`    | Shared UI primitives (buttons, chips, track rows, player bar, icons)                                                                                            |
| `state/`         | Zustand stores. `appStore` holds user data and talks to repositories; `playerStore` holds queue and playback state                                              |
| `data/`          | IndexedDB schema (`idb`) and repository implementations                                                                                                         |
| `audio/`         | `PlaybackEngine` interface with two implementations: `HtmlAudioEngine` for local files and `SynthEngine` for catalog demo tracks, behind one `PlayerController` |
| `styles/`        | Design tokens (CSS custom properties) and base styles                                                                                                           |
| `lib/`, `hooks/` | Small helpers                                                                                                                                                   |

### Data flow

1. On boot `appStore.hydrate()` loads profile, playlists, follows, local tracks and recent
   listens from IndexedDB. If no profile exists, the router sends the user to onboarding.
2. Onboarding answers go through `createProfileFromOnboarding` in core and are persisted.
3. Screens read from the stores and call core pure functions for recommendations, then render.
4. User actions (play, skip, like, follow, add to playlist) update the store, which persists
   through the repository and, where relevant, updates the taste profile via core.
5. The player controller emits position and end events; the player store records a `ListenEvent`
   that feeds back into the profile.

### Persistence (IndexedDB, database `weegood`, version 1)

| Store         | Key             | Contents                               |
| ------------- | --------------- | -------------------------------------- |
| `profile`     | `me`            | `TasteProfile`                         |
| `playlists`   | `id`            | `Playlist`                             |
| `follows`     | `kind:targetId` | `Follow`                               |
| `localTracks` | `id`            | `Track` whose source kind is `local`   |
| `audioBlobs`  | track `id`      | the audio `Blob`                       |
| `listens`     | auto-increment  | `ListenEvent` (capped, oldest trimmed) |

The repository contracts in `core/repository` mean a sync backend can be slotted in later without
touching features (see ADR 0004).

### Playback

Catalog demo tracks have no licensed audio, so `SynthEngine` renders a short, deterministic loop
with the Web Audio API from the track's vibe vector (tempo, major or minor key, brightness, drum
density) and loops it for the track's nominal duration. Local files play through an
`HTMLAudioElement` fed by a Blob URL. Both engines implement the same interface so the UI does
not care which one is active. See ADR 0006.

### Cross-platform plan

| Platform     | Shell                      | Reuses                                                                            |
| ------------ | -------------------------- | --------------------------------------------------------------------------------- |
| Web (now)    | React + Vite               | core                                                                              |
| Mobile (M4)  | Expo / React Native        | core, most state and feature logic; new UI primitives, SQLite repos, native audio |
| Desktop (M4) | Tauri wrapping the web app | core, web app as-is; native file access and tray                                  |

## Testing strategy

- `core`: exhaustive unit tests, no mocks needed because everything is pure.
- `web`: store tests against the in-memory repositories; repository tests against
  `fake-indexeddb`; a smoke render of the app shell. UI pixel tests are deferred until the design
  settles.
