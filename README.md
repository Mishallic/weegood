# Weegood

Music that gets your vibe.

Weegood is a lightweight, cross-platform music player with a taste-aware recommendation
engine, playlists, follows, and first-class support for the music you already own.

**Status:** pre-alpha. We are shipping a web MVP first to validate the concept, then bringing
the same core to mobile and desktop.

## What it does

- Learns your taste from a one-minute onboarding, or picks up where you left off on a return visit.
- Recommends tracks and artists by _vibe_, with a plain-language reason attached to every pick.
- Lets you build playlists and follow artists, genres and people.
- Plays your own MP3, WAV, FLAC and OGG files next to catalog tracks, inside the same playlists.
- Keeps everything on your device. No account is needed to start.

## Quickstart

Requires Node 24 (see `.node-version`). npm ships with Node, nothing else to install.

```sh
npm install
npm run dev        # web app on http://localhost:5173
npm test           # unit tests across all packages
npm run check      # typecheck + lint + format check (what CI runs)
npm run build      # production build of the web app
```

## Repository layout

```
weegood/
├─ apps/
│  └─ web/              React + Vite web app, the first client
├─ packages/
│  └─ core/             Platform-agnostic domain logic and recommendation engine (pure TypeScript)
├─ docs/
│  ├─ PRODUCT.md        Vision, personas, MVP scope and success metrics
│  ├─ ARCHITECTURE.md   How the pieces fit together
│  ├─ ROADMAP.md        Milestones and prioritised TODOs
│  └─ adr/              Architecture Decision Records
└─ .github/workflows/   Continuous integration
```

## Principles

1. **Lightweight by default.** Small bundle, system fonts, no UI framework. Fast on a cheap phone.
2. **Local-first, privacy-first.** Your taste profile, playlists and files live on your device.
   Sync is an upgrade, not a requirement.
3. **Explainable recommendations.** Every suggestion says why. No black boxes.
4. **One core, many shells.** Everything that is not pixels lives in `packages/core` so the
   mobile and desktop apps reuse it unchanged.

## Documentation

Start with [docs/PRODUCT.md](docs/PRODUCT.md), then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Decisions and their reasoning live in [docs/adr](docs/adr). Open work lives in
[docs/ROADMAP.md](docs/ROADMAP.md). Contribution conventions are in
[CONTRIBUTING.md](CONTRIBUTING.md).
