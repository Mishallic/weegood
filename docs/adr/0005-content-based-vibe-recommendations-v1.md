# 0005. Recommendation v1 is content-based on vibe vectors, with reasons

Date: 2026-10-17
Status: Accepted

## Context

Day one has zero listening data, so collaborative filtering has nothing to filter. The product
also promises that every recommendation comes with a reason a person can read. We need a model
that works cold, is cheap to run on-device, and is explainable by construction.

## Decision

- Every track, artist and mood has a **vibe vector** with six dimensions in 0..1: energy, valence,
  danceability, acousticness, instrumentalness, tempo. The catalog authors these; a later
  ingestion pipeline computes them from audio.
- A **taste profile** holds a vibe vector, genre weights and artist affinities. Onboarding seeds
  it from chosen moods, genres and artists. Listening updates it with an exponential moving
  average: completed plays and likes pull the vector toward the track, skips push it away with a
  smaller weight.
- Scoring is a weighted sum of vibe similarity (normalised distance in vibe space) to the profile
  vector, genre affinity, artist affinity, follow boosts (artist, genre, people), with penalties for recently played and
  explicitly skipped tracks.
- Results are diversified with maximal marginal relevance so a feed is not twelve near-identical
  tracks, and capped per artist.
- Each result carries `reasons`: short strings generated from whichever terms dominated its score
  ("Matches your mellow, acoustic vibe", "Because you follow Paper Lanterns").
- The engine is pure, deterministic for a given input, and lives in `packages/core`.

## Consequences

- Works offline, on-device, instantly, from the first session.
- Quality is bounded by the hand-authored vibes of the demo catalog; this is fine for validating
  the interaction, not for judging final recommendation quality.
- Collaborative filtering (M3) will be blended in as another term rather than replacing this
  model, so cold-start and explainability survive.

## Alternatives considered

- Collaborative filtering first: nothing to learn from on day one, and explanations are weak.
- Large pre-trained audio embeddings: strong, but heavy to run on-device and opaque to explain.
  A good candidate to replace hand-authored vibes server-side later.
- Rules only ("same genre"): explainable but too blunt to feel personal.
