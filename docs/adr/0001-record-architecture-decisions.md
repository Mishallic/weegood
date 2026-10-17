# 0001. Record architecture decisions

Date: 2026-10-17
Status: Accepted

## Context

Weegood is starting as a small team with an explicit plan to grow to several platforms. The
reasoning behind early choices evaporates quickly unless it is written down, and new teammates
otherwise re-open settled questions.

## Decision

We keep Architecture Decision Records in `docs/adr`, one file per decision, numbered, using the
template in `0000-template.md`. A decision is recorded when it is hard to reverse or when a
reasonable engineer would ask why.

## Consequences

Slightly more writing per significant change. Much less re-litigating. Reviewers can ask
"where is the ADR?" for anything structural.

## Alternatives considered

- Wiki pages: drift from the code and are not reviewed with it.
- Nothing: fine for a week, expensive for a year.
