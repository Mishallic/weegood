# 0007. Lightweight UI stack: design tokens, wouter, zustand

Date: 2026-10-17
Status: Accepted

## Context

"Lightweight" is a product promise, not a vibe. The initial JS budget is 150 KB gzipped and the
UI is expected to change after tester feedback, so we should not invest in a heavy design system
yet, nor lock into one.

## Decision

- Styling: plain CSS with custom properties as design tokens (`styles/tokens.css`). Dark and light
  themes are token swaps. System font stack, no web fonts. Icons are a small inline SVG set.
- Routing: `wouter` (about 2 KB). We need a handful of routes and no data loaders.
- State: `zustand` (about 1 KB). Two stores: app data and player. No reducers, no boilerplate.
- Components are hand-written and small. No component library.

## Consequences

- Current estimate for the shell: React plus these libraries is under 60 KB gzipped, leaving ample
  budget for features.
- A visual redesign later touches tokens and components, not architecture.
- We write a few primitives ourselves (menu, dialog) that a library would give us for free. Each
  is under 100 lines and is a known trade.

## Alternatives considered

- Tailwind: great velocity, but adds a build dependency and class soup for a UI we expect to
  redesign; tokens give us the same consistency.
- MUI, Chakra, Mantine: 80 to 150 KB before we write a line; opinionated looks we would fight.
- react-router: fine, several times the size of wouter for features we do not use yet.
- Redux Toolkit: more structure than two stores need.
