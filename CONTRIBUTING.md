# Contributing

## Workflow

- `main` is always releasable. Work happens on short-lived branches: `feat/<topic>`, `fix/<topic>`,
  `docs/<topic>`, `chore/<topic>`.
- Every change comes with tests where logic lives. `packages/core` is pure and must stay fully
  unit-tested. UI changes include at least a smoke test when they touch state or data access.
- `npm run check && npm test` must pass before a PR is opened. CI runs the same commands.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<scope>): <imperative summary, lower case, no trailing period>

<body: what changed and why, wrapped at 72 columns. Mention trade-offs.>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`.
Scopes: `core`, `web`, `docs`, `ci`, or omitted for repo-wide changes.

## Decisions

Anything that is hard to reverse, or that a new teammate would ask "why?" about, gets an
Architecture Decision Record in `docs/adr`. Copy `docs/adr/0000-template.md`, number it, and link
it from `docs/adr/README.md`. ADRs are never edited after acceptance; supersede them instead.

## Code style

- TypeScript strict mode everywhere. No `any` without a comment explaining why.
- Prettier formats, ESLint lints. Do not argue with either in review.
- `packages/core` has no DOM, Node or framework imports. If you need one, you are in the wrong
  package.
- Prefer small pure functions and plain data. Classes only where lifecycle matters (audio engines,
  repositories).

## Pull requests

A PR description answers three questions: what changed, why, and how it was verified. Link the
roadmap item or ADR it advances. Keep PRs under roughly 400 lines of diff where possible; split
otherwise.
