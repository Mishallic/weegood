# 0002. TypeScript monorepo with a platform-agnostic core

Date: 2026-10-17
Status: Accepted

## Context

The product must run on web first and on mobile and desktop later. The expensive, differentiating
logic (taste modelling, recommendation, playlist semantics, local-file handling) is the same on
every platform. The pixels are not. We want to write the logic once and test it once.

## Decision

- One repository, npm workspaces (`packages/*`, `apps/*`). npm ships with Node, so there is nothing
  to install; we revisit pnpm or Turborepo when the build graph is big enough to feel it.
- `packages/core` is pure TypeScript: no DOM, no Node, no framework imports. It exports types,
  pure functions and interfaces. ESLint enforces the import ban.
- Apps consume `@weegood/core` from source (`exports` points at `src/index.ts`). Bundlers compile
  it; there is no build step for the core during development. A `dist` build is added when we
  publish or when a non-bundler consumer appears.
- Shared TypeScript config in `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` on from day one. Loosening later is a decision; tightening later is
  a migration.

## Consequences

- Mobile (Expo) and desktop (Tauri) reuse the engine unchanged; they only implement storage and
  audio adapters and their own UI.
- Core tests run in Node with no mocks, in milliseconds.
- Developers must resist putting "just one" browser call into core. The lint rule and code review
  hold the line.

## Alternatives considered

- Flutter: excellent cross-platform story, but a heavier web output, a separate language from the
  web ecosystem we hire from, and no natural home for a shared TypeScript recommendation engine.
- Separate repositories per platform: duplicates the engine or forces a published package too
  early.
- pnpm + Turborepo now: better at scale, more moving parts than a two-package repo needs today.
