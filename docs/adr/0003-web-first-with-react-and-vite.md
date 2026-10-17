# 0003. Web first, built with React and Vite

Date: 2026-10-17
Status: Accepted

## Context

We need to validate the concept (vibe-based recommendation, mixed local and catalog playlists,
following) with real testers in weeks, not quarters. A web app has zero install friction, ships
on every device with a browser, and its building blocks (Web Audio, IndexedDB, file inputs) cover
every MVP feature.

## Decision

- The first client is a web app in `apps/web`, built with React 19 and Vite.
- It is structured so that it can become an installable PWA (manifest now, service worker in M2).
- React is chosen over lighter frameworks because the mobile client will be React Native (Expo),
  so hooks, state and most feature logic can be shared or ported with minimal translation.

## Consequences

- Fast iteration with testers; no app store review cycle.
- Browser constraints shape the MVP: no background audio on iOS Safari when the tab is hidden, and
  file access is through the picker rather than folder watching. Both are acceptable for
  validation and are solved by the native shells later.
- We carry React's runtime weight (about 45 KB gzipped). We offset it everywhere else (see ADR 0007)
  and keep the initial bundle under the 150 KB budget set in the product brief.

## Alternatives considered

- Svelte or SolidJS: smaller runtime, but a second component model to maintain next to React
  Native.
- Electron or Tauri first: a download is friction we do not need while the concept is unproven.
- Native iOS first: slowest route to a testable product, single platform.
