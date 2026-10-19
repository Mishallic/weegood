# Weegood

Music that gets your vibe.

Weegood is a lightweight, cross-platform music player that streams real, full-length music from
[Audius](https://audius.co), learns your taste on your own device, explains every recommendation,
and plays the files you already own alongside everything else.

**Status:** pre-alpha. The web app is feature complete on real music and ready for a tester round
(see [docs/ROADMAP.md](docs/ROADMAP.md)). Mobile and desktop follow on the same core.

**Live:** https://mishallic.github.io/weegood/ , deployed from `main` on every push by GitHub Actions.

## What it does

- Streams real songs, full length, from an open music network. No account, no key, no licensing
  exposure for us. Every track links back to its artist on Audius.
- Learns your taste from a one-minute onboarding, then from every play, skip, like and follow,
  with a per-listener ranking model that trains on your device.
- Measures the audio of what you play, in your browser, to refine each track's vibe: loudness,
  brightness, bass, tempo, beat strength, key.
- Recommends tracks and artists with a plain-language reason attached to every pick.
- Lets you build playlists and follow artists, genres and people; what they repost and playlist
  feeds your home.
- Plays your own MP3, WAV, FLAC and OGG files next to streamed tracks, inside the same playlists.
- Keeps everything on your device. Nothing is sent anywhere but anonymous requests to the music
  network.

## Quickstart

Requires Node 24 (see `.node-version`). npm ships with Node, nothing else to install.

```sh
npm install
npm run dev        # web app on http://localhost:5173
npm test           # unit tests across all packages (offline)
npm run check      # typecheck + lint + format check (what CI runs)
npm run build      # production build of the web app
AUDIUS_LIVE=1 npx vitest run --project web src/providers/audius.live.test.ts   # hits the real API
```

## Repository layout

```
weegood/
├─ apps/
│  └─ web/              React + Vite web app: provider adapters, streaming engine, on-device analysis, UI
├─ packages/
│  └─ core/             Platform-agnostic domain, taxonomy, learned ranker, feature extraction (pure TypeScript)
├─ docs/
│  ├─ PRODUCT.md        Vision, personas, scope and success metrics
│  ├─ ARCHITECTURE.md   How the pieces fit together
│  ├─ ROADMAP.md        Milestones and prioritised TODOs
│  └─ adr/              Architecture Decision Records
└─ .github/workflows/   Continuous integration
```

## Principles

1. **Real music, honestly sourced.** Open networks and the listener's own accounts and files.
   Nothing scraped, nothing re-streamed against a service's terms.
2. **Lightweight by default.** Small bundle, system fonts, plain HTML5 audio for streaming.
3. **Local-first, privacy-first.** Taste profile, ranking model, playlists and files live on the
   device. Sync is an upgrade, not a requirement.
4. **Explainable recommendations.** The reason shown is the arithmetic that produced the score.
5. **One core, many shells.** Everything that is not pixels or platform APIs lives in
   `packages/core`.

## Documentation

Start with [docs/PRODUCT.md](docs/PRODUCT.md), then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Decisions and their reasoning live in [docs/adr](docs/adr); the two that matter most now are
[0010](docs/adr/0010-real-music-from-streaming-providers.md) and
[0011](docs/adr/0011-on-device-learned-ranking-and-audio-analysis.md). Open work lives in
[docs/ROADMAP.md](docs/ROADMAP.md). Contribution conventions are in [CONTRIBUTING.md](CONTRIBUTING.md).
